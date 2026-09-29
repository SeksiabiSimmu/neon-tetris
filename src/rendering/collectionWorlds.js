import * as THREE from 'three';
import { addMesh, arcProfile, chamferedBox, instances, profile, strut, applyArtQuality } from './environmentArt.js';

const SCENES = Object.freeze({
  'japanese-courtyard': courtyard,
  'rainy-observatory': observatory,
  'desert-monument': desert,
  'underwater-ruins': underwater,
  'lunar-outpost': lunar,
  'alpine-retreat': alpine,
  'cloud-sanctuary': cloud,
  'autumn-library': library,
  'volcanic-coast': volcanic,
  'paper-landscape': paper,
  'clockmakers-workshop': clockmaker,
  'rainforest-temple': rainforest,
});

function material(color, roughness = 0.8, metalness = 0, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

function at(parent, x, y, z) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  parent.add(group);
  return group;
}

function box(parent, size, surface, position, name = '', secondary = false) {
  const part = addMesh(parent, chamferedBox(...size, Math.min(5, ...size.map(Math.abs))), surface, ...position);
  part.name = name;
  part.userData.secondary = secondary;
  return part;
}

function cylinder(parent, radii, height, surface, position, segments = 16, name = '') {
  const part = addMesh(parent, new THREE.CylinderGeometry(radii[0], radii[1], height, segments), surface, ...position);
  part.name = name;
  return part;
}

function landmark(object, name) {
  object.name = name;
  object.userData.landmark = true;
  return object;
}

function secondary(object) { object.userData.secondary = true; return object; }

function seedPoints(parent, count, bounds, color, size, seed = 1) {
  const positions = new Float32Array(count * 3);
  let state = seed;
  const random = () => { state = state * 16807 % 2147483647; return state / 2147483647; };
  for (let i = 0; i < count; i += 1) {
    for (let axis = 0; axis < 3; axis += 1) positions[i * 3 + axis] = bounds[axis][0] + random() * (bounds[axis][1] - bounds[axis][0]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.5, depthWrite: false }));
  points.userData.secondary = true;
  parent.add(points);
  return points;
}

function texture(kind) {
  const pixels = new Uint8Array(128 * 128 * 4);
  let seed = kind.length * 719;
  const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
  for (let y = 0; y < 128; y += 1) for (let x = 0; x < 128; x += 1) {
    const noise = (random() - 0.5) * 18;
    let bands = 0;
    if (kind === 'timber') bands = Math.sin(x * 0.31 + Math.sin(y * 0.026) * 3) * 11;
    if (kind === 'sandstone') bands = Math.sin(y * 0.25 + Math.sin(x * 0.04)) * 4;
    if (kind === 'stone') bands = Math.sin(x * 0.06) * Math.sin(y * 0.08) * 13;
    if (kind === 'metal') bands = Math.sin(y * 1.9) * 4;
    const value = Math.max(0, Math.min(255, 185 + noise + bands));
    const index = (y * 128 + x) * 4;
    pixels.set([value, value, value, 255], index);
  }
  const map = new THREE.DataTexture(pixels, 128, 128, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}

function backdrop(group, top, bottom) {
  const geometry = new THREE.PlaneGeometry(4700, 2700);
  const colors = new Float32Array(12);
  const a = new THREE.Color(bottom), b = new THREE.Color(top);
  [b, b, a, a].forEach((color, i) => color.toArray(colors, i * 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, depthWrite: false, fog: false }));
  sky.position.set(0, 80, -1850);
  sky.renderOrder = -900;
  group.add(sky);
}

function lights(group, { key, fill, ground, rim, position, strength = 1.6 }) {
  const sun = new THREE.DirectionalLight(key, strength);
  sun.position.set(...position);
  sun.userData.keyShadow = true;
  Object.assign(sun.shadow.camera, { left: -1100, right: 1100, top: 800, bottom: -700, near: 1, far: 3000 });
  sun.shadow.bias = -0.00015;
  sun.shadow.normalBias = 0.6;
  const ambient = new THREE.HemisphereLight(fill, ground, 0.65);
  const edge = new THREE.DirectionalLight(rim, 0.48);
  edge.position.set(-position[0], 150, 180);
  edge.userData.collectionRim = true;
  group.add(sun, ambient, edge);
  return { sun, edge };
}

function courtyard(group, animated) {
  backdrop(group, '#b8c9c1', '#4c6b67');
  lights(group, { key: '#f8e4bd', fill: '#b9d8cf', ground: '#293a32', rim: '#e7b96f', position: [-470, 720, 430], strength: 1.65 });
  const wood = material('#89715d', 0.9, 0, { map: texture('timber') });
  const stone = material('#a0a9a0', 1, 0, { map: texture('stone') });
  const moss = material('#395b3e', 1);
  const leaves = material('#55744c', 0.95, 0, { side: THREE.DoubleSide });
  const roofTiles = material('#464b46', 0.91, 0.02);
  const water = material('#4e7774', 0.24, 0.08, { transparent: true, opacity: 0.82 });
  const paper = material('#e7d4ad', 0.95, 0, { emissive: '#a57643', emissiveIntensity: 0.14 });
  box(group, [2000, 34, 1050], stone, [0, -340, -330]);
  const gate = at(group, 590, 73, -790);
  gate.scale.setScalar(0.84);
  landmark(box(gate, [560, 44, 85], wood, [0, 208, 0]), 'courtyard-gate-lintel');
  box(gate, [620, 22, 103], wood, [0, 244, -14]);
  landmark(addMesh(gate, profile([[-380, 235], [-311, 269], [-231, 282], [0, 293], [231, 282], [311, 269], [380, 235], [313, 252], [0, 268], [-313, 252]], 125, 3), roofTiles, 0, 0, -18), 'courtyard-upturned-roof');
  for (const side of [-1, 1]) {
    strut(gate, [side * 365, 245, 71], [side * 306, 270, 71], 9, wood);
    box(gate, [96, 11, 140], roofTiles, [side * 338, 256, -20], '', true).rotation.z = side * -0.12;
  }
  for (let i = -7; i <= 7; i += 1) secondary(box(gate, [3, 9, 120], stone, [i * 42, 278 - Math.abs(i) * 3, 51]));
  for (const side of [-1, 1]) {
    box(gate, [38, 460, 70], wood, [side * 208, -20, 0]);
    box(gate, [75, 23, 95], stone, [side * 208, -263, 0]);
    strut(gate, [side * 210, 82, 0], [side * 290, 211, 0], 18, wood);
    box(gate, [45, 74, 44], paper, [side * 320, 47, 40], '', true);
    box(gate, [49, 8, 49], wood, [side * 320, 90, 40]);
    box(gate, [49, 8, 49], wood, [side * 320, 4, 40]);
  }
  const screen = at(group, 337, -90, -1130);
  box(screen, [370, 250, 20], wood, [0, 0, 0]);
  for (let i = 0; i < 4; i += 1) box(screen, [75, 207, 23], paper, [-137 + i * 91, 0, 12]);
  for (let i = 0; i < 3; i += 1) secondary(box(screen, [7, 217, 28], wood, [-91 + i * 91, 0, 14]));
  const pool = at(group, 540, -316, -265);
  box(pool, [680, 33, 540], stone, [0, 0, 0]);
  const surface = addMesh(pool, new THREE.PlaneGeometry(622, 475), water, 0, 19, 0, false);
  surface.rotation.x = -Math.PI / 2;
  for (const side of [-1, 1]) {
    box(pool, [34, 35, 550], stone, [side * 329, 19, 0]);
    box(pool, [680, 35, 34], stone, [0, 19, side * 255]);
  }
  for (let i = 0; i < 8; i += 1) {
    const x = -220 + i * 71;
    const slab = cylinder(group, [43 + i % 3 * 4, 48], 11, stone, [x, -295, 155 - i * 83], 9);
    slab.rotation.y = i * 0.42;
  }
  const tree = at(group, 1025, 25, -1110);
  tree.scale.setScalar(0.78);
  cylinder(tree, [20, 33], 460, wood, [0, -70, 0], 9);
  for (let i = 0; i < 5; i += 1) {
    const branch = strut(tree, [0, 28 + i * 40, 0], [(-1) ** i * (125 + i * 20), 125 + i * 45, -25 - i * 15], 13, wood);
    branch.userData.secondary = i > 2;
  }
  const crown = at(tree, 0, 234, -35);
  crown.userData.animated = true;
  const foliage = instances(crown, new THREE.IcosahedronGeometry(1, 1), leaves,
    Array.from({ length: 32 }, (_, i) => ({ position: [Math.sin(i * 2.4) * (85 + i % 4 * 16), Math.cos(i * 1.4) * 64, Math.sin(i * 0.87) * 75], scale: [49, 31, 43] })), { secondary: true });
  foliage.userData.secondary = false;
  for (let i = 0; i < 9; i += 1) {
    const rock = addMesh(group, new THREE.IcosahedronGeometry(1, 1), i % 3 ? stone : moss, -830 + i * 49, -280 + (i % 2) * 11, -760 + (i % 4) * 45);
    rock.scale.set(35 + i % 3 * 11, 22, 28);
    rock.userData.secondary = i > 3;
  }
  seedPoints(group, 60, [[-990, 990], [-320, 310], [-820, -220]], '#dbe7c6', 2, 41);
  animated.push(time => { crown.rotation.z = Math.sin(time * 0.28) * 0.015; surface.material.opacity = 0.8 + Math.sin(time * 0.6) * 0.02; });
}

