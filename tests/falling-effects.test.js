import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FallingEffects3D } from '../src/rendering/FallingEffects3D.js';

const boardRect = { x: 0, y: 0, width: 300, height: 600 };
const shapes = { T: [[[0, 0], [1, 0], [2, 0], [1, 1]]] };
const settings = { reducedMotion: false, particleIntensity: 1 };
const colors = { T: '#a070ff' };

function piece(row = 2) {
  return { type: 'T', col: 3, row, rotation: 0,
    getCells(col = this.col, atRow = this.row) {
      return shapes.T[0].map(([dx, dy]) => ({ col: col + dx, row: atRow + dy }));
    } };
}

function game(activePiece, runId = 1, state = 'PLAYING') {
  return { activePiece, runId, state, board: { cols: 10, rows: 20 } };
}

function update(effects, currentGame, events = [], dtMs = 16) {
  effects.update({ game: currentGame, events, boardRect, settings, dtMs, colors, shapes });
}

test('only downward motion emits a short trail and spawn, hold, and run changes clear history', () => {
  const scene = new THREE.Scene();
  const effects = new FallingEffects3D(scene);
  effects.setEffect('fire');
  const active = piece();
  const currentGame = game(active);
  update(effects, currentGame);
  assert.equal(effects.items.length, 0);
  active.col += 2;
  update(effects, currentGame, [{ type: 'move' }]);
  assert.equal(effects.items.length, 0);
  active.rotation = 1;
  update(effects, currentGame, [{ type: 'rotate' }]);
  assert.equal(effects.items.length, 0);
  active.rotation = 0;
  update(effects, currentGame);
  active.row += 2;
  update(effects, currentGame, [{ type: 'fall', detail: { isSoftDropping: true } }]);
  assert.ok(effects.items.some((item) => item.role === 'trail'));
  assert.ok(effects.items.every((item) => item.mesh.position.z < 4));
  update(effects, currentGame, [{ type: 'hold' }]);
  assert.equal(effects.items.length, 0);
  active.row += 1;
  update(effects, currentGame);
  assert.ok(effects.items.length > 0);
  currentGame.activePiece = piece();
  update(effects, currentGame, [{ type: 'spawn' }]);
  assert.equal(effects.items.length, 0);
  currentGame.runId = 2;
  update(effects, currentGame);
  assert.equal(effects.items.length, 0);
  effects.dispose();
  assert.equal(scene.children.length, 0);
});

test('hard drop and lock on the same frame create one impact and duplicate events do not repeat it', () => {
  const effects = new FallingEffects3D(new THREE.Scene());
  effects.setEffect('water');
  const currentGame = game(null);
  const hardDrop = { id: 10, type: 'T', col: 3, fromRow: 2, row: 17, rotation: 0 };
  const lock = { id: 20, type: 'T', col: 3, row: 17, rotation: 0,
    cells: [{ col: 3, row: 17 }, { col: 4, row: 17 }, { col: 5, row: 17 }, { col: 4, row: 18 }] };
  const events = [{ type: 'hardDrop', detail: hardDrop }, { type: 'lock', detail: lock }];
  update(effects, currentGame, events);
  assert.equal(effects.items.filter((item) => item.role === 'impact').length, 1);
  assert.ok(effects.items.some((item) => item.role === 'drop'));
  update(effects, currentGame, events);
  assert.equal(effects.items.filter((item) => item.role === 'impact').length, 1);
  effects.dispose();
});

test('a lock following its hard drop on the next frame does not repeat the landing', () => {
  const effects = new FallingEffects3D(new THREE.Scene());
  effects.setEffect('fire');
  const currentGame = game(null);
  update(effects, currentGame, [{ type: 'hardDrop', detail: {
    id: 7, type: 'T', col: 3, fromRow: 2, row: 17, rotation: 0,
  } }]);
  assert.equal(effects.items.filter((item) => item.role === 'impact').length, 1);
  update(effects, currentGame, [{ type: 'lock', detail: {
    id: 8, type: 'T', col: 3, row: 17, rotation: 0,
    cells: [{ col: 3, row: 17 }, { col: 4, row: 17 }, { col: 5, row: 17 }, { col: 4, row: 18 }],
  } }]);
  assert.equal(effects.items.filter((item) => item.role === 'impact').length, 1);
  effects.dispose();
});

