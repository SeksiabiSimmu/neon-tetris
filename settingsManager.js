// Player preferences are kept separately from earned progression. Saved
// values are validated on load so a partial, old, or edited profile cannot
// poison renderer, audio, or input state.
TETRIS.SettingsManager = class SettingsManager {
  constructor(storageKey) {
    this.storageKey = storageKey || 'tetris_settings_v1';
    this.values = this._defaults();
    this._load();
  }

  _defaults() {
    return {
      masterVolume: 80,
      sfxVolume: 80,
      screenShake: 60, // 0 - 100 intensity
      particleIntensity: 80, // 0 - 100 intensity
      glowIntensity: 1, // 0 - 1.5
      reducedMotion: !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches),
      colorblindMode: false,
      graphicsQuality: 'high', // 'low' | 'medium' | 'high'
      keyBindings: null,
    };
  }

  get(key) {
    return this.values[key];
  }

  set(key, value, persist = true) {
    if (!Object.prototype.hasOwnProperty.call(this._defaults(), key)) return;
    this.values[key] = this._normalizeValue(key, value);
    if (persist) this.save();
  }

  resetToDefaults() {
    this.values = this._defaults();
    this.save();
  }

  _normalizeValue(key, value) {
    const number = Number(value);
    if (['masterVolume', 'sfxVolume', 'screenShake', 'particleIntensity'].includes(key)) {
      return Number.isFinite(number) ? Math.round(Math.max(0, Math.min(100, number))) : this._defaults()[key];
    }
    if (key === 'glowIntensity') {
      return Number.isFinite(number) ? Math.max(0, Math.min(1.5, number)) : 1;
    }
    if (key === 'graphicsQuality') return ['low', 'medium', 'high'].includes(value) ? value : 'high';
    if (key === 'keyBindings') return this._normalizeBindings(value);
    if (key === 'reducedMotion' || key === 'colorblindMode') return value === true;
    return this._defaults()[key];
  }

  _normalizeBindings(bindings) {
    if (bindings == null) return null;
    if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) return null;
    const actions = new Set(['left', 'right', 'softDrop', 'hardDrop', 'rotateCW', 'rotateCCW', 'hold', 'restart', 'pause', 'toggleDebug']);
    const clean = {};
    Object.entries(bindings).forEach(([code, action]) => {
      if (/^[A-Za-z][A-Za-z0-9]{0,31}$/.test(code) && actions.has(action)) clean[code] = action;
    });
    return Object.keys(clean).length ? clean : null;
  }

  _load() {
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || Array.isArray(data)) return;
      const defaults = this._defaults();
      Object.keys(defaults).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(data, key)) this.values[key] = this._normalizeValue(key, data[key]);
      });
      // Migrate the earlier on/off controls to the new adjustable sliders.
      if (typeof data.screenShake === 'boolean') this.values.screenShake = data.screenShake ? 60 : 0;
      if (typeof data.particles === 'boolean' && !Object.prototype.hasOwnProperty.call(data, 'particleIntensity')) {
        this.values.particleIntensity = data.particles ? 80 : 0;
      }
    } catch (err) {
      console.warn('Settings: could not load saved settings, using defaults.', err);
    }
  }

  save() {
    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(this.values));
    } catch (err) {
      console.warn('Settings: could not save settings.', err);
    }
  }

  applyTo({ renderer, input, audio }) {
    const v = this.values;
    if (renderer) {
      const particles = v.reducedMotion ? 0 : v.particleIntensity / 100;
      renderer.effects.shakeScale = v.reducedMotion ? 0 : v.screenShake / 100;
      renderer.effects.reducedMotion = v.reducedMotion;
      renderer.boardParticles.intensityScale = particles;
      renderer.boardParticles.enabled = particles > 0;
      if (renderer.background) {
        renderer.background.reducedMotion = v.reducedMotion;
        renderer.background.styleIntensity = particles;
        renderer.background.particles.intensityScale = particles;
        renderer.background.particles.enabled = particles > 0;
      }
      renderer.glow.intensityScale = this._qualityScale(v.graphicsQuality) * v.glowIntensity;
      renderer.reducedMotion = v.reducedMotion;
      if (v.colorblindMode) {
        renderer.setPieceColors(TETRIS.COLORBLIND_PALETTE);
      } else {
        renderer.setPieceColors(renderer._lastAppliedSkinColors || TETRIS.COLORS);
      }
      renderer.webgl?.setSettings({
        reducedMotion: v.reducedMotion,
        colorblindMode: v.colorblindMode,
        screenShake: v.reducedMotion ? 0 : v.screenShake / 100,
        particleIntensity: v.reducedMotion ? 0 : v.particleIntensity / 100,
        glowIntensity: v.glowIntensity * this._qualityScale(v.graphicsQuality),
      });
    }
    if (input) input.setKeyBindings(v.keyBindings || input.defaultKeyMap);
    if (audio) audio.setVolumes(v.masterVolume, v.sfxVolume);
    const glowScale = v.glowIntensity * this._qualityScale(v.graphicsQuality);
    const glowAlpha = Math.min(1, Math.max(0, glowScale));
    document.documentElement.style.setProperty('--glow-scale', String(glowScale));
    document.documentElement.style.setProperty('--glow-alpha', String(glowAlpha));
    document.documentElement.style.setProperty('--glow-opacity', `${Math.round(glowAlpha * 100)}%`);
    document.documentElement.classList.toggle('reduced-motion', v.reducedMotion);
  }

  _qualityScale(quality) {
    return { low: 0.5, medium: 0.8, high: 1 }[quality] || 1;
  }
};

// High separation in hue and luminance, avoiding a red/green-only distinction.
TETRIS.COLORBLIND_PALETTE = {
  I: '#56b4e9',
  O: '#e69f00',
  T: '#cc79a7',
  S: '#009e73',
  Z: '#d55e00',
  J: '#0072b2',
  L: '#f0e442',
};
