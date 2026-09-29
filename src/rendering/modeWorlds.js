import * as THREE from 'three';
import { createAscentLandmark } from './architecturalAscent.js';
import { createSculpturalModeLandmark } from './sculpturalModeLandmarks.js';
import { WORLD_LIGHTING, tintSky } from './worldLighting.js';
import { createCollectionWorld } from './collectionWorlds.js';

const MODE_STYLE = {
  endless: { landmark: 'An orbital lift rising from a surface launch complex into space.', accent: '#50e3c2' },
  sprint: { landmark: 'A high-speed transit corridor with machined ribs and light rails.', accent: '#42d9ff' },
  marathon: { landmark: 'An inhabited orbital wheel above a distant world.', accent: '#b487ff' },
  timeAttack: { landmark: 'A clockwork observatory with a suspended pendulum.', accent: '#ff5a98' },
  zen: { landmark: 'A carved stone garden with a moon gate and reflecting pool.', accent: '#74f0ba' },
  challenge: { landmark: 'A mineral specimen held inside an articulated vault.', accent: '#d49cff' },
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
const BACKGROUND_STYLES = Object.freeze({ nebula: 0, cityLights: 1, orbit: 2, solar: 3, aurora: 4, prism: 5, meteors: 6, clockwork: 7 });

export function endlessAltitudeForLevel(level) {
  const number = Number(level);
  return Number.isFinite(number) && number >= 1 ? Math.floor(number) - 1 : 0;
}

export function createModeWorld(mode) {
  const id = Object.hasOwn(MODE_STYLE, mode) ? mode : 'endless';
  const style = MODE_STYLE[id];
  const lighting = WORLD_LIGHTING[id];
  const group = new THREE.Group();
  group.name = `world-${id}`;

  const background = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color(lighting.top) },
        uBottom: { value: new THREE.Color(lighting.bottom) },
        uAccent: { value: new THREE.Color(style.accent) },
        uTime: { value: 0 },
        uPulse: { value: 0 },
        uElevation: { value: 0 },
        uStyle: { value: 0 },
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
        uniform float uStyle;
        varying vec2 vUv;
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        void main() {
          float horizon = smoothstep(0.0, 1.0, vUv.y);
          vec3 color = mix(uBottom, uTop, horizon);
          float haze = exp(-abs(vUv.y - (0.24 - uElevation * 0.28)) * 15.0)
            * (1.0 - uElevation * 0.7) * (0.035 + uPulse * 0.085);
          color += uAccent * haze;
          float vignette = smoothstep(0.9, 0.08, distance(vUv, vec2(0.5, 0.48)));
          color *= 0.76 + vignette * 0.24;
          float grain = hash(floor(vUv * vec2(640.0, 360.0)) + floor(uTime * 0.5)) - 0.5;
          color += grain * 0.0012;
          color += uAccent * (0.005 + uElevation * 0.008) * smoothstep(0.0, 0.65, vUv.y);
          float pattern = 0.0;
          if (uStyle < 0.5) {
            pattern = pow(max(0.0, sin(vUv.x * 8.0 + uTime * 0.035) * sin(vUv.y * 5.0)), 3.0) * 0.025;
          } else if (uStyle < 1.5) {
            float column = floor(vUv.x * 54.0);
            float roof = 0.12 + hash(vec2(column, 3.0)) * 0.29;
            pattern = step(vUv.y, roof) * (0.02 + step(0.72, hash(floor(vUv * vec2(108.0, 65.0)))) * 0.035);
          } else if (uStyle < 2.5) {
            float orbit = length((vUv - vec2(0.6, 0.48)) * vec2(1.0, 1.7));
            pattern = exp(-abs(orbit - 0.32) * 170.0) * 0.055;
          } else if (uStyle < 3.5) {
            float flare = abs(vUv.x - 0.72) + abs(vUv.y - 0.28) * 0.3;
            pattern = exp(-flare * 15.0) * 0.07;
          } else if (uStyle < 4.5) {
            float curtain = sin(vUv.x * 25.0 + sin(vUv.y * 8.0 + uTime * 0.1));
            pattern = pow(max(0.0, curtain), 8.0) * smoothstep(0.1, 0.85, vUv.y) * 0.035;
          } else if (uStyle < 5.5) {
            pattern = step(0.97, sin(vUv.x * 12.0 + vUv.y * 9.0) * sin(vUv.x * 8.0 - vUv.y * 11.0)) * 0.035;
          } else if (uStyle < 6.5) {
            float streak = fract(vUv.x * 8.0 - vUv.y * 4.0 + uTime * 0.025);
            pattern = step(0.992, streak) * smoothstep(0.45, 0.95, vUv.y) * 0.06;
          } else {
            float clock = length((vUv - vec2(0.55, 0.47)) * vec2(1.0, 1.7));
            pattern = exp(-abs(clock - 0.28) * 145.0) * 0.04;
          }
          color += uAccent * pattern * 2.2;
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
  const trailingStars = id === 'endless' ? stars.clone() : null;
  environment.add(stars);
  if (trailingStars) environment.add(trailingStars);
  const landmark = id === 'endless'
    ? createAscentLandmark(style.accent)
    : createSculpturalModeLandmark(id);
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
  let collectionWorld = null;
  let collectionSceneId = null;
  let qualityPreset = null;

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
        altitude = 0;
      }
      lastRunId = game?.runId ?? lastRunId;

      const nextAltitude = id === 'endless' ? endlessAltitudeForLevel(game?.scoring?.level) : 0;
      altitude = reducedMotion ? nextAltitude
        : altitude + (nextAltitude - altitude) * (1 - Math.exp(-dt * 2.4));
      // Approach deep space gradually so later levels still change the sky.
      progress = id === 'endless' ? 1 - Math.exp(-altitude / 5.5) : progress;
      if (palette?.length) {
        const topColor = tintSky(lighting.top, palette[0], 0.44);
        const bottomColor = tintSky(lighting.bottom, palette[palette.length - 1], 0.38);
        const accentColor = new THREE.Color(style.accent).lerp(new THREE.Color(palette[Math.floor(palette.length / 2)]), 0.68);
        if (id === 'endless') {
          topColor.lerp(ENDLESS_TOP, progress);
          bottomColor.lerp(ENDLESS_BOTTOM, progress);
          accentColor.lerp(ENDLESS_ACCENT, progress);
        }
        background.material.uniforms.uTop.value.copy(topColor);
        background.material.uniforms.uBottom.value.copy(bottomColor);
        background.material.uniforms.uAccent.value.copy(accentColor);
      } else if (id === 'endless') {
        background.material.uniforms.uTop.value.copy(new THREE.Color(lighting.top).lerp(ENDLESS_TOP, progress));
        background.material.uniforms.uBottom.value.copy(new THREE.Color(lighting.bottom).lerp(ENDLESS_BOTTOM, progress));
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
      if (game?.state === 'GAME_OVER') {
        pulse = 0;
        ringProgress = 1;
        ringMaterial.opacity = 0;
        impactRing.visible = false;
      }
      if (reducedMotion) {
        pulse = 0;
        ringProgress = 1;
        impactRing.visible = false;
        environment.rotation.set(0, 0, 0);
        landmark.group.rotation.set(0, 0, 0);
        stars.rotation.set(0, 0, 0);
        if (trailingStars) trailingStars.rotation.set(0, 0, 0);
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

      if (trailingStars) {
        const travel = altitude * 90 + (reducedMotion ? 0 : elapsedMs * 0.012);
        stars.position.y = -(travel % 1350);
        trailingStars.position.x = stars.position.x;
        trailingStars.position.y = stars.position.y + 1350;
      }

      landmark.update?.({ time: elapsedMs / 1000, progress, altitude, pulse, reducedMotion, glowIntensity });
      if (collectionWorld) {
        collectionWorld.group.position.y = id === 'endless' ? -altitude * 90 : 0;
        collectionWorld.update({ time: elapsedMs / 1000, reducedMotion, pulse });
      }

      stars.material.opacity = (id === 'endless' ? 0.13 + progress * 0.49 : 0.48) * particleIntensity;
      stars.visible = particleIntensity > 0 && (!collectionWorld || (id === 'endless' && progress > 0.6));
      if (trailingStars) trailingStars.visible = stars.visible;
      pulseLight.intensity = reducedMotion ? 0 : pulse * glowIntensity * 1.8;
      background.material.uniforms.uTime.value = reducedMotion ? 0 : elapsedMs / 1000;
      background.material.uniforms.uPulse.value = reducedMotion ? 0 : pulse * glowIntensity;
      background.material.uniforms.uElevation.value = progress;
    },
    setPalette(colors, styleName, sceneId = null) {
      palette = Array.isArray(colors) && colors.length >= 2 ? colors : null;
      group.userData.backgroundStyle = styleName || 'nebula';
      background.material.uniforms.uStyle.value = BACKGROUND_STYLES[styleName] ?? 0;
      if (sceneId !== collectionSceneId) {
        if (collectionWorld) {
          environment.remove(collectionWorld.group);
          collectionWorld.dispose();
        }
        collectionWorld = createCollectionWorld(sceneId);
        collectionSceneId = collectionWorld ? sceneId : null;
        if (collectionWorld) {
          environment.add(collectionWorld.group);
          if (qualityPreset) collectionWorld.setQuality(qualityPreset);
        }
        landmark.group.visible = !collectionWorld;
      }
      group.userData.backgroundScene = collectionSceneId;
    },
    setAmbientParticles(colors, shape) {
      const accent = new THREE.Color(style.accent);
      const paletteColors = Array.isArray(colors) && colors.length
        ? colors.map((color) => new THREE.Color(color).lerp(accent, 0.65))
        : [accent];
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
    setQuality(preset) {
      qualityPreset = preset;
      landmark.setQuality?.(collectionWorld ? { ...preset, shadowSize: 0 } : preset);
      collectionWorld?.setQuality(preset);
    },
    setFiltering(anisotropy) {
      landmark.setFiltering?.(anisotropy);
    },
    dispose() {
      if (collectionWorld) {
        environment.remove(collectionWorld.group);
        collectionWorld.dispose();
        collectionWorld = null;
      }
      const disposedGeometries = new Set();
      const disposedMaterials = new Set();
      const disposedTextures = new Set();
      group.traverse((object) => {
        object.shadow?.dispose?.();
        if (object.geometry && !disposedGeometries.has(object.geometry)) {
          disposedGeometries.add(object.geometry);
          object.geometry.dispose();
        }
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          if (!material || disposedMaterials.has(material)) return;
          disposedMaterials.add(material);
          for (const texture of [material.map, material.alphaMap, material.bumpMap, material.roughnessMap]) {
            if (texture && !disposedTextures.has(texture)) {
              disposedTextures.add(texture);
              texture.dispose();
            }
          }
          material.dispose();
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

function clamp(value, min, max, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(min, Math.min(max, numeric)) : fallback;
}