function observatory(group, animated) {
  backdrop(group, '#273849', '#526777');
  lights(group, { key: '#859ab2', fill: '#718ca5', ground: '#212a37', rim: '#eab778', position: [560, 650, 250], strength: 1.35 });
  const brass = material('#cfaf79', 0.36, 0.68, { map: texture('metal') });
  const iron = material('#536671', 0.56, 0.57);
  const glass = material('#7eacb8', 0.1, 0.19, { transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false });
  const stone = material('#59646a', 0.94, 0.03, { map: texture('stone') });
  const lamp = material('#f1c98d', 0.35, 0, { emissive: '#eaa754', emissiveIntensity: 0.4 });
  box(group, [2100, 42, 1250], stone, [0, -365, -540]);
  const dome = at(group, 590, 160, -1030);
  dome.scale.setScalar(0.84);
  cylinder(dome, [290, 310], 55, stone, [0, -205, 0], 48);
  const gap = 0.28;
  landmark(addMesh(dome, new THREE.SphereGeometry(296, 36, 16, 0, Math.PI / 2 - gap, 0, Math.PI / 2), glass, 0, -175, 0, false), 'observatory-glass-dome');
  addMesh(dome, new THREE.SphereGeometry(296, 36, 16, Math.PI / 2 + gap, Math.PI * 1.5 - gap, 0, Math.PI / 2), glass, 0, -175, 0, false);
  for (let i = 0; i < 12; i += 1) {
    const azimuth = i * Math.PI / 6;
    if (Math.abs(azimuth - Math.PI / 2) < 0.3) continue;
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 13 }, (_, step) => {
      const angle = step / 12 * Math.PI / 2;
      return new THREE.Vector3(Math.sin(angle) * 299 * Math.cos(azimuth), -175 + Math.cos(angle) * 299, Math.sin(angle) * 299 * Math.sin(azimuth));
    }));
    const rib = addMesh(dome, new THREE.TubeGeometry(curve, 24, 4, 6, false), iron);
    rib.userData.secondary = i % 2 === 1;
  }
  const domeBaseRing = addMesh(dome, new THREE.TorusGeometry(298, 8, 8, 48), brass, 0, -175, 0);
  domeBaseRing.rotation.x = Math.PI / 2;
  cylinder(dome, [35, 35], 18, brass, [0, 122, 0]);
  const telescope = at(dome, -38, -134, 186);
  telescope.rotation.z = -0.21;
  telescope.userData.animated = true;
  const barrel = cylinder(telescope, [42, 60], 350, brass, [0, 85, 0], 24, 'observatory-telescope');
  barrel.rotation.z = -0.55;
  landmark(barrel, 'observatory-telescope');
  const lens = addMesh(telescope, new THREE.CylinderGeometry(34, 34, 5, 24), glass, 97, 229, 0, false);
  lens.rotation.z = -0.55;
  cylinder(telescope, [35, 45], 135, iron, [0, -126, 0]);
  const hood = cylinder(telescope, [49, 49], 37, iron, [112, 249, 0], 24);
  hood.rotation.z = -0.55;
  const finder = cylinder(telescope, [11, 15], 228, brass, [-41, 131, 52], 12);
  finder.rotation.z = -0.55;
  for (let i = 0; i < 4; i += 1) {
    const ring = addMesh(telescope, new THREE.TorusGeometry(44 + i * 2, 4, 8, 32), brass, -47 + i * 33, 147 + i * 22, 0);
    ring.rotation.y = Math.PI / 2;
  }
  for (const side of [-1, 1]) {
    for (const depth of [-1, 1]) {
      cylinder(group, [27, 34], 350, iron, [590 + side * 210, -224, -1030 + depth * 185], 12);
      box(group, [92, 28, 90], brass, [590 + side * 210, -79, -1030 + depth * 185]);
    }
    const frame = at(group, side * 855, -35, -530);
    for (let i = 0; i < 3; i += 1) cylinder(frame, [20, 25], 550, iron, [side * (i * 42), -25, -i * 65]);
    box(frame, [140, 26, 280], stone, [0, -303, -60]);
    box(frame, [96, 98, 75], lamp, [0, -30, 25], '', true);
    const practical = new THREE.PointLight('#ffc987', 0.7, 390, 2);
    practical.position.set(0, -20, 90); frame.add(practical);
  }
  box(group, [620, 24, 510], stone, [590, -67, -1030]);
  for (let i = 0; i < 12; i += 1) secondary(box(group, [20, 36, 17], brass, [320 + i * 49, -46, -762]));
  box(group, [690, 25, 420], iron, [-555, -332, -400]);
  for (let i = 0; i < 8; i += 1) secondary(box(group, [5, 4, 390], brass, [-845 + i * 82, -316, -400]));
  const rain = seedPoints(group, 135, [[-1200, 1200], [-300, 660], [-1350, -800]], '#a9c7d9', 2, 92);
  rain.material.opacity = 0.34;
  animated.push(time => { telescope.rotation.z = -0.21 + Math.sin(time * 0.09) * 0.02; rain.position.y = -(time * 18) % 70; });
}

