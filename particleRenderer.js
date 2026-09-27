// js/particleRenderer.js
//
// A generic particle pool. Doesn't know about Tetris at all — it just
// tracks little glowing dots/shards and moves them. Two kinds of particle:
//
//   - "ambient": seeded once, wander gently within a bounding box forever
//     (respawning at a fresh random spot inside the box when their life
//     runs out), used for background/board atmosphere.
//   - "burst": fired once from a point with a velocity, acceleration,
//     optional drag, rotation, and a fixed lifetime — used for line-clear,
//     drop-impact, combo, and other one-shot effects.
//
// Each burst particle carries: position, velocity, acceleration, lifetime,
// color, size, opacity, an optional glow, rotation, and fades out over its
// life. Multiple instances are used side by side (background vs. near-board)
// rather than one shared pool, so each can have its own bounds/density.
//
// No object pooling: counts here are small (dozens, occasionally ~100 for
// a perfect clear) and visual quality mattered more than squeezing out
// allocations, so this stays a plain array for readability.

TETRIS.ParticleRenderer = class ParticleRenderer {
  constructor(glow) {
    this.glow = glow;
    this.particles = [];
    this.enabled = true; // gates drawing only; simulation still runs so re-enabling looks correct immediately
    this.intensityScale = 1;
  }

  spawnAmbient(count, bounds, options = {}) {
    for (let i = 0; i < count; i++) {
      this.particles.push(this._makeAmbient(bounds, options));
    }
  }

  _makeAmbient(bounds, options) {
    const { colors = ['#4dd8ff'], minSize = 1, maxSize = 2.6, driftSpeed = 6, shape = 'spark' } = options;
    return {
      ambient: true,
      bounds,
      options,
      shape,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 1.5,
      x: bounds.x + Math.random() * bounds.w,
      y: bounds.y + Math.random() * bounds.h,
      vx: (Math.random() - 0.5) * driftSpeed,
      vy: -(driftSpeed * 0.4 + Math.random() * driftSpeed * 0.6),
      size: minSize + Math.random() * (maxSize - minSize),
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 0,
      maxLife: 7000 + Math.random() * 9000,
      alpha: 0.2 + Math.random() * 0.35,
    };
  }

  // options: speed, life, gravity (=> ay), spread (radians, default full
  // circle), angleOffset (aim the spread in a direction), shape ('spark',
  // 'fragment', 'ring', 'hex', or 'triangle'),
  // sizeMin/sizeMax, drag (0-1ish, extra velocity decay per second),
  // trail (draw a short motion-blur streak behind fast particles),
  // glow (false to draw a crisp shape with no soft halo).
  spawnBurst(x, y, color, count, options = {}) {
    if (!this.enabled || this.intensityScale <= 0) return;
    count = Math.round(count * this.intensityScale);
    const {
      speed = 90, life = 550, gravity = 220,
      spread = Math.PI * 2, angleOffset = 0,
      shape = 'spark', sizeMin = 1.5, sizeMax = 4,
      drag = 0, trail = false, glow = true,
    } = options;
    for (let i = 0; i < count; i++) {
      const angle = angleOffset + (Math.random() - 0.5) * spread;
      const s = speed * (0.4 + Math.random() * 0.7);
      this.particles.push({
        ambient: false,
        x, y, prevX: x, prevY: y,
        vx: Math.cos(angle) * s,
        vy: Math.sin(angle) * s - s * 0.2,
        ax: 0, ay: gravity,
        drag,
        size: sizeMin + Math.random() * (sizeMax - sizeMin),
        color,
        life: 0,
        maxLife: life * (0.6 + Math.random() * 0.7),
        alpha: 1,
        glow,
        shape,
        trail,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 8,
      });
    }
  }

  clear() {
    this.particles.length = 0;
  }

  clearTransient() {
    this.particles = this.particles.filter((particle) => particle.ambient);
  }

  update(dt) {
    const dtSec = dt / 1000;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.ambient) {
        p.x += p.vx * dtSec;
        p.y += p.vy * dtSec;
        p.rotation += (p.rotationSpeed || 0) * dtSec;
        const b = p.bounds;
        if (p.x < b.x) p.x = b.x + b.w;
        else if (p.x > b.x + b.w) p.x = b.x;
        if (p.y < b.y) p.y = b.y + b.h;
        else if (p.y > b.y + b.h) p.y = b.y;
      } else {
        p.vx += (p.ax || 0) * dtSec;
        p.vy += (p.ay || 0) * dtSec;
        if (p.drag) {
          const d = Math.max(0, 1 - p.drag * dtSec);
          p.vx *= d;
          p.vy *= d;
        }
        p.prevX = p.x;
        p.prevY = p.y;
        p.x += p.vx * dtSec;
        p.y += p.vy * dtSec;
        p.rotation += (p.rotationSpeed || 0) * dtSec;
      }

      if (p.life >= p.maxLife) {
        if (p.ambient) this.particles[i] = this._makeAmbient(p.bounds, p.options);
        else this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    if (!this.enabled || this.intensityScale <= 0) return;
    for (const p of this.particles) {
      const lifeRatio = 1 - p.life / p.maxLife;
      const alpha = p.alpha * this.intensityScale * Math.max(0, lifeRatio);
      if (alpha <= 0.01) continue;

      if (!p.ambient && p.trail) {
        ctx.save();
        ctx.globalAlpha = alpha * 0.5;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.size * 0.5);
        ctx.beginPath();
        ctx.moveTo(p.prevX, p.prevY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.restore();
      }

      if (p.ambient || p.glow !== false) {
        this.glow.drawGlowCircle(ctx, p.x, p.y, p.size * (p.ambient ? 2.4 : 3.2), p.color, alpha);
      }

      if (p.shape === 'fragment') {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        const s = p.size;
        ctx.fillRect(-s, -s * 0.4, s * 2, s * 0.8);
        ctx.restore();
      } else if (p.shape === 'ring' || p.shape === 'hex' || p.shape === 'triangle') {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.strokeStyle = p.color;
        ctx.fillStyle = p.color;
        if (p.shape === 'ring') {
          ctx.lineWidth = Math.max(0.8, p.size * 0.28);
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 1.1, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          const sides = p.shape === 'hex' ? 6 : 3;
          const radius = p.size * (p.shape === 'hex' ? 1.2 : 1.35);
          ctx.beginPath();
          for (let side = 0; side < sides; side++) {
            const angle = -Math.PI / 2 + side * Math.PI * 2 / sides;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (side === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          if (p.ambient) ctx.stroke();
          else ctx.fill();
        }
        ctx.restore();
      }
    }
  }
};
