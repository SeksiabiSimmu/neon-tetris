import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBlockAppearance, roundedBlockGeometry } from '../src/rendering/blockAppearance.js';

test('all six saved material families have distinct opaque cell faces', () => {
  const appearance = createBlockAppearance();
  const families = ['ceramic', 'ion-glass', 'carbon-lattice', 'aurora-alloy', 'prism-shell', 'void-chrome'];
  const signatures = [];
  const textures = new Set();
  for (const family of families) {
    const material = new THREE.MeshPhysicalMaterial({ color: '#b76ce4' });
    appearance.apply(material, { family, roughness: 0.3, metalness: 0.5, clearcoat: 0.8 });
    assert.ok(material.map?.isDataTexture);
    assert.ok(material.roughnessMap?.isDataTexture);
    assert.equal(material.transparent, false);
    textures.add(material.map);
    const data = material.map.image.data;
    signatures.push([0, 16, 31, 64, 88, 112].map((x) => data[(64 * 128 + x) * 4]).join(':'));
    material.dispose();
  }
  assert.equal(textures.size, families.length);
  assert.equal(new Set(signatures).size, families.length);
  const ghost = new THREE.MeshPhysicalMaterial();
  appearance.apply(ghost, { family: 'void-chrome' }, { ghost: true });
  assert.equal(ghost.map, null);
  ghost.dispose();
  appearance.dispose();
  const geometry = roundedBlockGeometry();
  assert.ok(geometry.attributes.uv.count > 0);
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  const capSamples = new Set();
  for (let index = 0; index < uv.count; index += 1) {
    const u = uv.getX(index), v = uv.getY(index);
    assert.ok(u >= 0 && u <= 1 && v >= 0 && v <= 1, 'cell UVs stay within authored face maps');
    if (Math.abs(normals.getZ(index)) > 0.999) {
      assert.ok(Math.abs(u - positions.getX(index) - 0.5) < 0.001);
      assert.ok(Math.abs(v - positions.getY(index) - 0.5) < 0.001);
      capSamples.add(`${u.toFixed(2)}:${v.toFixed(2)}`);
    }
  }
  assert.ok(capSamples.size > 4, 'cap faces sample the full authored material pattern');
  geometry.dispose();
});

test('five premium families produce distinct opaque faces with material detail', () => {
  const appearance = createBlockAppearance();
  const families = ['stained-glass', 'reactor-cells', 'porcelain-dynasty', 'pocket-gardens', 'comic-ink'];
  const signatures = new Set();
  const materials = [];
  for (const family of families) {
    const material = new THREE.MeshPhysicalMaterial({ color: '#4ba7d5' });
    appearance.apply(material, { family });
    assert.ok(material.map?.isDataTexture, `${family} has a face map`);
    assert.ok(material.roughnessMap?.isDataTexture, `${family} has a roughness map`);
    assert.equal(material.transparent, false, `${family} remains visibly solid`);
    assert.equal(material.opacity, 1);
    const pixels = material.map.image.data;
    const roughness = material.roughnessMap.image.data;
    const face = [];
    const finish = new Set();
    for (let y = 12; y < 116; y += 8) for (let x = 12; x < 116; x += 8) {
      const index = (y * 128 + x) * 4;
      face.push(pixels[index], pixels[index + 1], pixels[index + 2]);
      finish.add(roughness[index]);
      assert.equal(pixels[index + 3], 255, `${family} face pixels stay opaque`);
    }
    assert.ok(new Set(face).size >= 3, `${family} has readable face variation`);
    assert.ok(finish.size >= 2, `${family} has a surface finish pattern`);
    signatures.add(face.join(','));
    materials.push(material);
  }
  assert.equal(signatures.size, families.length, 'every premium family has its own motif');
  for (const material of materials) material.dispose();
  appearance.dispose();
});

test('premium motifs have structural contrast beyond a color swap', () => {
  const appearance = createBlockAppearance();
  const pixel = (family, u, v) => {
    const material = new THREE.MeshPhysicalMaterial();
    appearance.apply(material, { family });
    const x = Math.round(u * 127), y = Math.round(v * 127);
    const index = (y * 128 + x) * 4;
    const result = [...material.map.image.data.slice(index, index + 3)];
    material.dispose();
    return result;
  };
  const brightness = (rgb) => rgb.reduce((sum, channel) => sum + channel, 0);
  assert.ok(brightness(pixel('stained-glass', 0.5, 0.25)) < brightness(pixel('stained-glass', 0.25, 0.25)) * 0.6, 'lead seam separates glass panes');
  assert.ok(brightness(pixel('reactor-cells', 0.5, 0.5)) > brightness(pixel('reactor-cells', 0.38, 0.5)) * 1.4, 'bright core sits inside armor');
  assert.ok(brightness(pixel('porcelain-dynasty', 0.7, 0.7)) > brightness(pixel('porcelain-dynasty', 0.18, 0.5)), 'porcelain has a clear glazed field within its rim');
  assert.ok(brightness(pixel('pocket-gardens', 0.5, 0.5)) > brightness(pixel('pocket-gardens', 0.08, 0.5)), 'garden stays inside a strong frame');
  assert.ok(brightness(pixel('comic-ink', 0.5, 0.5)) > brightness(pixel('comic-ink', 0.08, 0.5)) * 1.5, 'ink outline encloses a bright printed face');
  appearance.dispose();
});

