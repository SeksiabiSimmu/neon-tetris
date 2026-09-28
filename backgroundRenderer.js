import { collectGameplayEvents } from './src/rendering/gameplaySignals.js';

const TETRIS = window.TETRIS;

// Lightweight projected worlds behind the playfield. Perspective grids and
// shaded silhouettes add 3D depth without a separate scene or WebGL system.
TETRIS.BackgroundRenderer = class BackgroundRenderer {
  constructor(ctx, glow) {
    this.ctx = ctx;
    this.glow = glow;
    this.width = 0;
    this.height = 0;
    this.clock = 0;
    this.particles = new TETRIS.ParticleRenderer(glow);
    this.palette = null;
    this.style = 'nebula';
    this.nebulae = [];
    this.stars = [];
    this.seeded = false;
    this.reducedMotion = false;
    this.styleIntensity = 1;
    this.mode = 'endless';
    this.runId = -1;
    this.altitude = 0;
    this.pressure = 0;
    this.motionScale = 1;
    this.reactions = { impact: 0, clear: 0, combo: 0, spin: 0, perfect: 0, level: 0, rotate: 0, move: 0, b2b: 0 };
    this.eventCursor = null;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this._reseed();
  }

  setPalette(colors, style) {
    if (colors && colors.length) this.palette = colors.slice();
    if (style) this.style = style;
    if (this.width && this.height) this._reseed();
  }

  _reseed() {
    const colors = this.palette || ['#4dd8ff', '#c65bff', '#4d7bff', '#43e07a'];
    this.nebulae = Array.from({ length: TETRIS.VISUAL.BG_NEBULA_COUNT }, (_, i) => ({
      x: Math.random() * this.width, y: Math.random() * this.height,
      r: Math.min(this.width, this.height) * (0.28 + Math.random() * 0.18),
      color: colors[i % colors.length],
      dx: (Math.random() - 0.5) * 6, dy: (Math.random() - 0.5) * 6,
      phase: Math.random() * Math.PI * 2,
    }));
    const count = Math.min(100, Math.max(48, Math.floor(this.width * this.height / 15000)));
    this.stars = Array.from({ length: count }, (_, i) => {
      const seed = (i * 16807 + 37) % 2147483647;
      const rand = (n) => ((seed * (n * 48271 + 1)) % 2147483647) / 2147483647;
      return { x: rand(1) * this.width, y: rand(2) * this.height, size: 0.6 + rand(3) * 1.4, phase: rand(4) * 6.28, depth: 0.15 + rand(5) * 0.85 };
    });
    this.particles.clear();
    this.particles.spawnAmbient(TETRIS.VISUAL.PARTICLE_BG_COUNT,
      { x: 0, y: 0, w: this.width, h: this.height },
      { colors, minSize: 0.6, maxSize: 2, driftSpeed: 4 });
    this.seeded = true;
  }

  update(dt, game) {
    if (!this.seeded) return;
    dt = Math.max(0, dt);
    const mode = game && TETRIS.GAME_MODES[game.mode] ? game.mode : 'endless';
    const level = game && game.scoring ? game.scoring.level : 1;
    const runId = game ? game.runId : 0;
    const newRun = mode !== this.mode || runId !== this.runId;
    this.mode = mode;
    this.runId = runId;

    if (newRun) this._syncEvents(game);
    else if (game) this._observe(game, dt);
    this._updatePressure(game, level);

    if (mode === 'endless') {
      const target = Math.max(0, level - 1);
      if (newRun || (game && game.state === TETRIS.GameState.GAME_OVER) || this.reducedMotion) this.altitude = target;
      else if (game && game.state === TETRIS.GameState.PLAYING) {
        this.altitude += (target - this.altitude) * (1 - Math.exp(-dt / 850));
      }
    } else if (newRun) this.altitude = 0;

    if (this.reducedMotion) {
      this.particles.update(dt);
      return;
    }
    const pulseSpeed = 1 + Math.max(this.reactions.combo, this.reactions.clear * 0.35) * 0.38;
    this.clock += dt * this.motionScale * pulseSpeed;
    const seconds = dt / 1000;
    this.nebulae.forEach((n) => {
      n.x += n.dx * seconds; n.y += n.dy * seconds;
      if (n.x < -n.r || n.x > this.width + n.r) n.dx *= -1;
      if (n.y < -n.r || n.y > this.height + n.r) n.dy *= -1;
    });
    this.particles.update(dt);
  }

  _syncEvents(game) {
    this.reactions = { impact: 0, clear: 0, combo: 0, spin: 0, perfect: 0, level: 0, rotate: 0, move: 0, b2b: 0 };
    this.eventCursor = game ? collectGameplayEvents(game, null).cursor : null;
  }

  _observe(game, dt) {
    const r = this.reactions;
    const fade = { impact: 520, clear: 880, combo: 1250, spin: 1050, perfect: 1700, level: 1250, rotate: 420, move: 380, b2b: 1100 };
    Object.keys(r).forEach((key) => { r[key] *= Math.exp(-dt / fade[key]); });
    const collection = collectGameplayEvents(game, this.eventCursor);
    this.eventCursor = collection.cursor;
    collection.events.forEach(({ type, detail }) => {
      if (type === 'hardDrop') {
        r.impact = Math.max(r.impact, Math.min(1, 0.28 + Math.max(0, detail.row - detail.fromRow) / 13));
      } else if (type === 'lock') r.impact = Math.max(r.impact, 0.38);
      else if (type === 'clear' && detail.linesCleared) r.clear = Math.max(r.clear, Math.min(1, 0.28 + detail.linesCleared * 0.16));
      else if (type === 'combo') r.combo = Math.max(r.combo, Math.min(1, 0.25 + detail.comboCount * 0.055));
      else if (type === 'tSpin') r.spin = 1;
      else if (type === 'perfectClear') r.perfect = 1;
      else if (type === 'levelUp') r.level = 1;
      else if (type === 'backToBack') r.b2b = 1;
      else if (type === 'rotate') r.rotate = 1;
      else if (type === 'move') r.move = Math.max(r.move, 0.55);
      else if (type === 'fall') r.move = Math.max(r.move, detail.isSoftDropping ? 0.25 : 0.12);
      else if (type === 'spawn') r.move = Math.max(r.move, 0.22);
    });
  }

  _updatePressure(game, level) {
    let timer = 0;
    if (game && game.mode === 'timeAttack' && game.modeConfig && game.modeConfig.timeLimitMs) {
      timer = game.modeTimer / game.modeConfig.timeLimitMs;
    } else if (game && game.mode === 'challenge' && game.modeState && game.modeState.challenge && game.modeState.challenge.timeLimitMs) {
      timer = game.modeTimer / game.modeState.challenge.timeLimitMs;
    }
    this.pressure = Math.min(1, Math.min(0.65, Math.max(0, level - 1) * 0.024) + Math.max(0, Math.min(1, timer)) * 0.55);
    this.motionScale = 1 + this.pressure * 0.75;
  }

  _colors() {
    const mode = TETRIS.GAME_MODES[this.mode] || TETRIS.GAME_MODES.endless;
    return { mode: mode.accent, glow: (this.palette && this.palette[0]) || mode.accent };
  }

  _sky(top, middle, bottom) {
    const c = this.ctx, g = c.createLinearGradient(0, 0, 0, this.height);
    g.addColorStop(0, top); g.addColorStop(0.56, middle); g.addColorStop(1, bottom);
    c.fillStyle = g; c.fillRect(0, 0, this.width, this.height);
  }

  _stars(count, alpha = 1) {
    const c = this.ctx, t = this.clock / 1000, accent = this._colors().glow;
    c.save();
    this.stars.forEach((s, i) => {
      if (i >= count) return;
      const blink = this.reducedMotion ? 0.75 : 0.55 + 0.45 * Math.sin(t * (0.45 + s.depth) + s.phase);
      const drift = this.reducedMotion ? 0 : t * (3 + s.depth * 12);
      const climb = this.mode === 'endless' ? this.altitude * 9 * s.depth : 0;
      c.globalAlpha = alpha * blink; c.fillStyle = i % 7 === 0 ? accent : '#e3f3ff';
      c.fillRect(s.x, (s.y + drift + climb + this.height * 2) % this.height, s.size, s.size);
    });
    c.restore();
  }

  _nebulae(alpha) {
    const c = this.ctx, t = this.clock / 1000;
    c.save(); c.globalCompositeOperation = 'lighter';
    this.nebulae.forEach((n) => this.glow.drawGlowCircle(c, n.x, n.y,
      n.r * (this.reducedMotion ? 1 : 0.88 + 0.12 * Math.sin(t * 0.3 + n.phase)), n.color, alpha));
    c.restore();
  }

  _grid(horizon, color, phase, alpha) {
    const c = this.ctx, w = this.width, h = this.height, vx = w * 0.5;
    const vy = h * horizon, scroll = (phase % 1 + 1) % 1;
    c.save(); c.strokeStyle = color; c.lineWidth = 1; c.globalAlpha = alpha;
    for (let i = -7; i <= 7; i++) {
      c.beginPath(); c.moveTo(vx, vy); c.lineTo(vx + i * w * 0.12, h + 2); c.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const d = (i + scroll) / 12, y = vy + (h - vy) * d * d;
      c.globalAlpha = alpha * (0.25 + d * 0.75); c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
    }
    c.restore();
  }

  _city(baseY, alpha, color) {
    const c = this.ctx;
    const w = this.width;
    const h = this.height;
    const count = Math.max(16, Math.ceil(w / 48));
    c.save();
    c.globalAlpha = alpha;
    for (let i = 0; i < count; i++) {
      const seed = (i * 1103515245 + 12345) >>> 0;
      const rand = (seed % 1000) / 1000;
      const x = (i / count) * w;
      const bw = (w / count) * (0.6 + rand * 0.35);
      const bh = h * (0.08 + ((seed >>> 9) % 1000) / 1000 * 0.23);
      const y = baseY - bh;
      const side = bw * 0.2;

      c.fillStyle = 'rgba(10,20,42,.94)';
      c.fillRect(x, y, bw, bh);
      c.beginPath();
      c.moveTo(x + bw, y);
      c.lineTo(x + bw + side, y - side * 0.35);
      c.lineTo(x + bw + side, baseY);
      c.lineTo(x + bw, baseY);
      c.closePath();
      c.fillStyle = 'rgba(4,9,24,.9)';
      c.fill();
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + bw, y);
      c.lineTo(x + bw + side, y - side * 0.35);
      c.lineTo(x + side, y - side * 0.35);
      c.closePath();
      c.fillStyle = 'rgba(38,64,98,.72)';
      c.fill();

      const twinkle = this.reducedMotion ? 0.18 : 0.12 + 0.2 * (0.5 + 0.5 * Math.sin(this.clock / 480 + i * 1.7));
      c.fillStyle = color;
      c.globalAlpha = alpha * twinkle;
      for (let row = 0; row < Math.floor(bh / 22); row++) {
        if ((seed >>> (row % 30)) % 3) c.fillRect(x + bw * 0.28, y + 10 + row * 20, 2, 3);
      }
      c.globalAlpha = alpha;
    }
    c.restore();
  }

  _mountains(baseY, color, alpha = 1) {
    const c = this.ctx;
    const w = this.width;
    const h = this.height;
    const fills = ['#1c365b99', '#0d214dcc', '#07142bef'];
    c.save();
    c.globalAlpha = alpha;
    for (let layer = 0; layer < 3; layer++) {
      const drift = this.reducedMotion ? 0 : Math.sin(this.clock / 2100 + layer) * 4 + this.reactions.clear * (layer + 1) * 2;
      const base = baseY + drift;
      c.beginPath();
      c.moveTo(0, base);
      for (let i = 0; i <= 12; i++) {
        const x = w * i / 12;
        const wave = Math.abs(Math.sin(i * 2.17 + layer * 1.3 + this.clock / 12000)) * 0.6
          + Math.abs(Math.cos(i * 0.81 + layer + this.clock / 18000)) * 0.4;
        c.lineTo(x, base - h * (0.1 + layer * 0.055) * (0.5 + wave * 0.7));
      }
      c.lineTo(w, base);
      c.closePath();
      c.fillStyle = fills[layer];
      c.fill();
    }
    c.strokeStyle = color;
    c.globalAlpha *= 0.35;
    c.beginPath();
    c.moveTo(0, baseY - h * 0.13);
    c.quadraticCurveTo(w * 0.5, baseY - h * 0.2, w, baseY - h * 0.11);
    c.stroke();
    c.restore();
  }

  _rings(x, y, rx, ry, count, color, phase, alpha) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.strokeStyle = color;
    c.globalAlpha = alpha;
    for (let i = 0; i < count; i++) {
      const start = phase * (0.08 + i * 0.012);
      c.beginPath();
      c.ellipse(0, 0, rx + i * 26, ry + i * 11, phase * 0.05 + i * 0.18,
        start, start + Math.PI * 1.55);
      c.stroke();
    }
    c.restore();
  }

  _endless(color) {
    const h = this.height;
    const level = Math.max(0, this.altitude);
    const climb = Math.min(1, level / 18);
    const deep = Math.min(1, Math.max(0, (level - 18) / 30));
    const skyTop = climb < 0.55 ? '#123a55' : '#030611';
    const skyMiddle = climb < 0.55 ? '#101a38' : '#080d24';
    this._sky(skyTop, skyMiddle, '#091329');
    this._nebulae(0.12 + climb * 0.1);
    this._stars(Math.floor(this.stars.length * (0.08 + climb * 0.92)), climb);
    this._city(h * (0.76 + climb * 0.46), Math.pow(1 - climb, 1.3), color);
    this._grid(0.69 + climb * 0.27, color, level * 0.17 + this.reactions.move * 0.08, (1 - climb) * 0.32);
    if (climb > 0.28) {
      const c = this.ctx;
      const p = (climb - 0.28) / 0.72;
      const cx = this.width * 0.52;
      const cy = h * (1.17 - p * 0.09 - deep * 0.06);
      const rx = this.width * (0.4 + p * 0.22) * (1 - deep * 0.74);
      const ry = h * (0.19 + p * 0.1) * (1 - deep * 0.68);
      c.save();
      c.globalAlpha = p * 0.9;
      c.beginPath();
      c.ellipse(cx, cy, rx, ry, 0, Math.PI, Math.PI * 2);
      const g = c.createRadialGradient(cx, cy - ry * 0.45, ry * 0.08, cx, cy, rx);
      g.addColorStop(0, '#286c9b');
      g.addColorStop(1, '#071222');
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = color;
      c.globalAlpha = p * 0.38;
      c.lineWidth = 3;
      c.stroke();
      c.restore();
    }
  }

  _world() {
    const c = this.ctx;
    const w = this.width;
    const h = this.height;
    const t = this.clock / 1000;
    const colors = this._colors();
    const accent = colors.mode;
    const glow = colors.glow;
    if (this.mode === 'endless') {
      this._endless(glow);
      return;
    }
    const scenes = {
      sprint: ['#281441', '#102044', '#080d1b', 0.58],
      marathon: ['#102b48', '#142746', '#07111f', 0.68],
      timeAttack: ['#321323', '#17152d', '#080b18', 0.7],
      zen: ['#123942', '#10253a', '#091421', 0.66],
      challenge: ['#24123d', '#151438', '#080b1b', 0.52],
    };
    const scene = scenes[this.mode] || scenes.marathon;
    this._sky(scene[0], scene[1], scene[2]);
    this._nebulae(0.18);
    this._stars(this.stars.length * 0.62, 0.7);
    if (this.mode === 'sprint') this._city(h * 0.76, 0.9, accent);
    if (this.mode === 'marathon' || this.mode === 'zen') {
      const isZen = this.mode === 'zen';
      this._mountains(h * (isZen ? 0.75 : 0.79), glow, isZen ? 0.72 : 1);
    }
    const speed = this.mode === 'sprint' ? 0.52 : this.mode === 'timeAttack' ? 0.26 : this.mode === 'zen' ? 0.035 : 0.1;
    this._grid(scene[3], accent, t * speed, this.mode === 'sprint' ? 0.34 : 0.2);
    if (this.mode === 'sprint' || this.mode === 'timeAttack') {
      this._rings(w * 0.5, h * 0.48, 38, 24, 7, accent, t * (0.5 + this.pressure), 0.17);
    }
    if (this.mode === 'timeAttack') {
      this._rings(w * 0.5, h * 0.42, 65, 22, 4, accent, t * (0.45 + this.pressure * 1.5), 0.13);
    }
    if (this.mode === 'zen') {
      [[0.14, 0.56, 0.1], [0.82, 0.48, 0.13], [0.35, 0.38, 0.065]].forEach((p, i) => {
        const x = w * p[0];
        const y = h * p[1] + (this.reducedMotion ? 0 : Math.sin(t * 0.65 + i) * 5 + this.reactions.clear * 3);
        const rx = w * p[2];
        const ry = h * 0.028;
        c.beginPath();
        c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        c.fillStyle = '#183641';
        c.fill();
        c.beginPath();
        c.moveTo(x - rx * 0.78, y + 2);
        c.lineTo(x + rx * 0.78, y + 2);
        c.lineTo(x + rx * 0.34, y + ry * 4);
        c.lineTo(x - rx * 0.4, y + ry * 3);
        c.closePath();
        c.fillStyle = '#091723';
        c.fill();
        c.strokeStyle = glow;
        c.globalAlpha = 0.25;
        c.beginPath();
        c.ellipse(x, y, rx, ry, 0, Math.PI, Math.PI * 2);
        c.stroke();
        c.globalAlpha = 1;
      });
    }
    if (this.mode === 'challenge') {
      for (let i = 0; i < 5; i++) {
        const phase = this.reducedMotion ? 0 : t * 0.45 + i * 1.2;
        const x = w * (0.12 + i * 0.2) + Math.sin(phase) * w * 0.01;
        const y = h * (0.25 + (i % 2) * 0.12) + Math.cos(phase * 2) * h * 0.015;
        const size = Math.min(w, h) * (0.04 + (i % 3) * 0.012);
        c.save();
        c.translate(x, y);
        c.rotate(phase * 0.5);
        c.globalAlpha = 0.13 + this.reactions.spin * 0.08;
        c.strokeStyle = accent;
        c.beginPath();
        c.moveTo(0, -size);
        c.lineTo(size * 0.7, 0);
        c.lineTo(0, size);
        c.lineTo(-size * 0.7, 0);
        c.closePath();
        c.stroke();
        c.restore();
      }
    }
  }

  _cosmeticMotion() {
    if (this.reducedMotion || this.style === 'nebula') return;
    const c = this.ctx;
    const w = this.width;
    const h = this.height;
    const t = this.clock / 1000;
    const colors = this._colors();
    const accent = colors.mode;
    const glow = colors.glow;
    c.save();
    c.globalCompositeOperation = 'screen';
    if (this.style === 'aurora') {
      for (let i = 0; i < 3; i++) {
        const y = h * (0.2 + i * 0.09);
        const phase = t * 0.22 + i * 1.4;
        c.beginPath();
        c.moveTo(-w * 0.1, y + Math.sin(phase) * h * 0.04);
        c.bezierCurveTo(w * 0.25, y - h * 0.07, w * 0.7, y + h * 0.07, w * 1.1, y);
        c.globalAlpha = 0.055;
        c.strokeStyle = i % 2 ? glow : accent;
        c.lineWidth = Math.max(10, w * 0.04);
        c.stroke();
      }
    } else if (this.style === 'meteors') {
      for (let i = 0; i < Math.round(6 * this.styleIntensity); i++) {
        const phase = (t * (0.18 + this.pressure * 0.08) + i * 0.173) % 1;
        const x = ((i * 173 + phase * w * 1.6) % (w + 80)) - 40;
        const y = (i * 97 + phase * h * 0.8) % (h * 0.72);
        const length = 22 + i % 3 * 12;
        c.globalAlpha = 0.22;
        c.strokeStyle = glow;
        c.beginPath();
        c.moveTo(x - length, y - length * 0.3);
        c.lineTo(x, y);
        c.stroke();
      }
    } else if (['orbit','clockwork'].includes(this.style)) {
      const isOrbit = this.style === 'orbit';
      c.translate(w * 0.5, h * 0.48);
      c.rotate(t * (isOrbit ? 0.025 : -0.018));
      c.strokeStyle = glow;
      for (let i = 0; i < (isOrbit ? 3 : 5); i++) {
        const rx = Math.min(w, h) * (0.26 + i * 0.055);
        const ry = rx * (isOrbit ? 0.26 : 0.4);
        c.globalAlpha = 0.075;
        c.beginPath();
        c.ellipse(0, 0, rx, ry, i * 0.42, t * 0.08 + i, t * 0.08 + i + Math.PI * 1.55);
        c.stroke();
        const phase = t * (0.25 + i * 0.06) + i * 2.1;
        c.globalAlpha = 0.4;
        c.fillStyle = i % 2 ? accent : glow;
        c.beginPath();
        c.arc(Math.cos(phase) * rx, Math.sin(phase) * ry, 2 + i % 2, 0, Math.PI * 2);
        c.fill();
      }
    } else if (this.style === 'solar') {
      c.translate(w * 0.78, h * 0.2);
      c.rotate(t * 0.018);
      c.strokeStyle = accent;
      c.globalAlpha = 0.06 + this.reactions.level * 0.06;
      for (let i = 0; i < 16; i++) {
        const phase = i * Math.PI / 8;
        c.beginPath();
        c.moveTo(Math.cos(phase) * Math.min(w, h) * 0.08, Math.sin(phase) * Math.min(w, h) * 0.08);
        c.lineTo(Math.cos(phase) * Math.max(w, h) * 0.6, Math.sin(phase) * Math.max(w, h) * 0.6);
        c.stroke();
      }
    } else if (this.style === 'prism') {
      c.translate(w * 0.5, h * 0.5);
      c.rotate(t * 0.012);
      c.strokeStyle = accent;
      for (let i = 0; i < 4; i++) {
        const size = Math.min(w, h) * (0.15 + i * 0.09);
        c.globalAlpha = 0.04 + this.reactions.clear * 0.08;
        c.beginPath();
        c.moveTo(0, -size);
        c.lineTo(size * 0.7, 0);
        c.lineTo(0, size);
        c.lineTo(-size * 0.7, 0);
        c.closePath();
        c.stroke();
      }
    } else if (this.style === 'cityLights') {
      const y = (t * 38) % h;
      const gradient = c.createLinearGradient(0, y - 36, 0, y + 36);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(0.5, glow);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = 0.08;
      c.fillStyle = gradient;
      c.fillRect(0, y - 36, w, 72);
    }
    c.restore();
  }

  _gameplayMotion() {
    if (this.reducedMotion) return;
    const r = this.reactions;
    const max = Math.max(...Object.values(r));
    if (max < 0.025) return;
    const c = this.ctx;
    const w = this.width;
    const h = this.height;
    const base = Math.min(w, h);
    const anchors = { endless: 0.72, sprint: 0.5, marathon: 0.66, timeAttack: 0.42, zen: 0.54, challenge: 0.5 };
    const x = w * 0.5;
    const y = h * (anchors[this.mode] || 0.5);
    const colors = this._colors();
    const color = r.perfect > 0.04 ? '#ffe39a' : r.spin > 0.04 ? colors.glow : colors.mode;
    c.save();
    c.translate(x, y);
    c.strokeStyle = color;
    c.lineWidth = 1.2 + r.impact * 1.6;
    const rings = [
      [r.impact, 0.12, 0.38], [r.rotate, 0.1, 0.13], [r.move, 0.08, 0.1],
      [r.clear, 0.23, 0.32], [r.spin, 0.27, 0.29], [r.combo, 0.31, 0.22],
      [r.b2b * 0.8, 0.34, 0.2], [r.level, 0.43, 0.2], [r.perfect, 0.4, 0.28],
    ];
    rings.forEach(([pulse, scale, alpha]) => {
      if (pulse < 0.025) return;
      const shrink = 1.15 - pulse * 0.35;
      c.globalAlpha = Math.min(0.28, pulse * alpha);
      c.beginPath();
      c.ellipse(0, 0, base * scale * shrink, base * scale * 0.38 * shrink,
        r.spin ? this.clock / 1200 : 0, 0, Math.PI * 2);
      c.stroke();
    });
    c.restore();
    const sprintPulse = Math.max(r.impact, r.clear, r.move * 0.45, r.rotate * 0.35);
    if (this.mode === 'sprint' && sprintPulse > 0.03) {
      const sweepY = h * (0.42 + (1 - sprintPulse) * 0.2);
      const gradient = c.createLinearGradient(0, sweepY, w, sweepY);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(0.5, color);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = sprintPulse * 0.24;
      c.fillStyle = gradient;
      c.fillRect(0, sweepY - 1, w, 2 + sprintPulse * 4);
    } else if (this.mode === 'marathon' && r.clear > 0.03) {
      c.globalAlpha = r.clear * 0.2;
      c.beginPath();
      c.moveTo(0, y + h * 0.08);
      c.quadraticCurveTo(w * 0.5, y - h * 0.12, w, y + h * 0.04);
      c.stroke();
    } else if (this.mode === 'timeAttack' && (r.clear > 0.03 || r.level > 0.03)) {
      c.save();
      c.translate(x, y);
      c.rotate(this.clock / 500 + r.spin * 0.5);
      c.globalAlpha = Math.max(r.clear, r.level) * 0.26;
      c.beginPath();
      c.ellipse(0, 0, base * 0.34, base * 0.12, 0, 0, Math.PI * 0.72);
      c.stroke();
      c.restore();
    } else if (this.mode === 'challenge' && (r.spin > 0.03 || r.perfect > 0.03)) {
      const pulse = Math.max(r.spin, r.perfect);
      c.save();
      c.translate(x, y);
      c.rotate(this.clock / 900);
      c.globalAlpha = pulse * 0.2;
      c.beginPath();
      c.moveTo(0, -base * 0.24 * pulse);
      c.lineTo(base * 0.16 * pulse, 0);
      c.lineTo(0, base * 0.24 * pulse);
      c.lineTo(-base * 0.16 * pulse, 0);
      c.closePath();
      c.stroke();
      c.restore();
    }
  }

  draw() {
    if (!this.width || !this.height) return;
    const c = this.ctx;
    c.clearRect(0, 0, this.width, this.height);
    this._world();
    this._cosmeticMotion();
    this._gameplayMotion();
    this.particles.draw(c);
    const vignette = c.createRadialGradient(
      this.width / 2, this.height / 2, Math.min(this.width, this.height) * 0.25,
      this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.72
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,.46)');
    c.fillStyle = vignette;
    c.fillRect(0, 0, this.width, this.height);
  }
};
