// js/glowRenderer.js
//
// Reusable low-level drawing primitives for the neon/holographic look:
// color math, soft glow blobs, and the layered "block material" used
// everywhere a tetromino cell is drawn (board, ghost, next, hold). Nothing
// in this file knows about game rules — it only ever takes coordinates and
// colors handed to it.

TETRIS.GlowRenderer = class GlowRenderer {
  constructor() {
    this.intensityScale = 1; // settings-driven multiplier on every blur amount below
  }

  hexToRgb(hex) {
    const num = parseInt(hex.slice(1), 16);
    return { r: (num >> 16) & 0xff, g: (num >> 8) & 0xff, b: num & 0xff };
  }

  shade(hex, amount) {
    const { r, g, b } = this.hexToRgb(hex);
    const clamp = (v) => Math.min(255, Math.max(0, v));
    return `rgb(${clamp(r + amount)},${clamp(g + amount)},${clamp(b + amount)})`;
  }

  rgba(hex, alpha) {
    const { r, g, b } = this.hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // A soft, blurred glow blob — the basic building block behind almost
  // every other effect (ambient lights, particles, block auras).
  drawGlowCircle(ctx, x, y, radius, color, alpha = 1) {
    if (this.intensityScale <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha * Math.min(1, this.intensityScale);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, this.rgba(color, 0.9));
    grad.addColorStop(0.5, this.rgba(color, 0.35));
    grad.addColorStop(1, this.rgba(color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // The full layered "material" for one tetromino cell: outer bloom, a
  // glossy multi-stop gradient fill, an inner specular highlight, and a
  // crisp glowing rim — instead of one flat fillRect. `intensity` scales
  // the glow (locked blocks get a gentle version; the active piece and
  // effects can push it brighter).
  drawBlock(ctx, x, y, size, color, { intensity = 1, chromatic = false, highlightPhase = 0 } = {}) {
    const pad = 1.5;
    const V = TETRIS.VISUAL;
    const innerX = x + pad;
    const innerY = y + pad;
    const innerSize = size - pad * 2;

    ctx.save();

    // Outer bloom: a soft blurred halo behind the block.
    if (intensity > 0) {
      ctx.shadowColor = this.rgba(color, Math.min(0.9, 0.55 * intensity));
      ctx.shadowBlur = V.BLOCK_GLOW_BLUR * intensity * this.intensityScale;
    }

    // Optional chromatic fringe: two faint offset copies of the glow in
    // complementary hues, blended additively, for a subtle holographic
    // fringe on the boldest blocks (kept small so it reads as texture,
    // not a smeared double-image).
    if (chromatic && intensity > 0 && this.intensityScale > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.22 * intensity;
      ctx.fillStyle = 'rgba(80,200,255,1)';
      ctx.fillRect(x + pad - V.CHROMATIC_FRINGE_PX, y + pad, size - pad * 2, size - pad * 2);
      ctx.fillStyle = 'rgba(255,70,140,1)';
      ctx.fillRect(x + pad + V.CHROMATIC_FRINGE_PX, y + pad, size - pad * 2, size - pad * 2);
      ctx.restore();
      ctx.shadowColor = this.rgba(color, Math.min(0.9, 0.55 * intensity));
      ctx.shadowBlur = V.BLOCK_GLOW_BLUR * intensity;
    }

    // Glossy fill: dark corner -> base color -> bright corner.
    const grad = ctx.createLinearGradient(x + size * 0.12, y, x + size * 0.88, y + size);
    grad.addColorStop(0, this.shade(color, 42));
    grad.addColorStop(0.34, this.shade(color, 12));
    grad.addColorStop(0.68, color);
    grad.addColorStop(1, this.shade(color, -38));
    ctx.fillStyle = grad;
    ctx.fillRect(innerX, innerY, innerSize, innerSize);

    // Glow only needed once for the fill; turn it off before crisper detail.
    ctx.shadowBlur = 0;

    // A restrained diagonal glass facet adds material depth without hiding
    // cell edges or the piece's silhouette.
    ctx.save();
    ctx.beginPath();
    ctx.rect(innerX, innerY, innerSize, innerSize);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(innerX, innerY);
    ctx.lineTo(innerX + innerSize * 0.72, innerY);
    ctx.lineTo(innerX + innerSize * 0.34, innerY + innerSize * 0.34);
    ctx.lineTo(innerX, innerY + innerSize * 0.52);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.075)';
    ctx.fill();

    // Moving specular glint is reserved for the active piece. The renderer
    // passes a fixed phase when reduced motion is enabled.
    if (highlightPhase) {
      const sweep = (Math.sin(highlightPhase / 1700) + 1) * 0.5;
      const glintX = innerX + innerSize * (sweep * 1.45 - 0.2);
      const glint = ctx.createLinearGradient(glintX - 3, innerY, glintX + 3, innerY + innerSize);
      glint.addColorStop(0, 'rgba(255,255,255,0)');
      glint.addColorStop(0.5, 'rgba(255,255,255,0.2)');
      glint.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glint;
      ctx.fillRect(innerX, innerY, innerSize, innerSize);
    }
    ctx.restore();

    // Inner specular highlight: a small bright patch near the top-left,
    // like light catching a glass/gem facet.
    ctx.save();
    ctx.globalAlpha = TETRIS.VISUAL.BLOCK_INNER_HIGHLIGHT_ALPHA;
    const hl = ctx.createRadialGradient(
      x + size * 0.32, y + size * 0.3, 0,
      x + size * 0.32, y + size * 0.3, size * 0.5
    );
    hl.addColorStop(0, 'rgba(255,255,255,0.95)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl;
    ctx.fillRect(innerX, innerY, innerSize, innerSize);
    ctx.restore();

    // Bright upper/left bevel and a darker lower/right bevel give each cell
    // a consistent light direction, including in the small previews.
    ctx.lineCap = 'square';
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.38)';
    ctx.beginPath();
    ctx.moveTo(innerX + 1, innerY + 1);
    ctx.lineTo(innerX + innerSize - 1, innerY + 1);
    ctx.moveTo(innerX + 1, innerY + 1);
    ctx.lineTo(innerX + 1, innerY + innerSize - 1);
    ctx.stroke();
    ctx.strokeStyle = this.rgba(color, 0.82);
    ctx.beginPath();
    ctx.moveTo(innerX + 1, innerY + innerSize - 1);
    ctx.lineTo(innerX + innerSize - 1, innerY + innerSize - 1);
    ctx.moveTo(innerX + innerSize - 1, innerY + 1);
    ctx.lineTo(innerX + innerSize - 1, innerY + innerSize - 1);
    ctx.stroke();

    // A thin dark inner seam so adjacent same-color blocks still read as
    // separate cells rather than one fused shape.
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + pad + 1, y + pad + 1, size - pad * 2 - 2, size - pad * 2 - 2);

    ctx.restore();
  }

  // A glowing outline only — used for the ghost piece, so it reads as a
  // preview rather than a solid block.
  drawGlowOutline(ctx, x, y, size, color, alpha = 0.55) {
    ctx.save();
    ctx.fillStyle = this.rgba(color, Math.min(0.13, alpha * 0.2));
    ctx.fillRect(x + 3, y + 3, size - 6, size - 6);
    if (this.intensityScale > 0) {
      ctx.shadowColor = this.rgba(color, 0.8);
      ctx.shadowBlur = TETRIS.VISUAL.GHOST_GLOW_BLUR * this.intensityScale;
    }
    ctx.strokeStyle = this.rgba(color, alpha);
    ctx.lineWidth = 1.6;
    ctx.strokeRect(x + 2.5, y + 2.5, size - 5, size - 5);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = this.rgba(color, Math.min(0.36, alpha * 0.65));
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + size - 5);
    ctx.lineTo(x + size - 5, y + 5);
    ctx.stroke();
    ctx.restore();
  }
};
