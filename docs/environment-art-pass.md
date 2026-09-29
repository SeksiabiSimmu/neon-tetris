# Environment art pass

## Direction and audit

Use designed architecture, machined surfaces, and carved stone with clear foreground, middle, and distant forms. Keep the board and its HUD in a calm central area. Existing gameplay, saves, controls, and interface stay authoritative.

The baseline confirms perspective worlds plus an orthographic board. The separate board pass is useful: it preserves exact cell alignment and skips background blur and occlusion. Both passes already share a generic studio reflection map, but use unrelated lighting. Several focal objects are outside the gameplay camera; the common color wash overwhelms mode identity. Board materials are overlit. World changes also leave shadow targets undisposed.

| Mode | Weakness | Art treatment |
| --- | --- | --- |
| Endless | Rectangular shaft, detached spherical ornament; ascent eventually leaves empty space | Chamfered lift pylons, rail carriages, cross bracing, a distant launch complex, cloud strata and an orbital station revealed through ascent. Cool daylight with warm practical lamps. |
| Sprint | Repeated rectangular frames with little construction detail | Swept transit ribs, recessed track channels, service bays, and a distant departure aperture. Hard lateral light and amber guide lights. |
| Marathon | Plain sphere and torus mostly cropped offscreen | An inhabited orbital wheel with segmented hull, spokes, docking hub, solar arrays, and a layered planet. Warm solar rim and cool reflected fill. |
| Time Attack | Overlapping simple rings around an opaque polyhedron | Open clockwork housing, stepped flywheel, bearings, teeth, and suspended gimbal. Bronze and graphite under a diagonal warm key. |
| Zen | Small polygon plants and rectangular platforms | Asymmetric layered stone, a carved moon gate, terraces, and an inset reflecting pool. Soft overcast light, restrained greenery, slow water motion. |
| Challenge | Floating octahedra framed by boxes | A faceted mineral specimen in an articulated exhibition vault, chamfered buttresses, and etched sockets. Violet edge light with neutral material illumination. |

## Integration

Retain the two projections. Share each world's key direction and a bounded neutralized fill with the board. Give the board a shallow machined housing outside the playable rectangle, with a recessed contact edge and small practical strips. Keep tetromino base colors and the ghost stable. Generate mode-specific reflection lighting locally; no network assets or licensing dependencies.

Use reusable profile geometry, instanced structural details, small deterministic material maps, and explicit resource disposal. Quality changes reduce shadows, postprocessing, and secondary detail while retaining each landmark. No camera shake or camera movement.

## Verification

Capture matching 1600 × 1000 views and frame timing with an isolated Brave browser, a deterministic piece sequence, the same board fill, High quality, and default ambient occlusion off. Inspect all six worlds, multiple board states, low quality, reduced motion, narrow and wide windows, pause/results, event effects, and repeat navigation. Run the build and existing rule/persistence checks. Draw-call figures include every render pass.

## Completed verification

Matched screenshots for all six modes are in the local, ignored `release/art-qa/before` and `release/art-qa/after-final` directories. The `release/art-qa/verification` directory captures Endless at levels 1, 2, 4, 8, and 12; all six modes at Low quality with Reduced Motion; near-full boards and active line clears in each mode; pause and results; and 1920 × 1080, 1280 × 720, and 800 × 600 layouts. These captures were visually inspected in the running game. Low quality disabled shadows while retaining each focal structure. No page errors occurred. A paused-to-game-over transition now dismisses the pause overlay.

The matching High-quality captures ran in headless Brave at 1600 × 1000 with default ambient occlusion off. The measured draw calls and triangles include all render passes. Frame intervals are browser request-animation-frame timing; they are not a benchmark of GPU time in the portable Windows build.

| Mode | Draw calls before → after | Triangles before → after | Final median frame interval |
| --- | ---: | ---: | ---: |
| Endless | 150 → 177 | 16,534 → 23,376 | 6.9 ms |
| Sprint | 121 → 136 | 10,842 → 24,462 | 6.9 ms |
| Marathon | 102 → 132 | 18,998 → 77,650 | 7.0 ms |
| Time Attack | 102 → 142 | 15,942 → 50,442 | 6.9 ms |
| Zen | 161 → 135 | 11,578 → 20,500 | 7.0 ms |
| Challenge | 124 → 139 | 10,962 → 17,334 | 6.9 ms |

Three complete cycles through all six modes ended with the same WebGL resource counts: 24 geometries and 22 textures. The final project passes 45 automated checks and builds with Vite. Vite reports a 946 kB JavaScript chunk; the bundle was not split in this focused art pass. The new art is generated locally from authored geometry and deterministic material maps, with no imported assets or attribution requirement. An external 3D asset pipeline and hardware-specific GPU profiling remain possible later improvements.

The portable Windows package was rebuilt at `release/art-build-final/NeonTetris-1.2.0-win-x64.exe`. Its staged `app.asar` contains the final Vite bundle (`index-_8Lp5C47.js`). The Windows packager's immediate rename of its freshly extracted Electron directory returned EPERM twice; packaging succeeded by using that fully extracted local Electron directory as `electronDist` in a fresh output folder. The EXE was packaged and its contents inspected, but not launched for a native desktop smoke test in this pass.
