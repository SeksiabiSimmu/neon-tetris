import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLegacyContext } from './helpers/legacyContext.js';

test('block material cosmetics have a safe legacy default and varied unlock gates', () => {
  const app = loadLegacyContext('constants.js', 'progressionData.js', 'progressionManager.js');
  const { CATEGORIES, UNLOCKABLES } = app.TETRIS.PROGRESSION_DATA;
  assert.ok(CATEGORIES.includes('blockMaterials'));
  const materials = UNLOCKABLES.filter((item) => item.category === 'blockMaterials');
  assert.equal(materials.length, 26);
  assert.deepEqual(Array.from(materials.slice(0, 6), (item) => item.id), [
    'material_ceramic', 'material_ion_glass', 'material_carbon_lattice',
    'material_aurora_alloy', 'material_prism_shell', 'material_void_chrome',
  ]);
  assert.ok(materials.filter((item) => item.requirement.type === 'default').length >= 2);
  assert.ok(new Set(materials.map((item) => item.requirement.type)).size >= 4);

  const defaultSave = JSON.stringify({ equipped: { pieceSkins: 'skin_classic' } });
  app.localStorage.setItem('legacy', defaultSave);
  const legacyProfile = new app.TETRIS.ProgressionManager('legacy');
  assert.equal(legacyProfile.getEquipped('blockMaterials').id, materials[0].id);

  app.localStorage.setItem('invalid', JSON.stringify({ equipped: { blockMaterials: 'removed-material-id' } }));
  const invalidProfile = new app.TETRIS.ProgressionManager('invalid');
  assert.equal(invalidProfile.getEquipped('blockMaterials').id, materials[0].id);
});

test('equipped material data reaches Three and existing cosmetic setters reach both renderers', () => {
  const app = loadLegacyContext('constants.js', 'progressionData.js', 'cosmeticsApplier.js', 'renderer.js');
  const calls = [];
  const webgl = Object.fromEntries(['setBlockMaterial', 'setFallingEffect', 'setBoardTheme', 'setAmbientParticles', 'setBackgroundPalette', 'setClearEffect']
    .map((name) => [name, (...args) => calls.push([name, ...args])]));
  const renderer = Object.create(app.TETRIS.Renderer.prototype);
  Object.assign(renderer, {
    webgl,
    boardTheme: {},
    boardParticles: { clear() {}, spawnAmbient() {} },
    background: { setPalette() {} },
    effects: {},
    pieceColors: {},
  });
  const equipped = {
    blockMaterials: { roughness: 0.12, metalness: 0.9, clearcoat: 1, emissiveAccent: '#b8f4ff' },
    fallingEffects: { effectId: 'bubbles' },
    boardThemes: { bgTop: '#010203', gridColor: '#aabbcc', gridAlpha: 0.2 },
    backgrounds: { nebulaColors: ['#000000', '#ffffff'], style: 'orbit', sceneId: 'japanese-courtyard' },
    particleEffects: { ambientColors: ['#ff00ff'], shape: 'hex' },
    clearEffects: { accentColor: '#00ffff', flashColor: '#fff000', particleShape: 'ring' },
  };
  const progression = { getAppliedData: (category) => equipped[category] || null };

  app.TETRIS.applyCosmetics(renderer, progression);
  assert.ok(calls.some(([name, data]) => name === 'setBlockMaterial' && data === equipped.blockMaterials));
  assert.ok(calls.some(([name, id]) => name === 'setFallingEffect' && id === 'bubbles'));
  assert.ok(calls.some(([name]) => name === 'setBoardTheme'));
  assert.ok(calls.some(([name]) => name === 'setAmbientParticles'));
  assert.ok(calls.some(([name, , , sceneId]) => name === 'setBackgroundPalette' && sceneId === 'japanese-courtyard'));
  assert.ok(calls.some(([name]) => name === 'setClearEffect'));
});
