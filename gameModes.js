// js/gameModes.js
//
// Every mode plugs into the SAME core engine (Board/Piece/Scoring/rotation/
// kicks/lock delay never change) through this one small, consistent
// interface. Game calls into whichever mode is active at a few well-defined
// points; a mode only implements the hooks it actually needs — anything
// omitted just falls through to the normal Endless behavior. Adding a new
// mode later means adding one entry here, not touching game.js.
//
// Hook contract (all optional):
//   onStart(game, config)                        — set up game.modeState
//   getGravityOverride(game, config, baseMs)      — return ms to override gravity, or null/undefined to keep it
//   onClearResolved(game, config, clearInfo)      — called right after a clear (or 0-line T-spin) resolves
//   checkEndCondition(game, config)               — return {result, reason} to end the run, or null/undefined to continue
//   onTopOut(game, config)                        — return {preventGameOver:true} to intercept a would-be game over
//   recoverFromTopOut(game, config)                — only called when onTopOut prevented it; must leave the board playable
//   getRecordSubmission(game, config)              — return {key, value, betterWhenLower, extra} to log a personal record, or null for none
//
// `result` from checkEndCondition/topout handling is one of:
//   'win' | 'lose' | 'timeout' | 'topout' — purely presentational (decides
//   the Game Over screen's title), never affects scoring itself.

window.TETRIS = window.TETRIS || {};

TETRIS.CHALLENGES = [
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Achieve a Perfect Clear within 3 minutes.',
    timeLimitMs: 180000,
    checkWin(game) { return !!(game.lastClearInfo && game.lastClearInfo.isPerfectClear); },
  },
  {
    id: 'tspin_trial',
    name: 'T-Spin Trial',
    description: 'Land 3 T-spins (mini or full) within 2 minutes.',
    timeLimitMs: 120000,
    onStart(game) { game.modeState.tSpinCount = 0; },
    onClearResolved(game, clearInfo) { if (clearInfo.tSpinType) game.modeState.tSpinCount += 1; },
    checkWin(game) { return game.modeState.tSpinCount >= 3; },
  },
  {
    id: 'flawless_ten',
    name: 'Flawless Ten',
    description: 'Clear 10 lines without creating a single hole. One mistake ends the run.',
    timeLimitMs: null,
    checkWin(game) { return game.scoring.lines >= 10; },
    checkLoss(game) { return game.mistakesThisGame > 0; },
  },
];

