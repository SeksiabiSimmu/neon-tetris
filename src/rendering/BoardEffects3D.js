import * as THREE from 'three';

const CLEAR_STRENGTH = [0, 0.32, 0.52, 0.76, 1];
const easeOut = (t) => 1 - (1 - t) ** 3;
const clamp01 = (value) => Math.max(0, Math.min(1, value));

/** Short-lived, board-local presentation. It never changes the simulation. */
export class BoardEffects3D {
  constructor(scene, blockGeometry, blockMaterials) {
    this.group = new THREE.Group();
    this.group.name = 'board-effects';
    scene.add(this.group);
    this.blockGeometry = blockGeometry;
    this.blockMaterials = blockMaterials;
    this.plane = new THREE.PlaneGeometry(1, 1);
    this.fragment = new THREE.TetrahedronGeometry(1, 0);
    this.ring = new THREE.TorusGeometry(1, 0.012, 4, 80);
    this.triangle = new THREE.RingGeometry(0.9, 1, 3);
    this.hexagon = new THREE.RingGeometry(0.94, 1, 6);
    this.items = [];
    this.drop = null;
    this.previousClearing = null;
    this.collapse = null;
    this.pulse = 0;
    this.light = new THREE.PointLight('#86eaff', 0, 550, 2);
    this.light.position.z = 58;
    this.group.add(this.light);
  }

  reset() {
    this.items.forEach(({ mesh }) => this._remove(mesh));
    this.items.length = 0;
    this._removeDrop();
    this.previousClearing = null;
    this.collapse = null;
    this.pulse = 0;
  }

  _remove(mesh) {
    this.group.remove(mesh);
    mesh.material?.dispose();
  }

  _removeDrop() {
    if (!this.drop) return;
    this.drop.meshes.forEach((mesh) => this.group.remove(mesh));
    this.drop = null;
  }

  _add(geometry, color, life, kind, extra = {}) {
    const material = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 1, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 12;
    this.group.add(mesh);
    this.items.push({ mesh, age: 0, life, kind, ...extra });
    return mesh;
  }

  _point(rect, cols, rows, col, row, z = 20) {
    return {
      x: rect.x + (col + 0.5) * rect.width / cols - rect.width / 2,
      y: rect.y + rect.height / 2 - (row + 0.5) * rect.height / rows,
      z,
    };
  }

  _burst(x, y, color, count, speed, settings) {
    if (settings.reducedMotion || settings.particleIntensity <= 0) return;
    const total = Math.round(count * settings.particleIntensity);
    for (let i = 0; i < total; i += 1) {
      const angle = Math.PI * 2 * (i / Math.max(1, total)) + Math.random() * 0.4;
      const distance = speed * (0.55 + Math.random() * 0.9);
      const mesh = this._add(i % 3 ? this.plane : this.fragment, color,
        360 + Math.random() * 390, 'particle', {
          vx: Math.cos(angle) * distance,
          vy: Math.sin(angle) * distance,
          angular: (Math.random() - 0.5) * 0.012,
        });
      mesh.position.set(x, y, 23 + Math.random() * 6);
      const size = 1.8 + Math.random() * 3.8;
      mesh.scale.set(size, size * (i % 3 ? 1.8 : 1), size);
    }
  }

  _ring(x, y, radius, color, life = 500, delay = 0, shape = 'circle') {
    const geometry = shape === 'triangle' ? this.triangle
      : shape === 'hexagon' ? this.hexagon : this.ring;
    const mesh = this._add(geometry, color, life, 'ring', { radius, delay, shape });
    mesh.position.set(x, y, 25);
    mesh.scale.setScalar(Math.max(1, radius * 0.3));
  }

  _flash(rect, color, strength, life = 220) {
    if (strength <= 0) return;
    const mesh = this._add(this.plane, color, life, 'flash', { strength });
    mesh.position.set(rect.x, rect.y, 17);
    mesh.scale.set(rect.width, rect.height, 1);
  }

  _beginClear(rows, rect, cols, boardRows, settings, color) {
    const strength = CLEAR_STRENGTH[Math.min(4, rows.length)] || 0.32;
    const cellHeight = rect.height / boardRows;
    rows.forEach((row) => {
      const y = this._point(rect, cols, boardRows, 0, row).y;
      const highlight = this._add(this.plane, color, 320, 'row', { strength });
      highlight.position.set(rect.x, y, 19);
      highlight.scale.set(rect.width, cellHeight * 0.92, 1);
      const sweep = this._add(this.plane, '#ffffff', 270, 'sweep', {
        left: rect.x - rect.width / 2, width: rect.width,
        strength,
      });
      sweep.position.set(rect.x - rect.width / 2, y, 24);
      sweep.scale.set(Math.max(8, cellHeight * (1.1 + strength)), cellHeight * 1.12, 1);
      this._burst(rect.x, y, color, Math.round(10 + strength * 24),
        100 + strength * 175, settings);
      if (settings.particleIntensity > 0) {
        const fragments = Math.round((4 + strength * 10) * settings.particleIntensity);
        for (let i = 0; i < fragments; i += 1) {
          const x = rect.x + (Math.random() - 0.5) * rect.width;
          this._burst(x, y, '#ffffff', 1, 70 + strength * 100, settings);
        }
      }
    });
    if (rows.length >= 3) this._ring(rect.x, this._point(rect, cols, boardRows, 0, rows[Math.floor(rows.length / 2)]).y,
      rect.width * (0.45 + strength * 0.2), color, 550);
    this._flash(rect, color, settings.glowIntensity * strength * 0.18, 170);
    this.pulse = Math.max(this.pulse, strength);
    this.light.color.set(color);
  }

