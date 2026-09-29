/** Settings controls and key rebinding; the menu shell owns navigation. */
export class SettingsPanel {
  constructor({ settings, renderer, input, audio, game, progression, onProfileReset }) {
    this.settings = settings;
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;
    this.game = game;
    this.progression = progression;
    this.onProfileReset = onProfileReset;
    this.rebindingAction = null;
    this.rebindKeyListener = null;
  }

  get isRebinding() {
    return this.rebindingAction !== null;
  }

  bind() {
    const settings = this.settings;
    const apply = () => settings.applyTo({ renderer: this.renderer, input: this.input, audio: this.audio });

    ['masterVolume', 'sfxVolume', 'glowIntensity', 'particleIntensity'].forEach((key) => {
      const control = document.getElementById(`setting-${key}`);
      control.addEventListener('input', (event) => {
        settings.set(key, key === 'glowIntensity' ? Number(event.target.value) / 100 : Number(event.target.value), false);
        this._updateRangeLabel(key, event.target.value);
        apply();
      });
      control.addEventListener('change', () => settings.save());
    });

    document.getElementById('setting-graphicsQuality').addEventListener('change', (event) => {
      settings.set('graphicsQuality', event.target.value);
      apply();
      this._syncGraphicsControls();
    });

    ['reducedMotion', 'colorblindMode', 'background3D', 'ambientOcclusion'].forEach((key) => {
      document.getElementById(`setting-${key}`).addEventListener('change', (event) => {
        settings.set(key, event.target.checked);
        apply();
        if (key === 'background3D') this._syncGraphicsControls();
      });
    });

    document.getElementById('settings-reset-button').addEventListener('click', () => {
      settings.resetToDefaults();
      apply();
      this.render();
    });

    const resetProfileButton = document.getElementById('settings-reset-profile-button');
    const resetConfirm = document.getElementById('profile-reset-confirm');
    const resetStatus = document.getElementById('profile-reset-status');
    const cancelProfileReset = document.getElementById('settings-cancel-profile-reset');

    const closeProfileReset = () => {
      resetConfirm.hidden = true;
      resetProfileButton.setAttribute('aria-expanded', 'false');
      resetProfileButton.focus({ preventScroll: true });
    };

    window.addEventListener('keydown', (event) => {
      if (resetConfirm.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeProfileReset();
      } else if (event.key === 'Tab') {
        const first = cancelProfileReset;
        const last = document.getElementById('settings-confirm-profile-reset');
        if (event.shiftKey && (document.activeElement === first || !resetConfirm.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !resetConfirm.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    }, true);

    resetProfileButton.addEventListener('click', () => {
      resetStatus.textContent = '';
      resetStatus.classList.remove('is-error');
      resetConfirm.hidden = false;
      resetProfileButton.setAttribute('aria-expanded', 'true');
      cancelProfileReset.focus();
    });

    cancelProfileReset.addEventListener('click', () => {
      closeProfileReset();
    });

    document.getElementById('settings-confirm-profile-reset').addEventListener('click', () => {
      const saved = this.progression.resetProfile(this.game);
      this.onProfileReset();
      apply();
      closeProfileReset();
      resetStatus.classList.toggle('is-error', !saved);
      resetStatus.textContent = saved
        ? 'Progression reset. Settings, key bindings, and mode records were kept.'
        : 'Progression reset for this session, but browser storage could not save the change.';
      this.audio?.play('menu');
    });
  }

  render() {
    document.getElementById('profile-reset-confirm').hidden = true;
    document.getElementById('settings-reset-profile-button').setAttribute('aria-expanded', 'false');
    const resetStatus = document.getElementById('profile-reset-status');
    resetStatus.textContent = '';
    resetStatus.classList.remove('is-error');

    const values = this.settings.values;
    document.getElementById('setting-masterVolume').value = values.masterVolume;
    document.getElementById('setting-sfxVolume').value = values.sfxVolume;
    document.getElementById('setting-glowIntensity').value = Math.round(values.glowIntensity * 100);
    document.getElementById('setting-particleIntensity').value = values.particleIntensity;
    document.getElementById('setting-graphicsQuality').value = values.graphicsQuality;
    document.getElementById('setting-background3D').checked = values.background3D;
    document.getElementById('setting-ambientOcclusion').checked = values.ambientOcclusion;
    this._syncGraphicsControls();
    document.getElementById('setting-reducedMotion').checked = values.reducedMotion;
    document.getElementById('setting-colorblindMode').checked = values.colorblindMode;
    ['masterVolume', 'sfxVolume', 'glowIntensity', 'particleIntensity'].forEach((key) => {
      this._updateRangeLabel(key, document.getElementById(`setting-${key}`).value);
    });

    const keybindActions = [
      ['left', 'Move Left'], ['right', 'Move Right'], ['softDrop', 'Soft Drop'],
      ['hardDrop', 'Hard Drop'], ['rotateCW', 'Rotate CW'], ['rotateCCW', 'Rotate CCW'], ['hold', 'Hold'],
    ];
    const container = document.getElementById('settings-keybinds');
    container.innerHTML = keybindActions.map(([action, label]) => {
      const code = this._codeForAction(action);
      return `<div class="keybind-row"><span>${label}</span><button type="button" data-action="${action}">${this._codeLabel(code)}</button></div>`;
    }).join('');
    container.querySelectorAll('button[data-action]').forEach((button) => {
      button.addEventListener('click', () => this._startRebind(button));
    });
  }

  _codeForAction(action) {
    return Object.keys(this.input.keyMap).find((code) => this.input.keyMap[code] === action) || '—';
  }

  _syncGraphicsControls() {
    const control = document.getElementById('setting-ambientOcclusion');
    const unavailable = !this.settings.get('background3D') || this.settings.get('graphicsQuality') !== 'high';
    control.disabled = unavailable;
    control.closest('.settings-row')?.classList.toggle('is-unavailable', unavailable);
  }

  _updateRangeLabel(key, value) {
    const output = document.querySelector(`[data-setting-value="${key}"]`);
    if (output) output.textContent = `${Math.round(Number(value))}%`;
  }

  _codeLabel(code) {
    return { ArrowLeft: '←', ArrowRight: '→', ArrowDown: '↓', ArrowUp: '↑', Space: 'Space' }[code] || code.replace('Key', '');
  }

  _startRebind(button) {
    if (this.isRebinding) return;
    this.rebindingAction = button.dataset.action;
    button.textContent = 'Press a key…';
    button.classList.add('is-listening');

    const onKey = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.code === 'Escape') {
        this.cancelRebinding();
        this.render();
        document.querySelector(`#settings-keybinds button[data-action="${button.dataset.action}"]`)?.focus({ preventScroll: true });
        return;
      }
      const map = { ...this.input.keyMap };
      Object.keys(map).forEach((code) => { if (map[code] === this.rebindingAction) delete map[code]; });
      map[event.code] = this.rebindingAction;
      this.input.setKeyBindings(map);
      this.settings.set('keyBindings', map);
      this.cancelRebinding();
      this.render();
      document.querySelector(`#settings-keybinds button[data-action="${button.dataset.action}"]`)?.focus({ preventScroll: true });
    };
    this.rebindKeyListener = onKey;
    window.addEventListener('keydown', onKey, true);
  }

  cancelRebinding() {
    if (this.rebindKeyListener) window.removeEventListener('keydown', this.rebindKeyListener, true);
    this.rebindKeyListener = null;
    this.rebindingAction = null;
  }
}
