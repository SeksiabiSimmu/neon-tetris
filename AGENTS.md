# Working in Neon Tetris

Read `docs/architecture.md` first, then open only the files for the requested area. Keep gameplay in `game.js` and related rule modules; renderers and UI may observe game state but must not alter rules or scoring. Preserve saved data keys and the Canvas fallback. New presentation modules should use ES imports and explicit constructor dependencies. `src/entry.js` still orders legacy `window.TETRIS` registration; change that order only when converting the corresponding modules and their checks together.
