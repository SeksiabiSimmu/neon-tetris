import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../uiShell.js', import.meta.url), 'utf8');

test('locked customization choices remain browsable while Equip is gated', () => {
  const lockedCard = css.match(/\.cosmetic-card\.is-locked\s*\{([^}]+)\}/)?.[1] ?? '';
  assert.ok(lockedCard, 'locked card styles should remain explicit');
  assert.match(lockedCard, /opacity:\s*1/, 'keep the locked choice fully readable');
  assert.match(css, /\.cosmetic-card\.is-locked\s+\.cosmetic-card__name\s*\{[^}]*color:\s*var\(--text-primary\)/);
  assert.match(css, /\.cosmetic-card\.is-locked\s+\.cosmetic-card__state\s*\{[^}]*color:/);
  assert.match(shell, /aria-label="\$\{item.name\}, \$\{state\}"/);
  assert.match(shell, /equip\.disabled = !unlocked \|\| equipped/);
  assert.match(shell, /if \(!this\.progression\.equip\(id\)\) return/);
});
