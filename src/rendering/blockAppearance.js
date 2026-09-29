import * as THREE from 'three';

export const PIECE_TYPES = Object.freeze(['I', 'O', 'T', 'S', 'Z', 'J', 'L']);

export function roundedBlockGeometry() {
  const shape = new THREE.Shape();
  const inset = 0.045, radius = 0.065;
  shape.moveTo(-0.5 + inset + radius, -0.5 + inset);
  shape.lineTo(0.5 - inset - radius, -0.5 + inset);
  shape.quadraticCurveTo(0.5 - inset, -0.5 + inset, 0.5 - inset, -0.5 + inset + radius);
  shape.lineTo(0.5 - inset, 0.5 - inset - radius);
  shape.quadraticCurveTo(0.5 - inset, 0.5 - inset, 0.5 - inset - radius, 0.5 - inset);
  shape.lineTo(-0.5 + inset + radius, 0.5 - inset);
  shape.quadraticCurveTo(-0.5 + inset, 0.5 - inset, -0.5 + inset, 0.5 - inset - radius);
  shape.lineTo(-0.5 + inset, -0.5 + inset + radius);
  shape.quadraticCurveTo(-0.5 + inset, -0.5 + inset, -0.5 + inset + radius, -0.5 + inset);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.17, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.025,
    bevelThickness: 0.03, curveSegments: 2,
  });
  geometry.center();
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  for (let index = 0; index < uv.count; index += 1) {
    if (Math.abs(normals.getZ(index)) > 0.999) {
      uv.setXY(index, positions.getX(index) + 0.5, positions.getY(index) + 0.5);
    } else {
      // Bevels and sides keep a quiet, consistent finish; face markings do not stretch over them.
      uv.setXY(index, 0.5, 0.5);
    }
  }
  uv.needsUpdate = true;
  return geometry;
}