test('each effect has a distinct trail shape and landing reaction', () => {
  const signatures = new Set();
  for (const id of ['fire', 'bubbles', 'water', 'smoke', 'frost', 'lightning']) {
    const effects = new FallingEffects3D(new THREE.Scene());
    effects.setEffect(id);
    const active = piece();
    const currentGame = game(active);
    update(effects, currentGame);
    active.row += 1;
    update(effects, currentGame, [{ type: 'fall', detail: { isSoftDropping: false } }]);
    const trail = effects.items.find((item) => item.role === 'trail');
    assert.ok(trail, `${id} emitted a trail`);
    update(effects, currentGame, [{ type: 'lock', detail: { id: 1, type: 'T', col: 3, row: 3,
      cells: active.getCells() } }]);
    const impact = effects.items.find((item) => item.role === 'impact');
    assert.ok(impact, `${id} emitted a landing reaction`);
    signatures.add(`${trail.kind}:${trail.mesh.geometry.type}:${impact.kind}:${impact.mesh.geometry.type}`);
    effects.dispose();
  }
  assert.equal(signatures.size, 6);
});

test('particles stay bounded, expire, pause freezes, and reduced motion clears them', () => {
  const effects = new FallingEffects3D(new THREE.Scene());
  effects.setEffect('smoke');
  const active = piece();
  const currentGame = game(active);
  update(effects, currentGame);
  for (let index = 0; index < 180; index += 1) {
    active.row = 2 + index % 12;
    update(effects, currentGame, [{ type: 'fall', detail: { isSoftDropping: true } }], 1);
    assert.ok(effects.items.length <= 96);
  }
  assert.equal(effects.items.length, 96);
  const age = effects.items[0].age;
  currentGame.state = 'PAUSED';
  update(effects, currentGame, [], 50);
  assert.equal(effects.items[0].age, age);
  currentGame.state = 'PLAYING';
  for (let index = 0; index < 30; index += 1) update(effects, currentGame, [], 50);
  assert.equal(effects.items.length, 0);
  active.row += 1;
  update(effects, currentGame);
  assert.ok(effects.items.length > 0);
  effects.update({ game: currentGame, events: [], boardRect,
    settings: { ...settings, reducedMotion: true }, dtMs: 16, colors, shapes });
  assert.equal(effects.items.length, 0);
  effects.dispose();
});

const secondCollection = [
  'lava', 'wind', 'stardust', 'cherry-blossoms', 'digital-glitch',
  'ink', 'fireflies', 'soap-film', 'autumn-leaves', 'comet',
];

test('ten new effects render ten distinct movement silhouettes and landing designs', () => {
  const trailSignatures = new Set();
  const landingSignatures = new Set();
  for (const id of secondCollection) {
    const effects = new FallingEffects3D(new THREE.Scene());
    effects.setEffect(id);
    const active = piece();
    const currentGame = game(active);
    update(effects, currentGame);
    active.row += 2;
    update(effects, currentGame, [{ type: 'fall', detail: { isSoftDropping: true } }]);
    const trail = effects.items.find((item) => item.role === 'trail');
    assert.ok(trail, `${id} has movement decoration`);
    assert.ok(trail.mesh.position.z < 4, `${id} stays behind the active piece`);
    trailSignatures.add(`${trail.kind}:${trail.mesh.geometry.type}`);
    update(effects, currentGame, [{ type: 'lock', detail: {
      id: 1, type: 'T', col: 3, row: 4, rotation: 0, cells: active.getCells(),
    } }]);
    const landing = effects.items.find((item) => item.role === 'impact');
    assert.ok(landing, `${id} has a landing reaction`);
    landingSignatures.add(`${landing.kind}:${landing.mesh.geometry.type}`);
    effects.dispose();
  }
  assert.equal(trailSignatures.size, 10);
  assert.equal(landingSignatures.size, 10);
});