test('small-cell motifs retain their porcelain, garden, and comic identities', () => {
  const appearance = createBlockAppearance();
  const pixel = (family, u, v) => {
    const material = new THREE.MeshPhysicalMaterial({ color: '#55aedd' });
    appearance.apply(material, { family });
    const index = (Math.round(v * 127) * 128 + Math.round(u * 127)) * 4;
    const rgb = [...material.map.image.data.slice(index, index + 3)];
    material.dispose();
    return rgb;
  };
  const light = (rgb) => rgb.reduce((sum, channel) => sum + channel, 0);
  assert.ok(light(pixel('porcelain-dynasty', 0.5, 0.64)) < light(pixel('porcelain-dynasty', 0.75, 0.5)) * 0.8,
    'blue porcelain brushwork is broad enough to survive cell-size sampling');
  assert.ok(light(pixel('pocket-gardens', 0.39, 0.55)) < light(pixel('pocket-gardens', 0.72, 0.68)) * 0.8,
    'a leafy silhouette contrasts with the garden stone');
  assert.ok(light(pixel('comic-ink', 0.6, 0.3)) < light(pixel('comic-ink', 0.75, 0.65)) * 0.65,
    'halftone dots stay visible at gameplay cell size');
  appearance.dispose();
});

const STAGE_TWO_FAMILIES = [
  'deep-sea-relics', 'meteorite', 'aurora-crystal', 'building-bricks', 'jelly-cubes',
  'arcade-carpet', 'tiny-aquariums', 'toy-blocks', 'circuit-boards', 'space-freight',
  'mechanical-keys', 'retro-displays', 'black-ice', 'dungeon-treasure', 'cosmic-windows',
];

test('all fifteen new themes have distinct opaque cell-size motifs and surface finishes', () => {
  const appearance = createBlockAppearance();
  const signatures = new Set();
  const maps = new Set();
  for (const family of STAGE_TWO_FAMILIES) {
    const material = new THREE.MeshPhysicalMaterial({ color: '#51b8e4' });
    appearance.apply(material, { family });
    assert.ok(material.map?.isDataTexture, `${family} has a face map`);
    assert.ok(material.roughnessMap?.isDataTexture, `${family} has a roughness map`);
    assert.equal(material.transparent, false, `${family} keeps solid occupancy`);
    assert.equal(material.opacity, 1);
    assert.equal(material.color.getHexString(), '51b8e4', `${family} retains piece palette color`);
    maps.add(material.map);
    const color = material.map.image.data;
    const finish = material.roughnessMap.image.data;
    const size = material.map.image.width;
    const coarseFace = [];
    const roughnessValues = new Set();
    for (let y = 4; y < size - 4; y += size / 16) for (let x = 4; x < size - 4; x += size / 16) {
      const i = (y * size + x) * 4;
      coarseFace.push(color[i], color[i + 1], color[i + 2]);
      roughnessValues.add(finish[i]);
      assert.equal(color[i + 3], 255, `${family} has no transparent gaps`);
    }
    assert.ok(new Set(coarseFace).size >= 5, `${family} has useful cell-size contrast`);
    assert.ok(roughnessValues.size >= 2, `${family} has a varied finish`);
    signatures.add(coarseFace.join(','));
    material.dispose();
  }
  assert.equal(maps.size, STAGE_TWO_FAMILIES.length, 'each theme owns its texture');
  assert.equal(signatures.size, STAGE_TWO_FAMILIES.length, 'motifs are structurally different');
  appearance.dispose();
});

test('animated themes respond to time and events without changing block color or opacity', () => {
  const appearance = createBlockAppearance();
  const materialFor = (family) => {
    const material = new THREE.MeshPhysicalMaterial({ color: '#e34e69' });
    appearance.apply(material, { family });
    return material;
  };
  const families = ['aurora-crystal', 'jelly-cubes', 'mechanical-keys', 'circuit-boards'];
  const materials = families.map(materialFor);
  const signature = (material) => Buffer.from(material.map.image.data).toString('base64');
  const initial = materials.map(signature);
  appearance.update({ timeMs: 900, dtMs: 900 });
  assert.notEqual(signature(materials[0]), initial[0], 'aurora ribbons drift slowly');
  assert.notEqual(signature(materials[1]), initial[1], 'jelly interior settles within the cell');
  assert.equal(signature(materials[2]), initial[2], 'keys wait for a lock event');
  assert.equal(signature(materials[3]), initial[3], 'circuit waits for a clear event');
  appearance.update({ timeMs: 916, dtMs: 16, locked: true, cleared: true });
  assert.notEqual(signature(materials[2]), initial[2], 'keycap responds to locking');
  assert.notEqual(signature(materials[3]), initial[3], 'circuit trace responds to clearing');
  appearance.update({ timeMs: 1500, dtMs: 584, reducedMotion: true });
  const still = materials.map(signature);
  appearance.update({ timeMs: 3000, dtMs: 1500, reducedMotion: true });
  assert.deepEqual(materials.map(signature), still, 'reduced motion holds all four textures still');
  for (const material of materials) {
    assert.equal(material.color.getHexString(), 'e34e69');
    assert.equal(material.transparent, false);
    material.dispose();
  }
  appearance.dispose();
});
