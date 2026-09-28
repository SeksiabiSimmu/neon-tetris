// js/constants.js
//
// Static configuration and data tables for the whole game. Nothing in this
// file has behavior — it's the single source of truth that every other
// module reads from. Loaded first, before any other script.
//
// The older gameplay modules register on the shared `TETRIS` namespace.
// Vite bundles these scripts with the newer ES modules for browser and desktop.

window.TETRIS = window.TETRIS || {};

TETRIS.CONFIG = {
  COLS: 10,
  ROWS: 20,

  CELL_SIZE: 30, // px, main playfield
  PREVIEW_CELL_SIZE: 20, // px, next/hold panels
  NEXT_COUNT: 5, // how many upcoming pieces are shown

  // Where a fresh piece appears, in board coordinates (top-left of its
  // 4x4/3x3 local shape grid). Row -1 means "one row above the visible
  // board" — cells there simply aren't drawn until the piece falls into
  // view. This matches standard Tetris Guideline spawn behavior.
  SPAWN_COL: 3,
  SPAWN_ROW: -1,

  // Input timing (ms)
  DAS_MS: 150, // delay before a held direction starts auto-repeating
  ARR_MS: 35, // auto-repeat interval once DAS has kicked in
  SOFT_DROP_MS: 35, // ms per row while soft-drop is held

  // If rotate/hold is pressed in the brief window where there's no active
  // piece (e.g. the instant before a new piece spawns), the action is
  // remembered and replayed against the next piece instead of being
  // dropped — this is what "rotation/input buffering" means below.
  INPUT_BUFFER_MS: 200,

  // A piece doesn't lock the instant it lands — it gets a short grace
  // period so the player can slide/rotate it. Each successful move or
  // rotation while grounded refreshes the timer, up to a cap so a piece
  // can't be stalled forever.
  LOCK_DELAY_MS: 500,
  LOCK_DELAY_MAX_RESETS: 15,

  // Gravity speed curve: ms per row at a given level, decaying toward a floor.
  BASE_GRAVITY_MS: 1000,
  MIN_GRAVITY_MS: 100,
  GRAVITY_DECAY: 0.85, // multiplier applied per level above 1

  SOFT_DROP_POINTS_PER_CELL: 1,
  HARD_DROP_POINTS_PER_CELL: 2,

  DEBUG_MODE_DEFAULT: false, // backtick (`) toggles it at runtime regardless

  LINES_PER_LEVEL: 10,

  // How long a full row flashes before it's actually removed. This is the
  // one bit of gameplay *timing* this visual phase touches: without some
  // pause here, there's no moment for "line-clear targets" to exist as a
  // visually distinct thing from a normal locked row — everything else
  // about scoring/timing is unchanged.
  LINE_CLEAR_FLASH_MS: 220,
};

// Visual tuning — every magic number the rendering layer needs, gathered
// here instead of scattered through the renderer files. Nothing in this
// block affects gameplay.
TETRIS.VISUAL = {
  BLOCK_GLOW_BLUR: 14,
  BLOCK_INNER_HIGHLIGHT_ALPHA: 0.35,
  GHOST_GLOW_BLUR: 10,
  ACTIVE_PIECE_LIGHT_RADIUS_CELLS: 3.2,
  CHROMATIC_FRINGE_PX: 1.1, // subtle RGB-offset fringe on the boldest glows

  TRAIL_MAX_STEPS: 7,
  TRAIL_STEP_ALPHA: 0.09,
  TRAIL_LIFETIME_MS: 260,

  PARTICLE_AMBIENT_COUNT: 26, // slow motes drifting near the board
  PARTICLE_BG_COUNT: 46, // far background motes across the whole page
  PARTICLE_BURST_COUNT_PER_ROW: 14, // line-clear burst

  BG_NEBULA_COUNT: 4,

  HUD_COUNT_UP_MS: 450, // score/level/lines number tween duration
};

