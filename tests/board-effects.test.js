import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BoardEffects3D } from '../src/rendering/BoardEffects3D.js';

const rect = { x: 0, y: 0, width: 300, height: 600 };
const settings = { reducedMotion: false, particleIntensity: 1, glowIntensity: 1 };
const shapes = { I: [[[0, 1], [1, 1], [2, 1], [3, 1]]] };
const colors = { I: '#4dd8ff' };

test('3D clear, special, drop, and collapse effects expire without lingering meshes', () => {
  const scene = new THREE.Scene();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshPhysicalMaterial();
  const effects = new BoardEffects3D(scene, geometry, new Map([['I', material]]));
  const game = { board: { cols: 10, rows: 20 }, clearingRows: [19] };

  effects.update(game, [], rect, settings, shapes, colors, '#8deaff', 16);
  assert.ok(effects.items.some((item) => item.kind === 'row'));
  assert.ok(effects.items.some((item) => item.kind === 'sweep'));
  assert.ok(effects.items.some((item) => item.kind === 'particle'));

  game.clearingRows = null;
  const info = { linesCleared: 4, comboCount: 4, isPerfectClear: true };
  effects.update(game, [
    { type: 'clear', detail: info },
    { type: 'combo', detail: info },
    { type: 'perfectClear', detail: info },
  ], rect, settings, shapes, colors, '#8deaff', 16);
  assert.ok(effects.getRowOffset(1, 30, false) > 0);
  assert.ok(effects.items.some((item) => item.shape === 'hexagon'));
  assert.ok(effects.items.some((item) => item.kind === 'beam'));
  assert.equal(effects.items.some((item) => item.shape === 'circle' && item.delay > 0), false);

  effects.update(game, [{ type: 'hardDrop', detail: {
    type: 'I', col: 3, fromRow: 0, row: 17, rotation: 0,
  } }], rect, settings, shapes, colors, '#8deaff', 16);
  assert.ok(effects.getHiddenLockCells()?.has('3:18'));
  for (let frame = 0; frame < 30; frame += 1) {
    effects.update(game, [], rect, settings, shapes, colors, '#8deaff', 50);
  }
  assert.equal(effects.getHiddenLockCells(), null);
  assert.equal(effects.items.length, 0);
  effects.dispose();
  assert.equal(scene.children.length, 0);
  geometry.dispose();
  material.dispose();
});

test('Reduced Motion skips moving board effects and visual hard-drop travel', () => {
  const scene = new THREE.Scene();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshPhysicalMaterial();
  const effects = new BoardEffects3D(scene, geometry, new Map([['I', material]]));
  const game = { board: { cols: 10, rows: 20 }, clearingRows: [19] };
  effects.update(game, [{ type: 'hardDrop', detail: {
    type: 'I', col: 3, fromRow: 0, row: 17, rotation: 0,
  } }], rect, { ...settings, reducedMotion: true }, shapes, colors, '#8deaff', 16);
  assert.equal(effects.items.length, 0);
  assert.equal(effects.getHiddenLockCells(), null);
  effects.dispose();
  geometry.dispose();
  material.dispose();
});
