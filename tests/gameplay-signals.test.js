import test from 'node:test';
import assert from 'node:assert/strict';
import { collectGameplayEvents } from '../src/rendering/gameplaySignals.js';

function createGame() {
  return {
    runId: 1,
    state: 'PLAYING',
    activePiece: { type: 'T', col: 3, row: 0, rotation: 0 },
    isSoftDropping: false,
    holdType: null,
    canHold: true,
    lastHardDropEvent: null,
    lastLockEvent: null,
    lastClearInfo: null,
  };
}

test('emits active-piece controls once and does not mutate game state', () => {
  const game = createGame();
  const initial = structuredClone(game);
  const seeded = collectGameplayEvents(game, null);
  assert.deepEqual(seeded.events, []);

  game.activePiece.col += 1;
  let result = collectGameplayEvents(game, seeded.cursor);
  assert.deepEqual(result.events.map((event) => event.type), ['move']);
  game.activePiece.rotation = 1;
  result = collectGameplayEvents(game, result.cursor);
  assert.deepEqual(result.events.map((event) => event.type), ['rotate']);
  game.isSoftDropping = true;
  result = collectGameplayEvents(game, result.cursor);
  assert.deepEqual(result.events.map((event) => event.type), ['softDrop']);
  assert.deepEqual(initial, {
    runId: 1, state: 'PLAYING', activePiece: { type: 'T', col: 3, row: 0, rotation: 0 },
    isSoftDropping: false, holdType: null, canHold: true,
    lastHardDropEvent: null, lastLockEvent: null, lastClearInfo: null,
  });
});

test('deduplicates hard drops, locks, clears, and all clear detail signals', () => {
  const game = createGame();
  let { cursor } = collectGameplayEvents(game, null);
  game.lastHardDropEvent = { id: 1, type: 'T', row: 16 };
  game.lastLockEvent = { id: 1, type: 'T', row: 16 };
  const clearInfo = {
    linesCleared: 4,
    tSpinType: 'full',
    comboCount: 2,
    backToBackApplied: true,
    isPerfectClear: true,
    leveledUp: true,
  };
  game.lastClearInfo = clearInfo;
  let result = collectGameplayEvents(game, cursor);
  assert.deepEqual(result.events.map((event) => event.type), [
    'hardDrop', 'lock', 'clear', 'tSpin', 'combo', 'backToBack', 'perfectClear', 'levelUp',
  ]);
  assert.equal(result.events.find((event) => event.type === 'clear').detail, clearInfo);

  cursor = result.cursor;
  result = collectGameplayEvents(game, cursor);
  assert.deepEqual(result.events, []);
});

test('a new run seeds current state instead of replaying stale events', () => {
  const game = createGame();
  const seeded = collectGameplayEvents(game, null);
  game.lastHardDropEvent = { id: 1 };
  const afterDrop = collectGameplayEvents(game, seeded.cursor);
  assert.deepEqual(afterDrop.events.map((event) => event.type), ['hardDrop']);

  game.runId = 2;
  game.lastHardDropEvent = { id: 0 };
  const nextRun = collectGameplayEvents(game, afterDrop.cursor);
  assert.deepEqual(nextRun.events, []);
  assert.equal(nextRun.cursor.runId, 2);
});
