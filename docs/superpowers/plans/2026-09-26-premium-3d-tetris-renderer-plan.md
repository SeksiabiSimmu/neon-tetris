# Premium 3D Tetris Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a polished Three.js presentation with six reactive 3D worlds and unlockable block materials while preserving the current Tetris game model and UI.

**Architecture:** Keep the existing game and Canvas renderer as the authoritative gameplay/fallback path. A Vite module entry loads the existing global game scripts in their current order, then connects a full-window Three.js renderer that reads game state, uses DOM canvas bounds for board/previews, and handles visual events. DOM menus/HUD remain in place.

**Tech Stack:** Existing browser JavaScript/CSS, Vite, Three.js, locally bundled Chakra Petch font, Node built-in test runner, browser playtest.

**Spec:** `docs/superpowers/specs/2026-09-26-three-dimensional-tetris-renderer-design.md`

## Global Constraints

- The game model remains the source of truth; the Three.js adapter reads state and does not simulate or modify gameplay.
- Preserve all current game rules, scoring, controls, records, progression economy, reset-profile behavior, and DOM HUD/menu behavior.
- Bundle Three.js and the display font locally; do not add runtime CDN or external asset requests.
- Retain the Canvas renderer as the fallback for WebGL initialization failure and context loss.
- Keep the playfield, active piece, ghost, previews, and important UI readable; visual reactions must not obscure them.
- Make reduced motion, colorblind mode, screen shake, particle intensity, and glow settings affect the 3D presentation.

## Review Focus

- Unsupported WebGL or a lost context must show the Canvas renderer and preserve the active run. **Test in Task 2:** constructor failure and context lost/restored transitions toggle fallback without resetting the supplied game state.
- Window resize and device-pixel-ratio changes must keep the 3D board and preview meshes on their existing DOM canvas bounds. **Test in Task 2:** resize at desktop and narrow viewport sizes and compare scene bounds with `getBoundingClientRect()`.
- A mode change, pause, menu, restart, or game over must not replay stale effects or advance Endless altitude incorrectly. **Test in Task 3 and Task 5:** transition each lifecycle state and verify event cursor reset and altitude follows the active run/level.
- Zero-effect settings and reduced motion must remove motion, particles, shake, and glow that their controls govern. **Test in Task 4:** assert the adapter receives normalized values and disables each matching effect at zero/reduced motion.
- An older, partial, or invalid saved profile must still equip the default block material safely. **Test in Task 4:** load a profile with no `blockMaterials` entry and one with an unknown item ID.

---

### Task 1: Vite bootstrap and stable renderer seam

**Files:**
- Create: `package.json`
- Create: `src/entry.js`
- Create: `src/rendering/PremiumSceneRenderer.js`
- Modify: `index.html`
- Modify: `main.js`
- Modify: `styles.css`

**Interfaces:**
- `src/entry.js` imports existing root scripts for side effects in the current order, imports local fonts and the renderer, then calls `TETRIS.boot(PremiumSceneRenderer)`.
- `main.js` exposes `TETRIS.boot(PremiumSceneRendererClass)` instead of running its current bootstrap before the module entry executes.
- `PremiumSceneRenderer` initially exposes `constructor({ canvas, boardCanvas, nextCanvas, holdCanvas, onAvailabilityChange, rendererFactory })`, `render(game, meta, pieceColors)`, `setBlockMaterial(data)`, `setSettings(settings)`, `resize()`, and `dispose()`; later tasks complete the implementation without changing this API. `rendererFactory` defaults to `options => new THREE.WebGLRenderer(options)` and exists as a small failure-test seam.

- [x] **Step 1: Add Vite scripts and local runtime dependencies**

Add `dev`, `build`, `preview`, and `test` scripts. Add Vite, Three.js, and the Chakra Petch font package; keep dependency versions in `package-lock.json`.

- [x] **Step 2: Route startup through the module entry**

Replace the remote Google Fonts request and the ordered classic-script tags in `index.html` with a local-font import and one `type="module"` entry. In `src/entry.js`, import the existing game scripts in their current order and boot only after those side effects have run.

- [x] **Step 3: Refactor the existing bootstrap into `TETRIS.boot`**

