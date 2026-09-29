// js/renderer.js
//
// The top-level rendering orchestrator. Composes the smaller, single-purpose
// renderers (GlowRenderer for material/bloom primitives, ParticleRenderer,
// BackgroundRenderer, EffectsManager, UIAnimator) into the finished frame.
// Renderer only ever *reads* from Game — it never mutates game state — so
// none of this touches gameplay logic, and gameplay logic never touches this.

TETRIS.Renderer = class Renderer {
  constructor({
    boardCtx, nextCtx, holdCtx, bgCtx,
    boardWidth, boardHeight,
    nextWidth, nextHeight,
    holdWidth, holdHeight,
    dom,
  }) {
    this.boardCtx = boardCtx;
    this.nextCtx = nextCtx;
    this.holdCtx = holdCtx;
    this.boardWidth = boardWidth;
    this.boardHeight = boardHeight;
    this.nextWidth = nextWidth;
    this.nextHeight = nextHeight;
    this.holdWidth = holdWidth;
    this.holdHeight = holdHeight;
    this.dom = dom;

    this.cell = TETRIS.CONFIG.CELL_SIZE;
    this.previewCell = TETRIS.CONFIG.PREVIEW_CELL_SIZE;
    this.clock = 0;
    this.reducedMotion = false;

    // Overridable by the Customization screen via applyCosmetics() —
    // default to the original values so nothing changes until a cosmetic
    // is actually equipped.
    this.pieceColors = Object.assign({}, TETRIS.COLORS);
    this.boardTheme = { bgTop: '#111a2e', bgBottom: '#080b14', gridColor: '#78d2ff', gridAlpha: 0.11 };
    this.blockMaterial = { roughness: 0.4, metalness: 0.08, clearcoat: 0.72, emissiveIntensity: 0.16 };

    this.glow = new TETRIS.GlowRenderer();
    this.boardParticles = new TETRIS.ParticleRenderer(this.glow);
    this.boardParticles.spawnAmbient(
      TETRIS.VISUAL.PARTICLE_AMBIENT_COUNT,
      { x: 0, y: 0, w: boardWidth, h: boardHeight },
      { colors: Object.values(TETRIS.COLORS), minSize: 0.6, maxSize: 1.8, driftSpeed: 5 }
    );
    this.effects = new TETRIS.EffectsManager(this.glow, this.boardParticles, this.pieceColors);
    this.background = bgCtx ? new TETRIS.BackgroundRenderer(bgCtx, this.glow) : null;
    this.ui = new TETRIS.UIAnimator(dom);
  }

  resizeBackground(width, height) {
    if (this.background) this.background.resize(width, height);
  }

  // --- cosmetic application (see cosmeticsApplier.js) --------------------

  setPieceColors(colors) {
    Object.assign(this.pieceColors, colors);
  }

  setBlockMaterial(data) {
    this.blockMaterial = { ...this.blockMaterial, ...data };
    this.webgl?.setBlockMaterial(data);
  }

  setFallingEffect(effectId = 'none') {
    this.fallingEffectId = effectId;
    this.webgl?.setFallingEffect(effectId);
  }

  setBoardTheme(theme) {
    Object.assign(this.boardTheme, theme);
    this.webgl?.setBoardTheme(theme);
  }

  setAmbientParticles(colors, shape) {
    this.boardParticles.clear();
    this.boardParticles.spawnAmbient(
      TETRIS.VISUAL.PARTICLE_AMBIENT_COUNT,
      { x: 0, y: 0, w: this.boardWidth, h: this.boardHeight },
      { colors, shape, minSize: 0.6, maxSize: 1.8, driftSpeed: 5 }
    );
    this.webgl?.setAmbientParticles(colors, shape);
  }

  setBackgroundPalette(colors, style, sceneId = null) {
    if (this.background) this.background.setPalette(colors, style);
    this.webgl?.setBackgroundPalette(colors, style, sceneId);
  }

  setClearEffect(effect) {
    this.effects.clearFlashColor = effect.flashColor || '#ffffff';
    this.effects.clearAccentColor = effect.accentColor || null;
    this.effects.clearParticleShape = effect.particleShape || 'spark';
    this.webgl?.setClearEffect(effect);
  }

  render(game, meta = {}) {
    const dt = meta.dt || 16.7;
    this.clock += dt;

    if (this.background) {
      this.background.update(dt, game);
      this.background.draw();
    }

    this.effects.update(dt, game, this.boardWidth, this.cell);

    this.drawBoard(game);
    this.drawNext(game.pieceQueue.peek(TETRIS.CONFIG.NEXT_COUNT));
    this.drawHold(game.holdType, game.canHold);
    this.ui.update(dt, game);
    this.updateDebugPanel(game, meta.fps || 0, meta.progression || null, meta.frameP95 || 0);

    if (this.webgl) {
      try {
        this.webgl.render(game, { ...meta, shapes: TETRIS.SHAPES }, this.pieceColors);
      } catch (error) {
        console.warn('3D renderer failed; returning to the Canvas renderer.', error);
        this.webgl.dispose?.();
        this.webgl = null;
      }
    }
  }

  // --- low-level drawing helpers -------------------------------------

  clear(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
  }

  drawCell(ctx, x, y, size, color, options) {
    this.glow.drawBlock(ctx, x, y, size, color, options);
  }

  drawGridLines(ctx, cols, rows, size, extraPulse = 0) {
    const basePulse = this.reducedMotion ? 1 : 0.7 + 0.3 * Math.sin(this.clock / 1400);
    const alpha = Math.min(0.55, (this.boardTheme.gridAlpha || 0.11) * basePulse + extraPulse * 0.3);
    ctx.save();
    ctx.strokeStyle = this.boardTheme.gridColor || '#78d2ff';
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * size, 0);
      ctx.lineTo(c * size, rows * size);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * size);
      ctx.lineTo(cols * size, r * size);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawBoardAtmosphere(ctx, game) {
    const tint = this.boardTheme.gridColor || '#78d2ff';
    const depth = Math.min(1, Math.max(0, (game.scoring.level - 1) / 24));

    ctx.save();
    const crown = ctx.createRadialGradient(this.boardWidth * 0.5, this.boardHeight * 0.08, 0,
      this.boardWidth * 0.5, this.boardHeight * 0.08, this.boardWidth * 0.9);
    crown.addColorStop(0, this.glow.rgba(tint, 0.095 + depth * 0.025));
    crown.addColorStop(1, this.glow.rgba(tint, 0));
    ctx.fillStyle = crown;
    ctx.fillRect(0, 0, this.boardWidth, this.boardHeight);

    const vignette = ctx.createRadialGradient(this.boardWidth * 0.5, this.boardHeight * 0.47,
      this.boardWidth * 0.16, this.boardWidth * 0.5, this.boardHeight * 0.47, this.boardHeight * 0.8);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.boardWidth, this.boardHeight);

    const motionGlow = Math.min(1, Math.max(0, this.glow.intensityScale));
    if (!this.reducedMotion && motionGlow > 0) {
      const y = (this.clock * 0.026) % (this.boardHeight + 56) - 28;
      const sweep = ctx.createLinearGradient(0, y - 28, 0, y + 28);
      sweep.addColorStop(0, this.glow.rgba(tint, 0));
      sweep.addColorStop(0.5, this.glow.rgba(tint, (0.035 + depth * 0.012) * motionGlow));
      sweep.addColorStop(1, this.glow.rgba(tint, 0));
      ctx.fillStyle = sweep;
      ctx.fillRect(0, y - 28, this.boardWidth, 56);
    }
    ctx.restore();
  }

  // --- board -----------------------------------------------------------

  drawBoard(game) {
    const ctx = this.boardCtx;
    const size = this.cell;
    const { cols, rows, grid } = game.board;

    this.clear(ctx, this.boardWidth, this.boardHeight);

    ctx.save();

    const bg = ctx.createLinearGradient(0, 0, 0, this.boardHeight);
    bg.addColorStop(0, this.boardTheme.bgTop);
    bg.addColorStop(1, this.boardTheme.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.boardWidth, this.boardHeight);

    this.drawBoardAtmosphere(ctx, game);

    // Soft light pooling under the active piece, before anything else is
    // drawn on top of it — reads as ambient light cast onto the board.
    this.effects.drawUnderlay(ctx, game, size);

    this.drawGridLines(ctx, cols, rows, size, this.effects.gridPulse);

    const clearingSet = game.clearingRows ? new Set(game.clearingRows) : null;
    for (let r = 0; r < rows; r++) {
      const isClearing = clearingSet && clearingSet.has(r);
      const rowOffset = this.effects.getRowOffset(r, size); // "rows drop into place" after a clear
      for (let c = 0; c < cols; c++) {
        const type = grid[r][c];
        if (!type || this.effects.isDropCellHidden(c, r)) continue;
        this.drawCell(ctx, c * size, r * size + rowOffset, size, this.pieceColors[type], {
          intensity: isClearing ? 1.6 : 0.5,
        });
      }
    }

    if (game.state === TETRIS.GameState.PLAYING && game.activePiece) {
      const piece = game.activePiece;
      const color = this.pieceColors[piece.type];

      const ghostRow = game.getGhostRow();
      if (ghostRow !== null && ghostRow !== piece.row) {
        piece.getCells(piece.col, ghostRow, piece.rotation).forEach(({ col, row }) => {
          if (row < 0) return;
          this.glow.drawGlowOutline(ctx, col * size, row * size, size, color, 0.5);
        });
      }

      this.effects.getVisualPieceCells(piece).forEach(({ col, row }) => {
        if (row < 0) return;
        this.drawCell(ctx, col * size, row * size, size, color, {
          intensity: 1,
          chromatic: true,
          highlightPhase: this.reducedMotion || this.glow.intensityScale <= 0 ? 0 : this.clock,
        });
      });
    }

    this.effects.getDropCells().forEach(({ col, row, type }) => {
      if (row < 0) return;
      this.drawCell(ctx, col * size, row * size, size, this.pieceColors[type], {
        intensity: 1.25, chromatic: true,
      });
    });

    this.effects.drawOverlay(ctx, game, this.boardWidth, size);

    ctx.restore();
  }

  // --- next / hold previews --------------------------------------------

  drawPieceInSlot(ctx, type, slotX, slotY, slotW, slotH) {
    const shape = TETRIS.SHAPES[type][0];
    const size = Math.min(this.previewCell, (slotH - 8) / 4, (slotW - 8) / 4);
    const cols = shape.map((cell) => cell[0]);
    const rows = shape.map((cell) => cell[1]);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const w = (maxCol - minCol + 1) * size;
    const h = (maxRow - minRow + 1) * size;
    const offsetX = slotX + (slotW - w) / 2;
    const offsetY = slotY + (slotH - h) / 2;
    const color = this.pieceColors[type];

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.glow.drawGlowCircle(ctx, slotX + slotW / 2, slotY + slotH / 2, Math.max(w, h) * 0.8, color, 0.14);
    ctx.restore();

    shape.forEach(([c, r]) => {
      this.drawCell(ctx, offsetX + (c - minCol) * size, offsetY + (r - minRow) * size, size, color, { intensity: 0.85 });
    });
  }

  drawNext(nextTypes) {
    const ctx = this.nextCtx;
    this.clear(ctx, this.nextWidth, this.nextHeight);
    const slotH = this.nextHeight / TETRIS.CONFIG.NEXT_COUNT;
    nextTypes.forEach((type, i) => {
      this.drawPieceInSlot(ctx, type, 0, i * slotH, this.nextWidth, slotH);
    });
  }

  drawHold(holdType, canHold) {
    const ctx = this.holdCtx;
    this.clear(ctx, this.holdWidth, this.holdHeight);
    if (!holdType) return;
    ctx.globalAlpha = canHold ? 1 : 0.4;
    this.drawPieceInSlot(ctx, holdType, 0, 0, this.holdWidth, this.holdHeight);
    ctx.globalAlpha = 1;
  }

  // --- debug overlay (off by default; backtick toggles it) --------------

  updateDebugPanel(game, fps, progression, frameP95 = 0) {
    const panel = this.dom.debugPanel;
    if (!panel) return;
    if (!game.debugMode) {
      panel.classList.remove('visible');
      return;
    }
    panel.classList.add('visible');

    const p = game.activePiece;
    const s = game.scoring;
    const last = game.lastClearInfo;
    const lastLine = last
      ? `Last: ${last.linesCleared}L${last.tSpinType ? ` ${last.tSpinType}-tspin` : ''}${last.backToBackApplied ? ' B2B' : ''}${last.isPerfectClear ? ' PC' : ''}`
      : 'Last: —';

    const lines = [
      `FPS: ${Math.round(fps)}  Frame p95: ${frameP95.toFixed(1)}ms`,
      `State: ${game.state}${game.clearingRows ? ' (clearing)' : ''}`,
      `Level: ${s.level}  Gravity: ${s.gravityInterval}ms`,
      `DAS: ${TETRIS.CONFIG.DAS_MS}ms  ARR: ${TETRIS.CONFIG.ARR_MS}ms`,
      `Piece: ${p ? `${p.type} rot${p.rotation} (${p.col},${p.row})` : '—'}`,
      `Combo: ${s.comboCount > 0 ? s.comboCount : '—'}  B2B: ${s.backToBack ? 'yes' : 'no'}`,
      lastLine,
    ];

    if (progression) {
      const unlockedCount = TETRIS.PROGRESSION_DATA.UNLOCKABLES.filter((u) => progression.isUnlocked(u.id)).length;
      const totalItems = TETRIS.PROGRESSION_DATA.UNLOCKABLES.length;
      const achCount = TETRIS.PROGRESSION_DATA.ACHIEVEMENTS.filter((a) => progression.hasAchievement(a.id)).length;
      const achTotal = TETRIS.PROGRESSION_DATA.ACHIEVEMENTS.length;
      lines.push(
        '',
        `-- Progression --`,
        `Player Lv ${progression.level}  XP ${progression.xpIntoCurrentLevel}/${progression.xpForNextLevel} (total ${progression.totalXp})`,
        `Unlocks: ${unlockedCount}/${totalItems}  Achievements: ${achCount}/${achTotal}`,
        `Best: score ${progression.stats.lifetime.bestScore}, combo ${progression.stats.lifetime.bestCombo}, B2B ${progression.stats.lifetime.bestBackToBackStreak}`,
        `Lifetime: ${progression.stats.lifetime.totalLines}L, ${progression.stats.lifetime.totalTetrises} Tetrises, ${progression.stats.lifetime.totalTSpins} T-spins, ${progression.stats.lifetime.totalPerfectClears} PCs`,
        `Games: ${progression.stats.lifetime.gamesPlayed}  Pieces: ${progression.stats.lifetime.totalPiecesPlaced}  Playtime: ${Math.round(progression.stats.lifetime.totalPlayTimeMs / 1000)}s`
      );
    }

    lines.push('', this.boardToAscii(game.board));
    panel.textContent = lines.join('\n');
  }

  boardToAscii(board) {
    return board.grid.map((row) => row.map((cell) => (cell ? '█' : '·')).join('')).join('\n');
  }
};
