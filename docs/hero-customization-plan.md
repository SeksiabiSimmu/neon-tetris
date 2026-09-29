# Hero assets and customization pass

1. Keep the existing gameplay and save model. Refine Marathon's planetary form and Zen's garden using authored large shapes and surface treatments that remain legible at the gameplay camera.
2. Give the existing material rewards distinct face structures using one shared block appearance module for gameplay and the inspector. Preserve every unlock ID and requirement.
3. Replace the long swatch grid with category navigation, a browsable collection, and a larger inspector. Browsing changes temporary preview state; only Equip writes progression.
4. Render one live representative world and all seven piece types in the inspector. Reuse `createModeWorld`, the board geometry, and appearance data. Pause its animation when hidden, respect reduced motion, and dispose the context and world on exit.
5. Verify matched gameplay views, locked/equipped behavior, keyboard access, clean and existing saves, compact layouts, repeated opening, build, and relevant tests.

Baseline: 45 existing tests pass. In matched 1600×1000 captures, Marathon's planet has little recognizable surface organization and Zen's garden is too dark; customization shows only color swatches and immediately equips unlocked items.