Move the current `main.js` IIFE body into `TETRIS.boot(PremiumSceneRendererClass)`. Keep the current 2D contexts and `TETRIS.Renderer`; create the Three.js adapter inside a guarded `try` so a missing WebGL context leaves the Canvas game running. Attach it as `renderer.webgl` and call `renderer.webgl?.resize()` from the existing resize handler.

- [x] **Step 4: Run the production build**

Run: `npm run build`  
Expected: Vite emits `dist/index.html` and bundled local JS/CSS/font assets without unresolved classic-script paths or runtime CDN references.

---

### Task 2: Full-window 3D board, previews, and fallback lifecycle

**Files:**
- Modify: `src/rendering/PremiumSceneRenderer.js`
- Modify: `main.js`
- Modify: `renderer.js`
- Modify: `index.html`
- Modify: `styles.css`
- Create: `tests/renderer-layout.test.js`

**Interfaces:**
- `PremiumSceneRenderer.render(game, meta, pieceColors)` renders the scene from current game state and CSS-pixel canvas bounds.
- `PremiumSceneRenderer.resize()` sizes the WebGL drawing buffer/camera for the window and current DPR, then remeasures board/preview bounds.
- `PremiumSceneRenderer` calls `onAvailabilityChange(available)` when WebGL becomes active or falls back.
- `rectToWorldRect(rect, viewportWidth, viewportHeight)` converts a DOM client rect to a camera-centered CSS-pixel rectangle `{ x, y, width, height }` with positive-up world Y.
- `TETRIS.Renderer.render()` continues drawing Canvas fallback and DOM animation state, then calls `this.webgl?.render(game, meta, this.pieceColors)`.

- [x] **Step 1: Write layout and fallback tests**

Create tests for CSS-pixel-to-orthographic coordinates, board/preview rectangle mapping, unavailable-WebGL fallback, and context lost/restored state transitions. Assert a lost context changes renderer availability only; the game object and run ID are unchanged.

- [x] **Step 2: Run the tests to verify failure**

Run: `npm test -- --test-name-pattern="layout|context"`  
Expected: the tests fail because the layout helpers and fallback lifecycle are not implemented.

- [x] **Step 3: Implement the Three.js scene adapter**

Use one transparent full-window `THREE.WebGLRenderer` canvas, an orthographic camera, cinematic layered lighting, bevelled block meshes, and a restrained `EffectComposer` bloom pass. Render board/active/ghost state and next/hold previews positioned from `boardCanvas`, `nextCanvas`, and `holdCanvas` rectangles. Use the current renderer's piece palette. Keep DOM overlays above the scene, retain canvas dimensions for layout while hiding their 2D pixels only when WebGL is available, and reveal them immediately during fallback.

- [x] **Step 4: Add resize, context recovery, and cleanup**

Set and remove a body class through `onAvailabilityChange`; use it to reveal/hide the 2D layers and make the board-frame backing translucent. Handle `webglcontextlost`/`webglcontextrestored`, resize/orientation changes, and `dispose()` for event listeners, geometries, materials, and the Three renderer. Rebuild application-owned scene state after restoration.

- [x] **Step 5: Run tests and verify responsive alignment in-browser**

Run: `npm test -- --test-name-pattern="layout|context"` and `npm run build`.  
Expected: tests pass and build succeeds. Open the Vite app at desktop and narrow widths; verify the board, previews, and DOM overlays remain aligned and readable after resize and a simulated context loss/restore.

---

### Task 3: Six moving mode worlds and one-shot gameplay reactions

**Files:**
- Create: `src/rendering/modeWorlds.js`
- Create: `src/rendering/gameplaySignals.js`
- Modify: `src/rendering/PremiumSceneRenderer.js`
- Create: `tests/mode-worlds.test.js`
- Create: `tests/gameplay-signals.test.js`

