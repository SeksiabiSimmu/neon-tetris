import * as THREE from 'three';

const fract = (n) => n - Math.floor(n);
const smooth = (n) => n * n * (3 - 2 * n);
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const point = (a, b) => fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
  const sx = smooth(x - ix), sy = smooth(y - iy);
  const a = point(ix, iy) * (1 - sx) + point(ix + 1, iy) * sx;
  const b = point(ix, iy + 1) * (1 - sx) + point(ix + 1, iy + 1) * sx;
  return a * (1 - sy) + b * sy;
}

function longitudeNoise(u, frequency, y, offset = 0) {
  const x = u * frequency + offset;
  return noise(x, y) * (1 - u) + noise(x - frequency, y) * u;
}

function texture(bytes, width, height) {
  const map = new THREE.DataTexture(bytes, width, height, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}

/** Broad continents, shallow shelves, and a separate sparse cloud deck. */
export function planetarySurfaces() {
  const width = 1024, height = 512;
  const land = new Uint8Array(width * height * 4);
  const clouds = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const u = x / width, v = y / height;
    const latitude = Math.abs(v - 0.5) * 2;
    const ridge = longitudeNoise(u, 3.4, v * 3.4) * 0.5
      + longitudeNoise(u, 7.2, v * 7.2) * 0.32
      + longitudeNoise(u, 17, v * 17) * 0.18;
    const continental = ridge + 0.13 * Math.sin(u * Math.PI * 6 + Math.sin(v * 8)) - latitude * 0.11;
    const coast = continental > 0.51;
    const shelf = continental > 0.475;
    const heightNoise = longitudeNoise(u, 34, v * 27);
    const ice = latitude > 0.88 + heightNoise * 0.045;
    let rgb;
    if (ice) rgb = [190, 207, 204];
    else if (coast) rgb = continental > 0.62 ? [129, 139, 124] : [99, 127, 117];
    else if (shelf) rgb = [51, 113, 125];
    else rgb = [27 + heightNoise * 7, 67 + heightNoise * 12, 91 + heightNoise * 14];
    const i = (y * width + x) * 4;
    land.set([Math.round(rgb[0]), Math.round(rgb[1]), Math.round(rgb[2]), 255], i);
    const cloud = longitudeNoise(u, 12, v * 18, Math.sin(v * 11) * 0.9) * 0.65
      + longitudeNoise(u, 29, v * 31) * 0.35;
    const opacity = Math.max(0, Math.min(76, (cloud - 0.59) * 380));
    clouds.set([225, 236, 233, Math.round(opacity)], i);
  }
  // The sphere meets at longitude zero; make both texture edges identical.
  for (let y = 0; y < height; y += 1) {
    const first = y * width * 4, last = first + (width - 1) * 4;
    land.set(land.subarray(first, first + 4), last);
    clouds.set(clouds.subarray(first, first + 4), last);
  }
  return { land: texture(land, width, height), clouds: texture(clouds, width, height) };
}

/** Curved raking around two stones, with a quiet grain aligned to the bed. */
export function gardenSandTexture() {
  const size = 512, bytes = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const u = x / size, v = y / size;
    const a = Math.hypot((u - 0.22) * 1.2, v - 0.68);
    const b = Math.hypot((u - 0.72) * 1.2, v - 0.3);
    const distance = Math.min(a, b);
    const rake = Math.sin(distance * 220) * 4.5;
    const grain = (noise(x * 0.22, y * 0.22) - 0.5) * 5;
    const shade = rake + grain;
    const i = (y * size + x) * 4;
    bytes.set([116 + shade, 120 + shade, 107 + shade, 255].map(Math.round), i);
  }
  return texture(bytes, size, size);
}
