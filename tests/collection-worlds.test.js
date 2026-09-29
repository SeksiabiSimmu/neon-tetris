import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCollectionWorld } from '../src/rendering/collectionWorlds.js';

const ids = [
  'japanese-courtyard', 'rainy-observatory', 'desert-monument', 'underwater-ruins', 'lunar-outpost',
  'alpine-retreat', 'cloud-sanctuary', 'autumn-library', 'volcanic-coast',
  'paper-landscape', 'clockmakers-workshop', 'rainforest-temple',
];

test('all twelve collection worlds have authored, distinct focal structures and depth', () => {
  const signatures = [];
  for (const id of ids) {
    const world = createCollectionWorld(id);
    assert.ok(world?.group?.isGroup, id);
    assert.equal(world.group.name, `collection-${id}`);
    const meshes = [];
    world.group.traverse(object => { if (object.isMesh || object.isInstancedMesh || object.isPoints) meshes.push(object); });
    assert.ok(meshes.length >= 14, `${id}: insufficient authored structure`);
    const landmarks = meshes.filter(object => object.userData.landmark);
    assert.ok(landmarks.length > 0, `${id}: missing focal landmark`);
    signatures.push(landmarks.map(object => object.name).sort().join('|'));
    const depths = new Set(meshes.map(object => Math.round(object.getWorldPosition(new THREE.Vector3()).z / 100)));
    assert.ok(depths.size >= 4, `${id}: lacks foreground/background depth`);
    assert.ok(meshes.some(object => Math.abs(object.getWorldPosition(new THREE.Vector3()).x) > 350), `${id}: lacks side framing`);
    assert.ok(world.group.children.some(object => object.isLight || object.children.some(child => child.isLight)), `${id}: missing motivated lighting`);
    world.dispose();
  }
  assert.equal(new Set(signatures).size, ids.length);
  assert.equal(createCollectionWorld('unknown'), null);
});

test('each focal silhouette projects into the open right side of both world cameras', () => {
  for (const aspect of [1.6, 1.96]) {
    const camera = new THREE.PerspectiveCamera(35, aspect, 1, 4000);
    camera.position.set(0, 90, 1000);
    camera.lookAt(0, 0, -180);
    camera.updateMatrixWorld();
    for (const id of ids) {
      const world = createCollectionWorld(id);
      world.group.updateMatrixWorld(true);
      const visible = [];
      world.group.traverse(object => {
        if (!object.userData.landmark) return;
        const center = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).project(camera);
        if (center.x > 0.28 && center.x < 0.94 && center.y > 0.16 && center.y < 0.83) visible.push(object.name);
      });
      assert.ok(visible.length > 0, `${id} has no readable right-side landmark at aspect ${aspect}`);
      world.dispose();
    }
  }
});

test('quality changes preserve focal geometry while culling fine detail and shadows', () => {
  for (const id of ids) {
    const world = createCollectionWorld(id);
    const fine = [], landmarks = [], keys = [];
    world.group.traverse(object => {
      if (object.userData.secondary) fine.push(object);
      if (object.userData.landmark) landmarks.push(object);
      if (object.userData.keyShadow) keys.push(object);
    });
    assert.ok(fine.length > 0 && landmarks.length > 0 && keys.length > 0, id);
    world.setQuality({ ao: false, shadowSize: 0 });
    assert.ok(fine.every(object => !object.visible));
    assert.ok(landmarks.every(object => object.visible));
    assert.ok(keys.every(object => !object.castShadow));
    world.setQuality({ ao: true, shadowSize: 1024 });
    assert.ok(fine.every(object => object.visible));
    assert.ok(keys.every(object => object.castShadow));
    world.dispose();
  }
});

test('switching to Low releases allocated shadow targets immediately', () => {
  const world = createCollectionWorld('lunar-outpost');
  let released = 0;
  let allocated = 0;
  world.group.traverse(object => {
    if (!object.userData.keyShadow) return;
    object.shadow.map = { dispose() { released += 1; } };
    object.shadow.mapPass = { dispose() { released += 1; } };
    allocated += 2;
  });
  assert.ok(allocated > 0);
  world.setQuality({ ao: false, shadowSize: 0 });
  assert.equal(released, allocated);
  world.group.traverse(object => {
    if (object.userData.keyShadow) {
      assert.equal(object.shadow.map, null);
      assert.equal(object.shadow.mapPass, null);
    }
  });
  world.dispose();
  assert.equal(released, allocated);
});

test('reduced motion freezes animation and disposal releases owned resources', () => {
  for (const id of ids) {
    const world = createCollectionWorld(id);
    const animated = [];
    const geometries = new Set(), materials = new Set(), textures = new Set();
    world.group.traverse(object => {
      if (object.userData.animated) animated.push(object);
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) for (const material of [object.material].flat()) {
        materials.add(material);
        if (material.map) textures.add(material.map);
      }
      if (object.customDepthMaterial) {
        assert.equal(object.customDepthMaterial.map, null, `${id}: shadow pass bound a color map`);
        materials.add(object.customDepthMaterial);
      }
    });
    assert.ok(animated.length > 0, id);
    let rim;
    world.group.traverse(object => { if (object.userData.collectionRim) rim = object; });
    assert.ok(rim, id);
    const starting = animated.map(object => object.rotation.toArray().join(','));
    world.update({ time: 120, reducedMotion: true, pulse: 1 });
    assert.deepEqual(animated.map(object => object.rotation.toArray().join(',')), starting, id);
    assert.equal(rim.intensity, 0.48);
    world.update({ time: 120, reducedMotion: false, pulse: 1 });
    assert.ok(animated.some((object, index) => object.rotation.toArray().join(',') !== starting[index]), `${id}: no motion`);
    assert.ok(Math.abs(rim.intensity - 0.56) < 1e-9);
    let disposed = 0;
    for (const resource of [...geometries, ...materials, ...textures]) {
      const original = resource.dispose.bind(resource);
      resource.dispose = () => { disposed += 1; original(); };
    }
    world.dispose();
    assert.equal(disposed, geometries.size + materials.size + textures.size, id);
    assert.equal(world.group.children.length, 0);
    world.dispose();
  }
});
