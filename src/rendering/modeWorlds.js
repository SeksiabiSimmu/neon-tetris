import * as THREE from 'three';

const MODE_STYLE = {
  endless: { landmark: 'A planetary ascent from a glowing surface to deep space.', top: '#071022', bottom: '#1a3948', accent: '#50e3c2' },
  sprint: { landmark: 'A high-speed transit corridor with converging light rails.', top: '#071227', bottom: '#102d4c', accent: '#42d9ff' },
  marathon: { landmark: 'A monumental orbital ring around a distant world.', top: '#0b1025', bottom: '#24203e', accent: '#b487ff' },
  timeAttack: { landmark: 'A charged reactor chamber with pulsing concentric rings.', top: '#130d20', bottom: '#32142d', accent: '#ff5a98' },
  zen: { landmark: 'A calm bioluminescent garden beneath a soft aurora.', top: '#071a25', bottom: '#10382f', accent: '#74f0ba' },
  challenge: { landmark: 'A geometric arena framed by shifting crystal forms.', top: '#101022', bottom: '#27224a', accent: '#d49cff' },
};

const EVENT_PULSE = {
  move: 0.08,
  rotate: 0.11,
  softDrop: 0.07,
  hardDrop: 0.52,
  hold: 0.16,
  lock: 0.18,
  clear: 0.72,
  tSpin: 0.86,
  combo: 0.48,
  backToBack: 0.62,
  perfectClear: 1.15,
  levelUp: 1.0,
};

const ENDLESS_TOP = new THREE.Color('#030612');
const ENDLESS_BOTTOM = new THREE.Color('#081329');
const ENDLESS_ACCENT = new THREE.Color('#8acfff');

export function endlessAltitudeForLevel(level) {
  const number = Number(level);
  return Number.isFinite(number) && number >= 1 ? Math.floor(number) - 1 : 0;
}