function desert(group, animated) {
  backdrop(group, '#927f78', '#dcaa70');
  lights(group, { key: '#ffe0a4', fill: '#eac18d', ground: '#574738', rim: '#eb9770', position: [-740, 260, 520], strength: 2.05 });
  const sandstone = material('#c1a181', 1, 0, { map: texture('sandstone') });
  const shade = material('#80644f', 1);
  const inlay = material('#dcc49d', 0.89, 0.04);
  const sand = material('#c4a981', 1);
  box(group, [2400, 42, 1280], sand, [0, -378, -550]);
  for (let layer = 0; layer < 4; layer += 1) {
    const ridge = addMesh(group, profile([[-1250, -110], [-900, 40 + layer * 17], [-460, -10], [70, 100 - layer * 21], [510, -50], [1250, 15], [1250, -170], [-1250, -170]], 25), layer % 2 ? sandstone : shade,
      0, -218 + layer * 20, -1560 + layer * 220);
    ridge.userData.secondary = layer === 0;
  }
  const monument = at(group, 590, -57, -850);
  monument.scale.setScalar(0.8);
  box(monument, [610, 64, 275], sandstone, [0, -226, 0]);
  for (const side of [-1, 1]) {
    landmark(box(monument, [150, 640, 205], sandstone, [side * 225, 99, 0]), `desert-pylon-${side}`);
    box(monument, [178, 34, 240], inlay, [side * 225, 436, 0]);
    const inset = addMesh(monument, profile([[-48, -180], [48, -180], [48, 190], [0, 230], [-48, 190]], 8), shade,
      side * 225, 81, 110, false);
    inset.userData.secondary = false;
    for (let row = 0; row < 7; row += 1) {
      const score = secondary(box(monument, [80, 4, 7], inlay, [side * 225, -126 + row * 55, 120]));
      score.rotation.z = row % 2 ? 0.11 : -0.07;
    }
  }
  box(monument, [610, 94, 235], sandstone, [0, 391, 0]);
  box(monument, [470, 25, 240], shade, [0, 345, 0]);
  landmark(addMesh(monument, profile([[-111, 441], [0, 547], [111, 441]], 116, 3), sandstone, 0, 0, -8), 'desert-sun-crest');
  const disk = addMesh(monument, new THREE.TorusGeometry(54, 9, 9, 32), inlay, 0, 362, 125);
  disk.userData.secondary = false;
  for (let i = 0; i < 12; i += 1) secondary(box(monument, [29, 5, 8], inlay, [-241 + i * 43, 402, 122]));
  for (const side of [-1, 1]) {
    box(monument, [23, 385, 16], shade, [side * 133, 86, 111]);
    for (let i = 0; i < 4; i += 1) secondary(box(monument, [25, 6, 19], inlay, [side * 133, -54 + i * 88, 122]));
  }
  const stairs = instances(group, chamferedBox(420, 22, 83), sandstone,
    Array.from({ length: 5 }, (_, i) => ({ position: [590, -345 + i * 16, -330 - i * 88], scale: [0.8, 1, 1] })));
  stairs.name = 'desert-processional-steps';
  box(group, [640, 88, 370], shade, [590, -340, -850]);
  const farMesa = addMesh(group, profile([[-390, -95], [-310, 29], [-220, 29], [-175, 137], [-35, 137], [18, 19], [310, 19], [390, -95]], 85, 5), shade, -680, -153, -1480);
  farMesa.userData.secondary = false;
  for (let i = 0; i < 6; i += 1) {
    const ruin = at(group, -780 + (i % 2) * 160, -190 - i * 22, -1060 + Math.floor(i / 2) * 275);
    cylinder(ruin, [24 + i * 2, 32], 235 - i * 20, sandstone, [0, -40, 0], 8);
    box(ruin, [77, 21, 75], inlay, [0, 83 - i * 10, 0]);
  }
  const dust = seedPoints(group, 100, [[-1140, 1120], [-330, 310], [-950, -190]], '#f2d5aa', 2, 188);
  dust.userData.animated = true;
  animated.push(time => { dust.rotation.y = Math.sin(time * 0.04) * 0.025; dust.position.x = Math.sin(time * 0.15) * 22; });
}