  _startCollapse(rows, boardRows) {
    const cleared = new Set(rows);
    const shift = new Array(boardRows).fill(0);
    let next = rows.length;
    for (let original = 0; original < boardRows; original += 1) {
      if (cleared.has(original)) continue;
      shift[next] = next - original;
      next += 1;
    }
    this.collapse = { shift, age: 0, life: 220 };
  }

  getRowOffset(row, cellHeight, reducedMotion) {
    if (reducedMotion || !this.collapse) return 0;
    const { shift, age, life } = this.collapse;
    return (shift[row] || 0) * cellHeight * (1 - easeOut(clamp01(age / life)));
  }

  getHiddenLockCells() {
    if (!this.drop || this.drop.age >= this.drop.life) return null;
    return this.drop.locked;
  }

  _hardDrop(detail, rect, cols, rows, shapes, settings) {
    if (settings.reducedMotion || !shapes?.[detail.type]?.[detail.rotation]) return;
    this._removeDrop();
    const shape = shapes[detail.type][detail.rotation];
    const locked = new Set();
    const meshes = [];
    shape.forEach(([dx, dy]) => {
      const col = detail.col + dx;
      const row = detail.row + dy;
      if (row < 0) return;
      locked.add(`${col}:${row}`);
      const mesh = new THREE.Mesh(this.blockGeometry, this.blockMaterials.get(detail.type));
      mesh.renderOrder = 14;
      mesh.scale.set(rect.width / cols * 0.9, rect.height / rows * 0.9,
        Math.min(rect.width / cols, rect.height / rows) * 0.75);
      this.group.add(mesh);
      meshes.push({ mesh, col, dy });
    });
    this.drop = { meshes, locked, detail, age: 0, life: 125 };
    this.pulse = Math.max(this.pulse, 0.28);
  }

  _impact(detail, rect, cols, rows, settings, color, strength) {
    const cells = detail.cells || [];
    const centerCol = cells.length ? cells.reduce((sum, cell) => sum + cell.col, 0) / cells.length : detail.col + 1.5;
    const bottomRow = cells.length ? Math.max(...cells.map((cell) => cell.row)) : detail.row + 2;
    const point = this._point(rect, cols, rows, centerCol, bottomRow);
    if (!settings.reducedMotion) {
      this._ring(point.x, point.y, rect.width * (0.07 + strength * 0.22), color, 310);
      this._burst(point.x, point.y, color, Math.round(3 + strength * 14), 65 + strength * 90, settings);
    }
    this.light.color.set(color);
    this.pulse = Math.max(this.pulse, strength * 0.48);
  }

  _special(type, info, rect, settings) {
    if (settings.reducedMotion) return;
    const count = type === 'perfectClear' ? 6 : type === 'levelUp' ? 5
      : type === 'tSpin' ? 3 : Math.min(5, 1 + Math.ceil((info.comboCount || 1) / 2));
    const comboTier = Math.min(1, (info.comboCount || 0) / 8);
    const color = type === 'perfectClear' ? '#ffe9a3' : type === 'tSpin' ? '#d78bff'
      : type === 'levelUp' ? '#83eaff'
        : `#${new THREE.Color('#ffd47b').lerp(new THREE.Color('#ff61b9'), comboTier).getHexString()}`;
    const base = Math.min(rect.width, rect.height);
    for (let index = 0; index < count; index += 1) {
      this._ring(rect.x, rect.y, base * (0.22 + index * 0.13), color,
        580 + index * 55, index * 58,
        type === 'tSpin' ? 'triangle' : type === 'perfectClear' ? 'hexagon' : 'circle');
    }
    if (type === 'levelUp' || type === 'perfectClear') {
      for (let index = 0; index < 7; index += 1) {
        const beam = this._add(this.plane, color, 700, 'beam', {
          startY: rect.y - rect.height * 0.6,
          travel: rect.height * 1.35,
          delay: index * 42,
        });
        beam.position.set(rect.x + (index - 3) * rect.width / 8,
          rect.y - rect.height * 0.6, 18);
        beam.scale.set(3 + (index % 3) * 2, rect.height * 0.56, 1);
      }
    }
    const intensity = type === 'perfectClear' ? 1.3 : type === 'levelUp' ? 1.05
      : type === 'tSpin' ? 0.8 : Math.min(1, 0.25 + (info.comboCount || 1) * 0.1);
    this._burst(rect.x, rect.y, color, Math.round(18 + intensity * 60),
      140 + intensity * 140, settings);
    this._flash(rect, color, settings.glowIntensity * intensity * 0.2,
      type === 'perfectClear' ? 650 : 360);
    this.pulse = Math.max(this.pulse, intensity);
    this.light.color.set(color);
  }

