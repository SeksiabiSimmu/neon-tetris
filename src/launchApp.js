export function launchApp(tetris, PremiumSceneRendererClass) {
  if (!tetris || typeof tetris.boot !== 'function') {
    throw new TypeError('TETRIS.boot must be defined before the app can start.');
  }
  return tetris.boot(PremiumSceneRendererClass);
}
