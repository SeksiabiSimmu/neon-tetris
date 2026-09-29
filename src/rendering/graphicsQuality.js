// Background quality is independent of the board's full-resolution canvas.
// Presets are kept in one place so the settings UI never promises an effect
// that the active renderer does not actually change.
const PRESETS = Object.freeze({
  low: Object.freeze({ renderScale: 0.7, shadowSize: 0, ao: false, bloom: false, samples: 0, anisotropy: 1 }),
  medium: Object.freeze({ renderScale: 0.9, shadowSize: 1024, ao: false, bloom: true, samples: 2, anisotropy: 4 }),
  high: Object.freeze({ renderScale: 1, shadowSize: 2048, ao: true, bloom: true, samples: 4, anisotropy: 8 }),
});

export function graphicsPreset(quality, maxSamples = 4, maxAnisotropy = 8) {
  const preset = PRESETS[quality] || PRESETS.medium;
  return {
    ...preset,
    samples: Math.max(0, Math.min(preset.samples, Number(maxSamples) || 0)),
    anisotropy: Math.max(1, Math.min(preset.anisotropy, Number(maxAnisotropy) || 1)),
  };
}
