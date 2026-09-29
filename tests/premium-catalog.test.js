import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLegacyContext } from './helpers/legacyContext.js';

const stageOneMaterials = ['stained-glass', 'reactor-cells', 'porcelain-dynasty', 'pocket-gardens', 'comic-ink'];
const stageOneEffects = ['none', 'fire', 'bubbles', 'water', 'smoke', 'frost', 'lightning'];
const stageOneWorlds = ['japanese-courtyard', 'rainy-observatory', 'desert-monument', 'underwater-ruins', 'lunar-outpost'];
const stageTwoMaterials = ['deep-sea-relics', 'meteorite', 'aurora-crystal', 'building-bricks', 'jelly-cubes',
  'arcade-carpet', 'tiny-aquariums', 'toy-blocks', 'circuit-boards', 'space-freight',
  'mechanical-keys', 'retro-displays', 'black-ice', 'dungeon-treasure', 'cosmic-windows'];
const stageTwoEffects = ['lava', 'wind', 'stardust', 'cherry-blossoms', 'digital-glitch',
  'ink', 'fireflies', 'soap-film', 'autumn-leaves', 'comet'];
const stageTwoWorlds = ['alpine-retreat', 'cloud-sanctuary', 'autumn-library', 'volcanic-coast',
  'paper-landscape', 'clockmakers-workshop', 'rainforest-temple'];

test('first collection has independent, valid catalog entries and starter choices', () => {
  const app = loadLegacyContext('constants.js', 'progressionData.js', 'progressionManager.js');
  const { CATEGORIES, UNLOCKABLES } = app.TETRIS.PROGRESSION_DATA;
  assert.ok(CATEGORIES.includes('fallingEffects'));
  assert.equal(new Set(UNLOCKABLES.map((item) => item.id)).size, UNLOCKABLES.length);
  for (const family of stageOneMaterials) {
    const item = UNLOCKABLES.find((entry) => entry.category === 'blockMaterials' && entry.apply.family === family);
    assert.ok(item, family);
    assert.ok(item.requirement);
  }
  for (const effectId of stageOneEffects) {
    const item = UNLOCKABLES.find((entry) => entry.category === 'fallingEffects' && entry.apply.effectId === effectId);
    assert.ok(item, effectId);
    assert.ok(item.requirement);
  }
  for (const sceneId of stageOneWorlds) {
    const item = UNLOCKABLES.find((entry) => entry.category === 'backgrounds' && entry.apply.sceneId === sceneId);
    assert.ok(item, sceneId);
    assert.ok(item.apply.nebulaColors?.length >= 2);
  }
  for (const category of ['blockMaterials', 'fallingEffects', 'backgrounds']) {
    assert.ok(UNLOCKABLES.some((entry) => entry.category === category && entry.requirement.type === 'default'));
  }
  const legacy = new app.TETRIS.ProgressionManager('premium-legacy');
  assert.equal(legacy.getEquipped('blockMaterials').id, 'material_ceramic');
  assert.equal(legacy.getEquipped('backgrounds').id, 'bg_nebula');
  assert.equal(legacy.getEquipped('fallingEffects').apply.effectId, 'none');
});

test('complete collection preserves old choices and has twenty new themes, sixteen effects, twelve worlds', () => {
  const app = loadLegacyContext('constants.js', 'progressionData.js', 'progressionManager.js');
  const items = app.TETRIS.PROGRESSION_DATA.UNLOCKABLES;
  assert.equal(new Set(items.map((item) => item.id)).size, items.length);
  for (const [category, field, ids] of [
    ['blockMaterials', 'family', [...stageOneMaterials, ...stageTwoMaterials]],
    ['fallingEffects', 'effectId', [...stageOneEffects, ...stageTwoEffects]],
    ['backgrounds', 'sceneId', [...stageOneWorlds, ...stageTwoWorlds]],
  ]) {
    for (const id of ids) {
      const item = items.find((entry) => entry.category === category && entry.apply?.[field] === id);
      assert.ok(item, `${category}: ${id}`);
      assert.ok(item.description?.length >= 15, `${id}: informative description`);
      assert.ok(['default', 'level', 'stat', 'achievement'].includes(item.requirement?.type), `${id}: valid unlock`);
    }
  }
  const existing = ['material_ceramic', 'material_void_chrome', 'bg_nebula', 'bg_clockwork'];
  for (const id of existing) assert.ok(items.some((item) => item.id === id), id);
  assert.equal(items.filter((item) => item.category === 'fallingEffects').length, 17);
  assert.equal(items.filter((item) => item.category === 'blockMaterials').length, 26);
  assert.equal(items.filter((item) => item.category === 'backgrounds').length, 20);
});