export function createModeWorld(mode) {
  const id = Object.hasOwn(MODE_STYLE, mode) ? mode : 'endless';
  const style = MODE_STYLE[id];
  const group = new THREE.Group();
  group.name = `world-${id}`;

  const background = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color(style.top) },
        uBottom: { value: new THREE.Color(style.bottom) },
        uAccent: { value: new THREE.Color(style.accent) },
        uTime: { value: 0 },
        uPulse: { value: 0 },
        uElevation: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uBottom;
        uniform vec3 uAccent;
        uniform float uTime;
        uniform float uPulse;
        uniform float uElevation;
        varying vec2 vUv;
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        void main() {
          float horizon = smoothstep(0.0, 1.0, vUv.y);
          vec3 color = mix(uBottom, uTop, horizon);
          float haze = exp(-abs(vUv.y - 0.24) * 15.0) * (0.035 + uPulse * 0.085);
          color += uAccent * haze;
          float vignette = smoothstep(0.9, 0.08, distance(vUv, vec2(0.5, 0.48)));
          color *= 0.76 + vignette * 0.24;
          float grain = hash(floor(vUv * vec2(640.0, 360.0)) + floor(uTime * 3.0)) - 0.5;
          color += grain * 0.008;
          color += uAccent * (0.018 + uElevation * 0.035) * smoothstep(0.0, 0.65, vUv.y);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      depthWrite: false,
      depthTest: false,
    }),
  );
  background.position.z = -280;
  background.renderOrder = -1000;
  group.add(background);

  const environment = new THREE.Group();
  environment.name = `environment-${id}`;
  group.add(environment);
  const seed = id.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const stars = makeStarfield(seed, style.accent);
  environment.add(stars);
  const landmark = makeLandmark(id, style.accent);
  environment.add(landmark.group);

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: style.accent,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  let clearShape = 'spark';
  const impactRing = new THREE.Mesh(createClearRingGeometry(clearShape), ringMaterial);
  impactRing.name = 'clear-impact-ring';
  impactRing.position.set(0, 0, -100);
  impactRing.visible = false;
  environment.add(impactRing);

  const pulseLight = new THREE.PointLight(style.accent, 0, 900, 2);
  pulseLight.position.set(0, 40, -120);
  environment.add(pulseLight);

  let pulse = 0;
  let ringProgress = 1;
  let elapsedMs = 0;
  let altitude = 0;
  let palette = null;
  let progress = 0;
  let lastRunId = null;
  let particleTexture = null;

  const world = {
    descriptor: { id, landmark: style.landmark },
    group,
    update({ dtMs = 16.7, elapsedMs: runElapsedMs = 0, game = null, events = [], settings = {} } = {}) {
      const dt = Math.min(50, Math.max(0, dtMs)) / 1000;
      elapsedMs += dt * 1000;
      const reducedMotion = !!settings.reducedMotion;
      const particleIntensity = clamp(settings.particleIntensity, 0, 1, 1);
      const glowIntensity = clamp(settings.glowIntensity, 0, 1.5, 1);

      if (lastRunId !== null && game?.runId !== lastRunId) {
        pulse = 0;
        ringProgress = 1;
        ringMaterial.opacity = 0;
      }
      lastRunId = game?.runId ?? lastRunId;

      const nextAltitude = id === 'endless' ? endlessAltitudeForLevel(game?.scoring?.level) : 0;
      if (nextAltitude !== altitude) altitude = nextAltitude;
      progress = id === 'endless' ? 1 - Math.exp(-altitude / 8) : progress;
      if (palette?.length) {
        const topColor = new THREE.Color(style.top).lerp(new THREE.Color(palette[0]), 0.2);
        const bottomColor = new THREE.Color(style.bottom).lerp(new THREE.Color(palette[palette.length - 1]), 0.16);
        const accentColor = new THREE.Color(style.accent).lerp(new THREE.Color(palette[Math.floor(palette.length / 2)]), 0.44);
        if (id === 'endless') {
          topColor.lerp(ENDLESS_TOP, progress);
          bottomColor.lerp(ENDLESS_BOTTOM, progress);
          accentColor.lerp(ENDLESS_ACCENT, progress);
        }
        background.material.uniforms.uTop.value.copy(topColor);
        background.material.uniforms.uBottom.value.copy(bottomColor);
        background.material.uniforms.uAccent.value.copy(accentColor);
      } else if (id === 'endless') {
        background.material.uniforms.uTop.value.copy(new THREE.Color(style.top).lerp(ENDLESS_TOP, progress));
        background.material.uniforms.uBottom.value.copy(new THREE.Color(style.bottom).lerp(ENDLESS_BOTTOM, progress));
        background.material.uniforms.uAccent.value.copy(new THREE.Color(style.accent).lerp(ENDLESS_ACCENT, progress));
      }

      events.forEach((event) => {
        const force = EVENT_PULSE[event.type] || 0;
        if (!force || reducedMotion) return;
        pulse = Math.min(1.8, pulse + force);
        if (event.type === 'clear' || event.type === 'hardDrop' || event.type === 'tSpin' || event.type === 'perfectClear' || event.type === 'levelUp') {
          ringProgress = 0;
          impactRing.visible = true;
        }
      });
      if (reducedMotion) {
        pulse = 0;
        ringProgress = 1;
        impactRing.visible = false;
        environment.rotation.set(0, 0, 0);
        landmark.group.rotation.set(0, 0, 0);
        stars.rotation.set(0, 0, 0);
      } else {
        const decay = Math.exp(-dt * 2.3);
        pulse *= decay;
        ringProgress = Math.min(1, ringProgress + dt * (1.1 + glowIntensity * 0.18));
        impactRing.scale.setScalar(0.7 + ringProgress * (1.2 + pulse * 0.8));
        ringMaterial.opacity = (1 - ringProgress) * Math.min(0.42, pulse * 0.34) * glowIntensity;
        impactRing.visible = ringMaterial.opacity > 0.006;
        environment.rotation.z = Math.sin((elapsedMs + runElapsedMs) * 0.00008) * 0.008;
        stars.position.x = Math.sin(elapsedMs * 0.00004) * 7;
      }

      landmark.update?.({ time: elapsedMs / 1000, progress, altitude, pulse, reducedMotion });

      stars.material.opacity = 0.86 * particleIntensity;
      stars.visible = particleIntensity > 0;
      pulseLight.intensity = reducedMotion ? 0 : pulse * glowIntensity * 1.8;
      background.material.uniforms.uTime.value = reducedMotion ? 0 : elapsedMs / 1000;
      background.material.uniforms.uPulse.value = reducedMotion ? 0 : pulse * glowIntensity;
      background.material.uniforms.uElevation.value = progress;
    },
    setPalette(colors, styleName) {
      palette = Array.isArray(colors) && colors.length >= 2 ? colors : null;
      group.userData.backgroundStyle = styleName || 'nebula';
    },
    setAmbientParticles(colors, shape) {
      const paletteColors = Array.isArray(colors) && colors.length ? colors.map((color) => new THREE.Color(color)) : [new THREE.Color(style.accent)];
      const colorAttribute = stars.geometry.getAttribute('color');
      for (let index = 0; index < colorAttribute.count; index += 1) {
        colorAttribute.setXYZ(index, ...paletteColors[index % paletteColors.length].toArray());
      }
      colorAttribute.needsUpdate = true;
      if (particleTexture) particleTexture.dispose();
      particleTexture = createParticleTexture(shape);
      stars.material.map = particleTexture;
      stars.material.needsUpdate = true;
      stars.material.size = shape === 'ring' ? 3.4 : shape === 'hex' ? 2.8 : 2.2;
      group.userData.particleShape = shape || 'spark';
    },
    setClearEffect(effect = {}) {
      const nextShape = ['spark', 'fragment', 'ring', 'hex', 'triangle'].includes(effect.particleShape)
        ? effect.particleShape
        : 'spark';
      ringMaterial.color.set(effect.accentColor || effect.flashColor || style.accent);
      if (nextShape !== clearShape) {
        const previousGeometry = impactRing.geometry;
        impactRing.geometry = createClearRingGeometry(nextShape);
        previousGeometry.dispose();
        clearShape = nextShape;
      }
      group.userData.clearEffect = clearShape;
    },
    dispose() {
      group.traverse((object) => {
        object.geometry?.dispose?.();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          material?.map?.dispose?.();
          material?.alphaMap?.dispose?.();
          material?.dispose?.();
        });
      });
      group.clear();
    },
  };

  return world;
}

