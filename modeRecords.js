// js/modeRecords.js
//
// Personal records, scoped per mode and — where a mode has configurable
// variants (Sprint's target line count, Time Attack's time limit,
// Challenge's specific objective) — per configuration too, since a 20-line
// Sprint record and a 100-line Sprint record aren't comparable. Separate
// from ProgressionManager's lifetime stats, which are global across every
// mode; this is "your best at this specific thing."

TETRIS.ModeRecords = class ModeRecords {
  constructor(storageKey) {
    this.storageKey = storageKey || 'tetris_records_v1';
    this.records = {}; // modeId -> { [key]: { value, extra, achievedAt } }
    this._load();
  }

  get(modeId, key) {
    return (this.records[modeId] && this.records[modeId][key]) || null;
  }

  // Compares `value` against the stored record for modeId/key and updates
  // it if better. Returns { isNewRecord, previous } so the caller can
  // decide whether to celebrate.
  submit(modeId, key, value, betterWhenLower, extra) {
    if (typeof modeId !== 'string' || typeof key !== 'string' || !Number.isFinite(value)) {
      return { isNewRecord: false, previous: null };
    }
    if (!this.records[modeId]) this.records[modeId] = {};
    const existing = this.records[modeId][key];
    const isBetter = !existing || (betterWhenLower ? value < existing.value : value > existing.value);
    const previous = existing ? existing.value : null;

    if (isBetter) {
      this.records[modeId][key] = { value, extra: extra || {}, achievedAt: Date.now() };
      this.save();
    }
    return { isNewRecord: isBetter, previous };
  }

  _load() {
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (raw) {
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object' || Array.isArray(data)) return;
        const clean = {};
        Object.entries(data).forEach(([modeId, modeRecords]) => {
          if (!TETRIS.GAME_MODES[modeId] || !modeRecords || typeof modeRecords !== 'object' || Array.isArray(modeRecords)) return;
          clean[modeId] = {};
          Object.entries(modeRecords).forEach(([key, record]) => {
            if (!record || typeof record !== 'object' || !Number.isFinite(record.value)) return;
            clean[modeId][key] = {
              value: record.value,
              extra: record.extra && typeof record.extra === 'object' && !Array.isArray(record.extra) ? record.extra : {},
              achievedAt: Number.isFinite(record.achievedAt) ? record.achievedAt : 0,
            };
          });
        });
        this.records = clean;
      }
    } catch (err) {
      console.warn('ModeRecords: could not load saved records, starting fresh.', err);
    }
  }

  save() {
    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(this.records));
    } catch (err) {
      console.warn('ModeRecords: could not save records.', err);
    }
  }
};