const COLLECTION_FAMILIES = [
  'deep-sea-relics', 'meteorite', 'aurora-crystal', 'building-bricks', 'jelly-cubes',
  'arcade-carpet', 'tiny-aquariums', 'toy-blocks', 'circuit-boards', 'space-freight',
  'mechanical-keys', 'retro-displays', 'black-ice', 'dungeon-treasure', 'cosmic-windows',
];
const FAMILIES = [
  'ceramic', 'ion-glass', 'carbon-lattice', 'aurora-alloy', 'prism-shell', 'void-chrome',
  'stained-glass', 'reactor-cells', 'porcelain-dynasty', 'pocket-gardens', 'comic-ink',
  ...COLLECTION_FAMILIES,
];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const distanceToSegment = (x, y, x1, y1, x2, y2) => {
  const dx = x2 - x1, dy = y2 - y1;
  const t = clamp(((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(x - x1 - t * dx, y - y1 - t * dy);
};

// These are painted details, rather than transparent faces: the piece color
// remains the dominant tint and every block keeps a solid occupancy silhouette.
function premiumFaceSample(family, u, v) {
  const edge = Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5));
  if (family === 'stained-glass') {
    const lead = edge > 0.435 || Math.abs(u - 0.5) < 0.018 || Math.abs(v - 0.5) < 0.018;
    if (lead) return { color: [0.17, 0.19, 0.21], roughness: 0.82 };
    const pane = (u < 0.5 ? 0 : 1) + (v < 0.5 ? 0 : 2);
    const facet = (u + v) % 0.5 < 0.24 ? 0.07 : 0;
    const fineBubble = Math.hypot(u - 0.31, v - 0.72) < 0.015 || Math.hypot(u - 0.72, v - 0.3) < 0.012;
    const light = [0.84, 0.73, 0.91, 0.79][pane] + facet - (fineBubble ? 0.09 : 0);
    return { color: [light, light * 0.98, light], roughness: fineBubble ? 0.32 : 0.17 + facet };
  }
  if (family === 'reactor-cells') {
    const radius = Math.hypot(u - 0.5, v - 0.5);
    const cornerBolt = [[0.19, 0.19], [0.81, 0.19], [0.19, 0.81], [0.81, 0.81]]
      .some(([x, y]) => Math.hypot(u - x, v - y) < 0.026);
    if (cornerBolt) return { color: [0.76, 0.79, 0.82], roughness: 0.35 };
    if (radius < 0.105) return { color: [0.99, 0.99, 0.94], roughness: 0.13 };
    if (radius < 0.165) return { color: [0.23, 0.27, 0.3], roughness: 0.6 };
    if (radius < 0.255) return { color: [0.8, 0.84, 0.86], roughness: 0.29 };
    const seam = edge > 0.415 || (edge > 0.315 && edge < 0.333);
    return seam
      ? { color: [0.2, 0.23, 0.26], roughness: 0.74 }
      : { color: [0.55, 0.59, 0.62], roughness: 0.46 };
  }
  if (family === 'porcelain-dynasty') {
    const repair = Math.min(
      distanceToSegment(u, v, 0.17, 0.81, 0.41, 0.62),
      distanceToSegment(u, v, 0.41, 0.62, 0.57, 0.72),
      distanceToSegment(u, v, 0.57, 0.72, 0.78, 0.57),
    ) < 0.009;
    if (repair) return { color: [1, 0.77, 0.35], roughness: 0.27 };
    if (edge > 0.43) return { color: [0.56, 0.66, 0.78], roughness: 0.33 };
    if (edge > 0.315) return { color: [0.75, 0.8, 0.82], roughness: 0.23 };
    if (edge > 0.29 && edge < 0.315) return { color: [0.42, 0.58, 0.75], roughness: 0.28 };
    const du = u - 0.5, dv = v - 0.5;
    const verticalPetal = Math.abs(du) < 0.075 && Math.abs(Math.abs(dv) - 0.14) < 0.105
      && (du / 0.075) ** 2 + ((Math.abs(dv) - 0.14) / 0.105) ** 2 < 1;
    const horizontalPetal = Math.abs(dv) < 0.075 && Math.abs(Math.abs(du) - 0.14) < 0.105
      && (dv / 0.075) ** 2 + ((Math.abs(du) - 0.14) / 0.105) ** 2 < 1;
    if (verticalPetal || horizontalPetal) return { color: [0.31, 0.49, 0.72], roughness: 0.25 };
    if (Math.hypot(du, dv) < 0.045) return { color: [0.96, 0.75, 0.37], roughness: 0.24 };
    return { color: [0.97, 0.96, 0.93], roughness: 0.12 };
  }
  if (family === 'pocket-gardens') {
    if (edge > 0.41) return { color: [0.33, 0.37, 0.32], roughness: 0.67 };
    if (edge > 0.36) return { color: [0.82, 0.86, 0.8], roughness: 0.43 };
    const stone = Math.hypot((u - 0.72) * 1.12, (v - 0.68) * 1.35) < 0.145;
    if (stone) return { color: [0.94, 0.93, 0.83], roughness: 0.72 };
    const leaf = [[0.35, 0.42], [0.37, 0.56], [0.55, 0.39], [0.58, 0.54]]
      .some(([x, y]) => ((u - x) / 0.105) ** 2 + ((v - y) / 0.07) ** 2 < 1);
    const stem = distanceToSegment(u, v, 0.46, 0.26, 0.46, 0.73) < 0.018;
    if (leaf || stem) return { color: [0.29, 0.54, 0.3], roughness: 0.89 };
    const flower = Math.hypot(u - 0.66, v - 0.28) < 0.04;
    if (flower) return { color: [0.99, 0.83, 0.62], roughness: 0.58 };
    return { color: [0.75, 0.76, 0.62], roughness: 0.94 };
  }
  if (family === 'comic-ink') {
    if (edge > 0.405) return { color: [0.09, 0.1, 0.13], roughness: 0.85 };
    if (edge > 0.365) return { color: [0.97, 0.97, 0.92], roughness: 0.68 };
    const highlight = u < 0.45 && v > 0.6 && v < 0.91 - 0.45 * u;
    if (highlight) return { color: [1, 0.99, 0.94], roughness: 0.55 };
    const dot = u > 0.48 && v < 0.56 && Math.hypot((u * 9) % 1 - 0.5, (v * 9) % 1 - 0.5) < 0.31;
    if (dot) return { color: [0.23, 0.25, 0.28], roughness: 0.83 };
    return { color: [0.88, 0.88, 0.84], roughness: 0.64 };
  }
  return null;
}

// Stage 2 patterns favor a few strong shapes over high-frequency texture. The
// optional phase and event pulses only move details inside the opaque face.
function collectionFaceSample(family, u, v, phase = 0, keyPulse = 0, tracePulse = 0) {
  const edge = Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5));
  const radius = Math.hypot(u - 0.5, v - 0.5);
  switch (family) {
    case 'deep-sea-relics': {
      if (edge > 0.42) return { color: [0.38, 0.56, 0.58], roughness: 0.75 };
      const shell = Math.hypot(u - 0.5, v - 0.25);
      const arc = v > 0.24 && Math.abs(shell - 0.31) < 0.035;
      const rib = v > 0.28 && v < 0.78 && [0.25, 0.5, 0.75]
        .some((tip) => distanceToSegment(u, v, 0.5, 0.26, tip, 0.77) < 0.024);
      const crack = distanceToSegment(u, v, 0.14, 0.27, 0.3, 0.37) < 0.009
        || distanceToSegment(u, v, 0.3, 0.37, 0.36, 0.32) < 0.009;
      if (crack) return { color: [0.88, 0.98, 0.91], roughness: 0.23 };
      if (arc || rib) return { color: [0.35, 0.54, 0.59], roughness: 0.68 };
      const worn = edge > 0.34 || Math.hypot(u - 0.72, v - 0.7) < 0.035;
      return { color: worn ? [0.68, 0.76, 0.7] : [0.85, 0.88, 0.78], roughness: worn ? 0.84 : 0.53 };
    }
    case 'meteorite': {
      if (edge > 0.425) return { color: [0.57, 0.45, 0.39], roughness: 0.83 };
      const pit = [[0.31, 0.65, 0.11], [0.68, 0.34, 0.085], [0.71, 0.72, 0.05]]
        .some(([x, y, r]) => Math.hypot(u - x, v - y) < r);
      if (pit) return { color: [0.27, 0.3, 0.32], roughness: 0.96 };
      const vein = Math.min(
        distanceToSegment(u, v, 0.17, 0.2, 0.49, 0.47),
        distanceToSegment(u, v, 0.49, 0.47, 0.8, 0.58),
      ) < 0.023;
      if (vein) return { color: [0.83, 0.7, 0.51], roughness: 0.42 };
      return { color: [0.62, 0.65, 0.64], roughness: 0.9 };
    }
    case 'aurora-crystal': {
      if (edge > 0.42) return { color: [0.56, 0.68, 0.77], roughness: 0.4 };
      const facet = Math.abs(u - v) < 0.025 || Math.abs(u + v - 1) < 0.025;
      const ribbonCenter = 0.5 + 0.15 * Math.sin(v * 5.8 + phase * 0.55);
      const ribbon = Math.abs(u - ribbonCenter) < 0.085;
      if (ribbon) return { color: [0.79, 0.97, 0.89], roughness: 0.31 };
      if (facet) return { color: [0.91, 0.94, 0.98], roughness: 0.19 };
      return { color: u + v > 1 ? [0.75, 0.81, 0.95] : [0.83, 0.9, 0.93], roughness: 0.57 };
    }
    case 'building-bricks': {
      if (edge > 0.42) return { color: [0.42, 0.46, 0.49], roughness: 0.66 };
      const stud = [[0.31, 0.31], [0.69, 0.31], [0.31, 0.69], [0.69, 0.69]]
        .map(([x, y]) => Math.hypot(u - x, v - y));
      if (stud.some((r) => r < 0.092)) return { color: [0.99, 0.99, 0.95], roughness: 0.22 };
      if (stud.some((r) => r < 0.125)) return { color: [0.46, 0.51, 0.54], roughness: 0.61 };
      const scratch = distanceToSegment(u, v, 0.38, 0.51, 0.58, 0.49) < 0.006;
      return { color: scratch ? [0.6, 0.64, 0.67] : [0.79, 0.83, 0.84], roughness: scratch ? 0.69 : 0.33 };
    }
    case 'jelly-cubes': {
      if (edge > 0.42) return { color: [0.7, 0.74, 0.78], roughness: 0.29 };
      if (edge > 0.335) return { color: [0.97, 0.98, 0.97], roughness: 0.11 };
      const wobble = 0.025 * Math.sin(phase * 2.1);
      const meniscus = Math.abs(v - (0.3 + 0.035 * Math.sin(u * 7 + phase * 1.5))) < 0.027;
      const bubble = Math.hypot(u - (0.37 + wobble), v - 0.59) < 0.075
        || Math.hypot(u - (0.68 - wobble), v - 0.69) < 0.045;
      if (bubble || meniscus) return { color: [0.99, 0.99, 0.98], roughness: 0.09 };
      return { color: [0.8, 0.86, 0.87], roughness: 0.2 };
    }
    case 'arcade-carpet': {
      if (edge > 0.42) return { color: [0.31, 0.35, 0.37], roughness: 0.98 };
      const diamond = Math.abs(Math.abs(u - 0.5) + Math.abs(v - 0.5) - 0.27) < 0.044;
      if (diamond) return { color: [0.95, 0.77, 0.59], roughness: 0.89 };
      const weave = (Math.floor(u * 18) + Math.floor(v * 18)) % 2;
      if (radius < 0.09) return { color: [0.78, 0.64, 0.7], roughness: 0.92 };
      return { color: weave ? [0.57, 0.62, 0.62] : [0.65, 0.69, 0.68], roughness: 0.96 };
    }
    case 'tiny-aquariums': {
      if (edge > 0.4) return { color: [0.27, 0.4, 0.47], roughness: 0.44 };
      if (edge > 0.345) return { color: [0.79, 0.92, 0.91], roughness: 0.17 };
      const fishBody = Math.hypot((u - 0.53) * 1.15, (v - 0.55) * 1.8) < 0.12;
      const fishTail = u < 0.44 && u > 0.29 && Math.abs(v - 0.55) < (0.45 - u) * 0.8;
      if (fishBody || fishTail) return { color: [0.96, 0.73, 0.5], roughness: 0.53 };
      const bubble = Math.hypot(u - 0.72, v - 0.31) < 0.035;
      if (bubble) return { color: [1, 1, 0.98], roughness: 0.07 };
      if (Math.abs(v - 0.74) < 0.018) return { color: [0.93, 0.98, 0.95], roughness: 0.12 };
      return { color: [0.72, 0.84, 0.89], roughness: 0.28 };
    }
    case 'toy-blocks': {
      if (edge > 0.42) return { color: [0.62, 0.5, 0.36], roughness: 0.83 };
      const grain = Math.abs(v - (0.27 + 0.014 * Math.sin(u * 9))) < 0.014
        || Math.abs(v - (0.76 + 0.018 * Math.sin(u * 8 + 2))) < 0.014;
      const stamp = Math.min(
        distanceToSegment(u, v, 0.36, 0.64, 0.5, 0.35),
        distanceToSegment(u, v, 0.5, 0.35, 0.64, 0.64),
        distanceToSegment(u, v, 0.42, 0.54, 0.58, 0.54),
      ) < 0.026;
      if (stamp) return { color: [0.36, 0.39, 0.38], roughness: 0.85 };
      return { color: grain ? [0.72, 0.65, 0.52] : [0.91, 0.82, 0.66], roughness: grain ? 0.78 : 0.64 };
    }
    case 'circuit-boards': {
      if (edge > 0.42) return { color: [0.29, 0.39, 0.35], roughness: 0.67 };
      const chip = Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) < 0.17;
      const trace = Math.min(
        distanceToSegment(u, v, 0.5, 0.15, 0.5, 0.34),
        distanceToSegment(u, v, 0.5, 0.66, 0.5, 0.85),
        distanceToSegment(u, v, 0.15, 0.5, 0.34, 0.5),
        distanceToSegment(u, v, 0.66, 0.5, 0.85, 0.5),
      ) < 0.027;
      if (chip) return { color: [0.32 + 0.4 * tracePulse, 0.45 + 0.43 * tracePulse, 0.43 + 0.35 * tracePulse], roughness: 0.39 };
      if (trace) return { color: [0.69 + 0.3 * tracePulse, 0.8 + 0.19 * tracePulse, 0.71 + 0.25 * tracePulse], roughness: 0.26 };
      return { color: [0.65, 0.72, 0.64], roughness: 0.76 };
    }
    case 'space-freight': {
      if (edge > 0.42) return { color: [0.31, 0.36, 0.42], roughness: 0.74 };
      const bolt = [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]
        .some(([x, y]) => Math.hypot(u - x, v - y) < 0.035);
      if (bolt) return { color: [0.9, 0.87, 0.73], roughness: 0.37 };
      const hazard = v > 0.68 && v < 0.81 && ((u + v * 0.65) % 0.28) < 0.13;
      if (hazard) return { color: [0.96, 0.79, 0.45], roughness: 0.52 };
      const rib = [0.31, 0.5, 0.69].some((x) => Math.abs(u - x) < 0.032);
      return { color: rib ? [0.42, 0.48, 0.52] : [0.75, 0.79, 0.8], roughness: rib ? 0.78 : 0.51 };
    }
    case 'mechanical-keys': {
      if (edge > 0.42) return { color: [0.35, 0.39, 0.43], roughness: 0.61 };
      if (edge > 0.34) return { color: [0.95, 0.95, 0.88], roughness: 0.28 };
      const arrow = distanceToSegment(u, v, 0.5, 0.29, 0.5, 0.7) < 0.032
        || distanceToSegment(u, v, 0.35, 0.47, 0.5, 0.3) < 0.03
        || distanceToSegment(u, v, 0.65, 0.47, 0.5, 0.3) < 0.03;
      if (arrow) return { color: [0.32 + 0.58 * keyPulse, 0.37 + 0.57 * keyPulse, 0.4 + 0.52 * keyPulse], roughness: 0.48 };
      return { color: [0.84 + 0.12 * keyPulse, 0.87 + 0.1 * keyPulse, 0.86 + 0.1 * keyPulse], roughness: 0.34 };
    }
    case 'retro-displays': {
      if (edge > 0.41) return { color: [0.34, 0.37, 0.35], roughness: 0.67 };
      const segment = (v > 0.69 && v < 0.75 && u > 0.29 && u < 0.72)
        || (v > 0.48 && v < 0.54 && u > 0.3 && u < 0.71)
        || (u > 0.64 && u < 0.7 && v > 0.3 && v < 0.7);
      if (segment) return { color: [0.78, 0.98, 0.72], roughness: 0.24 };
      const scanline = Math.floor(v * 18) % 2 === 0;
      return { color: scanline ? [0.44, 0.54, 0.5] : [0.51, 0.6, 0.55], roughness: 0.64 };
    }
    case 'black-ice': {
      if (edge > 0.425) return { color: [0.51, 0.63, 0.73], roughness: 0.25 };
      const fracture = Math.min(
        distanceToSegment(u, v, 0.16, 0.78, 0.48, 0.52),
        distanceToSegment(u, v, 0.48, 0.52, 0.8, 0.2),
        distanceToSegment(u, v, 0.48, 0.52, 0.67, 0.71),
      ) < 0.024;
      if (fracture) return { color: [0.88, 0.98, 1], roughness: 0.21 };
      return { color: u + v > 1 ? [0.4, 0.51, 0.65] : [0.47, 0.58, 0.69], roughness: 0.1 };
    }
    case 'dungeon-treasure': {
      if (edge > 0.41) return { color: [0.82, 0.68, 0.38], roughness: 0.39 };
      const engraving = Math.abs(Math.abs(u - 0.5) + Math.abs(v - 0.5) - 0.28) < 0.025;
      if (engraving) return { color: [0.93, 0.8, 0.48], roughness: 0.28 };
      const gem = Math.abs(u - 0.5) + Math.abs(v - 0.5) < 0.19;
      if (gem) return { color: u < 0.5 ? [0.82, 0.94, 0.93] : [0.57, 0.78, 0.89], roughness: 0.11 };
      return { color: [0.61, 0.62, 0.59], roughness: 0.43 };
    }
    case 'cosmic-windows': {
      if (edge > 0.42) return { color: [0.27, 0.33, 0.43], roughness: 0.52 };
      if (edge > 0.34) return { color: [0.8, 0.86, 0.91], roughness: 0.3 };
      const star = [[0.35, 0.7], [0.7, 0.37], [0.58, 0.75]]
        .some(([x, y]) => Math.abs(u - x) + Math.abs(v - y) < 0.045);
      if (star) return { color: [0.99, 0.99, 0.94], roughness: 0.1 };
      const nebula = Math.abs(v - (0.45 + 0.14 * Math.sin(u * 6))) < 0.07;
      return { color: nebula ? [0.66, 0.75, 0.9] : [0.43, 0.52, 0.68], roughness: 0.48 };
    }
    default:
      return null;
  }
}

