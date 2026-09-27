import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../uiShell.js', import.meta.url), 'utf8');

test('locked customization choices keep names and unlock requirements readable', () => {
  const lockedCard = css.match(/\.cosmetic-card\.is-locked\s*\{([^}]+)\}/)?.[1] ?? '';
  assert.ok(lockedCard, 'locked card styles should remain explicit');
  assert.doesNotMatch(lockedCard, /opacity\s*:/, 'avoid dimming the entire label and requirement');
  assert.match(css, /\.cosmetic-card\.is-locked\s+\.cosmetic-card__name\s*\{[^}]*color:\s*var\(--text-primary\)/);
  assert.match(css, /\.cosmetic-card\.is-locked\s+\.cosmetic-card__state\s*\{[^}]*color:/);
  assert.match(shell, /data-unlocked="\$\{unlocked\}"\s+\$\{unlocked\s*\?\s*''\s*:\s*'disabled'\}/);
});