function createClearRingGeometry(shape) {
  const segments = 144;
  const innerRadius = 90;
  const outerRadius = 94;
  const positions = [];
  const indices = [];

  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const outerScale = clearShapeRadius(shape, angle);
    positions.push(
      Math.cos(angle) * Math.max(1, innerRadius * outerScale - 4),
      Math.sin(angle) * Math.max(1, innerRadius * outerScale - 4),
      0,
      Math.cos(angle) * outerRadius * outerScale,
      Math.sin(angle) * outerRadius * outerScale,
      0,
    );
    if (index < segments) {
      const inner = index * 2;
      indices.push(inner, inner + 1, inner + 2, inner + 1, inner + 3, inner + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function clearShapeRadius(shape, angle) {
  if (shape === 'ring') return 1;
  if (shape === 'triangle' || shape === 'hex') {
    const sides = shape === 'triangle' ? 3 : 6;
    const sector = (Math.PI * 2) / sides;
    const localAngle = (((angle % sector) + sector) % sector) - sector / 2;
    return Math.cos(sector / 2) / Math.cos(localAngle);
  }
  const contour = shape === 'fragment'
    ? [1, 0.72, 0.93, 0.66, 0.84, 0.7, 0.97, 0.62, 0.89, 0.73, 0.95, 0.68]
    : [1, 0.52, 1, 0.52, 1, 0.52, 1, 0.52, 1, 0.52, 1, 0.52, 1, 0.52, 1, 0.52];
  const sector = (Math.PI * 2) / contour.length;
  const wrapped = ((angle / sector) % contour.length + contour.length) % contour.length;
  const lowerIndex = Math.floor(wrapped);
  const amount = wrapped - lowerIndex;
  return contour[lowerIndex] * (1 - amount) + contour[(lowerIndex + 1) % contour.length] * amount;
}

function makeStarfield(seed, accent) {
  let state = seed || 1;
  const random = () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
  const positions = [];
  const colors = [];
  const colorA = new THREE.Color('#d8eaff');
  const colorB = new THREE.Color(accent);
  for (let index = 0; index < 680; index += 1) {
    positions.push((random() - 0.5) * 2200, (random() - 0.5) * 1350, -210 + random() * 90);
    const color = colorA.clone().lerp(colorB, random() * 0.72);
    colors.push(color.r, color.g, color.b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({
    size: 2.2,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
  }));
}

function createParticleTexture(shape = 'spark') {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.translate(24, 24);
  context.fillStyle = '#ffffff';
  context.strokeStyle = '#ffffff';
  context.lineWidth = 5;
  if (shape === 'ring') {
    context.beginPath();
    context.arc(0, 0, 16, 0, Math.PI * 2);
    context.stroke();
  } else {
    const points = shape === 'triangle' ? 3 : shape === 'hex' ? 6 : shape === 'spark' ? 8 : 5;
    const innerRatio = shape === 'spark' ? 0.32 : shape === 'fragment' ? 0.65 : 1;
    context.beginPath();
    for (let index = 0; index < points * (innerRatio < 1 ? 2 : 1); index += 1) {
      const radius = innerRatio < 1 && index % 2 ? 8 : 18;
      const angle = (index * Math.PI * 2) / (points * (innerRatio < 1 ? 2 : 1)) - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeLandmark(id, accent) {
  const group = new THREE.Group();
  const accentColor = new THREE.Color(accent);
  const wire = (opacity = 0.25) => new THREE.MeshBasicMaterial({
    color: accentColor,
    wireframe: true,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const solid = (color = accent, opacity = 0.2) => new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: false,
  });
  const ring = (radius, thickness, x, y, z, material = wire(0.26)) => {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 8, 96), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  const mesh = (geometry, material, x, y, z, scale = 1) => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.scale.setScalar(scale);
    group.add(object);
    return object;
  };
  const animated = [];
  let horizon = null;
  let moon = null;
  let planet = null;
  let core = null;
  let reactorRings = [];

  if (id === 'endless') {
    const groundMat = solid('#10252f', 0.96);
    horizon = mesh(new THREE.BoxGeometry(2400, 150, 4), groundMat, 0, -295, -170);
    for (let i = 0; i < 13; i += 1) {
      const x = -1000 + i * 166;
      const height = 25 + ((i * 47) % 105);
      const spire = mesh(new THREE.ConeGeometry(25 + (i % 4) * 9, height, 5), solid(i % 2 ? '#16303b' : '#1d3943', 0.93), x, -218 + height * 0.38, -168 + (i % 3) * 2);
      animated.push({ object: spire, phase: i * 0.8, range: 0.012 });
    }
    moon = mesh(new THREE.SphereGeometry(148, 32, 24), solid('#304e70', 0.55), 510, 245, -175);
    ring(212, 4, 510, 245, -174, wire(0.28)).rotation.x = 1.22;
    planet = moon;
  } else if (id === 'sprint') {
    for (let side = -1; side <= 1; side += 2) {
      for (let lane = 0; lane < 4; lane += 1) {
        const rail = mesh(new THREE.BoxGeometry(8, 2200, 2), solid(accent, 0.3), side * (330 + lane * 78), 0, -170 - lane * 5);
        rail.rotation.z = side * 0.42;
        animated.push({ object: rail, phase: lane * 0.7, range: 0.015 });
      }
    }
    for (let i = 0; i < 7; i += 1) ring(460 + i * 105, 1.4, 0, 0, -155 - i * 11, wire(0.19 - i * 0.012));
  } else if (id === 'marathon') {
    planet = mesh(new THREE.SphereGeometry(260, 40, 30), solid('#394a79', 0.68), 610, 290, -184);
    ring(650, 6, 0, 50, -172, wire(0.34)).rotation.set(0.26, 0.1, 0.04);
    ring(760, 2, 0, 50, -178, wire(0.18)).rotation.set(0.26, 0.1, 0.04);
    for (let i = 0; i < 8; i += 1) {
      const station = mesh(new THREE.OctahedronGeometry(32, 1), solid(accent, 0.42), Math.cos(i * Math.PI / 4) * 640, 50 + Math.sin(i * Math.PI / 4) * 360, -160);
      animated.push({ object: station, phase: i, range: 0.18 });
    }
  } else if (id === 'timeAttack') {
    core = mesh(new THREE.IcosahedronGeometry(150, 2), solid('#a32860', 0.62), -500, 40, -174);
    reactorRings = [ring(230, 6, -500, 40, -165), ring(330, 4, -500, 40, -176), ring(440, 2, -500, 40, -188)];
    reactorRings[1].rotation.x = 0.3;
    reactorRings[2].rotation.y = 0.4;
    for (let i = 0; i < 12; i += 1) {
      const spoke = mesh(new THREE.BoxGeometry(8, 820, 3), solid(accent, 0.36), -500, 40, -160);
      spoke.rotation.z = (Math.PI * 2 * i) / 12;
      animated.push({ object: spoke, phase: i * 0.4, range: 0.02 });
    }
  } else if (id === 'zen') {
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 6; i += 1) {
        const x = side * (460 + (i % 3) * 140);
        const y = -260 + Math.floor(i / 3) * 170;
        const stem = mesh(new THREE.CylinderGeometry(2, 6, 150 + (i % 2) * 60, 8), solid('#318b72', 0.56), x, y, -174);
        const bloom = mesh(new THREE.SphereGeometry(24 + (i % 3) * 7, 16, 12), solid(accent, 0.7), x + side * 14, y + 85, -167);
        ring(38 + i * 2, 2, x + side * 14, y + 85, -166, wire(0.38));
        animated.push({ object: stem, phase: i, range: 0.06 });
        animated.push({ object: bloom, phase: i * 0.8, range: 0.12 });
      }
    }
  } else {
    for (let i = 0; i < 14; i += 1) {
      const side = i % 2 ? 1 : -1;
      const x = side * (355 + ((i * 67) % 440));
      const y = -300 + ((i * 89) % 650);
      const crystal = mesh(new THREE.OctahedronGeometry(55 + (i % 4) * 16, 0), wire(0.34), x, y, -178 - (i % 3) * 4);
      animated.push({ object: crystal, phase: i * 0.56, range: 0.14 });
    }
    ring(480, 1.8, 0, 0, -185, wire(0.15));
  }

  return {
    group,
    update({ time = 0, progress = 0, reducedMotion = false }) {
      animated.forEach(({ object, phase, range }) => {
        if (reducedMotion) return;
        object.rotation.x = Math.sin(time * 0.36 + phase) * range;
        object.rotation.y = Math.cos(time * 0.24 + phase) * range;
      });
      if (id === 'endless') {
        const ascent = Math.min(1, progress * 1.12);
        if (horizon) horizon.position.y = -255 - ascent * 260;
        if (planet) {
          planet.position.y = 245 - ascent * 420;
          planet.scale.setScalar(1 - ascent * 0.18);
          planet.material.opacity = 0.55 - ascent * 0.18;
        }
      }
      if (core && !reducedMotion) {
        core.rotation.x = time * 0.11;
        core.rotation.y = time * 0.17;
        reactorRings.forEach((reactorRing, index) => {
          reactorRing.rotation.z = (index % 2 ? -1 : 1) * time * (0.035 + index * 0.018);
        });
      }
    },
  };
}

function clamp(value, min, max, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(min, Math.min(max, numeric)) : fallback;
}