// Face treatments are authored in normalized cell space. They remain visible at
// gameplay scale and tint with each piece's accessible seven-color palette.
function faceValue(family, u, v) {
  const x = Math.abs(u - 0.5), y = Math.abs(v - 0.5);
  const edge = Math.max(x, y);
  switch (family) {
    case 'ceramic':
      return edge > 0.39 ? 0.79 : edge > 0.35 ? 0.92 : 0.98;
    case 'ion-glass': {
      const inset = Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5));
      return inset > 0.38 ? 0.97 : inset > 0.35 ? 0.68 : 0.87 + 0.10 * (1 - v);
    }
    case 'carbon-lattice': {
      const weave = (Math.floor(u * 12) + Math.floor(v * 12)) % 2;
      return edge > 0.39 ? 0.9 : weave ? 0.68 : 0.82;
    }
    case 'aurora-alloy':
      return edge > 0.4 ? 0.98 : 0.84 + 0.09 * Math.sin(u * 43 + v * 6);
    case 'prism-shell': {
      const diagonal = u + v > 1;
      const facet = Math.abs(u - v) < 0.035 || Math.abs(u + v - 1) < 0.035;
      return facet ? 0.99 : diagonal ? 0.77 : 0.91;
    }
    case 'void-chrome':
      return edge > 0.39 ? 0.96 : edge > 0.32 ? 0.62 : Math.abs(u - 0.5) < 0.055 ? 0.88 : 0.7;
    default:
      return 1;
  }
}

