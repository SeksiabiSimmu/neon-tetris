import test from 'node:test';
import assert from 'node:assert/strict';
import { graphicsPreset } from '../src/rendering/graphicsQuality.js';
import { loadLegacyContext } from './helpers/legacyContext.js';

test('graphics tiers clamp multisampling and anisotropy to device capabilities', () => {
  assert.deepEqual(graphicsPreset('low', 8, 16), {
    renderScale: 0.7, shadowSize: 0, ao: false, bloom: false,
    samples: 0, anisotropy: 1,
  });
  const high = graphicsPreset('high', 2, 4);
  assert.equal(high.samples, 2);
  assert.equal(high.anisotropy, 4);
  assert.equal(high.shadowSize, 2048);
  assert.equal(high.ao, true);
  assert.equal(graphicsPreset('unknown').renderScale, 0.9);
});

test('new graphics preferences persist safely without changing the save key', () => {
  const app = loadLegacyContext('constants.js', 'settingsManager.js');
  const settings = new app.TETRIS.SettingsManager();
  assert.equal(settings.storageKey, 'tetris_settings_v1');
  assert.equal(settings.get('background3D'), true);
  assert.equal(settings.get('ambientOcclusion'), false);
  settings.set('background3D', false);
  settings.set('ambientOcclusion', false);
  const reloaded = new app.TETRIS.SettingsManager();
  assert.equal(reloaded.get('background3D'), false);
  assert.equal(reloaded.get('ambientOcclusion'), false);
  reloaded.set('ambientOcclusion', 'true');
  assert.equal(reloaded.get('ambientOcclusion'), false);
});
