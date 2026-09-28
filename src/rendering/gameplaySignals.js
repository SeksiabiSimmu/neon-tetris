/** Observe gameplay without mutating simulation state. Each renderer keeps its own cursor. */
export function collectGameplayEvents(game, cursor) {
  const snapshot = readSnapshot(game);
  if (!cursor || cursor.runId !== snapshot.runId) {
    return { events: [], cursor: snapshot };
  }

  const events = [];
  const previous = cursor.activePiece;
  const active = snapshot.activePiece;
  if (active && previous && snapshot.pieceRef === cursor.pieceRef) {
    if (active.col !== previous.col) events.push({ type: 'move', detail: active });
    if (active.rotation !== previous.rotation) events.push({ type: 'rotate', detail: active });
    if (active.row !== previous.row) events.push({ type: 'fall', detail: { ...active, isSoftDropping: snapshot.isSoftDropping } });
  } else if (active && snapshot.pieceRef !== cursor.pieceRef) {
    events.push({ type: 'spawn', detail: active });
  }

  if (!cursor.isSoftDropping && snapshot.isSoftDropping) events.push({ type: 'softDrop', detail: active });
  if (snapshot.holdType !== cursor.holdType || (cursor.canHold && !snapshot.canHold)) {
    events.push({ type: 'hold', detail: { holdType: snapshot.holdType, canHold: snapshot.canHold } });
  }

  if (snapshot.hardDropId !== cursor.hardDropId && snapshot.hardDrop) {
    events.push({ type: 'hardDrop', detail: snapshot.hardDrop });
  }
  if (snapshot.lockId !== cursor.lockId && snapshot.lock) {
    events.push({ type: 'lock', detail: snapshot.lock });
  }

  if (snapshot.clearInfo && snapshot.clearInfo !== cursor.clearInfo) {
    const clear = snapshot.clearInfo;
    events.push({ type: 'clear', detail: clear });
    if (clear.tSpinType) events.push({ type: 'tSpin', detail: clear });
    if (clear.comboCount > 0) events.push({ type: 'combo', detail: clear });
    if (clear.backToBackApplied) events.push({ type: 'backToBack', detail: clear });
    if (clear.isPerfectClear) events.push({ type: 'perfectClear', detail: clear });
    if (clear.leveledUp) events.push({ type: 'levelUp', detail: clear });
  }
  if (snapshot.level > cursor.level && !events.some((event) => event.type === 'levelUp')) {
    events.push({ type: 'levelUp', detail: { level: snapshot.level } });
  }

  return { events, cursor: snapshot };
}

function readSnapshot(game) {
  const active = game.activePiece;
  return {
    runId: game.runId,
    level: game.scoring?.level ?? 1,
    pieceRef: active || null,
    activePiece: active ? {
      type: active.type,
      col: active.col,
      row: active.row,
      rotation: active.rotation,
    } : null,
    isSoftDropping: !!game.isSoftDropping,
    holdType: game.holdType ?? null,
    canHold: !!game.canHold,
    hardDropId: game.lastHardDropEvent?.id ?? null,
    hardDrop: game.lastHardDropEvent || null,
    lockId: game.lastLockEvent?.id ?? null,
    lock: game.lastLockEvent || null,
    clearInfo: game.lastClearInfo || null,
  };
}
