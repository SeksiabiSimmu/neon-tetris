# Premium Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Work through Stage 1 and its acceptance gate before Stage 2.

**Goal:** Ship 20 distinctive block themes, 16 movement-driven falling effects, and 12 selectable 3D environments with accurate combined previews and compatible saves.

**Architecture:** Gameplay stays authoritative. Existing progression IDs and storage keys remain stable. The Three.js renderer and inspector consume shared theme, effect, and environment factories; the Canvas renderer keeps a clear fallback. Only one 3D preview runs while customization is open.

**Tech Stack:** Existing JavaScript, Three.js, Vite, Electron, Node test runner, Brave/Playwright browser QA.

**Spec:** User attachment `C:\Users\Simon\.codex\attachments\a99b5434-51de-4140-817b-7fb6f9584dcb\Pasted text.txt`.

## Global Constraints

- Preserve SRS, movement, timing, scoring, progression, saves, controls, and six mode goals.
- Preserve the current Canvas fallback, reduced-motion and colorblind behavior, and Endless ascent.
- Keep existing unlock IDs and equipment valid; no currencies or gameplay modifiers.
- Use actual shared art/effect definitions in gameplay and preview; keep all effects bounded and behind the active piece.
- Stage 2 begins only when Stage 1 passes functional, visual, lifecycle, and performance checks.

## Review Focus

- Old saves with unknown or missing new IDs use existing defaults.
- Spawn, hold, restart, and lateral movement never connect unrelated trail positions.
- Hard drop and lock produce one landing reaction per event.
- Rapid background switching disposes the previous scene without losing the currently equipped one.
- Bright and dark themes remain recognizable on busy worlds and with colorblind mode.

## Stage 1

### Task 1: Five block themes

**Files:** `src/rendering/blockAppearance.js`, `tests/block-appearance.test.js`.

**Interface:** `createBlockAppearance().apply(material, { family, roughness, metalness, clearcoat }, { ghost })` continues to support existing families. Add Stained Glass, Reactor Cells, Porcelain Dynasty, Pocket Gardens, Comic Ink as distinct opaque face/roughness treatments.

- [ ] Add failing assertions that each family has a unique pattern and valid cap UVs.
- [ ] Author the five treatments with useful contrast at gameplay cell size.
- [ ] Check active, settled, hold, next, and ghost rendering in the browser.

### Task 2: Six falling effects

**Files:** `src/rendering/FallingEffects3D.js`, `tests/falling-effects.test.js`, integration in `src/rendering/PremiumSceneRenderer.js`.

**Interface:** `new FallingEffects3D(scene)`, `setEffect(id)`, `update({ game, events, boardRect, settings, dtMs, colors })`, `reset()`, `dispose()`. Effect IDs: none, fire, bubbles, water, smoke, frost, lightning. Observe active-piece state and existing `collectGameplayEvents` only.

- [ ] Prove trail reset and single impact behavior with failing checks.
- [ ] Implement bounded, visually distinct movement and landing effects.
- [ ] Integrate without changing simulation state or competing with line-clear effects.

### Task 3: Five 3D environments

**Files:** `src/rendering/collectionWorlds.js`, `tests/collection-worlds.test.js`, integration in `src/rendering/modeWorlds.js`.

**Interface:** `createCollectionWorld(sceneId)` returns `{ group, update({time,reducedMotion,pulse}), setQuality(preset), dispose() }` or null for legacy backgrounds. Scene IDs: japanese-courtyard, rainy-observatory, desert-monument, underwater-ruins, lunar-outpost. Keep the center quiet and preserve Endless ascent treatment.

- [ ] Assert each scene has a different landmark silhouette, meaningful geometry depth, and disposal.
- [ ] Author structures, purpose-specific materials, lighting, and controlled motion.
- [ ] Verify every scene from the gameplay camera with a populated board.

### Task 4: Catalog, equipment, and inspector

**Files:** `progressionData.js`, `cosmeticsApplier.js`, `renderer.js`, `src/ui/CustomizationPreview3D.js`, `uiShell.js`, `index.html`, `styles.css`, focused tests.

- [ ] Add independent `fallingEffects` category, retaining ambient `particleEffects` and all existing IDs.
- [ ] Add Stage 1 catalog entries with varied early unlock requirements and a default none effect.
- [ ] Pass selected theme/effect/environment to the live inspector; add Fall, Soft Drop, Hard Drop, and Clear demonstration controls using the same effect renderer.
- [ ] Verify locked browsing, equip, leave without applying, reload, old saves, keyboard, reduced motion, and compact layouts.

### Stage 1 acceptance gate

- [ ] Run Node tests and production build.
- [ ] Capture all Stage 1 themes, effects, and worlds in the running game and inspector; compare baseline.
- [ ] Measure representative frame pacing and graphics resource counts; repeat navigation and context-loss checks.
- [ ] Repair any clarity, lifecycle, or performance failure before Stage 2.

## Stage 2

### Task 5: Remaining 15 block themes

**Files:** Shared block appearance factory, catalog, tests. Extend the proven Stage 1 face/material approach with theme-specific structure and restrained animation; verify all layers and accessible palettes.

### Task 6: Remaining 10 falling effects

**Files:** Shared falling effect factory, catalog, tests. Give each effect distinct shape, motion, and impact while retaining emitter bounds and reset rules.

### Task 7: Remaining seven environments

**Files:** Shared collection world factory, catalog, tests. Author seven different places with scene-specific geometry and material cues; inspect each at gameplay scale.

### Task 8: Final integration and release check

**Files:** UI/renderer integration, docs, tests as needed.

- [ ] Validate catalog counts: 20 new block themes, 16 falling effects plus none, 12 new environments, with old catalog entries preserved.
- [ ] Exercise representative bright/dark/reflective/effect combinations, six game modes, saves, rapid browsing, pause/restart, and fallbacks.
- [ ] Capture final screenshots, build, review diff, and report measured limitations accurately.
