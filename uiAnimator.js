// js/uiAnimator.js
//
// The DOM-side half of the visual pass. Canvas rendering can't touch the
// score/level/lines text or the combo/level-up callouts (those are real
// HTML elements for accessibility/selectability), so this is where their
// "modern HUD" polish lives: numbers ease toward their real value instead
// of snapping, the combo badge escalates with combo size, and notable
// clears/level-ups get a brief on-screen callout. Purely presentational —
// reads Game/Scoring, never writes them.

TETRIS.UIAnimator = class UIAnimator {
  constructor(dom) {
    this.dom = dom;
    this.displayed = { score: 0, level: 1, lines: 0 };
    this.target = { score: 0, level: 1, lines: 0 };
    this._lastSeenClearInfo = null;
  }

  reset() {
    this.displayed = { score: 0, level: 1, lines: 0 };
    this.target = { score: 0, level: 1, lines: 0 };
    this._lastSeenClearInfo = null;
  }

  update(dt, game) {
    this._updateStats(game.scoring, dt);
    this._updateComboBadge(game.scoring);
    this._checkClearCallout(game);
  }

  _updateStats(scoring, dt) {
    this.target.score = scoring.score;
    this.target.level = scoring.level;
    this.target.lines = scoring.lines;

    // Frame-rate-independent ease: closes ~99.95% of the remaining gap
    // over HUD_COUNT_UP_MS, however choppy or smooth the frame rate is.
    const factor = 1 - Math.pow(0.0005, dt / TETRIS.VISUAL.HUD_COUNT_UP_MS);
    ['score', 'level', 'lines'].forEach((key) => {
      const diff = this.target[key] - this.displayed[key];
      this.displayed[key] = Math.abs(diff) < 0.5 ? this.target[key] : this.displayed[key] + diff * factor;
    });

    this.dom.score.textContent = Math.round(this.displayed.score).toLocaleString();
    this.dom.level.textContent = Math.round(this.displayed.level);
    this.dom.lines.textContent = Math.round(this.displayed.lines);
  }

  _updateComboBadge(scoring) {
    if (!this.dom.comboBadge || !this.dom.b2bBadge) return;
    if (scoring.comboCount > 0) {
      this.dom.comboBadge.textContent = `COMBO \u00d7${scoring.comboCount}`;
      this.dom.comboBadge.classList.add('visible');
      // Escalating visual tier as the combo grows — bigger/brighter badge,
      // matching "increasingly large combos produce increasingly impressive
      // effects" without needing separate art per tier.
      const tier = scoring.comboCount >= 6 ? 3 : scoring.comboCount >= 3 ? 2 : 1;
      this.dom.comboBadge.classList.toggle('tier-2', tier === 2);
      this.dom.comboBadge.classList.toggle('tier-3', tier === 3);
    } else {
      this.dom.comboBadge.classList.remove('visible', 'tier-2', 'tier-3');
    }
    this.dom.b2bBadge.classList.toggle('visible', !!scoring.backToBack);
  }

  _checkClearCallout(game) {
    const info = game.lastClearInfo;
    if (!info || info === this._lastSeenClearInfo) return;
    this._lastSeenClearInfo = info;

    if (info.leveledUp) this._popCallout(this.dom.levelUpCallout, `LEVEL ${game.scoring.level}`);

    const label = this._labelFor(info);
    if (label) this._popCallout(this.dom.clearCallout, label);
  }

  _popCallout(el, label) {
    if (!el) return;
    el.textContent = label;
    el.classList.remove('pop');
    void el.offsetWidth; // force reflow so re-adding the class restarts the animation
    el.classList.add('pop');
  }

  // Plain Singles are deliberately silent — celebrating every single clear
  // would just be noise. Doubles and up, any T-spin, and perfect clears
  // all get a callout.
  _labelFor(info) {
    if (info.isPerfectClear) return 'PERFECT CLEAR!';
    const names = { 1: 'SINGLE', 2: 'DOUBLE', 3: 'TRIPLE', 4: 'TETRIS' };
    if (info.tSpinType) {
      const prefix = info.tSpinType === 'full' ? 'T-SPIN' : 'MINI T-SPIN';
      return info.linesCleared > 0 ? `${prefix} ${names[info.linesCleared]}!` : `${prefix}!`;
    }
    if (info.linesCleared >= 2) return `${names[info.linesCleared]}!`;
    return null;
  }
};