function underwater(group, animated) {
  backdrop(group, '#123949', '#1d6870');
  lights(group, { key: '#9dcebd', fill: '#629f9e', ground: '#132e36', rim: '#8bd2c1', position: [-350, 760, 350], strength: 1.35 });
  const stone = material('#adbeb4', 1, 0, { map: texture('stone') });
  const dark = material('#667d77', 1);
  const algae = material('#5f9a77', 1);
  const coral = material('#cb9d8d', 0.92);
  const sand = material('#869f99', 1);
  box(group, [2200, 38, 1400], sand, [0, -385, -610]);
  const temple = at(group, 605, 65, -1030);
  temple.scale.setScalar(0.88);
  box(temple, [760, 80, 370], stone, [0, -202, 0]);
  box(group, [720, 250, 350], dark, [605, -260, -1030]);
  for (let tier = 0; tier < 3; tier += 1) box(group, [820 - tier * 42, 26, 410 - tier * 32], stone, [605, -363 + tier * 37, -1030]);
  for (let i = 0; i < 5; i += 1) {
    const x = -280 + i * 140;
    const broken = i === 1 || i === 3;
    cylinder(temple, [39, 47], broken ? 260 : 400, stone, [x, broken ? -36 : 29, 53], 12);
    box(temple, [100, 28, 105], dark, [x, broken ? 105 : 238, 53]);
    if (i > 0 && i < 4) secondary(box(temple, [5, 205, 7], algae, [x + 31, -16, 98]));
  }
  landmark(addMesh(temple, arcProfile(145, 190, 100, 0, Math.PI), stone, 0, 40, -65), 'underwater-ruined-arch');
  box(temple, [690, 54, 180], stone, [0, 267, -65]);
  for (let i = 0; i < 6; i += 1) box(temple, [88, 19, 153], dark, [-300 + i * 119, 299, -65], '', true);
  for (let row = 0; row < 3; row += 1) for (let i = 0; i < 7; i += 1) {
    const seam = secondary(box(temple, [7, 5, 9], dark, [-328 + i * 108 + (row % 2) * 37, 221 + row * 23, 27]));
    seam.rotation.z = (i % 2 ? 1 : -1) * 0.08;
  }
  for (const side of [-1, 1]) {
    addMesh(temple, profile([[0, -71], [60, -71], [70, 46], [38, 75], [0, 65]], 43, 2), algae, side * 245, 5, 104);
    for (let i = 0; i < 6; i += 1) secondary(box(temple, [3, 38 + i * 8, 4], algae, [side * (212 + i * 12), 15 - i * 8, 130]));
  }
  const obelisk = at(group, -675, -185, -850);
  landmark(addMesh(obelisk, profile([[-78, -157], [83, -157], [65, 175], [0, 272], [-59, 175]], 118, 3), stone), 'underwater-broken-obelisk');
  box(obelisk, [186, 38, 151], dark, [0, -171, 0]);
  for (let i = 0; i < 10; i += 1) {
    const fan = at(group, -980 + (i % 5) * 93, -301, -320 - Math.floor(i / 5) * 310);
    cylinder(fan, [5, 8], 70 + i % 3 * 18, coral, [0, 30, 0], 6);
    for (const side of [-1, 1]) strut(fan, [0, 45, 0], [side * (28 + i % 3 * 7), 85 + i % 4 * 6, 0], 5, coral);
    fan.userData.secondary = i > 5;
  }
  const fish = at(group, -650, 120, -1190);
  fish.userData.animated = true;
  const fishMat = material('#8ca9a3', 0.55, 0.15);
  for (let i = 0; i < 5; i += 1) {
    const body = addMesh(fish, new THREE.SphereGeometry(1, 8, 6), fishMat, i * 38, Math.sin(i * 2) * 31, i * 35);
    body.scale.set(18, 7, 4);
  }
  const bubbles = seedPoints(group, 90, [[-1050, 1050], [-330, 540], [-1150, -200]], '#a5d9d1', 3, 24);
  const beams = material('#a7e4d4', 1, 0, { transparent: true, opacity: 0.065, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 3; i += 1) {
    const shaft = addMesh(group, profile([[-15, 650], [20, 650], [145, -180], [-90, -180]], 1, 0), beams, 345 + i * 240, 0, -1440 - i * 90, false);
    shaft.userData.secondary = i > 0;
  }
  animated.push(time => { fish.rotation.y = Math.sin(time * 0.11) * 0.12; bubbles.position.y = (time * 5) % 32; });
}

function lunar(group, animated) {
  backdrop(group, '#080e1b', '#26334a');
  lights(group, { key: '#e4e9e7', fill: '#788ca8', ground: '#1f2634', rim: '#aab9d2', position: [-740, 640, 460], strength: 1.75 });
  const regolith = material('#747983', 1, 0, { map: texture('stone') });
  const ceramic = material('#b5bab7', 0.61, 0.18, { map: texture('metal') });
  const dark = material('#34404b', 0.68, 0.52);
  const solar = material('#29445f', 0.25, 0.22);
  const glass = material('#607c8a', 0.16, 0.32);
  const practical = material('#decaa3', 0.62, 0, { emissive: '#c9ae7a', emissiveIntensity: 0.25 });
  box(group, [2400, 45, 1500], regolith, [0, -391, -660]);
  for (let i = 0; i < 9; i += 1) {
    const crater = addMesh(group, new THREE.TorusGeometry(65 + i * 13, 7 + i % 3 * 3, 7, 28), regolith,
      -1130 + i * 280, -363 + i % 2 * 4, -1190 + i % 3 * 185);
    crater.rotation.x = -Math.PI / 2;
    crater.scale.y = 0.72;
    crater.userData.secondary = i > 4;
  }
  const base = at(group, 620, 130, -1010);
  base.scale.setScalar(0.78);
  for (const side of [-1, 1]) {
    box(base, [40, 600, 42], dark, [side * 275, -360, 0]);
    box(base, [70, 30, 70], regolith, [side * 275, -674, 0]);
  }
  const habitat = cylinder(base, [180, 180], 520, ceramic, [0, 0, 0], 32, 'lunar-habitat');
  habitat.rotation.z = Math.PI / 2;
  landmark(habitat, 'lunar-habitat');
  for (const side of [-1, 1]) {
    const collar = cylinder(base, [192, 192], 28, dark, [side * 245, 0, 0], 32);
    collar.rotation.z = Math.PI / 2;
    const port = cylinder(base, [60, 60], 14, glass, [side * 270, 0, 0], 24);
    port.rotation.z = Math.PI / 2;
  }
  for (let i = 0; i < 7; i += 1) {
    const rib = cylinder(base, [183, 183], 9, dark, [-196 + i * 64, 0, 0], 32);
    rib.rotation.z = Math.PI / 2;
    rib.userData.secondary = i > 2;
  }
  box(base, [340, 27, 250], ceramic, [0, -197, 0]);
  box(base, [150, 60, 95], practical, [-58, -70, 182]);
  const airlock = at(base, 70, -90, 202);
  box(airlock, [174, 220, 86], ceramic, [0, 0, 0]);
  box(airlock, [119, 160, 12], dark, [0, -8, 50]);
  const hatch = cylinder(airlock, [52, 52], 13, glass, [0, 0, 61], 24);
  hatch.rotation.x = Math.PI / 2;
  for (let i = 0; i < 12; i += 1) {
    const angle = i / 12 * Math.PI * 2;
    secondary(box(airlock, [7, 7, 8], ceramic, [Math.sin(angle) * 61, Math.cos(angle) * 61, 58]));
  }
  for (const side of [-1, 1]) {
    box(base, [22, 160, 16], practical, [side * 166, 44, 176], '', true);
    strut(base, [side * 232, -164, 0], [side * 324, -320, 0], 12, dark);
  }
  const mast = at(base, 170, 176, -40);
  landmark(cylinder(mast, [11, 15], 290, dark, [0, 118, 0]), 'lunar-communications-mast');
  for (let i = 0; i < 4; i += 1) box(mast, [88 - i * 13, 7, 7], ceramic, [0, 88 + i * 55, 0]);
  const beacon = addMesh(mast, new THREE.SphereGeometry(13, 12, 8), practical, 0, 275, 0, false);
  beacon.userData.secondary = true;
  const array = at(group, -605, -108, -780);
  array.rotation.y = -0.25;
  array.userData.animated = true;
  cylinder(array, [15, 20], 400, dark, [0, -48, 0]);
  for (const side of [-1, 1]) {
    landmark(box(array, [270, 176, 9], solar, [side * 168, 102, 0]), `lunar-solar-array-${side}`);
    for (let i = 0; i < 3; i += 1) secondary(box(array, [4, 175, 11], ceramic, [side * (90 + i * 80), 102, 4]));
    for (let i = 0; i < 2; i += 1) secondary(box(array, [270, 4, 11], ceramic, [side * 168, 57 + i * 87, 4]));
  }
  const dish = at(group, 1060, 76, -1320);
  dish.scale.setScalar(0.7);
  dish.userData.animated = true;
  cylinder(dish, [13, 18], 460, dark, [0, -90, 0]);
  const reflector = addMesh(dish, new THREE.SphereGeometry(112, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), ceramic, 0, 132, 0);
  reflector.rotation.x = -0.6;
  strut(dish, [0, 132, 0], [0, 217, 67], 7, dark);
  const earth = addMesh(group, new THREE.SphereGeometry(112, 32, 20), material('#83acbf', 0.86), 1060, 485, -1700, false);
  earth.name = 'distant-earth';
  const earthCloud = secondary(addMesh(group, new THREE.SphereGeometry(115, 24, 16), material('#d4e0df', 1, 0, { transparent: true, opacity: 0.18, depthWrite: false }), 1060, 485, -1700, false));
  earthCloud.userData.secondary = false;
  const stars = seedPoints(group, 110, [[-1500, 1500], [110, 740], [-1700, -1450]], '#d7e1ef', 2, 5);
  stars.userData.secondary = false;
  animated.push(time => { array.rotation.y = -0.25 + Math.sin(time * 0.05) * 0.025; dish.rotation.y = Math.sin(time * 0.08) * 0.07; earth.rotation.y = time * 0.003; });
}

function alpine(group, animated) {
  backdrop(group, '#829da8', '#bdc6c3');
  lights(group, { key: '#e5e8de', fill: '#b7cbd8', ground: '#504c42', rim: '#edb26c', position: [-660, 640, 360], strength: 1.5 });
  const timber = material('#93755b', 0.93, 0, { map: texture('timber') });
  const darkWood = material('#483c35', 0.92);
  const stone = material('#9a9c98', 1, 0, { map: texture('stone') });
  const snow = new THREE.MeshBasicMaterial({ color: '#d9e7e6' });
  const pine = new THREE.MeshBasicMaterial({ color: '#526e74' });
  const farRock = new THREE.MeshBasicMaterial({ color: '#8ba4aa' });
  const ember = material('#e7ab59', 0.64, 0, { emissive: '#e37c36', emissiveIntensity: 0.6 });
  box(group, [2300, 42, 1350], darkWood, [0, -395, -570]);
  for (let i = 0; i < 10; i += 1) secondary(box(group, [15, 5, 1250], timber, [-1080 + i * 245, -369, -570]));
  const mountains = [
    { x: 270, y: -106, z: -1700, scale: 1.3, color: farRock },
    { x: 1080, y: -134, z: -1550, scale: 1.04, color: pine },
    { x: 600, y: -177, z: -1490, scale: 0.75, color: snow },
  ];
  for (const ridge of mountains) {
    const mesh = addMesh(group, profile([[-520, -160], [-362, 50], [-240, 20], [-90, 230], [10, 125], [190, 330], [390, 55], [520, -160]], 27), ridge.color, ridge.x, ridge.y, ridge.z);
    mesh.scale.setScalar(ridge.scale);
  }
  const whiteCap = addMesh(group, profile([[-92, 228], [-24, 152], [34, 216], [190, 330], [280, 180], [222, 200], [149, 174], [52, 110]], 4, 0), snow, 270, -106, -1659, false);
  whiteCap.scale.setScalar(1.3);
  const lodge = at(group, 610, 55, -1020);
  landmark(box(lodge, [750, 43, 90], timber, [0, 332, 45]), 'alpine-picture-window-beam');
  for (const side of [-1, 1]) {
    box(lodge, [52, 690, 95], timber, [side * 352, 0, 45]);
    box(lodge, [45, 720, 110], darkWood, [side * 380, 0, 5]);
    strut(lodge, [side * 350, 256, 45], [side * 284, 333, 45], 21, timber);
  }
  box(lodge, [750, 35, 95], timber, [0, -333, 45]);
  box(lodge, [38, 644, 90], timber, [0, 0, 48]);
  box(lodge, [730, 28, 90], timber, [0, -46, 50]);
  for (let i = 0; i < 5; i += 1) secondary(box(lodge, [9, 595, 7], stone, [-240 + i * 120, 0, 98]));
  box(group, [205, 650, 225], stone, [845, -75, -685]);
  box(group, [240, 29, 265], timber, [845, 211, -660]);
  box(group, [165, 190, 18], darkWood, [845, -246, -559]);
  const fire = at(group, 845, -277, -542);
  fire.userData.animated = true;
  for (let i = 0; i < 5; i += 1) {
    const flame = addMesh(fire, new THREE.ConeGeometry(12 + i % 3 * 6, 50 + i * 10, 7), ember, -45 + i * 22, 30, i % 2 * 10, false);
    flame.rotation.z = (i - 2) * 0.1;
  }
  for (const side of [-1, 1]) box(group, [160, 35, 330], timber, [side * 425, -281, -420]);
  box(group, [1200, 45, 100], timber, [500, 433, -800]);
  seedPoints(group, 95, [[-1200, 1250], [-120, 720], [-1750, -1300]], '#f4f7f6', 3, 812);
  const warm = new THREE.PointLight('#f4b66f', 1.3, 600, 2);
  warm.position.set(845, -180, -490); group.add(warm);
  animated.push(time => { fire.rotation.z = Math.sin(time * 0.8) * 0.035; });
}

function cloud(group, animated) {
  backdrop(group, '#63899b', '#9db6ba');
  lights(group, { key: '#fff3d7', fill: '#c8dde4', ground: '#737c81', rim: '#dfccb0', position: [-460, 790, 380], strength: 1.8 });
  const marble = material('#c7cec8', 0.82, 0, { map: texture('stone') });
  const shadow = material('#789290', 0.97);
  const trim = material('#cbbd9f', 0.62, 0.14);
  const fabric = material('#d9ad8f', 1, 0, { side: THREE.DoubleSide });
  const mist = material('#e4ece9', 1, 0, { transparent: true, opacity: 0.38, depthWrite: false });
  const clouds = instances(group, new THREE.SphereGeometry(1, 10, 7), mist,
    Array.from({ length: 26 }, (_, i) => ({
      position: [-1150 + (i * 277) % 2370, -285 + (i % 5) * 48, -1700 + (i % 4) * 145],
      scale: [125 + i % 3 * 35, 34 + i % 4 * 10, 76],
    })), { cast: false, secondary: true });
  clouds.userData.secondary = false;
  const terrace = at(group, 595, -180, -1110);
  box(terrace, [1050, 65, 650], marble, [0, -151, 0]);
  for (let tier = 0; tier < 3; tier += 1) box(terrace, [1040 - tier * 85, 30, 620 - tier * 70], shadow, [0, -106 + tier * 36, 0]);
  const sanctuary = at(group, 600, 105, -1190);
  for (const side of [-1, 1]) {
    cylinder(sanctuary, [37, 44], 465, marble, [side * 230, -84, 0], 18);
    box(sanctuary, [104, 28, 100], trim, [side * 230, 162, 0]);
    box(sanctuary, [100, 30, 106], marble, [side * 230, -333, 0]);
  }
  landmark(addMesh(sanctuary, arcProfile(190, 244, 105, 0, Math.PI), marble, 0, 133, 0), 'cloud-sanctuary-arch');
  box(sanctuary, [590, 42, 140], trim, [0, 365, 0]);
  for (let i = 0; i < 9; i += 1) secondary(box(sanctuary, [15, 22, 104], shadow, [-274 + i * 68, 392, 0]));
  const cloth = at(sanctuary, 0, 125, 87);
  cloth.userData.animated = true;
  const hanging = addMesh(cloth, profile([[-76, 0], [76, 0], [70, -211], [13, -191], [0, -240], [-20, -191], [-69, -211]], 2, 0), fabric, 0, 0, 0, false);
  hanging.castShadow = false;
  box(sanctuary, [181, 13, 18], trim, [0, 137, 94]);
  for (const side of [-1, 1]) {
    box(terrace, [32, 92, 440], marble, [side * 485, -34, 0]);
    for (let i = 0; i < 4; i += 1) cylinder(terrace, [20, 22], 135, marble, [side * 485, 23, -215 + i * 142], 10);
  }
  for (let i = 0; i < 6; i += 1) box(group, [550 - i * 45, 24, 85], marble, [575, -355 + i * 21, -430 - i * 95]);
  animated.push(time => { cloth.rotation.y = Math.sin(time * 0.25) * 0.035; });
}

function library(group, animated) {
  backdrop(group, '#3c3433', '#8d6c4f');
  lights(group, { key: '#eac188', fill: '#c8a679', ground: '#302825', rim: '#e5ad6a', position: [-570, 690, 420], strength: 1.45 });
  const wood = material('#7a4d32', 0.86, 0, { map: texture('timber') });
  const darkWood = material('#594336', 0.88);
  const floorWood = material('#907158', 0.94, 0, { emissive: '#473226', emissiveIntensity: 0.16 });
  const leather = material('#765944', 0.8);
  const brass = material('#bca06c', 0.35, 0.62);
  const goldGlass = material('#dcc28c', 0.37, 0.04, { emissive: '#ad7a3b', emissiveIntensity: 0.1 });
  box(group, [2300, 46, 1250], floorWood, [0, -386, -535]);
  const shelves = at(group, 625, 54, -1075);
  landmark(box(shelves, [760, 762, 130], wood, [0, 0, 0]), 'autumn-library-bookcase');
  box(shelves, [680, 688, 20], darkWood, [0, 0, 73]);
  for (const side of [-1, 1]) {
    box(shelves, [42, 789, 160], wood, [side * 366, 0, 55]);
    box(shelves, [33, 760, 9], brass, [side * 338, 0, 143]);
  }
  for (let row = 0; row < 5; row += 1) {
    const y = -298 + row * 150;
    box(shelves, [690, 27, 147], wood, [0, y - 58, 85]);
    const bindings = instances(shelves, chamferedBox(1, 1, 1, 0.1), row % 2 ? leather : goldGlass,
      Array.from({ length: 18 }, (_, i) => ({
        position: [-305 + i * 35, y, 152], scale: [24 + i % 3 * 4, 78 + (i * 7) % 49, 19 + i % 4 * 2],
        rotation: [0, 0, ((i % 5) - 2) * 0.015],
      })), { secondary: true });
    bindings.castShadow = false;
  }
  const crown = addMesh(shelves, profile([[-394, 356], [-319, 441], [0, 476], [319, 441], [394, 356]], 175, 5), wood, 0, 0, 0);
  crown.userData.secondary = false;
  const window = at(group, -385, 110, -1370);
  landmark(addMesh(window, arcProfile(150, 193, 40, 0, Math.PI), brass, 0, 110, 0), 'autumn-library-arched-window');
  box(window, [390, 400, 35], wood, [0, -90, 0]);
  box(window, [290, 360, 7], goldGlass, [0, -95, 20]);
  for (let i = 0; i < 3; i += 1) box(window, [12, 380, 10], brass, [-90 + i * 90, -96, 29], '', i > 0);
  const desk = at(group, 605, -263, -460);
  box(desk, [550, 42, 270], wood, [0, 85, 0]);
  for (const side of [-1, 1]) box(desk, [33, 230, 30], darkWood, [side * 222, -32, side * 75]);
  box(desk, [195, 12, 140], leather, [-96, 112, 8]);
  const lamp = cylinder(desk, [21, 34], 17, brass, [135, 117, 16]);
  lamp.castShadow = false;
  cylinder(desk, [6, 7], 100, brass, [135, 172, 16]);
  addMesh(desk, new THREE.SphereGeometry(27, 12, 8), goldGlass, 135, 234, 16, false);
  const mote = seedPoints(group, 60, [[-1070, 1050], [-260, 610], [-1450, -320]], '#e9c895', 1.7, 196);
  mote.userData.animated = true;
  const warm = new THREE.PointLight('#f5c77e', 1.2, 540, 2);
  warm.position.set(740, -45, -440); group.add(warm);
  const windowBounce = new THREE.PointLight('#f2d5aa', 0.7, 760, 2);
  windowBounce.position.set(340, 210, -390); group.add(windowBounce);
  animated.push(time => { mote.rotation.y = Math.sin(time * 0.08) * 0.03; });
}

function volcanic(group, animated) {
  backdrop(group, '#353743', '#9a6656');
  lights(group, { key: '#c7afb3', fill: '#88919c', ground: '#231d22', rim: '#d87750', position: [-620, 620, 300], strength: 1.25 });
  const basalt = material('#69696d', 0.98, 0.06, { map: texture('stone') });
  const dark = material('#393c45', 0.91, 0.06);
  const warmRock = material('#9a7362', 0.99);
  const water = material('#66808a', 0.36, 0.09);
  const lava = material('#b45b38', 0.64, 0, { emissive: '#e35c2b', emissiveIntensity: 0.38 });
  const steamMat = material('#bbbbb7', 1, 0, { transparent: true, opacity: 0.14, depthWrite: false });
  const sea = addMesh(group, new THREE.PlaneGeometry(3000, 1600), water, 0, -365, -700, false);
  sea.rotation.x = -Math.PI / 2;
  const distant = addMesh(group, profile([[-1300, -240], [-1030, -100], [-850, -175], [-620, 24], [-430, -84], [-160, 110], [60, -88], [470, 22], [840, -145], [1300, -60], [1300, -260]], 55), dark, 0, -20, -1550);
  distant.userData.secondary = false;
  const coast = at(group, 610, -80, -980);
  landmark(addMesh(coast, profile([[-410, -290], [-342, -120], [-272, -156], [-205, 52], [-155, -56], [-74, 276], [-2, 172], [58, 382], [105, 224], [171, 295], [250, 25], [344, -110], [408, -290]], 310, 1), basalt), 'volcanic-basalt-spire');
  landmark(addMesh(coast, profile([[20, 143], [58, 449], [111, 248], [128, 135]], 115, 1), dark, 0, 0, 22), 'volcanic-jagged-summit');
  for (let i = 0; i < 8; i += 1) {
    const col = cylinder(coast, [22 + i % 3 * 3, 28], 130 + i % 4 * 39, i % 3 ? basalt : warmRock,
      [-325 + i * 88, -226 + i % 4 * 18, 175 + i % 2 * 22], 6);
    col.rotation.z = (i % 3 - 1) * 0.08;
  }
  const fault = addMesh(coast, profile([[20, 226], [49, 272], [34, 110], [85, 65], [58, -46], [115, -104], [82, -235], [49, -235], [77, -87], [27, -40], [52, 66]], 5, 0), lava, 0, 0, 161, false);
  fault.userData.secondary = false;
  for (let i = 0; i < 7; i += 1) secondary(box(coast, [47 + i % 3 * 12, 8, 13], warmRock, [-291 + i * 87, -289 + i % 2 * 16, 199]));
  const lavaShelf = addMesh(group, profile([[-390, -110], [-245, -28], [-147, -75], [-28, 34], [155, -18], [330, 17], [480, -120]], 64), warmRock, -650, -250, -1150);
  lavaShelf.userData.secondary = true;
  const vent = at(group, 845, 76, -1080);
  vent.userData.animated = true;
  for (let i = 0; i < 6; i += 1) {
    const puff = addMesh(vent, new THREE.SphereGeometry(1, 10, 7), steamMat, Math.sin(i * 3) * 33, i * 57, -i * 17, false);
    puff.scale.set(47 + i * 6, 22 + i * 6, 35 + i * 5);
    puff.userData.secondary = i > 2;
  }
  const hotRim = new THREE.PointLight('#d37c50', 1.1, 800, 2);
  hotRim.position.set(820, 70, -370); group.add(hotRim);
  animated.push(time => { vent.rotation.z = Math.sin(time * 0.17) * 0.025; });
}

function paper(group, animated) {
  backdrop(group, '#e1dcd0', '#b1b8b1');
  lights(group, { key: '#f8edda', fill: '#d7ded7', ground: '#817b75', rim: '#d7bfa4', position: [-600, 700, 480], strength: 1.65 });
  const ivory = material('#e7dfd0', 0.95, 0, { side: THREE.DoubleSide });
  const warm = material('#c7ad96', 0.98, 0, { side: THREE.DoubleSide });
  const cool = material('#aabbb9', 0.96, 0, { side: THREE.DoubleSide });
  const edge = material('#817f79', 1);
  const ground = material('#d0c8b9', 1);
  box(group, [2300, 33, 1300], ground, [0, -395, -560]);
  for (let layer = 0; layer < 5; layer += 1) {
    const page = addMesh(group, profile([[-1250, -125], [-980, 82 + layer * 22], [-640, -80], [-280, 170 - layer * 23], [170, -67], [500, 102], [960, -48], [1250, 85], [1250, -175], [-1250, -175]], 10, 0), layer % 2 ? cool : warm,
      0, -212 + layer * 19, -1570 + layer * 180);
    page.userData.secondary = layer < 2;
  }
  const plinth = at(group, 610, -185, -960);
  box(plinth, [680, 53, 490], warm, [0, -145, 0]);
  box(plinth, [610, 18, 430], ivory, [0, -107, 0]);
  for (let i = 0; i < 5; i += 1) secondary(box(plinth, [510 - i * 20, 2, 4], edge, [0, -161 + i * 5, 247]));
  const crane = at(group, 610, 57, -1030);
  crane.userData.animated = true;
  landmark(addMesh(crane, profile([[-35, -114], [54, -131], [132, -38], [24, 74], [-98, 15]], 21, 0), ivory), 'paper-origami-crane-body');
  landmark(addMesh(crane, profile([[-42, -39], [-328, 200], [-277, -38], [-96, -104]], 12, 0), warm, 0, 0, -8), 'paper-origami-left-wing');
  landmark(addMesh(crane, profile([[25, -41], [306, 255], [272, -50], [100, -112]], 12, 0), cool, 0, 0, -4), 'paper-origami-right-wing');
  addMesh(crane, profile([[45, -29], [155, 86], [179, 221], [202, 243], [181, 195], [160, 107], [102, -18]], 12, 0), ivory, 0, 0, -10);
  addMesh(crane, profile([[-68, -52], [-167, -84], [-291, -175], [-219, -111], [-78, -9]], 10, 0), warm, 0, 0, -9);
  for (const [a, b] of [[[-328, 200, 8], [-96, -104, 8]], [[306, 255, 8], [100, -112, 8]], [[-35, -114, 14], [132, -38, 14]]]) secondary(strut(crane, a, b, 3, edge));
  for (let i = 0; i < 7; i += 1) {
    const fold = at(group, -870 + i * 238, -305 + i % 3 * 10, -700 - i % 2 * 160);
    addMesh(fold, profile([[-66, -13], [0, 83 + i % 3 * 15], [66, -13]], 10, 0), i % 2 ? cool : ivory);
    fold.userData.secondary = i > 3;
  }
  const hanging = at(group, 945, 254, -1280);
  hanging.userData.animated = true;
  for (let i = 0; i < 3; i += 1) {
    const kite = addMesh(hanging, profile([[-18, 0], [0, 55], [24, 0], [0, -47]], 4, 0), i % 2 ? cool : warm, i * 57, i * 45, -i * 14);
    kite.userData.secondary = i > 0;
  }
  animated.push(time => { crane.rotation.z = Math.sin(time * 0.12) * 0.012; hanging.rotation.y = Math.sin(time * 0.2) * 0.09; });
}

function clockmaker(group, animated) {
  backdrop(group, '#594638', '#93765a');
  lights(group, { key: '#f0c989', fill: '#baa78d', ground: '#3b2e2a', rim: '#d9aa70', position: [-530, 610, 430], strength: 1.52 });
  const oak = material('#987151', 0.89, 0, { map: texture('timber') });
  const brass = material('#e0bd7c', 0.34, 0.62, { map: texture('metal') });
  const dark = material('#554c43', 0.67, 0.42);
  const enamel = material('#d4c7a8', 0.32, 0.08);
  const ruby = material('#945044', 0.28, 0.2);
  box(group, [2400, 43, 1350], oak, [0, -394, -630]);
  const cabinet = at(group, 635, 12, -1110);
  box(cabinet, [710, 815, 185], oak, [0, 0, -100]);
  box(cabinet, [622, 692, 28], dark, [0, 29, 4]);
  box(cabinet, [715, 48, 243], oak, [0, 425, -70]);
  for (const side of [-1, 1]) box(cabinet, [48, 760, 215], oak, [side * 332, 0, -25]);
  const wheel = at(cabinet, 0, 115, 35);
  wheel.userData.animated = true;
  landmark(addMesh(wheel, arcProfile(169, 228, 45), brass), 'clockmaker-main-gear');
  addMesh(wheel, arcProfile(150, 164, 49), dark);
  const teeth = instances(wheel, chamferedBox(22, 40, 50), brass,
    Array.from({ length: 32 }, (_, i) => {
      const angle = i * Math.PI / 16;
      return { position: [Math.sin(angle) * 228, Math.cos(angle) * 228, 0], rotation: [0, 0, -angle] };
    }));
  teeth.userData.secondary = false;
  for (let i = 0; i < 8; i += 1) {
    const angle = i * Math.PI / 4;
    const spoke = strut(wheel, [0, 0, 0], [Math.sin(angle) * 178, Math.cos(angle) * 178, 0], 18, brass);
    spoke.userData.secondary = i % 2 === 1;
  }
  cylinder(wheel, [48, 48], 64, dark, [0, 0, 19], 24).rotation.x = Math.PI / 2;
  addMesh(wheel, new THREE.SphereGeometry(19, 12, 8), ruby, 0, 0, 61);
  const upper = at(cabinet, -230, 301, 27);
  addMesh(upper, arcProfile(55, 92, 24), enamel);
  for (let i = 0; i < 12; i += 1) {
    const a = i * Math.PI / 6;
    box(upper, [5, 16, 8], dark, [Math.sin(a) * 77, Math.cos(a) * 77, 15], '', true).rotation.z = -a;
  }
  const pendulum = at(cabinet, 255, -100, 45);
  pendulum.userData.animated = true;
  box(pendulum, [8, 390, 9], brass, [0, -174, 0]);
  addMesh(pendulum, new THREE.SphereGeometry(48, 20, 12), brass, 0, -377, 0);
  box(group, [720, 38, 275], oak, [-540, -190, -450]);
  for (const side of [-1, 1]) box(group, [44, 230, 50], oak, [-540 + side * 260, -311, -450]);
  for (let i = 0; i < 6; i += 1) {
    const tool = cylinder(group, [8 + i % 3 * 3, 8], 105 + i * 11, i % 2 ? brass : dark, [-780 + i * 91, -118, -450], 9);
    tool.rotation.z = (i - 3) * 0.04;
    tool.userData.secondary = i > 2;
  }
  const taskLight = new THREE.PointLight('#f1c581', 0.95, 620, 2);
  taskLight.position.set(-610, 90, -250); group.add(taskLight);
  const clockLight = new THREE.PointLight('#f6d3a0', 1.25, 690, 2);
  clockLight.position.set(635, 205, -700); group.add(clockLight);
  animated.push(time => { wheel.rotation.z = time * 0.025; pendulum.rotation.z = Math.sin(time * 0.5) * 0.035; });
}

function rainforest(group, animated) {
  backdrop(group, '#315653', '#788d70');
  lights(group, { key: '#cdd6a2', fill: '#8eae9b', ground: '#253e36', rim: '#c4c090', position: [-610, 840, 400], strength: 1.65 });
  const stone = material('#98a494', 1, 0, { map: texture('stone') });
  const deep = material('#51645a', 1);
  const moss = material('#587c55', 1);
  const foliage = material('#3b7152', 0.98, 0, { side: THREE.DoubleSide });
  const water = material('#4e8177', 0.28, 0.02, { transparent: true, opacity: 0.87 });
  const bark = material('#5a4d3c', 1, 0, { map: texture('timber') });
  box(group, [2300, 47, 1400], deep, [0, -394, -550]);
  const lagoon = addMesh(group, new THREE.PlaneGeometry(1350, 720), water, -250, -369, -310, false);
  lagoon.rotation.x = -Math.PI / 2;
  const sanctuary = at(group, 600, -60, -1070);
  for (let tier = 0; tier < 5; tier += 1) {
    box(sanctuary, [830 - tier * 93, 67, 610 - tier * 59], tier % 2 ? deep : stone, [0, -235 + tier * 80, -tier * 36]);
    for (const side of [-1, 1]) secondary(box(sanctuary, [22, 11, 380 - tier * 49], moss, [side * (400 - tier * 47), -190 + tier * 80, -tier * 36]));
  }
  const shrine = at(sanctuary, 0, 180, -188);
  landmark(addMesh(shrine, profile([[-201, -157], [-201, 153], [-147, 208], [147, 208], [201, 153], [201, -157], [131, -157], [131, 112], [82, 146], [-82, 146], [-131, 112], [-131, -157]], 154, 3), stone), 'rainforest-temple-shrine');
  box(shrine, [500, 40, 210], deep, [0, 229, 0]);
  for (let i = 0; i < 7; i += 1) box(shrine, [51, 19, 189], stone, [-212 + i * 71, 259, 0], '', i % 2 === 1);
  for (const side of [-1, 1]) {
    box(shrine, [46, 186, 25], moss, [side * 165, 39, 89]);
    for (let i = 0; i < 4; i += 1) secondary(box(shrine, [12, 12, 15], deep, [side * 172, 138 - i * 49, 104]));
  }
  for (let i = 0; i < 7; i += 1) box(group, [252 + i * 19, 19, 63], stone, [590, -358 + i * 27, -315 - i * 89]);
  const grove = at(group, 1070, -122, -1350);
  grove.userData.animated = true;
  for (let i = 0; i < 3; i += 1) {
    cylinder(grove, [22 + i * 4, 34], 650 - i * 100, bark, [i * 120 - 120, -1 + i * 30, -i * 90], 9);
    const crown = addMesh(grove, new THREE.IcosahedronGeometry(1, 1), foliage, i * 120 - 120, 326 - i * 45, -i * 90);
    crown.scale.set(180 - i * 22, 92, 125);
    crown.userData.secondary = i > 0;
  }
  for (let i = 0; i < 12; i += 1) {
    const leaf = addMesh(group, profile([[-12, -32], [0, 62 + i % 3 * 20], [23, -15]], 3, 0), foliage,
      -1030 + i * 124, -235 + i % 4 * 29, -350 - i % 3 * 130);
    leaf.rotation.z = i % 2 ? 0.35 : -0.24;
    leaf.userData.secondary = i > 6;
  }
  seedPoints(group, 52, [[-1000, 1080], [-180, 650], [-1350, -220]], '#c9e0bd', 2, 377);
  animated.push(time => { grove.rotation.z = Math.sin(time * 0.14) * 0.012; lagoon.material.opacity = 0.86 + Math.sin(time * 0.36) * 0.01; });
}

/** An independently owned scene for the fixed gameplay world camera. */
export function createCollectionWorld(sceneId) {
  const build = SCENES[sceneId];
  if (!build) return null;
  const group = new THREE.Group();
  group.name = `collection-${sceneId}`;
  const animated = [];
  build(group, animated);
  // Opaque surface maps do not affect the shadow silhouette. Avoid binding
  // them through Three's shared shadow material during rapid world switches.
  const shadowDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.BasicDepthPacking });
  group.traverse(object => {
    if ((object.isMesh || object.isInstancedMesh) && object.material?.map) object.customDepthMaterial = shadowDepth;
  });
  const rimLights = [];
  group.traverse(object => { if (object.userData.collectionRim) rimLights.push(object); });
  let disposed = false;
  return {
    group,
    update({ time = 0, reducedMotion = false, pulse = 0 } = {}) {
      if (disposed) return;
      for (const light of rimLights) light.intensity = 0.48 + (reducedMotion ? 0 : Math.max(0, Math.min(1, pulse)) * 0.08);
      if (reducedMotion) return;
      const seconds = Number.isFinite(time) ? time : 0;
      for (const animate of animated) animate(seconds, Math.max(0, Math.min(1, pulse)));
    },
    setQuality(preset) {
      if (disposed) return;
      applyArtQuality(group, preset);
      if (!preset?.shadowSize) group.traverse(object => {
        if (!object.shadow || (!object.shadow.map && !object.shadow.mapPass)) return;
        object.shadow.dispose();
        object.shadow.map = null;
        object.shadow.mapPass = null;
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const geometries = new Set(), materials = new Set(), textures = new Set();
      group.traverse(object => {
        object.shadow?.dispose?.();
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) for (const material of [object.material].flat()) {
          materials.add(material);
          for (const field of ['map', 'bumpMap', 'roughnessMap', 'normalMap', 'alphaMap', 'emissiveMap']) {
            if (material[field]) textures.add(material[field]);
          }
        }
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      shadowDepth.dispose();
      for (const map of textures) map.dispose();
      group.clear();
    },
  };
}
