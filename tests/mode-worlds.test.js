import test from 'node:test';
import assert from 'node:assert/strict';
import { createModeWorld, endlessAltitudeForLevel } from '../src/rendering/modeWorlds.js';
import * as THREE from 'three';

const modes = ['endless', 'sprint', 'marathon', 'timeAttack', 'zen', 'challenge'];

test('switching worlds releases allocated shadow render targets', () => {
  const world = createModeWorld('sprint');
  let disposed = 0;
  let allocated = 0;
  world.group.traverse((object) => {
    if (!object.shadow) return;
    object.shadow.map = { dispose() { disposed += 1; } };
    allocated += 1;
  });
  assert.ok(allocated > 0);
  world.dispose();
  assert.equal(disposed, allocated);
});

test('bright equipped palettes preserve each world sky contrast', () => {
  for (const mode of modes) {
    const world = createModeWorld(mode);
    world.setPalette(['#ffffff', '#00ffff', '#ff00ff'], 'nebula');
    world.update({ game: { runId: 1, scoring: { level: 1 } } });
    const sky = world.group.children.find(object => object.material?.uniforms?.uTop).material.uniforms;
    const luminance = color => color.r * .2126 + color.g * .7152 + color.b * .0722;
    assert.ok(luminance(sky.uTop.value) < .03, `${mode} sky became bright`);
    assert.ok(luminance(sky.uBottom.value) < .06, `${mode} horizon became bright`);
    world.dispose();
  }
});

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
    if (object.isPoints && !stars) stars = object;
  });
  const game = { runId: 1, scoring: { level: 1 } };
  world.update({ dtMs: 16, game });
  const startY = ground.getWorldPosition(new THREE.Vector3()).y;
  const startStars = stars.material.opacity;
  game.scoring.level = 2;
  for (let frame = 0; frame < 40; frame += 1) world.update({ dtMs: 50, game });
  assert.ok(ground.getWorldPosition(new THREE.Vector3()).y < startY - 100);
  assert.ok(stars.material.opacity > startStars);
  game.scoring.level = 8;
  for (let frame = 0; frame < 40; frame += 1) world.update({ dtMs: 50, game });
  const background = world.group.children.find((object) => object.material?.uniforms?.uElevation);
  const levelEightElevation = background.material.uniforms.uElevation.value;
  assert.ok(levelEightElevation > 0.65);
  assert.ok(ground.getWorldPosition(new THREE.Vector3()).y < startY - 1200,
    'launch complex should clear the camera by orbital height');
  const spacePosition = stars.position.y;
  game.scoring.level = 12;
  for (let frame = 0; frame < 40; frame += 1) world.update({ dtMs: 50, game });
  assert.ok(background.material.uniforms.uElevation.value > levelEightElevation,
    'the ascent should keep changing after level eight');
  assert.notEqual(stars.position.y, spacePosition);
  assert.ok(stars.position.y > -1350 && stars.position.y <= 0);
  world.dispose();
});

test('world lighting settles on game over without changing game state', () => {
  const world = createModeWorld('endless');
  const game = { runId: 2, state: 'PLAYING', scoring: { level: 3 } };
  world.update({ dtMs: 16, game, events: [{ type: 'clear' }] });
  const pulseLight = world.group.getObjectByName('environment-endless').children.find((object) => object.isPointLight);
  assert.ok(pulseLight.intensity > 0);
  game.state = 'GAME_OVER';
  world.update({ dtMs: 0, game });
  assert.equal(pulseLight.intensity, 0);
  assert.equal(world.group.getObjectByName('clear-impact-ring').visible, false);
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