test('new effect motion follows its material and comet hard drops taper', () => {
  const expected = {
    lava: (item) => item.vy < 0 && item.life > 250,
    wind: (item) => Math.abs(item.vx) > Math.abs(item.vy) && item.mesh.isLine,
    stardust: (item) => item.vy > 0 && item.spin !== 0,
    'cherry-blossoms': (item) => item.spin !== 0 && item.vy < 0,
    'digital-glitch': (item) => item.life <= 150 && item.spin === 0,
    ink: (item) => item.life < 300 && item.growth < 0,
    fireflies: (item) => item.follow > 0 && item.life > 400,
    'soap-film': (item) => item.aspectY > item.aspectX && item.growth > 0,
    'autumn-leaves': (item) => item.spin !== 0 && Math.abs(item.vx) > 0,
    comet: (item) => item.life < 250 && item.vy > 0,
  };
  for (const id of secondCollection) {
    const effects = new FallingEffects3D(new THREE.Scene());
    effects.setEffect(id);
    const active = piece();
    const currentGame = game(active);
    update(effects, currentGame);
    active.row += 1;
    update(effects, currentGame, [{ type: 'fall' }]);
    assert.ok(expected[id](effects.items.find((item) => item.role === 'trail')),
      `${id} has its specified movement character`);
    effects.dispose();
  }
  const effects = new FallingEffects3D(new THREE.Scene());
  effects.setEffect('comet');
  update(effects, game(null), [{ type: 'hardDrop', detail: {
    id: 1, type: 'T', col: 3, fromRow: 2, row: 17, rotation: 0,
  } }]);
  const streaks = effects.items.filter((item) => item.role === 'drop');
  assert.ok(streaks.length >= 5);
  assert.ok(streaks[0].size > streaks.at(-1).size);
  effects.dispose();
});

test('second collection retains caps, pause, reduced motion, and duplicate landing protection', () => {
  for (const id of secondCollection) {
    const effects = new FallingEffects3D(new THREE.Scene());
    effects.setEffect(id);
    const active = piece();
    const currentGame = game(active);
    update(effects, currentGame);
    for (let frame = 0; frame < 160; frame += 1) {
      active.row = 2 + frame % 12;
      update(effects, currentGame, [{ type: 'fall' }], 1);
      assert.ok(effects.items.length <= 96, `${id} stays capped`);
    }
    const lock = { id: 9, type: 'T', col: 3, row: 17, rotation: 0,
      cells: [{ col: 3, row: 17 }, { col: 4, row: 17 }, { col: 5, row: 17 }, { col: 4, row: 18 }] };
    update(effects, currentGame, [{ type: 'lock', detail: lock }]);
    const impactCount = effects.items.filter((item) => item.role === 'impact').length;
    update(effects, currentGame, [{ type: 'lock', detail: lock }]);
    assert.equal(effects.items.filter((item) => item.role === 'impact').length, impactCount,
      `${id} deduplicates its landing`);
    const age = effects.items[0].age;
    currentGame.state = 'PAUSED';
    update(effects, currentGame, [], 50);
    assert.equal(effects.items[0].age, age, `${id} freezes on pause`);
    effects.update({ game: currentGame, events: [], boardRect,
      settings: { ...settings, reducedMotion: true }, dtMs: 16, colors, shapes });
    assert.equal(effects.items.length, 0, `${id} clears for reduced motion`);
    effects.dispose();
  }
});

test('hard-drop landing details remain at the reported contact edge without lock cells', () => {
  const effects = new FallingEffects3D(new THREE.Scene());
  effects.setEffect('ink');
  update(effects, game(null), [{ type: 'hardDrop', detail: {
    id: 11, type: 'T', col: 0, fromRow: 2, row: 17, rotation: 0,
  } }]);
  const impact = effects.items.find((item) => item.role === 'impact');
  const details = effects.items.filter((item) => item.role === 'impact-detail');
  assert.ok(details.length > 0);
  assert.ok(details.every((item) => Math.abs(item.mesh.position.x - impact.mesh.position.x) < 45));
  effects.dispose();
});

test('firefly followers disperse when their piece locks', () => {
  const effects = new FallingEffects3D(new THREE.Scene());
  effects.setEffect('fireflies');
  const active = piece();
  const currentGame = game(active);
  update(effects, currentGame);
  active.row += 1;
  update(effects, currentGame, [{ type: 'fall' }]);
  const follower = effects.items.find((item) => item.role === 'trail');
  assert.ok(follower.follow > 0);
  update(effects, currentGame, [{ type: 'lock', detail: {
    id: 1, type: 'T', col: 3, row: 3, rotation: 0, cells: active.getCells(),
  } }]);
  assert.equal(follower.follow, 0);
  assert.ok(Math.abs(follower.vx) > 5);
  effects.dispose();
});
