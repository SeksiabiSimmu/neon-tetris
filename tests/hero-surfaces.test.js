import test from 'node:test';
import assert from 'node:assert/strict';
import { planetarySurfaces } from '../src/rendering/heroSurfaces.js';

test('planet land and cloud maps meet cleanly at the sphere seam', () => {
  const surfaces = planetarySurfaces();
  for (const map of Object.values(surfaces)) {
    const { width, height, data } = map.image;
    for (let y = 0; y < height; y += 1) {
      const first = y * width * 4, last = first + (width - 1) * 4;
      assert.deepEqual(data.subarray(first, first + 4), data.subarray(last, last + 4));
    }
    map.dispose();
  }
});
