import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLegacyContext } from './helpers/legacyContext.js';

test('reset profile clears progression while preserving player settings and mode records', () => {
  const app = loadLegacyContext('constants.js', 'progressionData.js', 'progressionManager.js');
  const settings = JSON.stringify({ masterVolume: 41, keyBindings: { KeyA: 'left' } });
  const records = JSON.stringify({ endless: { bestScore: 4321 } });
  app.localStorage.setItem('tetris_settings_v1', settings);
  app.localStorage.setItem('tetris_records_v1', records);

  const profile = new app.TETRIS.ProgressionManager('tetris_progression_v1');
  profile.totalXp = 8420;
  profile.unlockedAchievementIds.add('ach_test');
  profile.stats.lifetime.totalLines = 900;
  profile.currentB2BStreak = 4;
  profile.xpAwardedThisGame = 20;
  const game = { scoring: { score: 500 } };

  assert.equal(profile.resetProfile(game), true);
  assert.equal(profile.totalXp, 0);
  assert.deepEqual(Array.from(profile.unlockedAchievementIds), []);
  assert.equal(profile.stats.lifetime.totalLines, 0);
  assert.equal(profile.currentB2BStreak, 0);
  assert.equal(profile.xpAwardedThisGame, 0);
  assert.equal(profile.xpScoreCheckpointThisGame, Math.floor(500 / app.TETRIS.PROGRESSION_DATA.XP_PER_SCORE_POINT));
  assert.equal(app.localStorage.getItem('tetris_settings_v1'), settings);
  assert.equal(app.localStorage.getItem('tetris_records_v1'), records);

  const savedProfile = JSON.parse(app.localStorage.getItem('tetris_progression_v1'));
  assert.equal(savedProfile.totalXp, 0);
  assert.equal(savedProfile.lifetimeStats.totalLines, 0);
});
