// js/input.js
//
// Translates raw keyboard events into named game actions and emits them as
// events. This is the only module that knows about key codes — Game just
// subscribes to events like "moveLeft" or "rotateCW" and never sees a
// KeyboardEvent. That split is what makes it possible to rebind controls,
// or add gamepad/touch input later, without touching game logic.
//
// Held-direction repeat (DAS/ARR) is handled here too, since "how a held
// key turns into repeated actions over time" is an input concern, not a
// rules concern. Call update(now) once per animation frame to drive it.

TETRIS.InputHandler = class InputHandler {
  constructor() {
    this.keysDown = new Set();
    this.dasTimers = { left: 0, right: 0 };
    this.dasActive = { left: false, right: false };
    this.horizontalPriority = null;
    this.listeners = {};

    this.defaultKeyMap = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowDown: 'softDrop',
      ArrowUp: 'rotateCW',
      KeyX: 'rotateCW',
      KeyZ: 'rotateCCW',
      ControlLeft: 'rotateCCW',
      ControlRight: 'rotateCCW',
      Space: 'hardDrop',
      KeyC: 'hold',
      ShiftLeft: 'hold',
      ShiftRight: 'hold',
      KeyR: 'restart',
      Backquote: 'toggleDebug',
      Escape: 'pause',
      KeyP: 'pause',
    };
    this.keyMap = Object.assign({}, this.defaultKeyMap);
    this.gameplayEnabled = true;

    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    window.addEventListener('blur', () => this.clearHeldKeys());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clearHeldKeys();
    });
  }

  on(eventName, callback) {
    (this.listeners[eventName] = this.listeners[eventName] || []).push(callback);
  }

  // Replaces the active key map wholesale — used to restore a saved custom
  // binding set. Pass the same shape as the built-in keyMap (code -> action).
  setKeyBindings(map) {
    if (map && typeof map === 'object' && !Array.isArray(map)) this.keyMap = Object.assign({}, map);
  }

  setGameplayEnabled(enabled) {
    this.gameplayEnabled = !!enabled;
    if (!this.gameplayEnabled) this.clearHeldKeys();
  }

  clearHeldKeys() {
    this.keysDown.clear();
    this.horizontalPriority = null;
    this.dasActive.left = false;
    this.dasActive.right = false;
    this.emit('softDropEnd');
  }

  emit(eventName, payload) {
    (this.listeners[eventName] || []).forEach((cb) => cb(payload));
  }

  handleKeyDown(e) {
    if (!this.gameplayEnabled) return;
    const action = this.keyMap[e.code];
    if (!action) return;
    e.preventDefault(); // stop arrow-key scrolling / space-bar page-down, etc.
    this.emit('anyKey');

    if (e.repeat) return; // we drive repeats ourselves in update(), not via OS key-repeat

    switch (action) {
      case 'left':
      case 'right':
        this.keysDown.add(action);
        this.horizontalPriority = action;
        this.dasActive[action] = false;
        this.dasTimers[action] = performance.now();
        this.emit(action === 'left' ? 'moveLeft' : 'moveRight');
        break;
      case 'softDrop':
        this.keysDown.add('softDrop');
        this.emit('softDropStart');
        break;
      case 'rotateCW':
        this.emit('rotateCW');
        break;
      case 'rotateCCW':
        this.emit('rotateCCW');
        break;
      case 'hardDrop':
        this.emit('hardDrop');
        break;
      case 'hold':
        this.emit('hold');
        break;
      case 'restart':
        this.emit('restart');
        break;
      case 'toggleDebug':
        this.emit('toggleDebug');
        break;
      case 'pause':
        this.emit('pause');
        break;
    }
  }

  handleKeyUp(e) {
    const action = this.keyMap[e.code];
    if (!action) return;

    if (action === 'left' || action === 'right') {
      this.keysDown.delete(action);
      this.dasActive[action] = false;
      if (this.horizontalPriority === action) {
        const other = action === 'left' ? 'right' : 'left';
        this.horizontalPriority = this.keysDown.has(other) ? other : null;
        if (this.horizontalPriority) {
          this.dasTimers[other] = performance.now();
          this.dasActive[other] = false;
          this.emit(other === 'left' ? 'moveLeft' : 'moveRight');
        }
      }
    } else if (action === 'softDrop') {
      this.keysDown.delete('softDrop');
      this.emit('softDropEnd');
    }
  }

  // Drives auto-repeat for held left/right. Call once per animation frame.
  update(now) {
    const { DAS_MS, ARR_MS } = TETRIS.CONFIG;
    const dir = this.horizontalPriority;
    if (dir && this.keysDown.has(dir)) {
      const elapsed = now - this.dasTimers[dir];
      if (!this.dasActive[dir]) {
        if (elapsed >= DAS_MS) {
          this.dasActive[dir] = true;
          this.dasTimers[dir] = now;
          this.emit(dir === 'left' ? 'moveLeft' : 'moveRight');
        }
      } else if (elapsed >= ARR_MS) {
        this.dasTimers[dir] = now;
        this.emit(dir === 'left' ? 'moveLeft' : 'moveRight');
      }
    }
  }
};
