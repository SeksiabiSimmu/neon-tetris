// Bootstrap and animation loop. The Vite entry runs this only after the
// legacy game modules and the local Three.js adapter have loaded.
window.TETRIS = window.TETRIS || {};
TETRIS.boot = function boot(PremiumSceneRendererClass) {
  const boardCanvas = document.getElementById('board-canvas');
  const nextCanvas = document.getElementById('next-canvas');
  const holdCanvas = document.getElementById('hold-canvas');
  const bgCanvas = document.getElementById('bg-canvas');
  const sceneCanvas = document.getElementById('scene-canvas');

  const dom = {
    score: document.getElementById('score-value'),
    level: document.getElementById('level-value'),
    lines: document.getElementById('lines-value'),
    debugPanel: document.getElementById('debug-panel'),
    comboBadge: document.getElementById('combo-badge'),
    b2bBadge: document.getElementById('b2b-badge'),
    clearCallout: document.getElementById('clear-callout'),
    levelUpCallout: document.getElementById('level-up-callout'),
    achievementToast: document.getElementById('achievement-toast'),
  };

  // Scales a canvas for crisp rendering on high-DPI screens. The width/height
  // attributes already on the element are treated as the logical (CSS) size.
  function resizeFixedCanvas(canvas, ctx, width, height) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    if (canvas.width !== Math.round(width * dpr)) canvas.width = Math.round(width * dpr);
    if (canvas.height !== Math.round(height * dpr)) canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setupCanvas(canvas) {
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext('2d');
    resizeFixedCanvas(canvas, ctx, width, height);
    return ctx;
  }

  const boardCtx = setupCanvas(boardCanvas);
  const nextCtx = setupCanvas(nextCanvas);
  const holdCtx = setupCanvas(holdCanvas);
  const bgCtx = bgCanvas.getContext('2d');

  const renderer = new TETRIS.Renderer({
    boardCtx, nextCtx, holdCtx, bgCtx,
    boardWidth: 300, boardHeight: 600,
    nextWidth: 120, nextHeight: 300,
    holdWidth: 120, holdHeight: 100,
    dom,
  });

  renderer.webgl = null;
  try {
    renderer.webgl = new PremiumSceneRendererClass({
      canvas: sceneCanvas,
      boardCanvas,
      nextCanvas,
      holdCanvas,
      onAvailabilityChange(available) {
        document.body.classList.toggle('webgl-ready', !!available);
      },
    });
  } catch (error) {
    document.body.classList.remove('webgl-ready');
    console.warn('WebGL renderer unavailable; using the Canvas renderer.', error);
  }

  // The background canvas is a different kind of "full viewport" — it isn't
  // scaled to a fixed logical size like the others, so it gets its own
  // resize handling that tracks the actual window size.
  function resizeAllCanvases() {
    resizeFixedCanvas(boardCanvas, boardCtx, 300, 600);
    resizeFixedCanvas(nextCanvas, nextCtx, 120, 300);
    resizeFixedCanvas(holdCanvas, holdCtx, 120, 100);
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    bgCanvas.style.width = w + 'px';
    bgCanvas.style.height = h + 'px';
    bgCanvas.width = w * dpr;
    bgCanvas.height = h * dpr;
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderer.resizeBackground(w, h);
    renderer.webgl?.resize();
  }
  window.addEventListener('resize', resizeAllCanvases);
  resizeAllCanvases();
  window.addEventListener('pagehide', () => renderer.webgl?.dispose(), { once: true });

  const input = new TETRIS.InputHandler();
  const audio = new TETRIS.AudioEffects();

  let bestScoreBeforeGame = 0;

  const game = new TETRIS.Game({
    input,
    audio,
    onRunStart(run) {
      bestScoreBeforeGame = progression.stats.lifetime.bestScore;
      renderer.ui.reset();
      renderer.effects.reset(run);
    },
    onStateChange(state) {
      if (state === TETRIS.GameState.PLAYING) {
        document.getElementById('game-over-overlay').classList.remove('visible');
        document.getElementById('pause-overlay').classList.remove('visible');
        document.getElementById('pause-button').focus({ preventScroll: true });
      } else if (state === TETRIS.GameState.PAUSED) {
        document.getElementById('pause-overlay').classList.add('visible');
        document.getElementById('resume-button').focus({ preventScroll: true });
      } else if (state === TETRIS.GameState.GAME_OVER) {
        audio.play('gameOver');
        progression.update(0, game);
        progression.save();
        let recordResult = null;
        if (game.modeController.tracksRecords && game.modeController.getRecordSubmission) {
          const submission = game.modeController.getRecordSubmission(game, game.modeConfig);
          if (submission) {
            recordResult = modeRecords.submit(game.mode, submission.key, submission.value, submission.betterWhenLower, submission.extra);
          }
        }
        uiShell.populateGameOver(bestScoreBeforeGame, recordResult);
        document.getElementById('game-over-overlay').classList.add('visible');
        document.getElementById('restart-button-gameover').focus({ preventScroll: true });
      }
    },
  });

  // The meta-game layer: XP/levels, lifetime+session stats, and data-driven
  // achievement/cosmetic unlocking. Purely observational — see
  // progressionManager.js — so nothing here can affect how the game plays.
  const progression = new TETRIS.ProgressionManager();
  const settings = new TETRIS.SettingsManager();
  const modeRecords = new TETRIS.ModeRecords();

  TETRIS.applyCosmetics(renderer, progression);
  settings.applyTo({ renderer, input, audio });

  window.addEventListener('beforeunload', () => {
    progression.save();
  });

  let toastTimer = null;
  function showAchievementToast(text) {
    const el = dom.achievementToast;
    if (!el) return;
    if (toastTimer) clearTimeout(toastTimer);
    el.textContent = text;
    el.classList.remove('visible');
    void el.offsetWidth; // restart the animation if a toast is already showing
    el.classList.add('visible');
    toastTimer = setTimeout(() => el.classList.remove('visible'), 3200);
  }

  const uiShell = new TETRIS.UIShell({ game, progression, settings, renderer, input, modeRecords, audio });

  function handleRestart() {
    audio.play('menu');
    game.restart();
  }
  document.getElementById('restart-button').addEventListener('click', handleRestart);
  document.getElementById('restart-button-gameover').addEventListener('click', handleRestart);

  let lastTime = performance.now();
  let fps = 60;

  function loop(now) {
    const elapsed = now - lastTime;
    lastTime = now;
    const dt = Math.max(0, Math.min(50, elapsed));

    // A menu screen fully covers and replaces the game view, so the
    // simulation itself pauses too — otherwise a stray keypress while
    // browsing a menu could silently rack up playtime/stats in the
    // background. The pause overlay is different: it sits over a still
    // visible (frozen) board, and Game.update() already no-ops while
    // PAUSED, so no extra gating is needed for that case.
    const menuOpen = uiShell.currentScreen !== null;

    if (!document.hidden && !menuOpen) {
      game.update(dt, now);
      progression.update(dt, game);

      const notifications = progression.drainNotifications();
      notifications.forEach((n) => {
        if (n.type === 'achievement') showAchievementToast(`Achievement unlocked: ${n.name}`);
        else if (n.type === 'item') showAchievementToast(`Unlocked: ${n.name}`);
        else if (n.type === 'level') showAchievementToast(`Player level ${n.level}!`);
      });
    }

    if (elapsed > 0 && elapsed < 250) {
      // Light smoothing so the debug readout doesn't flicker every frame.
      fps = fps * 0.9 + (1000 / elapsed) * 0.1;
    }

    renderer.render(game, { fps, dt, progression });
    uiShell.updateHud();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  // Exposed for debugging in the browser console and for automated testing —
  // never read by any gameplay or UI logic above, so it can't affect behavior.
  window.__TETRIS_DEBUG__ = { game, progression, settings, renderer, uiShell, input, modeRecords, audio };
};
