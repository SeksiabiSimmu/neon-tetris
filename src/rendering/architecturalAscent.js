import * as THREE from 'three';
import { arcProfile, chamferedBox, instances, strut, surfaceMaps, mapSurface, applyArtQuality } from './environmentArt.js';
import { createWorldLights } from './worldLighting.js';

function addMesh(parent, geometry, material, x, y, z, { shadow = false, receive = false } = {}) {
  if (geometry.type === 'BoxGeometry') mapSurface(geometry);
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.castShadow = shadow;
  object.receiveShadow = receive;
  parent.add(object);
  return object;
}

/** A single composed, genuinely three-dimensional world for Endless. */
export function createAscentLandmark(accent = '#50e3c2') {
  const group = new THREE.Group();
  group.name = 'orbital-ascent-observatory';
  const concreteSurface = surfaceMaps('stone');
  const metalSurface = surfaceMaps('panel');
  const concreteMap = concreteSurface.map;
  const metalMap = metalSurface.map;
  const concreteDetail = concreteSurface.detail;
  const metalDetail = metalSurface.detail;
  const textures = [concreteMap, metalMap, concreteDetail, metalDetail];
  const concrete = new THREE.MeshStandardMaterial({
    color: '#647278', map: concreteMap, roughness: 0.88, roughnessMap: concreteDetail,
    bumpMap: concreteDetail, bumpScale: 0.4, metalness: 0.08,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: '#75868c', map: metalMap, roughness: 0.38, roughnessMap: metalDetail,
    bumpMap: metalDetail, bumpScale: 0.2, metalness: 0.75, envMapIntensity: 0.55,
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: '#1c3039', roughness: 0.42, metalness: 0.7, envMapIntensity: 0.48,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#719dac', roughness: 0.2, metalness: 0.16, clearcoat: 0.8,
    transparent: true, opacity: 0.28, depthWrite: false, envMapIntensity: 0.6,
  });
  const lightStrip = new THREE.MeshStandardMaterial({
    color: '#173338', emissive: accent, emissiveIntensity: 0.72, roughness: 0.3, metalness: 0.36,
  });
  const portal = new THREE.Group();
  group.add(portal);
  const overhead = new THREE.Group();
  overhead.name = 'lift-overhead';
  portal.add(overhead);
  const lights = createWorldLights('endless');
  group.add(lights.group);

  // Surface horizon stays recognizable at level one, then passes below view.
  addMesh(portal, new THREE.BoxGeometry(2400, 150, 150), concrete, 0, -315, -270, { receive: true });
  addMesh(portal, new THREE.BoxGeometry(1560, 30, 650), concrete, 0, -245, -165,
    { receive: true });
  addMesh(portal, new THREE.BoxGeometry(1380, 14, 12), metal, 0, -224, 120, { receive: true });

  // Receding frames use their z separation, perspective scale, and shadows to
  // describe the lift shaft without sending bright geometry behind the board.
  for (let depth = 0; depth < 4; depth += 1) {
    const z = 135 - depth * 245;
    const spread = 530 + depth * 38;
    const width = depth === 0 ? 76 : 60;
    const height = 880 + depth * 38;
    for (const side of [-1, 1]) {
      addMesh(portal, new THREE.BoxGeometry(width, height, 112), depth === 0 ? metal : concrete,
        side * spread, 55, z, { shadow: depth < 2, receive: true });
      addMesh(portal, new THREE.BoxGeometry(14, height - 30, 6), darkMetal,
        side * (spread - width / 2 + 12), 55, z + 61);
      addMesh(portal, new THREE.BoxGeometry(4, height - 65, 8), lightStrip,
        side * (spread - width / 2 + 13), 55, z + 66);
      addMesh(portal, new THREE.BoxGeometry(125, 260, 8), glass,
        side * (spread + 52), 90, z - 40);
    }
    addMesh(overhead, new THREE.BoxGeometry(spread * 2 + 90, 54, 116), metal,
      0, 485 + depth * 19, z, { shadow: depth < 2 });
    addMesh(overhead, new THREE.BoxGeometry(spread * 2 - 125, 6, 10), lightStrip,
      0, 451 + depth * 19, z + 63);
  }

  // Pylon collars and articulated lift rails give the shaft an engineered
  // silhouette at the actual gameplay distance. Repeated pieces are instanced.
  const collar = chamferedBox(100, 22, 126, 10);
  instances(portal, collar, metal, Array.from({ length: 14 }, (_, i) => {
    const depth = Math.floor(i / 2) % 4;
    const side = i % 2 ? 1 : -1;
    return { position: [side * (530 + depth * 38), -255 + Math.floor(i / 8) * 340, 135 - depth * 245] };
  }), { secondary: true });
  for (const side of [-1, 1]) {
    strut(portal, [side * 525, -285, 195], [side * 650, 290, -220], 18, darkMetal);
    addMesh(portal, chamferedBox(65, 175, 95, 8), metal,
      side * 524, -65, 205, { shadow: true, receive: true });
    addMesh(portal, chamferedBox(32, 76, 100, 5), darkMetal,
      side * 524, -65, 260);
    addMesh(portal, chamferedBox(5, 65, 8, 1), lightStrip,
      side * 524, -65, 316);
  }
  const floorMarker = addMesh(portal, arcProfile(120, 128, 8), metal, 300, -228, -125);
  floorMarker.rotation.x = -Math.PI / 2;
  instances(portal, chamferedBox(11, 3, 18, 1), lightStrip,
    Array.from({ length: 22 }, (_, i) => ({ position: [(-10.5 + i) * 54, -226, 89] })),
    { cast: false, secondary: true });

  // A lit, sculptural counterweight sits beyond the right-hand frame. Its
  // curved shell and rings remain a focal point even when animation is off.
  const counterweight = new THREE.Group();
  counterweight.position.set(690, 180, -370);
  portal.add(counterweight);
  const shell = addMesh(counterweight, new THREE.IcosahedronGeometry(125, 2), darkMetal, 0, 0, 0,
    { shadow: true, receive: true });
  addMesh(counterweight, new THREE.SphereGeometry(134, 32, 24), glass, 0, 0, 0);
  const ringGeometry = new THREE.TorusGeometry(165, 6, 10, 96);
  const outerRing = addMesh(counterweight, ringGeometry, metal, 0, 0, 0);
  outerRing.rotation.set(0.82, 0.23, 0.17);
  const orbitRing = addMesh(counterweight, new THREE.TorusGeometry(207, 2.5, 8, 96), lightStrip, 0, 0, -8);
  orbitRing.rotation.set(0.41, -0.22, -0.18);

  // The destination is held in the distant layer while the surface shaft
  // descends. Its lights and mass appear progressively as the sky darkens.
  const orbital = new THREE.Group();
  orbital.name = 'orbital-destination';
  orbital.position.set(535, 80, -790);
  group.add(orbital);
  const orbitalMetal = new THREE.MeshStandardMaterial({ color: '#4b626c', roughness: 0.42,
    metalness: 0.74, envMapIntensity: 0.55, transparent: true, opacity: 0 });
  const orbitalLight = new THREE.MeshBasicMaterial({ color: '#7ab8bd', transparent: true,
    opacity: 0, depthWrite: false });
  addMesh(orbital, arcProfile(139, 177, 38), orbitalMetal, 0, 0, 0, { shadow: true });
  addMesh(orbital, arcProfile(142, 148, 42), orbitalLight, 0, 0, 0);
  instances(orbital, chamferedBox(15, 114, 27, 3), orbitalMetal,
    Array.from({ length: 8 }, (_, i) => {
      const a = i * Math.PI / 4;
      return { position: [Math.sin(a) * 86, Math.cos(a) * 86, 3], rotation: [0, 0, -a] };
    }));
  addMesh(orbital, new THREE.CylinderGeometry(35, 40, 73, 24), orbitalMetal,
    0, 0, 10).rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) {
    strut(orbital, [side * 30, 0, -22], [side * 255, 0, -22], 8, orbitalMetal);
    instances(orbital, chamferedBox(66, 52, 5, 2), orbitalMetal,
      Array.from({ length: 6 }, (_, i) => ({ position: [side * (212 + i % 2 * 70),
        Math.floor(i / 2) * 61 - 61, -22] })));
  }
  const cloud = new THREE.Group();
  group.add(cloud);
  const cloudMaterial = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color('#687d86') } },
    vertexShader: `varying vec2 vUv;
      void main() { vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uOpacity; uniform vec3 uColor; varying vec2 vUv;
      void main() {
        float edge=smoothstep(0.0,0.32,vUv.x)*smoothstep(0.0,0.32,1.0-vUv.x)
          *smoothstep(0.0,0.45,vUv.y)*smoothstep(0.0,0.45,1.0-vUv.y);
        float wisp=0.6+0.2*sin(vUv.x*25.0+vUv.y*17.0)+0.2*sin(vUv.x*47.0-vUv.y*23.0);
        gl_FragColor=vec4(uColor,uOpacity*edge*wisp);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  for (let i = 0; i < 5; i += 1) {
    const bank = new THREE.Mesh(new THREE.PlaneGeometry(620, 135), cloudMaterial);
    bank.position.set((i % 2 ? 1 : -1) * (360 + i * 30), -135 + i * 95, -790 - i * 115);
    bank.rotation.y = (i % 2 ? -1 : 1) * 0.15;
    cloud.add(bank);
  }

  return {
    group,
    update({ time = 0, altitude = 0, progress = 0, pulse = 0, reducedMotion = false, glowIntensity = 1 } = {}) {
      portal.position.y = -altitude * 210;
      overhead.visible = altitude < 0.7;
      counterweight.rotation.y = reducedMotion ? 0 : Math.sin(time * 0.1) * 0.08;
      outerRing.rotation.z = 0.17 + (reducedMotion ? 0 : Math.sin(time * 0.2) * 0.04);
      orbitRing.rotation.z = -0.18 - (reducedMotion ? 0 : time * 0.025);
      lightStrip.emissiveIntensity = (0.55 + Math.min(0.25, pulse * 0.16)) * glowIntensity;
      orbitalMetal.opacity = Math.min(0.9, Math.max(0, (progress - 0.18) * 3.2));
      orbitalLight.opacity = orbitalMetal.opacity * 0.52 * glowIntensity;
      orbital.visible = orbitalMetal.opacity > 0.01;
      orbital.position.y = 80 - Math.max(0, altitude - 8) * 68;
      orbital.position.z = -790 - Math.max(0, altitude - 8) * 48;
      cloudMaterial.uniforms.uOpacity.value = progress > 0
        ? Math.sin(Math.min(1, progress * 2) * Math.PI) * 0.11 : 0;
      cloud.position.y = -(altitude * 63);
      lights.rim.intensity = 0.75 + Math.min(0.25, pulse * 0.14) * glowIntensity;
      shell.rotation.y = reducedMotion ? 0 : time * 0.035;
    },
    setQuality(preset) {
      applyArtQuality(group, preset);
    },
    setFiltering(anisotropy) {
      textures.forEach((texture) => {
        if (texture.anisotropy !== anisotropy) {
          texture.anisotropy = anisotropy;
          texture.needsUpdate = true;
        }
      });
    },
  };
}
