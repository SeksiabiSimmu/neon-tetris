// js/game.js
//
// Ties every other system together into actual Tetris rules. Game owns the
// active piece and all timing (gravity, lock delay); Board only answers
// "is this set of cells free"; Renderer only reads what Game exposes.
//
// Game modes (js/gameModes.js) plug into this same shared engine through a
// small hook interface — see the comment at the top of that file. Game
// consults `this.modeController` at a handful of well-defined points
// (gravity calculation, after a lock/clear resolves, on a would-be game
// over) instead of hardcoding per-mode checks, so a new mode never requires
// touching this file.
//
// Call update(dt, now) once per animation frame while playing, and
// render happens separately via Renderer — Game never touches a canvas.

TETRIS.Game = class Game {
  constructor({ input, audio, onStateChange, onRunStart, mode, modeConfig }) {
    this.board = new TETRIS.Board(TETRIS.CONFIG.COLS, TETRIS.CONFIG.ROWS);
    this.scoring = new TETRIS.Scoring();
    this.pieceQueue = new TETRIS.PieceQueue();
    this.input = input;
    this.audio = audio || null;
    this.onStateChange = onStateChange || (() => {});
    this.onRunStart = onRunStart || (() => {});

    this.state = TETRIS.GameState.READY;
    this.runId = 0;
    this.hardDropSequence = 0;
    this.lockSequence = 0;
    this.lastHardDropEvent = null;
    this.lastLockEvent = null;
    this._setMode(mode || 'endless', modeConfig);
    this.modeTimer = 0;
    this.piecesThisGame = 0;
    this.mistakesThisGame = 0; // holes created this run — a general board fact, not mode-specific
    this.zenClearing = false; // true while a mode-triggered "soft reset" flash is playing (see resolveClear)
    this.result = null; // null | 'topout' | 'win' | 'lose' | 'timeout', set right before GAME_OVER
    this.resultReason = ''; // human-readable reason shown on the Game Over screen

    this.activePiece = null;
    this.holdType = null;
    this.canHold = true;

    this.gravityTimer = 0;
    this.isSoftDropping = false;
    this.lockTimer = 0;
    this.lockResets = 0;

    // T-spin detection: true only when the piece's current position/rotation
    // was reached by a rotation, not a translation. Cleared on any move and
    // on every fresh spawn.
    this.lastActionWasRotation = false;
    this.lastRotationKickIndex = -1;

    // IRS/IHS-style buffering: a rotate or hold pressed while no piece is
    // active (e.g. the literal instant before one spawns) is remembered
    // and replayed against the very next piece instead of being dropped.
    this.bufferedAction = null; // { type: 'rotateCW' | 'rotateCCW' | 'hold', remainingMs }

    this.debugMode = TETRIS.CONFIG.DEBUG_MODE_DEFAULT;
    this.lastClearInfo = null;

    // While a row is flashing before removal, activePiece is null and the
    // board still physically holds the full rows — see resolveClear().
    this.clearingRows = null;
    this.clearTimer = 0;
    this._pendingTSpinType = null;

    this._bindInput();
  }

  _setMode(mode, modeConfig) {
    this.mode = mode;
    this.modeController = TETRIS.GAME_MODES[mode] || TETRIS.GAME_MODES.endless;
    this.modeConfig = Object.assign({}, this.modeController.defaultConfig, modeConfig);
  }

  _bindInput() {
    this.input.on('anyKey', () => {
      if (this.state === TETRIS.GameState.READY) this.start();
    });
    this.input.on('moveLeft', () => { if (this.tryMove(-1, 0)) this._playSound('move'); });
    this.input.on('moveRight', () => { if (this.tryMove(1, 0)) this._playSound('move'); });
    this.input.on('softDropStart', () => {
      if (this.state !== TETRIS.GameState.PLAYING || !this.activePiece || this.isSoftDropping) return;
      this.isSoftDropping = true;
      this._playSound('softDrop');
    });
    this.input.on('softDropEnd', () => { this.isSoftDropping = false; });
    this.input.on('rotateCW', () => { if (this.tryRotate(1)) this._playSound('rotate'); });
    this.input.on('rotateCCW', () => { if (this.tryRotate(-1)) this._playSound('rotate'); });
    this.input.on('hardDrop', () => this.hardDrop());
    this.input.on('hold', () => this.holdPiece());
    this.input.on('restart', () => this.restart());
    this.input.on('toggleDebug', () => { this.debugMode = !this.debugMode; });
    this.input.on('pause', () => this.togglePause());
  }

  setState(newState) {
    if (newState !== this.state && this.input.clearHeldKeys) this.input.clearHeldKeys();
    this.state = newState;
    this.onStateChange(newState);
  }

  _playSound(name) {
    if (this.audio) this.audio.play(name);
  }

  // --- lifecycle ---------------------------------------------------------

  start(mode, modeConfig) {
    this.runId += 1;
    if (this.input.clearHeldKeys) this.input.clearHeldKeys();
    if (mode) this._setMode(mode, modeConfig);
    this.modeTimer = 0;
    this.modeState = {};
    this.piecesThisGame = 0;
    this.mistakesThisGame = 0;
    this.zenClearing = false;
    this.result = null;
    this.resultReason = '';
    this.board.reset();
    this.scoring.reset();
    this.pieceQueue.reset();
    this.holdType = null;
    this.canHold = true;
    this.isSoftDropping = false;
    this.gravityTimer = 0;
    this.bufferedAction = null;
    this.lastClearInfo = null;
    this.clearingRows = null;
    this.clearTimer = 0;
    this._pendingTSpinType = null;
    this.onRunStart(this);
    if (this.modeController.onStart) this.modeController.onStart(this, this.modeConfig);
    this.spawnPiece();
    this.setState(TETRIS.GameState.PLAYING);
  }

  restart() {
    this.start(this.mode, this.modeConfig);
  }

  togglePause() {
    if (this.state === TETRIS.GameState.PLAYING) this.setState(TETRIS.GameState.PAUSED);
    else if (this.state === TETRIS.GameState.PAUSED) this.setState(TETRIS.GameState.PLAYING);
  }

  pause() {
    if (this.state === TETRIS.GameState.PLAYING) this.setState(TETRIS.GameState.PAUSED);
  }

  resume() {
    if (this.state === TETRIS.GameState.PAUSED) this.setState(TETRIS.GameState.PLAYING);
  }

  spawnPiece(typeOverride) {
    const type = typeOverride || this.pieceQueue.next();
    const piece = new TETRIS.Piece(type);

    if (!this.board.canPlace(piece.getCells())) {
      // The board is already full where this piece needs to appear
      // ("block out") — no valid game state to show it in. Whether that
      // actually ends the run is the mode's call (Zen intercepts it).
      this.activePiece = null;
      this._handleTopOut();
      return;
    }

    this.activePiece = piece;
    this.gravityTimer = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.lastActionWasRotation = false;
    this.lastRotationKickIndex = -1;
    this._consumeBufferedAction();
  }

  triggerGameOver() {
    if (!this.result) this.result = 'topout';
    this.setState(TETRIS.GameState.GAME_OVER);
  }

  // A would-be game over goes through the active mode first — Endless,
  // Sprint, Marathon, Time Attack, and Challenge all let it proceed
  // normally; Zen intercepts it and recovers the board instead.
  _handleTopOut() {
    const outcome = this.modeController.onTopOut ? this.modeController.onTopOut(this, this.modeConfig) : null;
    if (outcome && outcome.preventGameOver) {
      if (this.modeController.recoverFromTopOut) this.modeController.recoverFromTopOut(this, this.modeConfig);
      return;
    }
    this.triggerGameOver();
  }

  // Checked every frame and right after any lock/clear resolves. Returns
  // true if the mode ended the run (win/lose/timeout) this call.
  _checkEndCondition() {
    if (this.state !== TETRIS.GameState.PLAYING || !this.modeController.checkEndCondition) return false;
    const outcome = this.modeController.checkEndCondition(this, this.modeConfig);
    if (!outcome) return false;
    this.result = outcome.result;
    this.resultReason = outcome.reason || '';
    this.triggerGameOver();
    return true;
  }

  // --- input buffering -----------------------------------------------------

  _bufferAction(type) {
    const clearDelay = this.clearingRows
      ? Math.max(0, TETRIS.CONFIG.LINE_CLEAR_FLASH_MS - this.clearTimer)
      : 0;
    this.bufferedAction = {
      type,
      remainingMs: TETRIS.CONFIG.INPUT_BUFFER_MS + clearDelay,
    };
  }

  _consumeBufferedAction() {
    if (!this.bufferedAction || !this.activePiece) return;
    const { type, remainingMs } = this.bufferedAction;
    this.bufferedAction = null;
    if (remainingMs <= 0) return; // buffer expired while game time advanced
    if (type === 'rotateCW') this.tryRotate(1);
    else if (type === 'rotateCCW') this.tryRotate(-1);
    else if (type === 'hold') this.holdPiece();
  }

  // --- movement & rotation -------------------------------------------------

  isPieceGrounded() {
    const p = this.activePiece;
    return !this.board.canPlace(p.getCells(p.col, p.row + 1, p.rotation));
  }

  tryMove(dCol, dRow, playerAction = true) {
    if (this.state !== TETRIS.GameState.PLAYING || !this.activePiece) return false;
    const wasGrounded = this.isPieceGrounded();
    const piece = this.activePiece;
    const cells = piece.getCells(piece.col + dCol, piece.row + dRow, piece.rotation);
    if (!this.board.canPlace(cells)) return false;
    piece.col += dCol;
    piece.row += dRow;
    if (playerAction) {
      this.lastActionWasRotation = false;
      this.lastRotationKickIndex = -1;
    }
    this.afterSuccessfulMove(wasGrounded, playerAction);
    return true;
  }

  tryRotate(direction) {
    if (this.state !== TETRIS.GameState.PLAYING) return false;
    if (!this.activePiece) {
      this._bufferAction(direction === 1 ? 'rotateCW' : 'rotateCCW');
      return false;
    }
    const piece = this.activePiece;
    if (piece.type === 'O') return false; // symmetric — nothing to do

    const from = piece.rotation;
    const to = (from + direction + 4) % 4;
    const table = piece.type === 'I' ? TETRIS.KICKS.I : TETRIS.KICKS.JLSTZ;
    const kicks = table[`${from}->${to}`] || [[0, 0]];

    const wasGrounded = this.isPieceGrounded();
    for (let kickIndex = 0; kickIndex < kicks.length; kickIndex++) {
      const [dCol, dRow] = kicks[kickIndex];
      const cells = piece.getCells(piece.col + dCol, piece.row + dRow, to);
      if (this.board.canPlace(cells)) {
        piece.col += dCol;
        piece.row += dRow;
        piece.rotation = to;
        this.lastActionWasRotation = true;
        this.lastRotationKickIndex = kickIndex;
        this.afterSuccessfulMove(wasGrounded, true);
        return true;
      }
    }
    return false;
  }

  // After any successful move/rotation, refresh grounded/lock-delay state.
  // This runs whether the move came from gravity, soft drop, or the player
  // nudging a landed piece — landing (re)starts the countdown, and shifting
  // out over a gap resumes normal falling.
  afterSuccessfulMove(wasGrounded, playerAction) {
    const grounded = this.isPieceGrounded();
    if (grounded) this.gravityTimer = 0;
    if (playerAction && (wasGrounded || grounded) && this.lockResets < TETRIS.CONFIG.LOCK_DELAY_MAX_RESETS) {
      this.lockTimer = 0;
      this.lockResets += 1;
    } else if (!grounded && this.lockResets < TETRIS.CONFIG.LOCK_DELAY_MAX_RESETS) {
      this.lockTimer = 0;
    }
  }

  hardDrop() {
    if (this.state !== TETRIS.GameState.PLAYING || !this.activePiece) return;
    this._playSound('hardDrop');
    const piece = this.activePiece;
    const fromRow = piece.row;
    let dropped = 0;
    while (this.tryMove(0, 1, false)) dropped += 1;
    this.lastHardDropEvent = {
      id: ++this.hardDropSequence,
      type: piece.type,
      col: piece.col,
      fromRow,
      row: piece.row,
      rotation: piece.rotation,
    };
    this.scoring.addHardDrop(dropped);
    this.lockActivePiece();
  }

  holdPiece() {
    if (this.state !== TETRIS.GameState.PLAYING) return;
    if (!this.activePiece) {
      this._bufferAction('hold');
      return;
    }
    if (!this.canHold) return;
    const currentType = this.activePiece.type;

    if (this.holdType === null) {
      this.holdType = currentType;
      this.spawnPiece();
    } else {
      const swapType = this.holdType;
      this.holdType = currentType;
      this.spawnPiece(swapType);
    }
    this.canHold = false;
  }

  getGhostRow() {
    if (!this.activePiece) return null;
    const piece = this.activePiece;
    let testRow = piece.row;
    while (this.board.canPlace(piece.getCells(piece.col, testRow + 1, piece.rotation))) {
      testRow += 1;
    }
    return testRow;
  }

  // T-spin detection: the 3-corner rule. Only ever true right after a
  // rotation (not a translation) locks a T-piece with 3+ of its bounding
  // box's 4 corners occupied. Returns null, 'mini', or 'full'.
  detectTSpin() {
    const piece = this.activePiece;
    if (piece.type !== 'T' || !this.lastActionWasRotation) return null;
    const corners = TETRIS.T_SPIN_CORNERS[piece.rotation];
    const isFilled = ([dCol, dRow]) => !this.board.isCellFree(piece.col + dCol, piece.row + dRow);
    const frontFilled = corners.front.filter(isFilled).length;
    const backFilled = corners.back.filter(isFilled).length;
    if (frontFilled + backFilled < 3) return null;
    return frontFilled === 2 || this.lastRotationKickIndex === 4 ? 'full' : 'mini';
  }

  isBoardEmpty() {
    return this.board.grid.every((row) => row.every((cell) => cell === null));
  }

  // --- per-frame update ---------------------------------------------------

  update(dt, now) {
    if (this.state !== TETRIS.GameState.PLAYING) return;
    this.modeTimer += dt;
    if (this._checkEndCondition()) return; // time-based conditions (Time Attack, Challenge) need a per-frame check
    if (this.bufferedAction) this.bufferedAction.remainingMs -= dt;

    if (this.clearingRows) {
      this.clearTimer += dt;
      if (this.clearTimer >= TETRIS.CONFIG.LINE_CLEAR_FLASH_MS) {
        this.resolveClear();
      }
      return;
    }

    if (!this.activePiece) return;
    this.input.update(now);

    if (this.isPieceGrounded()) {
      this.lockTimer += dt;
      if (this.lockTimer >= TETRIS.CONFIG.LOCK_DELAY_MS) {
        this.lockActivePiece();
      }
      return;
    }

    const override = this.modeController.getGravityOverride
      ? this.modeController.getGravityOverride(this, this.modeConfig, this.scoring.gravityInterval)
      : null;
    const baseGravity = override != null ? override : this.scoring.gravityInterval;
    const interval = this.isSoftDropping ? Math.min(baseGravity, TETRIS.CONFIG.SOFT_DROP_MS) : baseGravity;

    this.gravityTimer += dt;
    if (this.gravityTimer >= interval) {
      this.gravityTimer = 0;
      const moved = this.tryMove(0, 1, this.isSoftDropping);
      if (moved && this.isSoftDropping) this.scoring.addSoftDrop(1);
    }
  }

  lockActivePiece() {
    this._playSound('lock');
    const tSpinType = this.detectTSpin();
    const holesBefore = this.board.countHoles();
    const cells = this.activePiece.getCells();
    this.lastLockEvent = {
      id: ++this.lockSequence,
      type: this.activePiece.type,
      col: this.activePiece.col,
      row: this.activePiece.row,
      rotation: this.activePiece.rotation,
      cells: cells.map(({ col, row }) => ({ col, row })),
    };
    const wentAboveBoard = cells.some((c) => c.row < 0);
    this.board.lockCells(cells, this.activePiece.type);
    this.piecesThisGame += 1;
    this.mistakesThisGame += Math.max(0, this.board.countHoles() - holesBefore);
    this.activePiece = null;

    if (wentAboveBoard) {
      // Part of the piece never made it onto the visible board ("lock out").
      this._handleTopOut();
      return;
    }

    const fullRows = this.board.getFullRows();

    if (fullRows.length > 0) {
      // Hold the actual removal/scoring/next-spawn until the flash plays
      // out, so the renderer gets a beat where these rows are visibly
      // "about to clear" rather than vanishing the instant they lock.
      this.clearingRows = fullRows;
      this.clearTimer = 0;
      this._pendingTSpinType = tSpinType;
      return;
    }

    let clearInfo = null;
    if (tSpinType) {
      clearInfo = this.scoring.registerClear({ linesCleared: 0, tSpinType, isPerfectClear: false });
      this.lastClearInfo = clearInfo;
      this._playSound('tspin');
    } else {
      this.scoring.registerNonClearingLock();
    }

    if (this.modeController.onClearResolved) {
      this.modeController.onClearResolved(this, this.modeConfig, clearInfo || { linesCleared: 0, tSpinType: null, isPerfectClear: false });
    }
    if (this._checkEndCondition()) return;

    this.canHold = true;
    this.spawnPiece();
  }

  // Runs once the line-clear flash timer expires: actually removes the
  // rows, scores the clear (including perfect-clear detection, which needs
  // the post-removal board), and spawns the next piece.
  resolveClear() {
    if (this.zenClearing) {
      // A mode-triggered "soft reset" (see Zen's recoverFromTopOut) reused
      // this same flash for its visual, but it isn't a real clear — no
      // scoring, no mode hooks, just an empty board to keep playing on.
      this.zenClearing = false;
      this.clearingRows = null;
      this.clearTimer = 0;
      this.board.reset();
      this.canHold = true;
      this.spawnPiece();
      return;
    }

    const rows = this.clearingRows;
    const tSpinType = this._pendingTSpinType;
    this.clearingRows = null;
    this.clearTimer = 0;
    this._pendingTSpinType = null;

    this.board.clearRows(rows);
    const isPerfectClear = this.isBoardEmpty();
    this.lastClearInfo = this.scoring.registerClear({ linesCleared: rows.length, tSpinType, isPerfectClear });
    if (this.lastClearInfo.tSpinType) this._playSound('tspin');
    if (rows.length === 4) this._playSound('tetris');
    else if (rows.length > 0) this._playSound('lineClear');
    if (this.lastClearInfo.comboCount > 0) this._playSound('combo');
    if (this.lastClearInfo.leveledUp) this._playSound('levelUp');

    if (this.modeController.onClearResolved) {
      this.modeController.onClearResolved(this, this.modeConfig, this.lastClearInfo);
    }
    if (this._checkEndCondition()) return;

    this.canHold = true;
    this.spawnPiece();
  }
};
