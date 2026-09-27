import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const appModule = await import('../src/launchApp.js').catch(() => ({}));

test('launchApp passes the scene renderer into the existing TETRIS boot once', () => {
  let receivedClass = null;
  let callCount = 0;
  const tetris = {
    boot(rendererClass) {
      callCount += 1;
      receivedClass = rendererClass;
      return 'started';
    },
  };
  class PremiumSceneRenderer {}

  assert.equal(appModule.launchApp(tetris, PremiumSceneRenderer), 'started');
  assert.equal(receivedClass, PremiumSceneRenderer);
  assert.equal(callCount, 1);
});

test('HTML loads one Vite entry and keeps the display font local', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<canvas id="scene-canvas" aria-hidden="true"><\/canvas>/);
  assert.match(html, /<script type="module" src="\/src\/entry\.js"><\/script>/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
});

test('Vite entry preserves existing game script dependency order before boot', async () => {
  const entryPath = fileURLToPath(new URL('../src/entry.js', import.meta.url));
  const entry = await readFile(entryPath, 'utf8').catch(() => '');
  const orderedScripts = [
    'constants.js', 'gameState.js', 'piece.js', 'pieceQueue.js', 'board.js',
    'scoring.js', 'input.js', 'glowRenderer.js', 'particleRenderer.js',
    'backgroundRenderer.js', 'effectsManager.js', 'audioEffects.js',
    'uiAnimator.js', 'renderer.js', 'gameModes.js', 'game.js',
    'progressionData.js', 'progressionManager.js', 'settingsManager.js',
    'modeRecords.js', 'cosmeticsApplier.js', 'uiShell.js', 'main.js',
  ];
  const positions = orderedScripts.map((name) => entry.indexOf(name));
  assert.ok(positions.every((position) => position >= 0), 'every existing game script must be imported');
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});
