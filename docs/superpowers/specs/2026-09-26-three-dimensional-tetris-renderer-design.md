# Premium 3D Tetris Renderer

**Status:** Approved by user  
**Date:** 2026-09-26

## Goal

Give the existing Tetris game a cohesive, premium futuristic presentation with real-time 3D mode environments and block materials, while preserving all game rules, controls, progression, and DOM-based interface behavior.

## Existing project boundary

The project currently runs as ordered browser scripts and can be opened directly as `index.html`. `main.js` creates 2D contexts for the full-screen background, board, hold, and next canvases; `TETRIS.Renderer` draws the board, previews, effects, and mode-aware background. The game model exposes the active piece, board, scoring, current mode, level, and event records for hard drops, locks, and clears. Six modes are defined in `gameModes.js`. Cosmetic categories and equipped-item fallback are data-driven in `progressionData.js` and `progressionManager.js`; settings already expose reduced motion, colorblind mode, screen shake, particle intensity, glow intensity, and graphics quality.

## Approved design

### Rendering architecture

- Add Vite scripts and bundle Three.js and the display font locally. Runtime rendering must not depend on a CDN or external art service.
- Add a Three.js rendering adapter that reads existing game state and renders the 3D scene. The game model remains the source of truth; the adapter does not simulate or modify gameplay.
- Render one full-window WebGL scene with a square-on, legible playfield. Position the board and next/hold previews from the existing layout, while leaving DOM HUD, menus, overlays, settings, and input targets intact.
- Keep the current Canvas renderer available as a fallback. WebGL initialization failure or context loss must not reset a game or progression state; restore the 3D scene when the context becomes usable again.
- Use procedural geometry, lighting, shaders/materials, and local code-generated detail for the initial worlds. Avoid external runtime assets.

### Worlds and mode response

Each mode gets a distinct moving 3D environment:

| Mode | Environment direction |
| --- | --- |
| Endless | Begin at a planetary surface; every level raises the environment toward atmosphere, orbit, and deep space, continuing until game over. |
| Sprint | Fast transit corridor with directional motion. |
| Marathon | Monumental orbital structure. |
| Time Attack | Pulsing reactor chamber. |
| Zen | Calm bioluminescent garden. |
| Challenge | Graphic geometric arena. |

Existing game event records drive restrained environment and board reactions for movement/drop/lock, clears, T-spins, combos, back-to-back clears, perfect clears, and level-ups. Reactions must not obscure the cells, active piece, ghost, or important UI. The Endless altitude is presentation-only and derives from level; it cannot affect scoring or gravity.

### Customization

- Add a `blockMaterials` cosmetic category to the existing unlock/equip flow, with a default and varied futuristic material families such as ceramic, ion glass, carbon lattice, aurora alloy, and void chrome.
- Preserve old saves: a missing category resolves to its default without data loss or migration prompts.
- Equipping an item changes rendered block materials without changing piece colors, collision, or rules.
- Keep all existing cosmetic categories active in 3D: piece skins color their pieces; board themes style the board; background palettes tint each mode world; particle and clear effects style their matching effects; UI themes remain applied to the DOM.

### Settings and accessibility

The 3D adapter consumes current settings for reduced motion, colorblind mode, screen shake, particle intensity, and glow. Reduced motion suppresses camera/world motion and optional pulses; effects at zero intensity are actually disabled. Color cues retain readable shape/value distinctions and the existing colorblind palette behavior. Keep the DOM interface and keyboard navigation behavior intact, and preserve sufficient contrast for game-state legibility.

### Failure and migration behavior

- Vite is the supported launch/build path: `npm run dev` for local play and `npm run build` for a production bundle.
- The original Canvas path remains usable when WebGL is unavailable or lost.
- Handle viewport changes and device pixel ratio changes without stretching board geometry or displacing HUD alignment.
- Pause, menu, restart, game-over, mode changes, settings changes, and renderer recovery must preserve existing game lifecycle semantics.

## Acceptance criteria

1. All six modes render distinct animated 3D worlds; Endless advances visibly from ground level toward space at each level and remains in the resulting environment until game over.
2. Board cells, active piece, ghost, hold, and next previews remain aligned and easy to read at supported viewport sizes.
3. Existing gameplay rules, scoring, progression, controls, records, and reset-profile behavior are unchanged.
4. Existing gameplay events trigger the agreed render reactions without duplicating game logic.
5. Unlocking, equipping, and loading legacy profiles work with the new material category.
6. Accessibility and visual-effect settings measurably affect the 3D renderer, including fully disabling their corresponding effects at zero/reduced-motion settings.
7. Vite development and production builds work without runtime network asset requests. Canvas fallback handles WebGL initialization/context loss.
8. Browser QA covers every mode, game events, settings, pause/menu/game-over overlays, resize, keyboard play, and WebGL fallback/recovery.

## Out of scope

No changes to Tetris rules, scoring formulas, input semantics, game modes/objectives, progression economy, or menu/HUD redesign. No external asset pipeline or online dependency at runtime. This work does not promise identical 3D rendering on browsers without WebGL; those use the retained Canvas renderer.
