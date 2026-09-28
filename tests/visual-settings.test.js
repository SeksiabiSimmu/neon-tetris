import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLegacyContext } from './helpers/legacyContext.js';

function makeRenderer(settingsCalls) {
  const particleSystem = { intensityScale: 1, enabled: true };
  const renderer = {
    effects: { reducedMotion: false },
    boardParticles: { intensityScale: 1, enabled: true },
    background: { reducedMotion: false, styleIntensity: 1, particles: { intensityScale: 1, enabled: true } },
    glow: { intensityScale: 1 },
    setPieceColors() {},
    webgl: { setSettings: (values) => settingsCalls.push(values) },
  };
  renderer.boardParticles = particleSystem;
  return renderer;
}

test('forwards normalized visual settings and zeros motion-controlled effects', () => {
  const app = loadLegacyContext('constants.js', 'settingsManager.js');
  const settings = Object.create(app.TETRIS.SettingsManager.prototype);
  const calls = [];
  settings.values = {
    masterVolume: 80, sfxVolume: 80, particleIntensity: 0,
    glowIntensity: 0, reducedMotion: true, colorblindMode: true, graphicsQuality: 'low', keyBindings: null,
  };
  const renderer = makeRenderer(calls);
  settings.applyTo({ renderer, input: { defaultKeyMap: {}, setKeyBindings() {} }, audio: { setVolumes() {} } });

  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{
    reducedMotion: true,
    colorblindMode: true,
    particleIntensity: 0,
    glowIntensity: 0,
  }]);
  assert.equal(renderer.effects.reducedMotion, true);
  assert.equal(renderer.boardParticles.enabled, false);
});

test("maps effect sliders to the renderer's normalized range and honors graphics quality", () => {
  const app = loadLegacyContext('constants.js', 'settingsManager.js');
  const settings = Object.create(app.TETRIS.SettingsManager.prototype);
  const calls = [];
  settings.values = {
    masterVolume: 80, sfxVolume: 80, particleIntensity: 60,
    glowIntensity: 1.2, reducedMotion: false, colorblindMode: false, graphicsQuality: 'medium', keyBindings: null,
  };
  settings.applyTo({
    renderer: makeRenderer(calls),
    input: { defaultKeyMap: {}, setKeyBindings() {} },
    audio: { setVolumes() {} },
  });
  assert.equal(calls[0].particleIntensity, 0.6);
  assert.equal(calls[0].glowIntensity, 0.96);
});

test('sets zero-glow CSS variables so interface glows can be fully disabled', () => {
  const app = loadLegacyContext('constants.js', 'settingsManager.js');
  const settings = Object.create(app.TETRIS.SettingsManager.prototype);
  const cssVariables = {};
  app.document.documentElement.style.setProperty = (key, value) => { cssVariables[key] = value; };
  settings.values = {
    masterVolume: 80, sfxVolume: 80, particleIntensity: 80,
    glowIntensity: 0, reducedMotion: false, colorblindMode: false, graphicsQuality: 'high', keyBindings: null,
  };
  settings.applyTo({
    renderer: makeRenderer([]),
    input: { defaultKeyMap: {}, setKeyBindings() {} },
    audio: { setVolumes() {} },
  });

  assert.equal(cssVariables['--glow-alpha'], '0');
  assert.equal(cssVariables['--glow-opacity'], '0%');
});
