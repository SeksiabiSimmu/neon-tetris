// js/effectsManager.js
//
// The reusable "game feel" system. Everything here is *observational*: it
// watches Game/Scoring/Board state each frame and reacts, but never calls
// into Game or mutates it — gameplay stays fully decoupled from
// presentation. Every trigger method below (spawnRing,
// pulseGrid, particles.spawnBurst) is generic and reusable on its own;
// the "what happens for a Tetris vs a Single" choreography is just this
// file calling those generic primitives with different numbers, all of
// which live in TETRIS.VFX / TETRIS.VISUAL so they can be retuned in one
// place without touching this logic.

TETRIS.EffectsManager = class EffectsManager {
  constructor(glow, particles, pieceColors) {
    this.glow = glow;
    this.particles = particles; // a board-local ParticleRenderer, shared for ambience + every burst below
    this.pieceColors = pieceColors || TETRIS.COLORS; // shared reference with Renderer — cosmetics update it in place
    this.clearFlashColor = '#ffffff'; // overridable by the equipped clear-effect cosmetic
    this.clearAccentColor = null;
    this.clearParticleShape = 'spark';
    this.reducedMotion = false;
    this.clock = 0;

    // Piece trail + lock/impact detection.
    this.trail = [];
    this.prevPieceType = null;
    this.prevPieceRow = null;
    this.prevPieceRef = null;
    this.visualPiece = null;
    this.dropMotion = null;

    // Line-clear lifecycle.
    this.prevClearingRows = null;
    this._lastClearInfoSeen = null;
    this._lastHardDropId = 0;
    this._lastLockId = 0;
    this.collapseShift = null;
    this.collapseElapsed = 0;

    // Reusable primitives.
    this.rings = []; // { x, y, color, maxRadius, delay, life, maxLife, lineWidth }
    this.gridPulse = 0; // 0-1, decays; drawGridLines reads this to brighten briefly
  }

  // --- generic, reusable trigger API --------------------------------------

  spawnRing(x, y, color, maxRadius, options = {}) {
    if (this.reducedMotion) return;
    this.rings.push({
      x, y, color, maxRadius,
      delay: options.delay || 0,
      life: 0,
      maxLife: options.life || TETRIS.VFX.RING_LIFETIME_MS,
      lineWidth: options.lineWidth || TETRIS.VFX.RING_LINE_WIDTH,
    });
  }

  pulseGrid(amount = 1) {
    if (this.reducedMotion) return;
    this.gridPulse = Math.max(this.gridPulse, amount);
  }

  reset(game) {
    this.trail.length = 0;
    this.prevPieceType = null;
    this.prevPieceRow = null;
    this.prevPieceRef = null;
    this.visualPiece = null;
    this.dropMotion = null;
    this.prevClearingRows = null;
    this._lastClearInfoSeen = null;
    if (game) {
      this._lastHardDropId = game.hardDropSequence;
      this._lastLockId = game.lockSequence;
    }
    this.collapseShift = null;
    this.collapseElapsed = 0;
    this.rings.length = 0;
    this.gridPulse = 0;
    this.particles.clearTransient();
  }

  // How far (in px) a given board row should currently be drawn offset by,
  // for the "rows smoothly drop into place" animation after a clear.
  getRowOffset(row, cellSize) {
    if (this.reducedMotion || !this.collapseShift || this.collapseElapsed >= TETRIS.VFX.COLLAPSE_MS) return 0;
    const shift = this.collapseShift[row] || 0;
    if (!shift) return 0;
    const progress = Math.min(1, this.collapseElapsed / TETRIS.VFX.COLLAPSE_MS);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    return shift * cellSize * (1 - eased);
  }

  // --- per-frame update ----------------------------------------------------

  update(dt, game, boardWidth, cellSize) {
    this.clock += dt;

    this._updatePieceAndTrail(dt, game);
    if (game.lastHardDropEvent && game.lastHardDropEvent.id !== this._lastHardDropId) {
      this._lastHardDropId = game.lastHardDropEvent.id;
      this._reactToHardDrop(game.lastHardDropEvent, boardWidth, cellSize);
    }
    if (game.lastLockEvent && game.lastLockEvent.id !== this._lastLockId) {
      this._lastLockId = game.lastLockEvent.id;
      this._spawnLockSettle(game.lastLockEvent, boardWidth, cellSize);
    }
    this._updateClearTransitions(game, boardWidth, cellSize);
    if (this.dropMotion) {
      this.dropMotion.age += dt;
      if (this.dropMotion.age >= this.dropMotion.life || this.reducedMotion) this.dropMotion = null;
    }

    if (game.lastClearInfo && game.lastClearInfo !== this._lastClearInfoSeen) {
      this._lastClearInfoSeen = game.lastClearInfo;
      this._reactToClear(game.lastClearInfo, boardWidth, cellSize, game.board.rows);
    }

    this.rings.forEach((r) => { if (r.delay > 0) r.delay -= dt; else r.life += dt; });
    this.rings = this.rings.filter((r) => r.delay > 0 || r.life < r.maxLife);

    if (this.reducedMotion) this.rings.length = 0;
    if (this.collapseShift) {
      this.collapseElapsed += dt;
      if (this.collapseElapsed >= TETRIS.VFX.COLLAPSE_MS) {
        this.collapseShift = null;
        this.collapseElapsed = 0;
      }
    }
    if (this.gridPulse > 0) this.gridPulse = Math.max(0, this.gridPulse - dt / TETRIS.VFX.GRID_PULSE_DECAY_MS);

    this.particles.update(dt);
  }

  _updatePieceAndTrail(dt, game) {
    const piece = game.activePiece;

    if (piece) {
      const target = piece.getCells().map(({ col, row }) => ({ col, row }));
      const state = `${piece.col}:${piece.row}:${piece.rotation}`;
      const motion = this.visualPiece;
      if (!motion || motion.ref !== piece || this.reducedMotion) {
        this.visualPiece = { ref: piece, state, from: target, to: target,
          age: 1, life: 1, rotation: piece.rotation, row: piece.row };
      } else if (motion.state !== state) {
        const t = 1 - (1 - Math.min(1, motion.age / motion.life)) ** 3;
        const from = motion.to.map((cell, index) => ({
          col: motion.from[index].col + (cell.col - motion.from[index].col) * t,
          row: motion.from[index].row + (cell.row - motion.from[index].row) * t,
        }));
        this.visualPiece = { ref: piece, state, from, to: target, age: 0,
          life: piece.rotation !== motion.rotation ? 125 : piece.row !== motion.row ? 70 : 85,
          rotation: piece.rotation, row: piece.row };
      }
      this.visualPiece.age = Math.min(this.visualPiece.life, this.visualPiece.age + dt);
      if (this.prevPieceRef !== piece) {
        this.trail = []; // a brand-new piece shouldn't inherit a trail from whatever came before it
        this.prevPieceRow = piece.row;
        this.prevPieceRef = piece;
      } else if (piece.row !== this.prevPieceRow) {
        const jump = piece.row - this.prevPieceRow;
        if (jump > 2 && !this.reducedMotion) {
          const steps = Math.min(jump, TETRIS.VISUAL.TRAIL_MAX_STEPS);
          for (let i = 0; i < steps; i++) {
            const row = this.prevPieceRow + Math.round((jump * i) / steps);
            this.trail.push({ row, col: piece.col, rotation: piece.rotation, type: piece.type, age: 0 });
          }
        } else if (!this.reducedMotion) {
          this.trail.push({ row: this.prevPieceRow, col: piece.col, rotation: piece.rotation, type: piece.type, age: 0 });
        }
        this.prevPieceRow = piece.row;
      }
      this.prevPieceType = piece.type;
    } else {
      this.visualPiece = null;
      this.prevPieceRef = null;
      this.prevPieceType = null;
      this.prevPieceRow = null;
    }

    this.trail.forEach((s) => { s.age += dt; });
    this.trail = this.trail.filter((s) => s.age < TETRIS.VISUAL.TRAIL_LIFETIME_MS);
    while (this.trail.length > TETRIS.VISUAL.TRAIL_MAX_STEPS) this.trail.shift();
  }

  getVisualPieceCells(piece) {
    const motion = this.visualPiece;
    if (!piece || !motion || motion.ref !== piece) return piece?.getCells() || [];
    const t = 1 - (1 - Math.min(1, motion.age / motion.life)) ** 3;
    return motion.to.map((cell, index) => ({
      col: motion.from[index].col + (cell.col - motion.from[index].col) * t,
      row: motion.from[index].row + (cell.row - motion.from[index].row) * t,
    }));
  }

  getDropCells() {
    const drop = this.dropMotion;
    if (!drop) return [];
    const t = 1 - (1 - Math.min(1, drop.age / drop.life)) ** 3;
    const row = drop.event.fromRow + (drop.event.row - drop.event.fromRow) * t;
    return TETRIS.SHAPES[drop.event.type][drop.event.rotation]
      .map(([dc, dr]) => ({ col: drop.event.col + dc, row: row + dr, type: drop.event.type }));
  }

  isDropCellHidden(col, row) {
    return !!this.dropMotion?.locked.has(`${col}:${row}`);
  }

  _updateClearTransitions(game, boardWidth, cellSize) {
    if (game.clearingRows && !this.prevClearingRows) {
      this._startClearFlash(game.clearingRows, boardWidth, cellSize);
    } else if (!game.clearingRows && this.prevClearingRows) {
      this._startCollapse(this.prevClearingRows, game.board.rows);
    }
    this.prevClearingRows = game.clearingRows;
  }

  // --- reactions: the actual "game feel" choreography -----------------------

  // Fires the instant rows start flashing — differentiated purely by how
  // many lines (Single/subtle through Tetris/spectacular), since the
  // richer context (T-spin, perfect clear, combo) isn't known until the
  // clear resolves a beat later (see _reactToClear).
  _startClearFlash(rows, boardWidth, cellSize) {
    const intensity = TETRIS.VFX.LINE_CLEAR_INTENSITY[rows.length] || 0.5;

    rows.forEach((row) => {
      const y = (row + 0.5) * cellSize;
      const particleCount = Math.round(TETRIS.VFX.LINE_CLEAR_PARTICLES_BASE * intensity);
      const fragmentCount = Math.round(TETRIS.VFX.LINE_CLEAR_FRAGMENTS_BASE * intensity);
      for (let i = 0; i < particleCount; i++) {
        this.particles.spawnBurst(Math.random() * boardWidth, y, this.clearFlashColor, 1, {
          speed: 100 + 120 * intensity, life: 500 + 300 * intensity, shape: 'spark', trail: intensity > 0.7,
        });
      }
      for (let i = 0; i < fragmentCount; i++) {
        this.particles.spawnBurst(Math.random() * boardWidth, y, this.clearFlashColor, 1, {
          speed: 60 + 80 * intensity, life: 450, shape: this.clearParticleShape, sizeMin: 2, sizeMax: 4,
        });
      }
    });

    if (rows.length >= TETRIS.VFX.LINE_CLEAR_RING_THRESHOLD) {
      const centerY = (rows[Math.floor(rows.length / 2)] + 0.5) * cellSize;
      this.spawnRing(boardWidth / 2, centerY, this.clearAccentColor || this.clearFlashColor, boardWidth * 0.65, { life: 420 });
    }


    this.pulseGrid(intensity);
  }

  // Fires once the clear resolves and we know what it actually was —
  // this is where T-spins, perfect clears, combos, and level-ups get their
  // own recognizable identity on top of the base line-clear feedback above.
  _reactToClear(info, boardWidth, cellSize, boardRows) {
    const cx = boardWidth / 2;
    const cy = (cellSize * boardRows) / 2;

    if (info.isPerfectClear) {
      // The rarest, most special moment in the game — it gets the whole
      // frame to itself rather than competing with combo/level-up rings.
      const color = this.clearAccentColor || TETRIS.VFX.PERFECT_CLEAR_COLOR;
      for (let i = 0; i < TETRIS.VFX.PERFECT_CLEAR_RING_COUNT; i++) {
        this.spawnRing(cx, cy, color, boardWidth * (0.4 + i * 0.22), { delay: i * 90, life: 650 });
      }
      this.particles.spawnBurst(cx, cy, color, TETRIS.VFX.PERFECT_CLEAR_PARTICLES, {
        speed: 160, life: 900, shape: this.clearParticleShape, trail: true,
      });
      this.pulseGrid(1);
      return;
    }

    if (info.tSpinType) {
      const color = this.clearAccentColor || TETRIS.VFX.T_SPIN_COLOR;
      for (let i = 0; i < TETRIS.VFX.T_SPIN_RING_COUNT; i++) {
        this.spawnRing(cx, cy, color, boardWidth * (0.3 + i * 0.18), { delay: i * 70, life: 450 });
      }
      this.particles.spawnBurst(cx, cy, color, 30, { speed: 110, life: 500, shape: this.clearParticleShape });
    }

    if (info.leveledUp) {
      this.spawnRing(cx, cy, '#ffffff', boardWidth * 0.9, { life: TETRIS.VFX.LEVEL_UP_FLASH_MS });
      for (let i = 1; i < TETRIS.VFX.LEVEL_UP_RING_COUNT; i++) {
        this.spawnRing(cx, cy, '#4dd8ff', boardWidth * (0.3 + i * 0.16), { delay: i * 80, life: 600 });
      }
      this.particles.spawnBurst(cx, cy, '#ffffff', TETRIS.VFX.LEVEL_UP_PARTICLES, { speed: 140, life: 800, trail: true });
      this.pulseGrid(1);
    }

    if (info.comboCount > 0) {
      const tier = Math.min(1, info.comboCount / TETRIS.VFX.COMBO_MAX_TIER_COUNT);
      const ringCount = 1 + Math.round(tier * 3);
      for (let i = 0; i < ringCount; i++) {
        this.spawnRing(cx, cy, this.clearAccentColor || '#ffd84d', boardWidth * (0.25 + i * 0.15), { delay: i * 60, life: 400 });
      }
      this.particles.spawnBurst(cx, cy, this.clearAccentColor || '#ffd84d', Math.round(10 + tier * 30), {
        speed: 90 + tier * 60, life: 450, shape: this.clearParticleShape,
      });
    }
  }

  _reactToHardDrop(event, boardWidth, cellSize) {
    if (this.reducedMotion) return;
    this.dropMotion = {
      event, age: 0, life: 125,
      locked: new Set(TETRIS.SHAPES[event.type][event.rotation]
        .map(([dc, dr]) => `${event.col + dc}:${event.row + dr}`)),
    };
    const color = this.pieceColors[event.type];
    const shape = TETRIS.SHAPES[event.type][event.rotation];
    const minCol = Math.min(...shape.map(([col]) => col));
    const maxCol = Math.max(...shape.map(([col]) => col));
    const maxRow = Math.max(...shape.map(([, row]) => row));
    const cx = Math.max(0, Math.min(boardWidth, (event.col + (minCol + maxCol + 1) / 2) * cellSize));
    const cy = (event.row + maxRow + 0.5) * cellSize;
    const jump = event.row - event.fromRow;
    if (jump > 2) {
      const steps = Math.min(jump, TETRIS.VISUAL.TRAIL_MAX_STEPS);
      for (let i = 0; i < steps; i++) {
        const row = event.fromRow + Math.round((jump * i) / steps);
        this.trail.push({ row, col: event.col, rotation: event.rotation, type: event.type, age: 0 });
      }
    }
    this.particles.spawnBurst(cx, cy, color, 10, { speed: 70, life: 380 });
    this.spawnRing(cx, cy, color, cellSize * 2.2, { life: 260, lineWidth: 2 });
  }

  // Subtle feedback for *every* lock, hard-dropped or naturally settled —
  // deliberately much smaller than the hard-drop impact above.
  _spawnLockSettle(event, boardWidth, cellSize) {
    if (this.reducedMotion) return;
    if (!event.cells || !event.cells.length) return;
    const color = this.pieceColors[event.type];
    const minCol = Math.min(...event.cells.map((cell) => cell.col));
    const maxCol = Math.max(...event.cells.map((cell) => cell.col));
    const maxRow = Math.max(...event.cells.map((cell) => cell.row));
    const cx = Math.max(0, Math.min(boardWidth, ((minCol + maxCol + 1) / 2) * cellSize));
    const cy = (maxRow + 1) * cellSize;
    this.particles.spawnBurst(cx, cy, color, TETRIS.VFX.LOCK_SETTLE_PARTICLES, { speed: 35, life: 260 });
  }

  _startCollapse(clearedRowsOriginal, totalRows) {
    const k = clearedRowsOriginal.length;
    const clearedSet = new Set(clearedRowsOriginal);
    const remainingOriginal = [];
    for (let i = 0; i < totalRows; i++) {
      if (!clearedSet.has(i)) remainingOriginal.push(i);
    }
    const shift = new Array(totalRows).fill(0);
    for (let j = 0; j < remainingOriginal.length; j++) {
      const newRow = k + j;
      shift[newRow] = remainingOriginal[j] - newRow; // rows above the clear drop by this many rows
    }
    this.collapseShift = shift;
    this.collapseElapsed = 0;
  }

  // --- drawing -------------------------------------------------------------

  drawUnderlay(ctx, game, cellSize) {
    const piece = game.activePiece;
    if (!piece) return;
    const color = this.pieceColors[piece.type];
    const cx = (piece.col + 1.5) * cellSize;
    const cy = (piece.row + 1) * cellSize;
    const radius = cellSize * TETRIS.VISUAL.ACTIVE_PIECE_LIGHT_RADIUS_CELLS;
    const pulse = this.reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(this.clock / 260);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.glow.drawGlowCircle(ctx, cx, cy, radius * pulse, color, 0.16);
    ctx.restore();
  }

  drawOverlay(ctx, game, boardWidth, cellSize) {
    this._drawTrail(ctx, cellSize);
    this.particles.draw(ctx);
    this._drawRings(ctx);
    this._drawClearFlash(ctx, game, boardWidth, cellSize);
  }

  _drawTrail(ctx, cellSize) {
    if (this.reducedMotion || this.trail.length === 0) return;
    ctx.save();
    this.trail.forEach((snap) => {
      const fade = 1 - snap.age / TETRIS.VISUAL.TRAIL_LIFETIME_MS;
      const color = this.pieceColors[snap.type];
      const cells = TETRIS.SHAPES[snap.type][snap.rotation];
      ctx.globalAlpha = TETRIS.VISUAL.TRAIL_STEP_ALPHA * fade * 3;
      ctx.fillStyle = color;
      cells.forEach(([dc, dr]) => {
        const row = snap.row + dr;
        if (row < 0) return;
        const x = (snap.col + dc) * cellSize;
        const y = row * cellSize;
        ctx.fillRect(x + 3, y + 3, cellSize - 6, cellSize - 6);
      });
    });
    ctx.restore();
  }

  _drawRings(ctx) {
    if (this.rings.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.rings.forEach((r) => {
      if (r.delay > 0) return;
      const progress = Math.min(1, r.life / r.maxLife);
      const radius = r.maxRadius * progress;
      const alpha = (1 - progress) * 0.8;
      if (alpha <= 0.01) return;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.lineWidth;
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 12 * this.glow.intensityScale;
      ctx.beginPath();
      ctx.arc(r.x, r.y, Math.max(0.1, radius), 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
  }

  _drawClearFlash(ctx, game, boardWidth, cellSize) {
    if (!game.clearingRows) return;
    const progress = this.reducedMotion ? 0.45 : Math.min(1, game.clearTimer / TETRIS.CONFIG.LINE_CLEAR_FLASH_MS);
    const intensity = TETRIS.VFX.LINE_CLEAR_INTENSITY[game.clearingRows.length] || 0.5;
    const pulseAlpha = Math.max(0, 1 - Math.abs(progress - 0.45) * 1.8) * (0.5 + 0.5 * intensity);
    const rgb = this.glow.hexToRgb(this.clearFlashColor);
    const rgbStr = `${rgb.r},${rgb.g},${rgb.b}`;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    game.clearingRows.forEach((row) => {
      const y = row * cellSize;

      const glow = ctx.createLinearGradient(0, y, boardWidth, y);
      glow.addColorStop(0, `rgba(${rgbStr},0)`);
      glow.addColorStop(0.5, `rgba(${rgbStr},${pulseAlpha})`);
      glow.addColorStop(1, `rgba(${rgbStr},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, y, boardWidth, cellSize);

      // The "energy sweep": a brighter, narrower band traveling across the
      // row over the flash duration — wider and hotter for bigger clears.
      if (this.reducedMotion) return;
      const sweepX = progress * boardWidth;
      const sweepWidth = boardWidth * (0.18 + 0.12 * intensity);
      const sweep = ctx.createLinearGradient(sweepX - sweepWidth / 2, 0, sweepX + sweepWidth / 2, 0);
      sweep.addColorStop(0, `rgba(${rgbStr},0)`);
      sweep.addColorStop(0.5, `rgba(${rgbStr},${0.9 * intensity})`);
      sweep.addColorStop(1, `rgba(${rgbStr},0)`);
      ctx.fillStyle = sweep;
      ctx.fillRect(0, y, boardWidth, cellSize);
    });
    ctx.restore();
  }
};
