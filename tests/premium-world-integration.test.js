import test from 'node:test';
import assert from 'node:assert/strict';
import { createModeWorld } from '../src/rendering/modeWorlds.js';

test('a selected collection world replaces the mode landmark and releases on switch', () => {
  const world = createModeWorld('marathon');
  world.setPalette(['#809e99', '#d0b48b'], 'nebula', 'japanese-courtyard');
  assert.equal(world.group.userData.backgroundScene, 'japanese-courtyard');
  assert.ok(world.group.getObjectByName('collection-japanese-courtyard'));
  world.setPalette(['#809e99', '#d0b48b'], 'nebula', null);
  assert.equal(world.group.userData.backgroundScene, null);
  assert.equal(world.group.getObjectByName('collection-japanese-courtyard'), undefined);
  world.dispose();
});

test('Endless preserves its ascent and moves a ground environment out of view', () => {
  const world = createModeWorld('endless');
  world.setPalette(['#809e99', '#d0b48b'], 'nebula', 'desert-monument');
  world.update({ dtMs: 16, game: { runId: 1, scoring: { level: 8 } }, settings: { reducedMotion: true, particleIntensity: 1, glowIntensity: 1 } });
  const environment = world.group.getObjectByName('collection-desert-monument');
  assert.ok(environment.position.y < -400);
  world.dispose();
});
