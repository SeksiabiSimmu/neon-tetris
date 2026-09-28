# Code map

Use this map to open the few files relevant to a change instead of reading the repository from top to bottom.

| Change | Start here | Boundary |
| --- | --- | --- |
| Movement, rotation, hold, lock, line clear | `game.js`, `board.js`, `piece.js`, `input.js`, `scoring.js` | Gameplay owns rules and timing. Rendering only observes them. |
| Mode objectives and records | `gameModes.js`, `modeRecords.js` | Every mode uses the same gameplay engine. |
| Unlocks and saves | `progressionData.js`, `progressionManager.js`, `settingsManager.js` | Saved settings, records, and progression have separate storage keys. |
| Menus and HUD | `uiShell.js`, `src/ui/SettingsPanel.js`, `uiAnimator.js`, `index.html`, `styles.css` | DOM owns keyboard-accessible controls and text. |
| Canvas fallback | `renderer.js`, `backgroundRenderer.js`, `effectsManager.js` | Keep fallback legible when WebGL is unavailable. |
| 3D presentation | `src/rendering/PremiumSceneRenderer.js`, `src/rendering/BoardEffects3D.js`, `src/rendering/modeWorlds.js` | The scene reads game state; it never changes scoring or collision. |
| Gameplay reactions | `src/rendering/gameplaySignals.js` | Canvas and 3D renderers keep independent cursors over the same read-only signals. |
| Startup and desktop | `src/entry.js`, `main.js`, `desktop/main.cjs`, `vite.config.js` | Vite bundles local assets; Electron loads the built page. |

## Current module boundary

`src/entry.js` imports the older scripts in dependency order. Those scripts register on `window.TETRIS`. New presentation code can use ES modules and receive dependencies in its constructor. `uiShell.js` and `backgroundRenderer.js` are examples: they register their public classes for the legacy bootstrap while importing focused ES modules. Convert other files only when a change benefits from it; avoid a simultaneous rewrite of the gameplay engine and its VM-based checks.

`main.js` composes input, audio, game, progression, settings, menu, and the Canvas renderer. The 3D renderer is optional and the Canvas renderer remains available on WebGL failure. `game.js` is the authority for simulation. A visual change should consume `collectGameplayEvents` or read game state, never write into the game to trigger an effect.

## Safe edit path

1. Find the row above that owns the requested behavior.
2. Read that module, its direct consumers, and the relevant checks under `tests/`.
3. Preserve the public game rules and the existing localStorage keys unless the task explicitly changes them.
4. Keep new files focused on one screen or rendering responsibility; pass collaborators explicitly rather than adding another global.
