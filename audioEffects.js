// Small, asset-free sound layer. AudioContext is created on the first player
// action so browser autoplay policies are respected; every sound is a short
// oscillator envelope and is allowed to finish without keeping a timer alive.
window.TETRIS = window.TETRIS || {};

TETRIS.AudioEffects = class AudioEffects {
  constructor() {
    this.context = null;
    this.masterVolume = 0.8;
    this.sfxVolume = 0.8;
    this.lastMoveAt = -Infinity;
    this.patterns = {
      move: [[190, 0, 0.045, 'square']],
      rotate: [[360, 0, 0.075, 'triangle']],
      softDrop: [[245, 0, 0.055, 'triangle']],
      hardDrop: [[105, 0, 0.16, 'sawtooth'], [62, 0.035, 0.18, 'triangle']],
      lock: [[145, 0, 0.075, 'triangle']],
      lineClear: [[440, 0, 0.11, 'sine'], [660, 0.055, 0.14, 'sine']],
      tetris: [[392, 0, 0.12, 'triangle'], [494, 0.045, 0.14, 'triangle'], [587, 0.09, 0.17, 'triangle'], [784, 0.14, 0.24, 'sine']],
      tspin: [[294, 0, 0.11, 'triangle'], [440, 0.05, 0.16, 'sine']],
      combo: [[587, 0, 0.07, 'sine'], [784, 0.045, 0.1, 'triangle']],
      levelUp: [[523, 0, 0.1, 'triangle'], [659, 0.08, 0.12, 'triangle'], [784, 0.16, 0.15, 'triangle'], [1047, 0.25, 0.24, 'sine']],
      gameOver: [[392, 0, 0.16, 'triangle'], [330, 0.13, 0.17, 'triangle'], [262, 0.27, 0.2, 'triangle'], [196, 0.43, 0.32, 'sine']],
      menu: [[440, 0, 0.06, 'sine'], [587, 0.035, 0.08, 'triangle']],
    };
  }

  setVolumes(master, sfx) {
    this.masterVolume = this._unit(master);
    this.sfxVolume = this._unit(sfx);
  }

  _unit(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(1, number / (number > 1 ? 100 : 1))) : 0;
  }

  play(name) {
    const pattern = this.patterns[name];
    if (!pattern || this.masterVolume <= 0 || this.sfxVolume <= 0) return;
    const now = performance.now();
    if (name === 'move' && now - this.lastMoveAt < 38) return;
    if (name === 'move') this.lastMoveAt = now;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!this.context) this.context = new AudioContextClass();
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});

      const start = this.context.currentTime;
      const volume = this.masterVolume * this.sfxVolume;
      pattern.forEach(([frequency, offset, duration, type]) => {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        const toneStart = start + offset;
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, toneStart);
        gain.gain.setValueAtTime(0.0001, toneStart);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.055 * volume / Math.sqrt(pattern.length)), toneStart + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, toneStart + duration);
        oscillator.connect(gain);
        gain.connect(this.context.destination);
        oscillator.start(toneStart);
        oscillator.stop(toneStart + duration + 0.01);
      });
    } catch (_) {
      // Audio is optional: an unavailable or blocked browser audio device
      // must never prevent the game from responding to input.
    }
  }
};
