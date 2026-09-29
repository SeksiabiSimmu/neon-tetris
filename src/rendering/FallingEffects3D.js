import * as THREE from 'three';

const MAX_ITEMS = 96;
const SECOND_COLLECTION = new Set(['lava', 'wind', 'stardust', 'cherry-blossoms',
  'digital-glitch', 'ink', 'fireflies', 'soap-film', 'autumn-leaves', 'comet']);
const EFFECTS = new Set(['none', 'fire', 'bubbles', 'water', 'smoke', 'frost', 'lightning',
  ...SECOND_COLLECTION]);
const LINE_KINDS = new Set(['arc', 'wind-streak', 'wind-gust', 'constellation']);
const PALETTES = {
  fire: '#ff9b45', bubbles: '#89e6ff', water: '#69caff',
  smoke: '#bbc1d4', frost: '#c9f5ff', lightning: '#b3d2ff',
  lava: '#ff7b3d', wind: '#c8ebef', stardust: '#ffe5a4',
  'cherry-blossoms': '#f2a8c8', 'digital-glitch': '#82dff1', ink: '#8e81b4',
  fireflies: '#e8ef8f', 'soap-film': '#a8d9f8', 'autumn-leaves': '#d98243',
  comet: '#d7ebff',
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function shape(points) {
  const path = new THREE.Shape();
  points.forEach(([x, y], index) => (index ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();
  return new THREE.ShapeGeometry(path);
}

function star(points = 5, inner = 0.23, outer = 0.5) {
  return shape(Array.from({ length: points * 2 }, (_, index) => {
    const radius = index % 2 ? inner : outer;
    const angle = -Math.PI / 2 + index * Math.PI / points;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  }));
}

function curve(points) {
  return new THREE.BufferGeometry().setFromPoints(points.map(([x, y]) => new THREE.Vector3(x, y, 0)));
}

/** Board-local decoration driven only by observed piece motion and gameplay signals. */
export class FallingEffects3D {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'falling-effects';
    scene.add(this.group);
    this.effect = 'none';
    this.items = [];
    this.geometries = {
      flame: new THREE.ConeGeometry(0.5, 1, 3),
      bubble: new THREE.TorusGeometry(0.5, 0.075, 4, 12),
      drop: new THREE.SphereGeometry(0.5, 6, 4),
      wisp: new THREE.CircleGeometry(0.5, 12),
      crystal: new THREE.OctahedronGeometry(0.5, 0),
      arc: new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.5, 0.2, 0), new THREE.Vector3(-0.12, -0.15, 0),
        new THREE.Vector3(0.08, 0.12, 0), new THREE.Vector3(0.5, -0.22, 0),
      ]),
      spark: new THREE.TetrahedronGeometry(0.5, 0),
      splash: new THREE.RingGeometry(0.36, 0.5, 12),
      puff: new THREE.CircleGeometry(0.5, 16),
      halo: new THREE.RingGeometry(0.44, 0.5, 4),
      outline: new THREE.RingGeometry(0.44, 0.5, 4),
      molten: new THREE.DodecahedronGeometry(0.5, 0),
      'wind-streak': curve([[-0.5, -0.1], [-0.28, 0.08], [0.02, 0.18], [0.3, 0.1], [0.5, -0.12]]),
      star: star(),
      petal: shape([[-0.42, 0], [-0.14, 0.4], [0.17, 0.5], [0.45, 0.15],
        [0.3, -0.2], [0, -0.46], [-0.31, -0.27]]),
      pixel: new THREE.PlaneGeometry(1, 1),
      brush: shape([[-0.5, -0.16], [-0.32, 0.2], [0.24, 0.38], [0.5, 0.16],
        [0.3, -0.07], [-0.36, -0.33]]),
      firefly: new THREE.IcosahedronGeometry(0.5, 0),
      film: new THREE.RingGeometry(0.41, 0.5, 24),
      leaf: shape([[0, 0.5], [0.12, 0.26], [0.34, 0.32], [0.26, 0.1],
        [0.48, -0.04], [0.17, -0.18], [0.12, -0.48], [0, -0.3],
        [-0.12, -0.48], [-0.17, -0.18], [-0.48, -0.04], [-0.26, 0.1],
        [-0.34, 0.32], [-0.12, 0.26]]),
      comet: shape([[-0.5, 0.47], [0, 0.13], [0.45, 0.34], [0.18, -0.5],
        [-0.12, -0.28]]),
      cooling: new THREE.RingGeometry(0.35, 0.5, 10),
      'wind-gust': curve([[-0.5, -0.18], [-0.25, -0.02], [0, 0.04], [0.25, -0.02], [0.5, -0.18]]),
      constellation: curve([[-0.45, -0.12], [-0.18, 0.34], [0.12, 0.08], [0.42, 0.3]]),
      'petal-scatter': star(5, 0.38, 0.5),
      'glitch-burst': shape([[-0.5, -0.2], [-0.17, -0.2], [-0.17, 0.03],
        [0.13, 0.03], [0.13, 0.3], [0.5, 0.3], [0.5, -0.03], [0.28, -0.03],
        [0.28, -0.4], [-0.07, -0.4], [-0.07, -0.02], [-0.5, -0.02]]),
      splatter: shape([[0, 0.5], [0.11, 0.27], [0.36, 0.4], [0.24, 0.1],
        [0.49, -0.1], [0.21, -0.16], [0.16, -0.46], [-0.05, -0.28],
        [-0.36, -0.39], [-0.27, -0.11], [-0.49, 0.09], [-0.2, 0.17]]),
      'firefly-ring': new THREE.RingGeometry(0.42, 0.5, 7),
      'film-pop': new THREE.RingGeometry(0.46, 0.5, 32),
      'leaf-scatter': star(7, 0.32, 0.5),
      'comet-flare': shape([[-0.5, 0.04], [-0.12, 0.12], [0, 0.48], [0.13, 0.12],
        [0.5, 0.04], [0.13, -0.1], [0, -0.46], [-0.13, -0.1]]),
    };
    this.lastPiece = null;
    this.lastRunId = null;
    this.lastState = null;
    this.lastHardDropId = null;
    this.lastLockId = null;
    this.pendingDropLanding = null;
    this.followPoint = null;
    this.disposed = false;
  }

  setEffect(id) {
    const next = EFFECTS.has(id) ? id : 'none';
    if (next !== this.effect) {
      this.reset();
      this.effect = next;
    }
  }

  reset() {
    while (this.items.length) this._remove(this.items.pop());
    this.lastPiece = null;
    this.lastRunId = null;
    this.lastState = null;
    this.lastHardDropId = null;
    this.lastLockId = null;
    this.pendingDropLanding = null;
    this.followPoint = null;
  }

  _remove(item) {
    this.group.remove(item.mesh);
    item.mesh.material.dispose();
  }

  _point(rect, cols, rows, col, row, z = 2.4) {
    return new THREE.Vector3(
      rect.x - rect.width / 2 + (col + 0.5) * rect.width / cols,
      rect.y + rect.height / 2 - (row + 0.5) * rect.height / rows,
      z,
    );
  }

  _add(role, kind, position, size, life, tint, { vx = 0, vy = 0, growth = 0,
    spin = 0, opacity = 0.55, follow = 0, aspectX = 1, aspectY = 1,
    pop = false } = {}) {
    const isArc = LINE_KINDS.has(kind);
    const material = isArc ? new THREE.LineBasicMaterial({ color: tint, transparent: true,
      opacity, depthWrite: false, blending: THREE.AdditiveBlending })
      : new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity,
        depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const geometry = this.geometries[kind];
    const mesh = isArc ? new THREE.Line(geometry, material) : new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.scale.set(size * aspectX, size * aspectY, size);
    mesh.renderOrder = 7;
    this.group.add(mesh);
    const item = { mesh, role, kind, age: 0, life, size, vx, vy, growth, spin,
      opacity, follow, aspectX, aspectY, pop };
    this.items.push(item);
    if (this.items.length > MAX_ITEMS) this._remove(this.items.shift());
    return item;
  }

  _trailShape() {
    return { fire: 'flame', bubbles: 'bubble', water: 'drop', smoke: 'wisp',
      frost: 'crystal', lightning: 'arc', lava: 'molten', wind: 'wind-streak',
      stardust: 'star', 'cherry-blossoms': 'petal', 'digital-glitch': 'pixel',
      ink: 'brush', fireflies: 'firefly', 'soap-film': 'film',
      'autumn-leaves': 'leaf', comet: 'comet' }[this.effect];
  }

  _trailAt(point, cell, role = 'trail', accent) {
    const kind = this._trailShape();
    const random = Math.random();
    const tint = accent || (this.effect === 'soap-film'
      ? new THREE.Color().setHSL(0.48 + random * 0.38, 0.68, 0.78)
      : this.effect === 'autumn-leaves' && random > 0.5 ? '#e5a453' : PALETTES[this.effect]);
    const properties = {
      fire: { life: 240, size: cell * 0.24, vx: (random - 0.5) * 18, vy: 26, spin: 0.002 },
      bubbles: { life: 390, size: cell * 0.21, vx: (random - 0.5) * 17, vy: 21, growth: 0.2 },
      water: { life: 270, size: cell * 0.17, vx: (random - 0.5) * 13, vy: -24 },
      smoke: { life: 490, size: cell * 0.3, vx: (random - 0.5) * 15, vy: 15, growth: 0.9, opacity: 0.25 },
      frost: { life: 350, size: cell * 0.17, vx: (random - 0.5) * 8, vy: 4, spin: 0.0017 },
      lightning: { life: 110, size: cell * 0.54, vx: 0, vy: 0, opacity: 0.72 },
      lava: { life: 390, size: cell * 0.22, vx: (random - 0.5) * 12,
        vy: -26, spin: 0.001, opacity: 0.7 },
      wind: { life: 260, size: cell * 0.68, vx: 45 + random * 15,
        vy: (random - 0.5) * 12, opacity: 0.48 },
      stardust: { life: 440, size: cell * 0.16, vx: (random - 0.5) * 10,
        vy: 11, spin: 0.0018, opacity: 0.68 },
      'cherry-blossoms': { life: 510, size: cell * 0.25, vx: 11 + random * 15,
        vy: -14, spin: 0.0025 + random * 0.001, opacity: 0.62 },
      'digital-glitch': { life: 95, size: cell * 0.13, vx: (random - 0.5) * 40,
        vy: 0, opacity: 0.62 },
      ink: { life: 240, size: cell * 0.36, vx: (random - 0.5) * 5,
        vy: -6, growth: -0.32, opacity: 0.5 },
      fireflies: { life: 620, size: cell * 0.1, vx: (random - 0.5) * 4,
        vy: 3, follow: 0.0018, opacity: 0.76 },
      'soap-film': { life: 410, size: cell * 0.25, vx: (random - 0.5) * 9,
        vy: 13, growth: 0.8, aspectX: 0.82, aspectY: 1.34, pop: true, opacity: 0.5 },
      'autumn-leaves': { life: 530, size: cell * 0.29, vx: 12 + random * 12,
        vy: -19, spin: -0.0018 - random * 0.001, opacity: 0.61 },
      comet: { life: 190, size: cell * 0.35, vx: (random - 0.5) * 6,
        vy: 18, growth: -0.45, opacity: 0.72 },
    }[this.effect];
    const { life, size, ...motion } = properties;
    return this._add(role, kind, point, size, life, tint, motion);
  }

  _emitMovement(previous, current, rect, cols, rows, dt, intensity, soft) {
    const distance = current.row - previous.row;
    if (distance <= 0 || current.col !== previous.col || current.rotation !== previous.rotation) return;
    const cell = Math.min(rect.width / cols, rect.height / rows);
    const count = Math.min(this.effect === 'fireflies' ? 1
      : ['cherry-blossoms', 'autumn-leaves', 'soap-film'].includes(this.effect) ? 3 : 8,
    Math.ceil(Math.min(distance, 3)
      * (soft ? 2.4 : 1.5) * clamp(dt / 16.7, 0.4, 1.5) * intensity));
    const cells = current.cells.filter(({ row }) => row >= 0 && row < rows);
    if (!cells.length) return;
    for (let index = 0; index < count; index += 1) {
      const anchor = cells[index % cells.length];
      const along = (index + 0.4) / Math.max(1, count) * Math.min(distance, 2.5);
      const point = this._point(rect, cols, rows, anchor.col, anchor.row - along);
      point.x += (Math.random() - 0.5) * cell * 0.26;
      if (this.effect === 'soap-film') point.x += (index % 2 ? 1 : -1) * cell * 0.3;
      const item = this._trailAt(point, cell);
      if (this.effect === 'comet') {
        item.size *= 1 - index / Math.max(1, count) * 0.6;
        item.mesh.scale.setScalar(item.size);
      }
    }
  }

  _emitDrop(detail, rect, cols, rows, shapes, intensity) {
    const offsets = shapes?.[detail.type]?.[detail.rotation]
      || (this.lastState?.type === detail.type && this.lastState.rotation === detail.rotation
        ? this.lastState.cells.map((cell) => [cell.col - this.lastState.col,
          cell.row - this.lastState.row]) : null);
    if (!offsets || detail.row <= detail.fromRow) return;
    const cell = Math.min(rect.width / cols, rect.height / rows);
    const samples = this.effect === 'comet' ? Math.min(8, detail.row - detail.fromRow)
      : Math.min(4, Math.ceil((detail.row - detail.fromRow) / 3));
    for (let sample = 0; sample < samples; sample += 1) {
      const row = detail.row - (sample + 0.6) / samples
        * Math.min(detail.row - detail.fromRow, 5);
      const [dx, dy] = offsets[sample % offsets.length];
      if (row + dy < 0 || row + dy >= rows) continue;
      const point = this._point(rect, cols, rows, detail.col + dx, row + dy, 2.2);
      if (sample / samples <= intensity) {
        const item = this._trailAt(point, cell, 'drop');
        if (this.effect === 'comet') {
          item.size *= 1.6 * (1 - sample / samples * 0.75);
          item.mesh.scale.setScalar(item.size);
        }
      }
    }
  }

  _impact(detail, rect, cols, rows, intensity) {
    const cells = detail.cells?.filter((cell) => cell.row >= 0 && cell.row < rows) || [];
    const bottom = cells.length ? Math.max(...cells.map((cell) => cell.row)) : detail.row;
    const contact = cells.filter((cell) => cell.row === bottom);
    const col = contact.length ? contact.reduce((sum, cell) => sum + cell.col, 0) / contact.length
      : detail.col + 1;
    const point = this._point(rect, cols, rows, col, clamp(bottom, 0, rows - 1), 2.7);
    const cell = Math.min(rect.width / cols, rect.height / rows);
    if (SECOND_COLLECTION.has(this.effect)) {
      this._impactSecond(point, contact, bottom, rect, cols, rows, cell, intensity);
      return;
    }
    const kind = { fire: 'spark', bubbles: 'bubble', water: 'splash', smoke: 'puff',
      frost: 'halo', lightning: 'outline' }[this.effect];
    const size = cell * ({ fire: 0.55, bubbles: 0.8, water: 1.15, smoke: 1.05,
      frost: 1.3, lightning: 1.4 }[this.effect]);
    this._add('impact', kind, point, size, this.effect === 'lightning' ? 135 : 280,
      PALETTES[this.effect], {
        growth: this.effect === 'smoke' || this.effect === 'bubbles' ? 1.3 : 0.55,
        vy: this.effect === 'fire' || this.effect === 'bubbles' ? 14 : 0,
        opacity: clamp(intensity * 0.7, 0.1, 0.75),
      });
    const detailCount = Math.round((this.effect === 'frost' || this.effect === 'lightning' ? 2 : 3) * intensity);
    for (let index = 0; index < detailCount; index += 1) {
      const edge = this._point(rect, cols, rows,
        contact[index % Math.max(contact.length, 1)]?.col ?? col,
        clamp(bottom, 0, rows - 1), 2.3);
      edge.x += (index - (detailCount - 1) / 2) * cell * 0.42;
      if (this.effect === 'fire' || this.effect === 'frost') {
        this._add('impact-detail', this.effect === 'fire' ? 'spark' : 'crystal', edge,
          cell * 0.14, 210, PALETTES[this.effect], {
            vx: (index - 1) * 22, vy: this.effect === 'fire' ? 28 : 2,
          });
      } else this._trailAt(edge, cell, 'impact-detail');
    }
  }

  _impactSecond(point, contact, bottom, rect, cols, rows, cell, intensity) {
    const design = {
      lava: { kind: 'cooling', size: 1.05, life: 340, growth: 0.65 },
      wind: { kind: 'wind-gust', size: 1.9, life: 220, growth: 0.6 },
      stardust: { kind: 'constellation', size: 1.8, life: 370, growth: 0.25 },
      'cherry-blossoms': { kind: 'petal-scatter', size: 1.05, life: 350, growth: 0.5 },
      'digital-glitch': { kind: 'glitch-burst', size: 0.85, life: 120, growth: 0.2 },
      ink: { kind: 'splatter', size: 1.0, life: 310, growth: -0.12 },
      fireflies: { kind: 'firefly-ring', size: 1.1, life: 370, growth: 1.2 },
      'soap-film': { kind: 'film-pop', size: 1.0, life: 210, growth: 1.5 },
      'autumn-leaves': { kind: 'leaf-scatter', size: 1.1, life: 340, growth: 0.45 },
      comet: { kind: 'comet-flare', size: 1.35, life: 190, growth: 0.8 },
    }[this.effect];
    this._add('impact', design.kind, point, cell * design.size, design.life,
      PALETTES[this.effect], { growth: design.growth, opacity: 0.64 * intensity,
        pop: this.effect === 'soap-film' });
    const count = Math.max(1, Math.round((this.effect === 'fireflies' ? 4 : 3) * intensity));
    const detailKind = {
      lava: 'spark', wind: 'wind-streak', stardust: 'star',
      'cherry-blossoms': 'petal', 'digital-glitch': 'pixel', ink: 'brush',
      fireflies: 'firefly', 'soap-film': 'film', 'autumn-leaves': 'leaf', comet: 'comet',
    }[this.effect];
    for (let index = 0; index < count; index += 1) {
      const target = contact[index % Math.max(1, contact.length)];
      const origin = target
        ? this._point(rect, cols, rows, target.col, clamp(bottom, 0, rows - 1), 2.2)
        : point.clone().setZ(2.2);
      const direction = index - (count - 1) / 2;
      origin.x += direction * cell * 0.18;
      const motion = {
        lava: { vx: direction * 25, vy: 18, spin: 0.003, opacity: 0.7 },
        wind: { vx: direction * 55, vy: 3, opacity: 0.46 },
        stardust: { vx: direction * 18, vy: 13, spin: 0.002, opacity: 0.7 },
        'cherry-blossoms': { vx: direction * 32, vy: -13, spin: 0.003 },
        'digital-glitch': { vx: direction * 27, vy: 0, opacity: 0.7 },
        ink: { vx: direction * 17, vy: -8, growth: -0.35 },
        fireflies: { vx: direction * 27, vy: 17, opacity: 0.73 },
        'soap-film': { vx: direction * 24, vy: 12, growth: 0.8,
          aspectX: 0.9, aspectY: 1.25, pop: true },
        'autumn-leaves': { vx: direction * 29, vy: -15, spin: 0.003 },
        comet: { vx: direction * 24, vy: 22, growth: -0.5 },
      }[this.effect];
      this._add('impact-detail', detailKind, origin,
        cell * (this.effect === 'wind' ? 0.66 : 0.2),
        this.effect === 'digital-glitch' ? 105 : 320,
        this.effect === 'lava' ? '#a6a09b' : PALETTES[this.effect], motion);
    }
  }

  _advance(dt) {
    for (let index = this.items.length - 1; index >= 0; index -= 1) {
      const item = this.items[index];
      item.age += dt;
      if (item.age >= item.life) {
        this._remove(item);
        this.items.splice(index, 1);
        continue;
      }
      const t = item.age / item.life;
      item.mesh.position.x += item.vx * dt / 1000;
      item.mesh.position.y += item.vy * dt / 1000;
      if (item.follow && this.followPoint) {
        item.mesh.position.lerp(this.followPoint, clamp(item.follow * dt, 0, 0.1));
      }
      item.mesh.rotation.z += item.spin * dt;
      const pop = item.pop && t > 0.78 ? (1 - t) / 0.22 : 1;
      const scale = item.size * (1 + item.growth * t) * pop;
      item.mesh.scale.set(scale * item.aspectX, scale * item.aspectY, scale);
      item.mesh.material.opacity = item.opacity * (1 - t) ** 1.5;
    }
  }

  _disperseFireflies(detail, rect, cols, rows) {
    if (this.effect !== 'fireflies') return;
    const center = this._point(rect, cols, rows, detail.col + 1, detail.row);
    let index = 0;
    this.items.forEach((item) => {
      if (item.role !== 'trail' || item.kind !== 'firefly') return;
      item.follow = 0;
      const side = Math.sign(item.mesh.position.x - center.x) || (index % 2 ? 1 : -1);
      item.vx = side * (19 + index % 3 * 6);
      item.vy = 15 + index % 2 * 8;
      item.life = Math.min(item.life, item.age + 260);
      index += 1;
    });
  }

  update({ game, events = [], boardRect, settings = {}, dtMs = 0, colors = {}, shapes = null } = {}) {
    if (this.disposed || !game?.board || !boardRect) return;
    const runChanged = this.lastRunId !== null && this.lastRunId !== game.runId;
    const pieceChanged = this.lastPiece && this.lastPiece !== game.activePiece;
    if (runChanged || pieceChanged || events.some(({ type }) => type === 'spawn' || type === 'hold')) this.reset();
    this.lastRunId = game.runId;
    if (this.effect === 'none' || settings.reducedMotion || (settings.particleIntensity ?? 1) <= 0) {
      this.reset();
      this.lastRunId = game.runId;
      this.lastPiece = game.activePiece;
      return;
    }
    if (game.state !== 'PLAYING' || dtMs <= 0) return;
    const dt = clamp(dtMs, 0, 50);
    const { cols, rows } = game.board;
    const intensity = clamp(settings.particleIntensity ?? 1, 0, 1);
    const active = game.activePiece;
    const current = active ? {
      type: active.type, col: active.col, row: active.row, rotation: active.rotation,
      cells: active.getCells(),
    } : null;
    this.followPoint = current?.cells.length
      ? this._point(boardRect, cols, rows,
        current.cells.reduce((sum, cell) => sum + cell.col, 0) / current.cells.length,
        Math.min(...current.cells.map((cell) => cell.row)) - 0.6, 2.1)
      : null;
    this._advance(dt);
    if (active && this.lastPiece === active && this.lastState && current) {
      const soft = events.some(({ type, detail }) => type === 'fall' && detail?.isSoftDropping)
        || !!game.isSoftDropping;
      this._emitMovement(this.lastState, current, boardRect, cols, rows, dt, intensity, soft);
    }
    this.lastPiece = active;
    this.lastState = current;

    const hardDrop = events.find(({ type, detail }) => type === 'hardDrop'
      && detail?.id !== this.lastHardDropId)?.detail;
    if (hardDrop) {
      this.lastHardDropId = hardDrop.id;
      this.pendingDropLanding = {
        key: `${hardDrop.type}:${hardDrop.col}:${hardDrop.row}:${hardDrop.rotation}`,
        impactEmitted: false,
      };
      this._emitDrop(hardDrop, boardRect, cols, rows, shapes, intensity);
    }
    const lock = events.find(({ type, detail }) => type === 'lock'
      && detail?.id !== this.lastLockId)?.detail;
    if (lock) {
      this.lastLockId = lock.id;
      this._disperseFireflies(lock, boardRect, cols, rows);
      const key = `${lock.type}:${lock.col}:${lock.row}:${lock.rotation}`;
      if (!this.pendingDropLanding?.impactEmitted || this.pendingDropLanding.key !== key) {
        this._impact(lock, boardRect, cols, rows, intensity);
      }
      this.pendingDropLanding = null;
    } else if (hardDrop) {
      this._disperseFireflies(hardDrop, boardRect, cols, rows);
      this._impact(hardDrop, boardRect, cols, rows, intensity);
      this.pendingDropLanding.impactEmitted = true;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.reset();
    this.group.parent?.remove(this.group);
    Object.values(this.geometries).forEach((geometry) => geometry.dispose());
    this.disposed = true;
  }
}