TETRIS.GAME_MODES = {
  endless: {
    id: 'endless',
    name: 'Endless',
    tagline: 'Classic marathon — no end but topping out.',
    accent: '#4dd8ff',
    defaultConfig: {},
    hudFields: ['combo', 'backToBack'],
    tracksRecords: true,
    getRecordSubmission(game) {
      return { key: 'default', value: game.scoring.score, betterWhenLower: false, extra: { level: game.scoring.level } };
    },
  },

  sprint: {
    id: 'sprint',
    name: 'Sprint',
    tagline: 'Clear the target lines as fast as you can.',
    accent: '#ff9a4d',
    defaultConfig: { targetLines: 40 },
    configOptions: { targetLines: [20, 40, 100] },
    hudFields: ['timer', 'linesRemaining'],
    tracksRecords: true,
    checkEndCondition(game, config) {
      if (game.scoring.lines >= config.targetLines) return { result: 'win', reason: `${config.targetLines} lines cleared!` };
      return null;
    },
    getRecordSubmission(game, config) {
      if (game.result !== 'win') return null;
      return {
        key: String(config.targetLines),
        value: game.modeTimer,
        betterWhenLower: true,
        extra: { pieces: game.piecesThisGame, mistakes: game.mistakesThisGame },
      };
    },
  },

  marathon: {
    id: 'marathon',
    name: 'Marathon',
    tagline: 'A long run with gravity speed capped at your chosen level.',
    accent: '#4d7bff',
    defaultConfig: { maxLevel: 15 },
    configOptions: { maxLevel: [10, 15, 20] },
    hudFields: ['combo', 'backToBack'],
    tracksRecords: true,
    getGravityOverride(game, config, baseIntervalForLevel) {
      const cappedLevel = Math.min(game.scoring.level, config.maxLevel);
      return game.scoring.gravityIntervalForLevel(cappedLevel);
    },
    getRecordSubmission(game, config) {
      return { key: String(config.maxLevel), value: game.scoring.score, betterWhenLower: false, extra: { level: game.scoring.level } };
    },
  },

  timeAttack: {
    id: 'timeAttack',
    name: 'Time Attack',
    tagline: 'Score as much as you can before time runs out.',
    accent: '#ff4d6a',
    defaultConfig: { timeLimitMs: 120000 },
    configOptions: { timeLimitMs: [60000, 120000, 180000] },
    hudFields: ['timer', 'combo'],
    tracksRecords: true,
    checkEndCondition(game, config) {
      if (game.modeTimer >= config.timeLimitMs) return { result: 'timeout', reason: "Time's up!" };
      return null;
    },
    getRecordSubmission(game, config) {
      return { key: String(config.timeLimitMs), value: game.scoring.score, betterWhenLower: false, extra: {} };
    },
  },

  zen: {
    id: 'zen',
    name: 'Zen',
    tagline: 'Relaxed, slower-paced play with no game over.',
    accent: '#43e07a',
    defaultConfig: { gravityMultiplier: 2.2 },
    configOptions: { gravityMultiplier: [1.5, 2.2, 3.5] },
    hudFields: [],
    tracksRecords: false, // deliberate — Zen is explicitly pressure-free, so it keeps no leaderboard
    getGravityOverride(game, config, baseIntervalForLevel) {
      return Math.round(baseIntervalForLevel * config.gravityMultiplier);
    },
    onTopOut() {
      return { preventGameOver: true };
    },
    recoverFromTopOut(game) {
      // Reuse the existing clear-flash visual instead of an instant, jarring
      // reset: mark the whole board as "clearing" and let resolveClear()
      // (which special-cases zenClearing) handle the actual reset once the
      // flash finishes. Score/lines/level keep accumulating — only the
      // board itself clears.
      game.zenClearing = true;
      game.clearingRows = Array.from({ length: game.board.rows }, (_, i) => i);
      game.clearTimer = 0;
      game._pendingTSpinType = null;
      game.activePiece = null;
    },
  },

  challenge: {
    id: 'challenge',
    name: 'Challenge',
    tagline: 'Predefined objectives with their own win condition.',
    accent: '#c65bff',
    defaultConfig: { challengeId: TETRIS.CHALLENGES[0].id },
    hudFields: ['timer', 'objective'],
    tracksRecords: true,
    onStart(game, config) {
      const challenge = TETRIS.CHALLENGES.find((c) => c.id === config.challengeId) || TETRIS.CHALLENGES[0];
      game.modeState.challenge = challenge;
      if (challenge.onStart) challenge.onStart(game);
    },
    onClearResolved(game, config, clearInfo) {
      const challenge = game.modeState.challenge;
      if (challenge && challenge.onClearResolved) challenge.onClearResolved(game, clearInfo);
    },
    checkEndCondition(game) {
      const challenge = game.modeState.challenge;
      if (!challenge) return null;
      if (challenge.checkWin(game)) return { result: 'win', reason: `${challenge.name} complete!` };
      if (challenge.checkLoss && challenge.checkLoss(game)) return { result: 'lose', reason: 'Objective failed.' };
      if (challenge.timeLimitMs && game.modeTimer >= challenge.timeLimitMs) return { result: 'timeout', reason: "Time's up." };
      return null;
    },
    getRecordSubmission(game, config) {
      const challenge = game.modeState.challenge;
      if (!challenge || game.result !== 'win') return null;
      return { key: config.challengeId, value: game.modeTimer, betterWhenLower: true, extra: {} };
    },
  },
};
