// js/scoring.js
//
// Tracks score, lines cleared, and level, and derives the current gravity
// speed from the level. Also owns the combo counter and back-to-back streak
// state, since both are properties of the *scoring sequence* over time, not
// of any single clear in isolation.
//
// registerClear() is the one entry point Game calls after every lock that
// might score something (a line clear, a T-spin, or both). It returns a
// breakdown of what happened, which the debug panel reads and a future
// "COMBO x3!" style callout could hook into.

TETRIS.Scoring = class Scoring {
  constructor() {
    this.reset();
  }

  reset() {
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.comboCount = -1; // -1 = not currently in a combo; 0 = first clear of one
    this.backToBack = false;
  }

  gravityIntervalForLevel(level) {
    const { BASE_GRAVITY_MS, MIN_GRAVITY_MS, GRAVITY_DECAY } = TETRIS.CONFIG;
    const interval = BASE_GRAVITY_MS * Math.pow(GRAVITY_DECAY, level - 1);
    return Math.max(MIN_GRAVITY_MS, Math.round(interval));
  }

  get gravityInterval() {
    return this.gravityIntervalForLevel(this.level);
  }

  addSoftDrop(cellCount) {
    this.score += cellCount * TETRIS.CONFIG.SOFT_DROP_POINTS_PER_CELL;
  }

  addHardDrop(cellCount) {
    this.score += cellCount * TETRIS.CONFIG.HARD_DROP_POINTS_PER_CELL;
  }

  // linesCleared: 0-4. tSpinType: null | 'mini' | 'full'. isPerfectClear:
  // whether the board ended up completely empty (only meaningful when
  // linesCleared > 0 — locking always adds at least one cell, so a board
  // can only be empty right after a clear that removed everything on it).
  registerClear({ linesCleared, tSpinType = null, isPerfectClear = false }) {
    const table = TETRIS.SCORE_TABLE;
    const level = this.level;
    const result = {
      linesCleared, tSpinType, isPerfectClear,
      baseScore: 0, comboScore: 0, perfectClearScore: 0,
      backToBackApplied: false, comboCount: this.comboCount, leveledUp: false,
    };

    // A T-spin that clears no lines still scores, but per Guideline it can
    // neither break nor extend a combo or a back-to-back streak — it's
    // simply invisible to both, since no line-clear event actually happened.
    if (linesCleared === 0) {
      if (tSpinType) {
        result.baseScore = table.T_SPIN[tSpinType][0] * level;
        this.score += result.baseScore;
      }
      return result;
    }

    const isDifficult = linesCleared === 4 || tSpinType !== null;
    const wasBackToBack = this.backToBack;

    const rawBase = tSpinType ? table.T_SPIN[tSpinType][linesCleared] : table.LINE[linesCleared];
    // A couple of T-spin/line-count combinations (e.g. a Mini Triple) are
    // geometrically near-impossible and have no official score entry —
    // fall back to the plain line-clear value rather than risk NaN.
    let base = (rawBase !== undefined ? rawBase : table.LINE[linesCleared]) * level;

    if (isDifficult && wasBackToBack) {
      base = Math.round(base * table.BACK_TO_BACK_MULTIPLIER);
      result.backToBackApplied = true;
    }
    result.baseScore = base;
    this.backToBack = isDifficult;

    this.comboCount += 1;
    result.comboCount = this.comboCount;
    if (this.comboCount > 0) {
      result.comboScore = table.COMBO_PER_STEP * this.comboCount * level;
    }

    if (isPerfectClear) {
      result.perfectClearScore = (table.PERFECT_CLEAR[linesCleared] || 0) * level;
    }

    this.score += base + result.comboScore + result.perfectClearScore;
    this.lines += linesCleared;

    const newLevel = Math.floor(this.lines / TETRIS.CONFIG.LINES_PER_LEVEL) + 1;
    result.leveledUp = newLevel > this.level;
    this.level = newLevel;

    return result;
  }

  // A lock that cleared nothing and wasn't a T-spin still ends any active
  // combo (a plain piece landing in the middle of a combo breaks it).
  registerNonClearingLock() {
    this.comboCount = -1;
  }
};
