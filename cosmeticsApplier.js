// js/cosmeticsApplier.js
//
// The one bridge between the meta-game layer and the rendering layer.
// Everything else in progression stays purely observational (see
// progressionManager.js's own comment) — this file is the deliberate,
// narrow exception: it *reads* what's equipped and pushes the resulting
// colors/shapes into Renderer and a couple of CSS custom properties.
// Nothing here can affect scoring, timing, or any rule — only appearance.

TETRIS.applyCosmetics = function applyCosmetics(renderer, progression) {
  const pieceSkin = progression.getAppliedData('pieceSkins');
  if (pieceSkin) {
    renderer.setPieceColors(pieceSkin.colors);
    renderer._lastAppliedSkinColors = pieceSkin.colors;
  }

  const blockMaterial = progression.getAppliedData('blockMaterials');
  if (blockMaterial) renderer.setBlockMaterial(blockMaterial);

  const boardTheme = progression.getAppliedData('boardThemes');
  if (boardTheme) renderer.setBoardTheme(boardTheme);

  const background = progression.getAppliedData('backgrounds');
  if (background) renderer.setBackgroundPalette(background.nebulaColors, background.style);

  const particles = progression.getAppliedData('particleEffects');
  if (particles) renderer.setAmbientParticles(particles.ambientColors, particles.shape);

  const clearEffect = progression.getAppliedData('clearEffects');
  if (clearEffect) renderer.setClearEffect(clearEffect);

  const uiTheme = progression.getAppliedData('uiThemes');
  if (uiTheme) {
    document.documentElement.style.setProperty('--accent', uiTheme.accent);
    document.documentElement.style.setProperty('--accent-dim', uiTheme.accentDim);
  }
};
