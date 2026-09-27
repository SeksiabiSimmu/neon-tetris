// js/progressionManager.js
//
// The meta-game layer. Like EffectsManager, this only ever *observes*
// Game/Scoring state each frame and reacts — it never calls into Game or
// changes how the game plays. That's deliberate: progression should reward
// skill and continued play without being able to touch competitive
// integrity, so it physically has no path to mutate gameplay.
//
// Persistence is a single JSON blob in localStorage. Saves are throttled
// (at most every few seconds) except at meaningful checkpoints — a new
// achievement, a new cosmetic unlock, or a level-up — which save
// immediately so a closed tab can never lose a milestone.

TETRIS.ProgressionManager = class ProgressionManager {
  constructor(storageKey) {
    this.storageKey = storageKey || 'tetris_progression_v1';

    this.totalXp = 0;
    this.unlockedItemIds = new Set();
    this.unlockedAchievementIds = new Set();
    this.equipped = {}; // category -> itemId
    this.stats = { lifetime: this._emptyStats(), session: this._emptyStats() };

    this._load();
    this._grantDefaultUnlocks();
    this._fillMissingEquips();

    // Per-frame observation state.
    this.prevRunId = 0;
    this.prevPiecesThisGame = 0;
    this.prevLastClearInfo = null;
    this.currentB2BStreak = 0;
    this.xpAwardedThisGame = 0;
    this.xpScoreCheckpointThisGame = 0;
    this.achievementsThisGame = [];

    // A queue the UI layer can drain to show "unlocked!" notifications —
    // populated here, never read or cleared except via drainNotifications().
    this._newlyUnlocked = [];

    this.dirty = false;
    this.saveTimer = 0;
  }

  _emptyStats() {
    return {
      bestScore: 0,
      bestGameLevel: 1,
      bestCombo: 0,
      bestBackToBackStreak: 0,
      totalLines: 0,
      totalTetrises: 0,
      totalTSpins: 0,
      totalPerfectClears: 0,
      totalPlayTimeMs: 0,
      totalPiecesPlaced: 0,
      gamesPlayed: 0,
    };
  }

  // --- XP / level ------------------------------------------------------

  get level() {
    return ProgressionManager.levelForTotalXp(this.totalXp);
  }

  get xpIntoCurrentLevel() {
    return this.totalXp - ProgressionManager.totalXpForLevel(this.level);
  }

  get xpForNextLevel() {
    return ProgressionManager.totalXpForLevel(this.level + 1) - ProgressionManager.totalXpForLevel(this.level);
  }

  static totalXpForLevel(level) {
    const { BASE, EXPONENT } = TETRIS.PROGRESSION_DATA.XP_CURVE;
    if (level <= 1) return 0;
    return Math.round(BASE * Math.pow(level - 1, EXPONENT));
  }

  static levelForTotalXp(totalXp) {
    if (!Number.isFinite(totalXp) || totalXp <= 0) return 1;
    let level = Math.max(1, Math.floor(Math.pow(totalXp / TETRIS.PROGRESSION_DATA.XP_CURVE.BASE, 1 / TETRIS.PROGRESSION_DATA.XP_CURVE.EXPONENT)) + 1);
    while (level > 1 && ProgressionManager.totalXpForLevel(level) > totalXp) level -= 1;
    while (ProgressionManager.totalXpForLevel(level + 1) <= totalXp) level += 1;
    return level;
  }

  addXp(amount) {
    if (!Number.isFinite(amount) || amount <= 0 || this.totalXp >= 1000000000) return;
    const levelBefore = this.level;
    this.totalXp = Math.min(1000000000, this.totalXp + Math.floor(amount));
    this.dirty = true;
    if (this.level > levelBefore) {
      this._newlyUnlocked.push({ type: 'level', level: this.level });
      this.save();
    }
  }

  // --- unlocks -----------------------------------------------------------

  isUnlocked(id) {
    return this.unlockedItemIds.has(id);
  }

  hasAchievement(id) {
    return this.unlockedAchievementIds.has(id);
  }

  getUnlockedByCategory(category) {
    return TETRIS.PROGRESSION_DATA.UNLOCKABLES.filter((u) => u.category === category && this.isUnlocked(u.id));
  }

  // Consumes and returns any unlock/level-up notifications queued since the
  // last call, so a UI layer can show them without polling internal state.
  drainNotifications() {
    const queued = this._newlyUnlocked;
    this._newlyUnlocked = [];
    return queued;
  }

  _grantDefaultUnlocks() {
    TETRIS.PROGRESSION_DATA.UNLOCKABLES.forEach((u) => {
      if (u.requirement.type === 'default') this.unlockedItemIds.add(u.id);
    });
  }

  // Every category always has *something* equipped — falls back to that
  // category's "default" item so a fresh profile (or one loaded before a
  // category existed) is never left without a valid look.
  _fillMissingEquips() {
    TETRIS.PROGRESSION_DATA.CATEGORIES.forEach((category) => {
      const current = this.equipped[category];
      const stillValid = current && this.isUnlocked(current) &&
        TETRIS.PROGRESSION_DATA.UNLOCKABLES.some((u) => u.id === current && u.category === category);
      if (stillValid) return;
      const fallback = TETRIS.PROGRESSION_DATA.UNLOCKABLES.find((u) => u.category === category && u.requirement.type === 'default');
      if (fallback) this.equipped[category] = fallback.id;
    });
  }

  // Returns false (and changes nothing) if the item isn't unlocked yet —
  // the Customization screen is expected to only ever offer unlocked items,
  // but this stays safe to call regardless.
  equip(itemId) {
    const item = TETRIS.PROGRESSION_DATA.UNLOCKABLES.find((u) => u.id === itemId);
    if (!item || !this.isUnlocked(itemId)) return false;
    this.equipped[item.category] = itemId;
    this.dirty = true;
    this.save();
    return true;
  }

  getEquipped(category) {
    const id = this.equipped[category];
    return TETRIS.PROGRESSION_DATA.UNLOCKABLES.find((u) => u.id === id) || null;
  }

  // What the renderer/CSS actually needs for a category right now — the
  // equipped item's `apply` block, e.g. { colors: {...} } for pieceSkins.
  getAppliedData(category) {
    const item = this.getEquipped(category);
    return item ? item.apply : null;
  }

  _meetsRequirement(req) {
    switch (req.type) {
      case 'default': return true;
      case 'level': return this.level >= req.value;
      case 'stat': return (this.stats.lifetime[req.stat] || 0) >= req.value;
      case 'achievement': return this.hasAchievement(req.id);
      default: return false;
    }
  }

  _checkUnlocksAndAchievements() {
    TETRIS.PROGRESSION_DATA.ACHIEVEMENTS.forEach((a) => {
      if (this.hasAchievement(a.id)) return;
      if (!this._meetsRequirement(a.requirement)) return;
      this.unlockedAchievementIds.add(a.id);
      if (a.rewardXp) this.addXp(a.rewardXp);
      this.achievementsThisGame.push(a.id);
      this._newlyUnlocked.push({ type: 'achievement', id: a.id, name: a.name, description: a.description });
      this.save();
    });

    TETRIS.PROGRESSION_DATA.UNLOCKABLES.forEach((u) => {
      if (this.isUnlocked(u.id)) return;
      if (!this._meetsRequirement(u.requirement)) return;
      this.unlockedItemIds.add(u.id);
      this._newlyUnlocked.push({ type: 'item', id: u.id, name: u.name, category: u.category });
      this.save();
    });
  }

  // --- stat recording ------------------------------------------------------

  _recordStat(key, delta) {
    this.stats.lifetime[key] = (this.stats.lifetime[key] || 0) + delta;
    this.stats.session[key] = (this.stats.session[key] || 0) + delta;
    this.dirty = true;
  }

  _recordBest(key, value) {
    if (value > this.stats.lifetime[key]) {
      this.stats.lifetime[key] = value;
      this.dirty = true;
    }
    if (value > this.stats.session[key]) this.stats.session[key] = value;
  }

  // --- per-frame observation -------------------------------------------

  update(dt, game) {
    const isNewGame = game.runId !== this.prevRunId;
    if (isNewGame) {
      this.prevRunId = game.runId;
      this.xpAwardedThisGame = 0;
      this.xpScoreCheckpointThisGame = 0;
      this.currentB2BStreak = 0;
      this.achievementsThisGame = [];
      this.prevPiecesThisGame = 0;
      this._recordStat('gamesPlayed', 1);
    }

    const runCanSetRecords = game.runId > 0 &&
      (game.state === TETRIS.GameState.PLAYING || game.state === TETRIS.GameState.GAME_OVER);
    if (game.state === TETRIS.GameState.PLAYING) this._recordStat('totalPlayTimeMs', dt);
    if (runCanSetRecords) {
      // Continuous XP trickle tied to score-so-far this game, rather than
      // a single lump sum at game over — so very long games (or ones that
      // never end) still earn XP in real time.
      const earnedXp = Math.floor(game.scoring.score / TETRIS.PROGRESSION_DATA.XP_PER_SCORE_POINT);
      if (earnedXp > this.xpScoreCheckpointThisGame) {
        const newXp = earnedXp - this.xpScoreCheckpointThisGame;
        this.addXp(newXp);
        this.xpAwardedThisGame += newXp;
        this.xpScoreCheckpointThisGame = earnedXp;
      }

      this._recordBest('bestScore', game.scoring.score);
      this._recordBest('bestGameLevel', game.scoring.level);
      if (game.scoring.comboCount > 0) this._recordBest('bestCombo', game.scoring.comboCount);
    }

    // Count the game's lock counter delta. Looking for a one-frame null
    // activePiece misses ordinary locks because the next piece spawns in the
    // same call; the clear-animation path only made that bug intermittent.
    const piecesPlaced = Math.max(0, game.piecesThisGame - this.prevPiecesThisGame);
    if (piecesPlaced > 0) this._recordStat('totalPiecesPlaced', piecesPlaced);
    this.prevPiecesThisGame = game.piecesThisGame;

    // React to each newly-resolved clear exactly once.
    if (game.lastClearInfo && game.lastClearInfo !== this.prevLastClearInfo) {
      this.prevLastClearInfo = game.lastClearInfo;
      const info = game.lastClearInfo;
      if (info.linesCleared > 0) {
        this._recordStat('totalLines', info.linesCleared);
        const isDifficult = info.linesCleared === 4 || !!info.tSpinType;
        this.currentB2BStreak = isDifficult ? this.currentB2BStreak + 1 : 0;
        this._recordBest('bestBackToBackStreak', this.currentB2BStreak);
      }
      if (info.linesCleared === 4) this._recordStat('totalTetrises', 1);
      if (info.tSpinType) this._recordStat('totalTSpins', 1);
      if (info.isPerfectClear) this._recordStat('totalPerfectClears', 1);
    }

    this._checkUnlocksAndAchievements();

    this.saveTimer += dt;
    if (this.dirty && this.saveTimer > 3000) {
      this.save();
      this.saveTimer = 0;
    }
  }

  // --- persistence -------------------------------------------------------

  _load() {
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || Array.isArray(data)) return;
      this.totalXp = Number.isFinite(data.totalXp) ? Math.floor(Math.max(0, Math.min(1000000000, data.totalXp))) : 0;
      const itemIds = new Set(TETRIS.PROGRESSION_DATA.UNLOCKABLES.map((item) => item.id));
      const achievementIds = new Set(TETRIS.PROGRESSION_DATA.ACHIEVEMENTS.map((item) => item.id));
      this.unlockedItemIds = new Set(Array.isArray(data.unlockedItemIds) ? data.unlockedItemIds.filter((id) => itemIds.has(id)) : []);
      this.unlockedAchievementIds = new Set(Array.isArray(data.unlockedAchievementIds) ? data.unlockedAchievementIds.filter((id) => achievementIds.has(id)) : []);
      this.equipped = data.equipped && typeof data.equipped === 'object' && !Array.isArray(data.equipped) ? data.equipped : {};
      const defaults = this._emptyStats();
      const storedStats = data.lifetimeStats && typeof data.lifetimeStats === 'object' ? data.lifetimeStats : {};
      Object.keys(defaults).forEach((key) => {
        const value = storedStats[key];
        defaults[key] = Number.isFinite(value) && value >= 0 ? value : defaults[key];
      });
      defaults.bestGameLevel = Math.max(1, defaults.bestGameLevel);
      this.stats.lifetime = defaults;
    } catch (err) {
      // Corrupt data, storage disabled, or a strict file:// origin that
      // blocks it — start fresh rather than let progression break the game.
      console.warn('Progression: could not load saved progress, starting fresh.', err);
    }
  }

  save() {
    try {
      const payload = {
        totalXp: this.totalXp,
        unlockedItemIds: Array.from(this.unlockedItemIds),
        unlockedAchievementIds: Array.from(this.unlockedAchievementIds),
        equipped: this.equipped,
        lifetimeStats: this.stats.lifetime,
      };
      window.localStorage.setItem(this.storageKey, JSON.stringify(payload));
      this.dirty = false;
      return true;
    } catch (err) {
      console.warn('Progression: could not save progress.', err);
      return false;
    }
  }

  // Resets earned progression without touching settings, key bindings, or
  // per-mode records. Run observation cursors stay in place so a reset made
  // while paused cannot recount the current game or award XP for its old score.
  resetProfile(game = null) {
    this.totalXp = 0;
    this.unlockedItemIds = new Set();
    this.unlockedAchievementIds = new Set();
    this.equipped = {};
    this.stats = { lifetime: this._emptyStats(), session: this._emptyStats() };
    this._grantDefaultUnlocks();
    this._fillMissingEquips();

    this.currentB2BStreak = 0;
    this.xpAwardedThisGame = 0;
    this.xpScoreCheckpointThisGame = game && game.scoring && Number.isFinite(game.scoring.score)
      ? Math.floor(Math.max(0, game.scoring.score) / TETRIS.PROGRESSION_DATA.XP_PER_SCORE_POINT)
      : 0;
    this.achievementsThisGame = [];
    this._newlyUnlocked = [];
    this.saveTimer = 0;
    this.dirty = true;
    // Free the old entry first so a nearly full storage quota cannot prevent
    // a reset from replacing a larger, previously earned profile.
    try {
      window.localStorage.removeItem(this.storageKey);
    } catch (err) {
      console.warn('Progression: could not clear the saved profile before reset.', err);
    }
    return this.save();
  }
};
