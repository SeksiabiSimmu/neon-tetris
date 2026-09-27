import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLegacyContext } from './helpers/legacyContext.js';

const TETRIS = loadLegacyContext(
  'constants.js', 'gameState.js', 'piece.js', 'board.js', 'pieceQueue.js', 'scoring.js', 'gameModes.js', 'game.js', 'input.js',
).TETRIS;

class MockInput {
  constructor() { this.handlers = new Map(); }
  on(name, callback) {
    if (!this.handlers.has(name)) this.handlers.set(name, []);
    this.handlers.get(name).push(callback);
  }
  emit(name, payload) { (this.handlers.get(name) || []).forEach((callback) => callback(payload)); }
  clearHeldKeys() {}
  update() {}
}

function startGame() {
  const input = new MockInput();
  const game = new TETRIS.Game({ input });
  game.start();
  return { game, input };
}

test('JLSTZ and I pieces use their distinct SRS wall-kick candidates', () => {
  const { game } = startGame();
  game.activePiece = new TETRIS.Piece('T');
  game.activePiece.col = 7;
  game.activePiece.row = 5;
  game.board.grid[7][8] = 'X'; // blocks the first rotation, but not its left-kick candidate
  assert.equal(game.tryRotate(1), true);
  assert.equal(game.activePiece.rotation, 1);
  assert.equal(game.activePiece.col, 6);
  assert.equal(game.lastRotationKickIndex, 1);

  const second = startGame().game;
  second.activePiece = new TETRIS.Piece('I');
  second.activePiece.col = 7;
  second.activePiece.row = 5;
  second.activePiece.rotation = 1;
  assert.equal(second.tryRotate(1), true);
  assert.equal(second.activePiece.rotation, 2);
  assert.equal(second.activePiece.col, 6);
  assert.equal(second.lastRotationKickIndex, 1);
});

test('lock delay gives a grounded piece time, then locks it once', () => {
  const { game } = startGame();
  game.activePiece = new TETRIS.Piece('T');
  game.activePiece.col = 3;
  game.activePiece.row = TETRIS.CONFIG.ROWS - 2;
  const groundedPiece = game.activePiece;

  game.update(TETRIS.CONFIG.LOCK_DELAY_MS - 1, 499);
  assert.equal(game.activePiece, groundedPiece);
  assert.equal(game.lastLockEvent, null);
  game.update(1, 500);
  assert.equal(game.lastLockEvent.id, 1);
  assert.equal(game.lastLockEvent.cells.length, 4);
  assert.notEqual(game.activePiece, groundedPiece);
});

test('hold is available once per lock and ghost projection reaches the floor', () => {
  const { game } = startGame();
  game.activePiece = new TETRIS.Piece('T');
  const firstType = game.activePiece.type;
  game.holdPiece();
  const heldType = game.holdType;
  const afterFirstHold = game.activePiece.type;
  assert.equal(heldType, firstType);
  assert.equal(game.canHold, false);
  game.holdPiece();
  assert.equal(game.activePiece.type, afterFirstHold);
  game.hardDrop();
  assert.equal(game.canHold, true);
  game.holdPiece();
  assert.equal(game.activePiece.type, firstType);
  assert.equal(game.canHold, false);

  const ghostGame = startGame().game;
  ghostGame.activePiece = new TETRIS.Piece('T');
  ghostGame.activePiece.col = 3;
  ghostGame.activePiece.row = 0;
  assert.equal(ghostGame.getGhostRow(), TETRIS.CONFIG.ROWS - 2);
});

test('soft drop advances one cell and awards the configured drop score', () => {
  const { game } = startGame();
  game.activePiece = new TETRIS.Piece('T');
  game.activePiece.row = 0;
  game.isSoftDropping = true;
  game.update(TETRIS.CONFIG.SOFT_DROP_MS, TETRIS.CONFIG.SOFT_DROP_MS);
  assert.equal(game.activePiece.row, 1);
  assert.equal(game.scoring.score, TETRIS.CONFIG.SOFT_DROP_POINTS_PER_CELL);
});

test('hard drop preserves a just-completed T rotation for spin detection', () => {
  const { game } = startGame();
  game.activePiece = new TETRIS.Piece('T');
  game.activePiece.col = 3;
  game.activePiece.row = 14;
  game.board.canPlace = (cells) => cells.every(({ row }) => row < 18);
  const occupiedCorners = new Set(['5,15', '5,17', '3,15']);
  game.board.isCellFree = (col, row) => !occupiedCorners.has(`${col},${row}`);
  assert.equal(game.tryRotate(1), true);
  let detectedSpin = null;
  game.lockActivePiece = () => { detectedSpin = game.detectTSpin(); };

  game.update(TETRIS.CONFIG.BASE_GRAVITY_MS, TETRIS.CONFIG.BASE_GRAVITY_MS);
  assert.equal(game.activePiece.row, 15);
  assert.equal(game.lastActionWasRotation, true);
  game.hardDrop();
  assert.equal(detectedSpin, 'full');
  assert.equal(game.lastRotationKickIndex, 0);
});

test('scoring keeps combo and back-to-back chains, perfect clears, and level progression', () => {
  const scoring = new TETRIS.Scoring();
  const first = scoring.registerClear({ linesCleared: 4 });
  const second = scoring.registerClear({ linesCleared: 4 });
  assert.equal(first.baseScore, 800);
  assert.equal(first.backToBackApplied, false);
  assert.equal(second.backToBackApplied, true);
  assert.equal(second.comboCount, 1);
  assert.ok(second.comboScore > 0);
  const perfectClear = scoring.registerClear({ linesCleared: 1, isPerfectClear: true });
  assert.ok(perfectClear.perfectClearScore > 0);
  assert.equal(scoring.backToBack, false);
  const tSpin = scoring.registerClear({ linesCleared: 1, tSpinType: 'full' });
  assert.equal(tSpin.baseScore, TETRIS.SCORE_TABLE.T_SPIN.full[1]);

  scoring.reset();
  for (let index = 0; index < TETRIS.CONFIG.LINES_PER_LEVEL; index += 1) {
    scoring.registerClear({ linesCleared: 1 });
  }
  assert.equal(scoring.lines, TETRIS.CONFIG.LINES_PER_LEVEL);
  assert.equal(scoring.level, 2);
});

test('DAS and ARR repeat on game timing rather than operating-system key repeat', () => {
  const input = new TETRIS.InputHandler();
  let moves = 0;
  input.on('moveLeft', () => { moves += 1; });
  input.handleKeyDown({ code: 'ArrowLeft', repeat: false, preventDefault() {} });
  assert.equal(moves, 1);
  input.update(TETRIS.CONFIG.DAS_MS - 1);
  assert.equal(moves, 1);
  input.update(TETRIS.CONFIG.DAS_MS);
  assert.equal(moves, 2);
  input.update(TETRIS.CONFIG.DAS_MS + TETRIS.CONFIG.ARR_MS - 1);
  assert.equal(moves, 2);
  input.update(TETRIS.CONFIG.DAS_MS + TETRIS.CONFIG.ARR_MS);
  assert.equal(moves, 3);
  input.handleKeyUp({ code: 'ArrowLeft' });
  input.update(1000);
  assert.equal(moves, 3);
});

test('a blocked spawn enters game over without corrupting the run state', () => {
  const { game } = startGame();
  game.board.grid.slice(0, 4).forEach((row) => row.fill('X'));
  game.spawnPiece();
  assert.equal(game.state, TETRIS.GameState.GAME_OVER);
  assert.equal(game.result, 'topout');
  assert.equal(game.activePiece, null);
});
