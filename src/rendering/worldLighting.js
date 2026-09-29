import * as THREE from 'three';

// One authored key and fill per environment. Board shading uses a neutralized
// version of the same direction; the tetromino albedo remains the player skin.
export const WORLD_LIGHTING = Object.freeze({
  endless: { key: '#e3edf1', fill: '#749aa4', ground: '#17262c', rim: '#d9b37d', position: [-380,580,540], strength: 1.8, ambient: 0.52, frame: '#4a5c63', metalness: 0.7, top: '#080f19', bottom: '#253b45' },
  sprint: { key: '#d2e3ed', fill: '#91a1a9', ground: '#202832', rim: '#efa85b', position: [-650,230,390], strength: 2.05, ambient: 0.65, frame: '#4d5966', metalness: 0.78, top: '#090e17', bottom: '#1c2638' },
  marathon: { key: '#f4dcba', fill: '#7886b5', ground: '#10121c', rim: '#b9c8f0', position: [540,440,260], strength: 2.1, ambient: 0.38, frame: '#5e6172', metalness: 0.8, top: '#080c18', bottom: '#202537' },
  timeAttack: { key: '#f2c78f', fill: '#63818a', ground: '#1c1820', rim: '#f09d6d', position: [-520,390,500], strength: 1.85, ambient: 0.43, frame: '#756554', metalness: 0.82, top: '#160f18', bottom: '#302a2d' },
  zen: { key: '#e6e4d4', fill: '#a0b7aa', ground: '#182724', rim: '#a4c2b5', position: [-210,760,190], strength: 1.6, ambient: 0.65, frame: '#67746f', metalness: 0.25, top: '#111b23', bottom: '#344640' },
  challenge: { key: '#e1dcef', fill: '#8178a3', ground: '#181421', rim: '#c1a4e7', position: [420,360,480], strength: 1.9, ambient: 0.43, frame: '#645d72', metalness: 0.72, top: '#0e0e1c', bottom: '#282133' },
});

export function createWorldLights(mode) {
  const art = WORLD_LIGHTING[mode] || WORLD_LIGHTING.endless;
  const group = new THREE.Group();
  const key = new THREE.DirectionalLight(art.key, art.strength);
  key.position.set(...art.position);
  key.userData.keyShadow = true;
  Object.assign(key.shadow.camera, { left:-950, right:950, top:720, bottom:-600, near:20, far:2400 });
  key.shadow.bias = -0.00015;
  key.shadow.normalBias = 0.65;
  const ambient = new THREE.HemisphereLight(art.fill, art.ground, art.ambient);
  const rim = new THREE.DirectionalLight(art.rim, 0.68);
  rim.position.set(-art.position[0], 130, 340);
  group.add(key, ambient, rim);
  return { group, art, key, rim };
}

// Maintain the world's dark sky while allowing a cosmetic to tint its hue.
export function tintSky(base, tint, amount = 0.18) {
  const a = new THREE.Color(base), b = new THREE.Color(tint);
  const luminance = c => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
  b.multiplyScalar(luminance(a) / Math.max(0.0001, luminance(b)));
  return a.lerp(b, amount);
}

export function reflectionStudio(mode) {
  const art = WORLD_LIGHTING[mode] || WORLD_LIGHTING.endless;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(art.ground).multiplyScalar(0.7);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const add = (color, power, position, size) => {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide });
    const card = new THREE.Mesh(geometry, material);
    card.position.set(...position);
    card.scale.set(...size, 1);
    card.lookAt(0, 0, 0);
    scene.add(card);
  };
  add(art.key, 3.5, [Math.sign(art.position[0]) * 4, 5, 5], [4, 6]);
  add(art.fill, 1.3, [-Math.sign(art.position[0]) * 5, 1, 2], [2, 5]);
  add(art.rim, 2.2, [2, 2, -5], [1, 7]);
  scene.dispose = () => { geometry.dispose(); scene.children.forEach(child => child.material.dispose()); };
  return scene;
}