**Interfaces:**
- `createModeWorld(mode)` returns `{ descriptor: { id, landmark }, group, update({ dtMs, elapsedMs, game, events, settings }), dispose() }` for `endless`, `sprint`, `marathon`, `timeAttack`, `zen`, and `challenge`.
- `endlessAltitudeForLevel(level)` returns `0` for invalid levels or level 1 and increases monotonically at every higher level; world scenery and atmospheric transitions use it without changing game state.
- `collectGameplayEvents(game, cursor)` returns `{ events, cursor }`; each event is `{ type, detail }`, where `type` is one of `move`, `rotate`, `softDrop`, `hardDrop`, `hold`, `lock`, `clear`, `tSpin`, `combo`, `backToBack`, `perfectClear`, or `levelUp`.
- `PremiumSceneRenderer` updates a mode world with at most the current frame's newly observed events and replaces/disposes the world when the active mode/run changes.

- [x] **Step 1: Write world and event-cursor tests**

Assert all six modes create distinct world descriptors, Endless altitude begins at zero and rises with level, repeated frames do not duplicate `lastHardDropEvent`, `lastLockEvent`, or `lastClearInfo`, and a new `runId` clears stale event state.

- [x] **Step 2: Run the tests to verify failure**

Run: `npm test -- --test-name-pattern="world|event"`  
Expected: the tests fail because mode factories, altitude mapping, and event collection are not implemented.

- [x] **Step 3: Build the six procedural worlds**

Implement a moving surface-to-space ascent for Endless; a directional transit corridor for Sprint; an orbital megastructure for Marathon; a pulsing reactor for Time Attack; a slow bioluminescent garden for Zen; and a shifting geometric arena for Challenge. Use local procedural Three.js geometry/materials. Keep Endless altitude tied only to `game.scoring.level` and hold the final scene through game over.

- [x] **Step 4: Map existing state changes to visual signals**

Track hard-drop and lock event IDs and clear-info object identity. Emit `move`/`rotate` on active-piece column/rotation changes, `softDrop` on the transition into soft-drop, and `hold` on the hold-availability transition. Emit one-shot clear/T-spin/combo/back-to-back/perfect-clear/level-up signals from `lastClearInfo`; never write to the game object. Animate short, bounded world/board reactions without covering cells.

- [x] **Step 5: Run tests and verify mode/event behavior**

Run: `npm test -- --test-name-pattern="world|event"` and `npm run build`.  
Expected: all six worlds and event cursor tests pass and build succeeds. In-browser, start each mode, reach at least level 2 in Endless, trigger movement, rotation, drops, locks, clears, T-spins, combos, back-to-back, perfect clear, and level-up; verify each event reacts once and gameplay remains unchanged.

---

### Task 4: Unlockable 3D block materials and settings integration

**Files:**
- Modify: `progressionData.js`
- Modify: `cosmeticsApplier.js`
- Modify: `settingsManager.js`
- Modify: `renderer.js`
- Modify: `uiShell.js`
- Modify: `src/rendering/PremiumSceneRenderer.js`
- Create: `tests/block-materials.test.js`
- Create: `tests/visual-settings.test.js`

**Interfaces:**
- `renderer.setBlockMaterial(data)` stores the applied material data and forwards it to `renderer.webgl?.setBlockMaterial(data)`.
- `renderer.setBoardTheme(theme)`, `setAmbientParticles(colors, shape)`, `setBackgroundPalette(colors, style)`, and `setClearEffect(effect)` keep their existing Canvas behavior and forward the same customization data to `renderer.webgl` when present.
- `PremiumSceneRenderer.setBlockMaterial(data)` updates Three.js block material properties only; it does not change piece identity or color-blind palette selection.
- `PremiumSceneRenderer` implements matching setters for board theme, ambient particles, background palette/style, and clear effect so existing unlocked cosmetics remain visible in WebGL mode.
- `PremiumSceneRenderer.setSettings(settings)` consumes `reducedMotion`, `colorblindMode`, `screenShake`, `particleIntensity`, and `glowIntensity`.

- [x] **Step 1: Write material fallback and setting tests**

Test that a saved profile with no `blockMaterials` equip resolves to the category's default, an unknown equipped material falls back safely, block-material and existing cosmetic setters forward to the Three adapter, and zero/reduced-motion values disable their associated motion/effects.

- [x] **Step 2: Run the tests to verify failure**

Run: `npm test -- --test-name-pattern="material|settings"`  
Expected: the tests fail because the category, adapter forwarding, and 3D settings application are not implemented.

