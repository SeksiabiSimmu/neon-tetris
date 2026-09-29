import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('short desktop viewports keep the whole board and control hints in view', () => {
  const compactViewport = css.match(/@media\s*\(max-height:\s*790px\)[^{]*\{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.ok(compactViewport, 'a compact-height layout should be defined');
  assert.match(compactViewport, /#board-canvas\s*\{[^}]*height:[^;]+!important/);
  assert.match(compactViewport, /canvas#next-canvas\s*\{[^}]*height:/);
  assert.match(compactViewport, /\.game-wrap\s*\{[^}]*gap:/);
  assert.match(compactViewport, /\.controls-hint\s*\{[^}]*font-size:/);
});

test('game-over stats span the dialog and collapse cleanly on narrow screens', () => {
  const responsive = css.match(/@media\s*\(max-width:\s*460px\)[^{]*\{([\s\S]*?)\n\}/)?.[1] ?? '';
  const statRow = css.match(/\.game-over-stats\s*>\s*div\s*\{([^}]+)\}/)?.[1] ?? '';
  assert.match(responsive, /\.game-over-stats\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(statRow, /min-width:\s*0/);
});