  update(game, events, rect, settings, shapes, pieceColors, clearColor, dtMs) {
    const dt = Math.min(50, Math.max(0, dtMs ?? 16.7));
    const { cols, rows } = game.board;
    const clearing = game.clearingRows;
    if (clearing && clearing !== this.previousClearing) {
      this._beginClear(clearing, rect, cols, rows, settings, clearColor || '#85eaff');
    } else if (!clearing && this.previousClearing) {
      this._startCollapse(this.previousClearing, rows);
    }
    this.previousClearing = clearing;

    const perfectClear = events.some(({ type }) => type === 'perfectClear');
    events.forEach(({ type, detail }) => {
      if (type === 'hardDrop') this._hardDrop(detail, rect, cols, rows, shapes, settings);
      if (type === 'lock') this._impact(detail, rect, cols, rows, settings,
        pieceColors[detail.type] || '#8de9ff', 0.25);
      if (type === 'clear' && detail.linesCleared) {
        const strength = CLEAR_STRENGTH[Math.min(4, detail.linesCleared)];
        this._impact({ col: cols / 2 - 1.5, row: rows / 2 }, rect, cols, rows, settings,
          clearColor || '#8de9ff', strength);
        this._flash(rect, '#ffffff', settings.glowIntensity * strength * 0.16, 150);
      }
      if (['tSpin', 'combo', 'perfectClear', 'levelUp'].includes(type)
        && (!perfectClear || type === 'perfectClear')) {
        this._special(type, detail, rect, settings);
      }
    });

    if (this.drop) {
      this.drop.age += dt;
      const { detail, age, life } = this.drop;
      const t = easeOut(clamp01(age / life));
      const visualRow = detail.fromRow + (detail.row - detail.fromRow) * t;
      this.drop.meshes.forEach(({ mesh, col, dy }) => {
        const point = this._point(rect, cols, rows, col, visualRow + dy, 15);
        mesh.position.set(point.x, point.y, point.z);
        mesh.visible = visualRow + dy >= -0.5;
      });
      if (age >= life) {
        this._impact({ col: detail.col, row: detail.row }, rect, cols, rows, settings,
          pieceColors[detail.type] || '#8de9ff', 0.8);
        this._removeDrop();
      }
    }
    if (this.collapse) {
      this.collapse.age += dt;
      if (this.collapse.age >= this.collapse.life) this.collapse = null;
    }
    this.pulse *= Math.exp(-dt / 260);
    this.light.intensity = settings.reducedMotion ? 0 : this.pulse * settings.glowIntensity * 3.5;
    this.light.position.x = rect.x;
    this.light.position.y = rect.y;

    for (let index = this.items.length - 1; index >= 0; index -= 1) {
      const item = this.items[index];
      item.age += dt;
      if (item.age < item.delay) continue;
      const t = clamp01((item.age - (item.delay || 0)) / item.life);
      if (t >= 1 || settings.reducedMotion || (item.kind === 'particle' && settings.particleIntensity <= 0)) {
        this._remove(item.mesh);
        this.items.splice(index, 1);
        continue;
      }
      if (item.kind === 'particle') {
        item.mesh.position.x += item.vx * dt / 1000;
        item.mesh.position.y += item.vy * dt / 1000;
        item.vy -= dt * 0.08;
        item.mesh.rotation.z += item.angular * dt;
        item.mesh.material.opacity = (1 - t) ** 1.4 * settings.glowIntensity;
      } else if (item.kind === 'ring') {
        item.mesh.scale.setScalar(Math.max(1, item.radius * (0.3 + easeOut(t) * 0.7)));
        item.mesh.material.opacity = (1 - t) * 0.52 * settings.glowIntensity;
        if (item.shape === 'triangle') item.mesh.rotation.z = t * Math.PI * 1.5;
      } else if (item.kind === 'sweep') {
        item.mesh.position.x = item.left + item.width * easeOut(t);
        item.mesh.material.opacity = Math.sin(t * Math.PI) * item.strength * 0.65 * settings.glowIntensity;
      } else if (item.kind === 'row') {
        item.mesh.scale.y *= 1 - dt / 500;
        item.mesh.material.opacity = (1 - t) * item.strength * 0.5 * settings.glowIntensity;
      } else if (item.kind === 'flash') {
        item.mesh.material.opacity = item.strength * (1 - t) ** 2;
      } else if (item.kind === 'beam') {
        item.mesh.position.y = item.startY + item.travel * easeOut(t);
        item.mesh.material.opacity = Math.sin(Math.PI * t) * 0.3 * settings.glowIntensity;
      }
    }
  }

  dispose() {
    this.reset();
    this.group.parent?.remove(this.group);
    this.plane.dispose();
    this.fragment.dispose();
    this.ring.dispose();
    this.triangle.dispose();
    this.hexagon.dispose();
    this.light.dispose?.();
  }
}
