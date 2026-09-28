import test from 'node:test';
import assert from 'node:assert/strict';
import { createModeWorld, endlessAltitudeForLevel } from '../src/rendering/modeWorlds.js';

const modes = ['endless', 'sprint', 'marathon', 'timeAttack', 'zen', 'challenge'];

test('creates a distinct procedural world for all six game modes', () => {
  const worlds = modes.map((mode) => createModeWorld(mode));
  assert.deepEqual(worlds.map((world) => world.descriptor.id), modes);
  assert.equal(new Set(worlds.map((world) => world.descriptor.landmark)).size, modes.length);
  assert.equal(new Set(worlds.map((world) => world.group)).size, modes.length);
  worlds.forEach((world) => world.dispose());
});

test('Endless altitude starts at the surface and rises once per valid level', () => {
  assert.equal(endlessAltitudeForLevel(0), 0);
  assert.equal(endlessAltitudeForLevel(Number.NaN), 0);
  assert.equal(endlessAltitudeForLevel(1), 0);
  assert.equal(endlessAltitudeForLevel(2), 1);
  assert.equal(endlessAltitudeForLevel(25), 24);
  for (let level = 1; level < 100; level += 1) {
    assert.ok(endlessAltitudeForLevel(level + 1) > endlessAltitudeForLevel(level));
  }
});

test('Endless visibly ascends toward space as levels increase', () => {
  const world = createModeWorld('endless');
  let ground = null;
  let stars = null;
  world.group.traverse((object) => {
    if (object.geometry?.parameters?.width === 2400) ground = object;
    if (object.isPoints) stars = object;
  });
  const game = { runId: 1, scoring: { level: 1 } };
  world.update({ dtMs: 16, game });
  const startY = ground.position.y;
  const startStars = stars.material.opacity;
  game.scoring.level = 2;
  for (let frame = 0; frame < 40; frame += 1) world.update({ dtMs: 50, game });
  assert.ok(ground.position.y < startY - 100);
  assert.ok(stars.material.opacity > startStars);
  game.scoring.level = 8;
  for (let frame = 0; frame < 40; frame += 1) world.update({ dtMs: 50, game });
  const background = world.group.children.find((object) => object.material?.uniforms?.uElevation);
  assert.ok(background.material.uniforms.uElevation.value > 0.9);
  world.dispose();
});

test('clear effect shapes change the 3D impact ring geometry', () => {
  const world = createModeWorld('endless');
  const impactRing = world.group.getObjectByName('clear-impact-ring');
  assert.ok(impactRing);
  const circleGeometry = impactRing.geometry;

  world.setClearEffect({ particleShape: 'triangle', accentColor: '#ff00ff' });
  const triangleGeometry = impactRing.geometry;
  assert.notEqual(triangleGeometry, circleGeometry);
  assert.notDeepEqual(
    Array.from(triangleGeometry.getAttribute('position').array),
    Array.from(circleGeometry.getAttribute('position').array),
  );
  assert.equal(world.group.userData.clearEffect, 'triangle');

  world.setClearEffect({ particleShape: 'spark' });
  assert.notEqual(impactRing.geometry, triangleGeometry);
  world.dispose();
});

test('zero glow and particle settings suppress the world clear reaction', () => {
  const world = createModeWorld('endless');
  let clearRing = null;
  let stars = null;
  let pulseLight = null;
  world.group.traverse((object) => {
    if (object.name === 'clear-impact-ring') clearRing = object;
    if (object.isPoints) stars = object;
    if (object.isPointLight) pulseLight = object;
  });

  world.update({
    dtMs: 16,
    game: { runId: 1, scoring: { level: 1 } },
    events: [{ type: 'clear' }],
    settings: { reducedMotion: false, glowIntensity: 0, particleIntensity: 0 },
  });

  const background = world.group.children.find((object) => object.isMesh && object.material.uniforms?.uPulse);
  assert.equal(clearRing.visible, false);
  assert.equal(stars.visible, false);
  assert.equal(stars.material.opacity, 0);
  assert.equal(pulseLight.intensity, 0);
  assert.equal(background.material.uniforms.uPulse.value, 0);
  world.dispose();
});