export function createBlockAppearance() {
  const textures = new Map();
  const paint = (family, color, roughness, size, phase = 0, keyPulse = 0, tracePulse = 0) => {
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
      const u = x / (size - 1), v = y / (size - 1);
      const sample = premiumFaceSample(family, u, v)
        || collectionFaceSample(family, u, v, phase, keyPulse, tracePulse);
      const value = sample ? 1 : faceValue(family, u, v);
      const i = (y * size + x) * 4;
      const c = Math.round(255 * clamp(value, 0, 1));
      color.set(sample ? sample.color.map((channel) => Math.round(255 * clamp(channel, 0, 1))).concat(255) : [c, c, c, 255], i);
      const r = Math.round(255 * clamp(sample ? sample.roughness : family === 'carbon-lattice' ? 0.8 : family === 'ceramic' ? 0.7 : 0.45 + (1 - value) * 0.4, 0, 1));
      roughness.set([r, r, r, 255], i);
    }
  };
  for (const family of FAMILIES) {
    // Stage 2 shapes have cell-scale detail; 64 texels avoids wasting CPU on
    // animated pixels that the gameplay block cannot display.
    const size = COLLECTION_FAMILIES.includes(family) ? 64 : 128;
    const color = new Uint8Array(size * size * 4);
    const roughness = new Uint8Array(size * size * 4);
    paint(family, color, roughness, size);
    const texture = (bytes, colorSpace) => {
      const map = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat);
      map.colorSpace = colorSpace;
      map.magFilter = THREE.LinearFilter;
      map.minFilter = THREE.LinearMipmapLinearFilter;
      map.generateMipmaps = true;
      map.needsUpdate = true;
      return map;
    };
    textures.set(family, { map: texture(color, THREE.SRGBColorSpace), roughnessMap: texture(roughness, THREE.NoColorSpace), color, roughness, size });
  }
  let lastAmbientFrame = -1;
  let lastReducedMotion = false;
  let keyPulse = 0;
  let tracePulse = 0;
  const refresh = (family, phase, lockValue = 0, clearValue = 0) => {
    const record = textures.get(family);
    paint(family, record.color, record.roughness, record.size, phase, lockValue, clearValue);
    record.map.needsUpdate = true;
    record.roughnessMap.needsUpdate = true;
  };
  return {
    apply(material, data = {}, { ghost = false } = {}) {
      const family = textures.get(data.family) || textures.get('ceramic');
      material.map = ghost ? null : family.map;
      material.roughnessMap = ghost ? null : family.roughnessMap;
      material.roughness = data.roughness ?? 0.4;
      material.metalness = data.metalness ?? 0.08;
      material.clearcoat = data.clearcoat ?? 0.72;
      material.needsUpdate = true;
    },
    update({ timeMs = 0, dtMs = 0, reducedMotion = false, locked = false, cleared = false } = {}) {
      if (reducedMotion) {
        if (!lastReducedMotion) {
          keyPulse = 0;
          tracePulse = 0;
          refresh('aurora-crystal', 0);
          refresh('jelly-cubes', 0);
          refresh('mechanical-keys', 0);
          refresh('circuit-boards', 0);
        }
        lastReducedMotion = true;
        return;
      }
      const resumed = lastReducedMotion;
      lastReducedMotion = false;
      const ambientFrame = Math.floor(Math.max(0, timeMs) / 80);
      if (resumed || ambientFrame !== lastAmbientFrame) {
        const phase = Math.max(0, timeMs) / 1000;
        refresh('aurora-crystal', phase);
        refresh('jelly-cubes', phase);
        lastAmbientFrame = ambientFrame;
      }
      const nextKeyPulse = locked ? 1 : Math.max(0, keyPulse - Math.max(0, dtMs) / 220);
      const nextTracePulse = cleared ? 1 : Math.max(0, tracePulse - Math.max(0, dtMs) / 260);
      if (resumed || nextKeyPulse !== keyPulse) refresh('mechanical-keys', 0, nextKeyPulse);
      if (resumed || nextTracePulse !== tracePulse) refresh('circuit-boards', 0, 0, nextTracePulse);
      keyPulse = nextKeyPulse;
      tracePulse = nextTracePulse;
    },
    dispose() {
      for (const pair of textures.values()) {
        pair.map.dispose();
        pair.roughnessMap.dispose();
      }
    },
  };
}