- [x] **Step 3: Add data-driven block material unlocks**

Add `blockMaterials` to `PROGRESSION_DATA.CATEGORIES` with a default plus unlockable ceramic, ion glass, carbon lattice, aurora alloy, and void chrome presets. Give each a unique existing level/stat/achievement requirement and `apply` data for roughness, metalness, clearcoat/emissive accent. Add the display label to `UIShell._categoryLabel`; leave `ProgressionManager` persistence and requirement evaluation unchanged. Preserve the existing piece-skin, board-theme, background, particle, clear-effect, and UI-theme presentation in WebGL mode through the renderer setters.

- [x] **Step 4: Apply cosmetics and accessibility settings to both render paths**

Extend `applyCosmetics()` to call `renderer.setBlockMaterial()`. Forward settings from `SettingsManager.applyTo()` to `renderer.webgl.setSettings()`. Keep existing Canvas settings behavior, color-blind palette, and zero-intensity semantics; make 3D particle count, pulse, shake, and emissive glow actually respond to their matching controls.

- [x] **Step 5: Run tests and verify customization/settings**

Run: `npm test -- --test-name-pattern="material|settings"` and `npm run build`.  
Expected: all compatibility/settings tests pass and build succeeds. Equip every unlocked/default material, reload the profile, exercise reduced motion/colorblind mode and zero sliders, and verify current game state and score are unchanged.

---

### Task 5: Full gameplay-preservation playtest and final review

**Files:**
- Modify only files identified by QA or final review.
- Test: `tests/*.test.js` plus browser playtest checklist.

**Interfaces:**
- The Canvas renderer remains a complete draw fallback; the Three adapter remains read-only with respect to game/progression state.
- `window.__TETRIS_DEBUG__` continues exposing current game, progression, settings, renderer, input, and mode records for diagnosis.

- [x] **Step 1: Run the complete local checks**

Run: `npm test` and `npm run build`.  
Expected: all tests pass, production build succeeds, and `dist/index.html` has no external font, script, texture, or audio requests.

- [ ] **Step 2: Verify existing gameplay systems in-browser**

Use keyboard play to verify SRS rotation and wall kicks, lock delay/reset behavior, DAS/ARR, hold availability and swap, ghost projection, combo, T-spin, back-to-back, perfect clear, scoring, line/level progression, top-out/game-over, pause/resume, restart, mode objectives/records, and Reset Progression (gameplay progression clears while settings/key bindings/mode records remain as described in its UI). Compare scores and state progression to the existing Canvas-only game behavior; make no gameplay-rule changes.

Execution note: the deterministic gameplay regression suite covers SRS/wall kicks, lock delay, DAS/ARR, hold/ghost, drop scoring, T-spin rotation preservation, combo/B2B/perfect-clear scoring, level progression, and blocked-spawn game over. Exhaustive keyboard recreation of the special clear states and a live profile reset were not performed; the latter would erase the current saved progression.

- [ ] **Step 3: Verify renderer lifecycle and visual settings**

Play all six modes and verify worlds, event reactions, Endless ascent, customization persistence, legacy-profile defaulting, reduced motion, colorblind mode, particles/glow/shake sliders, menu/pause/game-over screens, resize, context loss/recovery, and Canvas fallback. Confirm the board/ghost/readable UI stay unobscured.

Execution note: all six worlds, mode selection, settings, and customization surfaces were visually checked during this task. The final production bundle was freshly loaded in Endless with WebGL active, zero console warnings/errors, and aligned board bounds. World-event behavior, resize/DPR, context transitions, Canvas fallback, and zero-effect states have focused automated coverage; each event and recovery path was not separately triggered in the final browser run.

- [x] **Step 4: Review touched code and remove proven dead code**

Check the final diff by reading each modified file and searching references to any renderer path replaced by the new adapter. Remove only code that is demonstrably unreachable or duplicated by this implementation. Confirm gameplay/input/scoring/progression rules were not changed.

- [x] **Step 5: Resolve any failures and repeat the complete checks**

For each QA issue, add or update a focused test, fix the issue, then rerun `npm test`, `npm run build`, and the affected browser scenarios. Finish with a clean console and no failed browser requests.