// Tuning for the EffectsManager / VFX system specifically — every knob for
// line-clear choreography, combos, T-spins, perfect clears, level-ups,
// and impacts live here so they can all be retuned in one
// place without touching effectsManager.js itself.
TETRIS.VFX = {
  // Per-line-count line-clear intensity (Single -> Tetris), 0-1. Scales
  // particle/fragment counts, sweep width, and flash brightness.
  LINE_CLEAR_INTENSITY: { 1: 0.35, 2: 0.55, 3: 0.8, 4: 1.0 },
  LINE_CLEAR_PARTICLES_BASE: 10, // × intensity, per cleared row
  LINE_CLEAR_FRAGMENTS_BASE: 6, // × intensity, per cleared row
  LINE_CLEAR_RING_THRESHOLD: 3, // rows cleared at once before a ring appears (Triple+)

  T_SPIN_COLOR: '#c65bff',
  T_SPIN_RING_COUNT: 2,

  PERFECT_CLEAR_COLOR: '#ffe066',
  PERFECT_CLEAR_RING_COUNT: 4,
  PERFECT_CLEAR_PARTICLES: 140,

  COMBO_MAX_TIER_COUNT: 8, // comboCount at which combo bonus effects hit max intensity

  LEVEL_UP_RING_COUNT: 5,
  LEVEL_UP_PARTICLES: 90,
  LEVEL_UP_FLASH_MS: 700,

  LOCK_SETTLE_PARTICLES: 3,


  COLLAPSE_MS: 180, // how long the "rows drop into place" animation takes after a clear

  RING_LIFETIME_MS: 500,
  RING_LINE_WIDTH: 2.5,

  GRID_PULSE_DECAY_MS: 260,
};

// Rotation states are indexed 0/1/2/3, matching the Guideline's 0/R/2/L.
// Rotating clockwise moves 0->1->2->3->0; counter-clockwise goes the other way.
// Each state lists the 4 occupied [col, row] cells within the piece's local
// bounding box (row increases downward, matching the board's own grid).
TETRIS.SHAPES = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
};

TETRIS.COLORS = {
  I: '#4dd8ff',
  O: '#ffd84d',
  T: '#c65bff',
  S: '#43e07a',
  Z: '#ff4d6a',
  J: '#4d7bff',
  L: '#ff9a4d',
};

// Super Rotation System wall-kick tables. Keys are "from->to" rotation state
// pairs; each entry is an ordered list of [dCol, dRow] offsets to try after a
// bare rotation fails, in board coordinates (row increases downward).
// The O piece never rotates, so it has no kick table.
//
// Source: the Tetris Guideline SRS kick tables (tetris.wiki), converted from
// their upward-positive-y convention into this project's downward-positive-row
// convention.
TETRIS.KICKS = {
  JLSTZ: {
    '0->1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '1->0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '1->2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '2->1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '2->3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '3->2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '3->0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '0->3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  },
  I: {
    '0->1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    '1->0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    '1->2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
    '2->1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    '2->3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    '3->2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    '3->0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    '0->3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  },
};

// T-spin detection uses the standard "3-corner rule": look at the 4 corners
// of the T-piece's 3x3 local box (its center cell, local (1,1), is always
// occupied by the T itself). If a rotation just landed the T somewhere with
// 3+ of those corners occupied, it's a T-spin. Which 2 corners count as
// "front" (the side the T points toward) vs "back" then decides Mini vs
// full: both front corners filled -> full T-spin; otherwise -> Mini. This
// is the Guideline's "pointing side cell" method, indexed by rotation state.
// Using the fifth SRS kick test upgrades an otherwise-Mini T-spin to a full spin.
TETRIS.T_SPIN_CORNERS = [
  { front: [[0, 0], [2, 0]], back: [[0, 2], [2, 2]] }, // state 0: points up
  { front: [[2, 0], [2, 2]], back: [[0, 0], [0, 2]] }, // state 1: points right
  { front: [[0, 2], [2, 2]], back: [[0, 0], [2, 0]] }, // state 2: points down
  { front: [[0, 0], [0, 2]], back: [[2, 0], [2, 2]] }, // state 3: points left
];

// Guideline-style scoring (tetris.wiki), level is always the level *before*
// the clear that's being scored. All values here are pre-level-multiplier.
TETRIS.SCORE_TABLE = {
  LINE: { 1: 100, 2: 300, 3: 500, 4: 800 }, // Single / Double / Triple / Tetris
  T_SPIN: {
    mini: { 0: 100, 1: 200, 2: 400 }, // no-lines / Single / Double
    full: { 0: 400, 1: 800, 2: 1200, 3: 1600 }, // no-lines / Single / Double / Triple
  },
  PERFECT_CLEAR: { 1: 800, 2: 1200, 3: 1800, 4: 2000 },
  COMBO_PER_STEP: 50, // × comboCount × level, added on top of the clear score
  BACK_TO_BACK_MULTIPLIER: 1.5, // applies to a difficult clear that follows another
};
