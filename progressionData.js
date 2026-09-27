// js/progressionData.js
//
// Pure data for the meta-game layer — no behavior lives here. Adding a new
// unlockable cosmetic or achievement later is just adding an entry to one
// of these arrays; ProgressionManager's requirement-checking logic already
// knows how to evaluate any of the requirement "types" below, and the
// cosmetics applier already knows how to read any category's `apply` block,
// so nothing else needs to change.
//
// Requirement shapes (extensible — add a new `type` and a matching case in
// ProgressionManager._meetsRequirement to introduce a new kind of gate):
//   { type: 'default' }                            -> always unlocked from the start
//   { type: 'level', value: N }                     -> player meta-level >= N
//   { type: 'stat', stat: 'totalLines', value: N }  -> that lifetime stat >= N
//   { type: 'achievement', id: 'ach_x' }             -> that achievement is unlocked
//
// IMPORTANT: none of this affects competitive integrity — every unlockable
// here is cosmetic (a skin/theme/background/particle/clear/UI style), never
// a gameplay modifier.
//
// `apply` holds the actual values the cosmetics applier pushes into the
// renderer when an item is equipped — shape depends on category:
//   pieceSkins:     { colors: { I,O,T,S,Z,J,L } }         (7-color palette)
//   boardThemes:    { bgTop, bgBottom, gridColor, gridAlpha }
//   backgrounds:    { nebulaColors: [...], style }         (palette + animated overlay)
//   particleEffects:{ ambientColors: [...], shape }        (spark/fragment/ring/hex/triangle)
//   clearEffects:   { flashColor, accentColor, particleShape }
//   uiThemes:       { accent, accentDim }                  (CSS custom properties)

window.TETRIS = window.TETRIS || {};

TETRIS.PROGRESSION_DATA = {
  // totalXpForLevel(n) = round(BASE * (n-1)^EXPONENT). With these values,
  // level 2 needs 100 total XP, level 5 needs ~973, level 10 needs ~3585,
  // level 25 needs ~28,600 — climbing steadily without demanding marathon
  // grinding for the early/mid levels.
  XP_CURVE: { BASE: 100, EXPONENT: 1.7 },

  // Continuous in-run XP trickle: 10 score points = 1 XP, awarded as the
  // score climbs rather than only at game over (see ProgressionManager).
  XP_PER_SCORE_POINT: 10,

  CATEGORIES: ['pieceSkins', 'blockMaterials', 'boardThemes', 'backgrounds', 'particleEffects', 'clearEffects', 'uiThemes'],

  UNLOCKABLES: [
    // --- piece skins ---
    { id: 'skin_classic', category: 'pieceSkins', name: 'Classic Neon', preview: '#4dd8ff', requirement: { type: 'default' },
      apply: { colors: { I: '#4dd8ff', O: '#ffd84d', T: '#c65bff', S: '#43e07a', Z: '#ff4d6a', J: '#4d7bff', L: '#ff9a4d' } } },
    { id: 'skin_pastel', category: 'pieceSkins', name: 'Pastel Dream', preview: '#ffb3d9', requirement: { type: 'level', value: 3 },
      apply: { colors: { I: '#a6e8ff', O: '#ffe6a6', T: '#e0b3ff', S: '#b3ffcf', Z: '#ffb3c9', J: '#b3c6ff', L: '#ffd1a6' } } },
    { id: 'skin_mono', category: 'pieceSkins', name: 'Monochrome', preview: '#cfd6e6', requirement: { type: 'stat', stat: 'totalLines', value: 200 },
      apply: { colors: { I: '#e8ecf6', O: '#c7ccd8', T: '#a4abbd', S: '#dfe3ec', Z: '#8b93a7', J: '#b8bfd0', L: '#959db0' } } },
    { id: 'skin_circuit', category: 'pieceSkins', name: 'Circuit Board', preview: '#19d3a2', requirement: { type: 'level', value: 6 },
      apply: { colors: { I: '#31d7ff', O: '#b6f542', T: '#bd78ff', S: '#18d3a4', Z: '#ff667e', J: '#628cff', L: '#ffad52' } } },
    { id: 'skin_aurora', category: 'pieceSkins', name: 'Aurora Glass', preview: '#8fe8d6', requirement: { type: 'achievement', id: 'ach_combo_10' },
      apply: { colors: { I: '#83e6ff', O: '#e8ff9c', T: '#d9a4ff', S: '#8ff0cf', Z: '#ff9faf', J: '#9db8ff', L: '#ffd09a' } } },
    { id: 'skin_gilded', category: 'pieceSkins', name: 'Gilded', preview: '#ffe066', requirement: { type: 'achievement', id: 'ach_perfect_clear' },
      apply: { colors: { I: '#ffe066', O: '#ffd23f', T: '#ffc93f', S: '#ffdd7a', Z: '#f2b705', J: '#e8b923', L: '#ffcf5c' } } },

    // --- 3D block materials ---
    { id: 'material_ceramic', category: 'blockMaterials', name: 'Celestial Ceramic', preview: '#e6f7ff', requirement: { type: 'default' },
      apply: { family: 'ceramic', roughness: 0.4, metalness: 0.08, clearcoat: 0.72, emissiveIntensity: 0.16, emissiveAccent: '#d9f6ff' } },
    { id: 'material_ion_glass', category: 'blockMaterials', name: 'Ion Glass', preview: '#51dcff', requirement: { type: 'level', value: 2 },
      apply: { family: 'ion-glass', roughness: 0.1, metalness: 0.28, clearcoat: 1, emissiveIntensity: 0.34, emissiveAccent: '#54e7ff' } },
    { id: 'material_carbon_lattice', category: 'blockMaterials', name: 'Carbon Lattice', preview: '#5be0ba', requirement: { type: 'level', value: 4 },
      apply: { family: 'carbon-lattice', roughness: 0.62, metalness: 0.76, clearcoat: 0.36, emissiveIntensity: 0.12, emissiveAccent: '#51d9bd' } },
    { id: 'material_aurora_alloy', category: 'blockMaterials', name: 'Aurora Alloy', preview: '#bb85ff', requirement: { type: 'stat', stat: 'totalPiecesPlaced', value: 250 },
      apply: { family: 'aurora-alloy', roughness: 0.18, metalness: 0.82, clearcoat: 0.94, emissiveIntensity: 0.32, emissiveAccent: '#bd88ff' } },
    { id: 'material_prism_shell', category: 'blockMaterials', name: 'Prism Shell', preview: '#ffd77e', requirement: { type: 'achievement', id: 'ach_first_tspin' },
      apply: { family: 'prism-shell', roughness: 0.14, metalness: 0.64, clearcoat: 1, emissiveIntensity: 0.28, emissiveAccent: '#ffe38b' } },
    { id: 'material_void_chrome', category: 'blockMaterials', name: 'Void Chrome', preview: '#6e84ff', requirement: { type: 'achievement', id: 'ach_combo_20' },
      apply: { family: 'void-chrome', roughness: 0.06, metalness: 1, clearcoat: 0.88, emissiveIntensity: 0.3, emissiveAccent: '#8495ff' } },

    // --- board themes ---
    { id: 'board_deepspace', category: 'boardThemes', name: 'Deep Space', preview: '#0d1220', requirement: { type: 'default' },
      apply: { bgTop: '#111a2e', bgBottom: '#080b14', gridColor: '#78d2ff', gridAlpha: 0.11 } },
    { id: 'board_synthwave', category: 'boardThemes', name: 'Synthwave Sunset', preview: '#2e1a4d', requirement: { type: 'level', value: 5 },
      apply: { bgTop: '#3a1a4d', bgBottom: '#160a24', gridColor: '#ff70d4', gridAlpha: 0.15 } },
    { id: 'board_glacier', category: 'boardThemes', name: 'Glacier', preview: '#173a4d', requirement: { type: 'stat', stat: 'totalTSpins', value: 25 },
      apply: { bgTop: '#12303f', bgBottom: '#06141c', gridColor: '#9eeaff', gridAlpha: 0.13 } },
    { id: 'board_volcanic', category: 'boardThemes', name: 'Volcanic Glass', preview: '#4a1827', requirement: { type: 'level', value: 8 },
      apply: { bgTop: '#321a31', bgBottom: '#130914', gridColor: '#ff805c', gridAlpha: 0.14 } },
    { id: 'board_prismatic', category: 'boardThemes', name: 'Prismatic Depth', preview: '#1b2848', requirement: { type: 'stat', stat: 'totalPerfectClears', value: 3 },
      apply: { bgTop: '#182a45', bgBottom: '#0a1026', gridColor: '#b997ff', gridAlpha: 0.16 } },

    // --- backgrounds ---
    { id: 'bg_nebula', category: 'backgrounds', name: 'Nebula Drift', preview: '#10162a', requirement: { type: 'default' },
      apply: { nebulaColors: ['#4dd8ff', '#c65bff', '#4d7bff', '#43e07a'], style: 'nebula' } },
    { id: 'bg_city', category: 'backgrounds', name: 'Neon City', preview: '#1a0f2e', requirement: { type: 'level', value: 7 },
      apply: { nebulaColors: ['#ff4d9e', '#4dd8ff', '#ffd84d', '#c65bff'], style: 'cityLights' } },
    { id: 'bg_void', category: 'backgrounds', name: 'The Void', preview: '#050508', requirement: { type: 'stat', stat: 'bestCombo', value: 10 },
      apply: { nebulaColors: ['#3a3a4d', '#1a1a2e', '#4d4d66', '#26263a'], style: 'orbit' } },
    { id: 'bg_solarflare', category: 'backgrounds', name: 'Solar Flare', preview: '#ff8b56', requirement: { type: 'level', value: 10 },
      apply: { nebulaColors: ['#ff8b56', '#ffd26a', '#ff536e', '#a64dff'], style: 'solar' } },
    { id: 'bg_abyss', category: 'backgrounds', name: 'Abyssal Light', preview: '#35d9d0', requirement: { type: 'achievement', id: 'ach_b2b_5' },
      apply: { nebulaColors: ['#35d9d0', '#2879b5', '#63f2bc', '#657cff'], style: 'aurora' } },
    { id: 'bg_candyworld', category: 'backgrounds', name: 'Candyworld', preview: '#ff86c8', requirement: { type: 'stat', stat: 'totalTetrises', value: 15 },
      apply: { nebulaColors: ['#ff86c8', '#8edbff', '#ffd886', '#b78aff'], style: 'prism' } },
    { id: 'bg_meteorRush', category: 'backgrounds', name: 'Meteor Rush', preview: '#b5e8ff', requirement: { type: 'level', value: 14 },
      apply: { nebulaColors: ['#b5e8ff', '#7c9cff', '#ffffff', '#ffca8a'], style: 'meteors' } },
    { id: 'bg_clockwork', category: 'backgrounds', name: 'Clockwork Orbit', preview: '#f0bd69', requirement: { type: 'achievement', id: 'ach_tetris_10' },
      apply: { nebulaColors: ['#f0bd69', '#8cd9ff', '#e2a5ff', '#fff0b0'], style: 'clockwork' } },

    // --- particle effects ---
    { id: 'particles_sparks', category: 'particleEffects', name: 'Sparks', preview: '#4dd8ff', requirement: { type: 'default' },
      apply: { ambientColors: ['#4dd8ff', '#c65bff', '#43e07a', '#ffd84d'], shape: 'spark' } },
    { id: 'particles_fireworks', category: 'particleEffects', name: 'Fireworks', preview: '#ff9a4d', requirement: { type: 'stat', stat: 'totalTetrises', value: 10 },
      apply: { ambientColors: ['#ff9a4d', '#ff4d6a', '#ffd84d', '#ff4dd8'], shape: 'fragment' } },
    { id: 'particles_petals', category: 'particleEffects', name: 'Cherry Blossom', preview: '#ffb3d9', requirement: { type: 'level', value: 12 },
      apply: { ambientColors: ['#ffb3d9', '#ffd6e8', '#ff8fc7', '#ffe0ee'], shape: 'fragment' } },
    { id: 'particles_comets', category: 'particleEffects', name: 'Comet Trails', preview: '#73dcff', requirement: { type: 'level', value: 4 },
      apply: { ambientColors: ['#73dcff', '#bfa2ff', '#f4fbff', '#70f0d0'], shape: 'spark' } },
    { id: 'particles_hex', category: 'particleEffects', name: 'Prism Fragments', preview: '#d17dff', requirement: { type: 'stat', stat: 'totalLines', value: 100 },
      apply: { ambientColors: ['#d17dff', '#60ddff', '#ffb45e', '#a6ffdc'], shape: 'hex' } },
    { id: 'particles_orbits', category: 'particleEffects', name: 'Orbitals', preview: '#86e7ff', requirement: { type: 'level', value: 9 },
      apply: { ambientColors: ['#86e7ff', '#bba0ff', '#ffffff', '#72edc0'], shape: 'ring' } },
    { id: 'particles_triangles', category: 'particleEffects', name: 'Triad Shards', preview: '#ff9c75', requirement: { type: 'achievement', id: 'ach_combo_10' },
      apply: { ambientColors: ['#ff9c75', '#ff6dad', '#ffd786', '#b1a0ff'], shape: 'triangle' } },

    // --- clear effects ---
    { id: 'clearfx_sweep', category: 'clearEffects', name: 'Energy Sweep', preview: '#ffffff', requirement: { type: 'default' },
      apply: { flashColor: '#ffffff', accentColor: '#ffffff', particleShape: 'spark' } },
    { id: 'clearfx_shatter', category: 'clearEffects', name: 'Shatter', preview: '#ffe066', requirement: { type: 'stat', stat: 'totalPerfectClears', value: 1 },
      apply: { flashColor: '#ffe066', accentColor: '#ffd05a', particleShape: 'fragment' } },
    { id: 'clearfx_arc', category: 'clearEffects', name: 'Arc Discharge', preview: '#83e6ff', requirement: { type: 'achievement', id: 'ach_first_tspin' },
      apply: { flashColor: '#83e6ff', accentColor: '#83e6ff', particleShape: 'ring' } },
    { id: 'clearfx_glitch', category: 'clearEffects', name: 'Glitch Bloom', preview: '#ff70b8', requirement: { type: 'level', value: 7 },
      apply: { flashColor: '#ff70b8', accentColor: '#ff70b8', particleShape: 'hex' } },
    { id: 'clearfx_voidpulse', category: 'clearEffects', name: 'Void Pulse', preview: '#ae91ff', requirement: { type: 'level', value: 11 },
      apply: { flashColor: '#ae91ff', accentColor: '#ae91ff', particleShape: 'triangle' } },

    // --- UI themes ---
    { id: 'ui_cyan', category: 'uiThemes', name: 'Cyan Protocol', preview: '#4dd8ff', requirement: { type: 'default' },
      apply: { accent: '#4dd8ff', accentDim: 'rgba(77, 216, 255, 0.18)' } },
    { id: 'ui_crimson', category: 'uiThemes', name: 'Crimson Protocol', preview: '#ff4d6a', requirement: { type: 'level', value: 9 },
      apply: { accent: '#ff4d6a', accentDim: 'rgba(255, 77, 106, 0.18)' } },
    { id: 'ui_gold', category: 'uiThemes', name: 'Gold Protocol', preview: '#ffd84d', requirement: { type: 'stat', stat: 'gamesPlayed', value: 50 },
      apply: { accent: '#ffd84d', accentDim: 'rgba(255, 216, 77, 0.18)' } },
    { id: 'ui_verdant', category: 'uiThemes', name: 'Verdant Signal', preview: '#43e07a', requirement: { type: 'level', value: 12 },
      apply: { accent: '#43e07a', accentDim: 'rgba(67, 224, 122, 0.18)' } },
    { id: 'ui_violet', category: 'uiThemes', name: 'Violet Shift', preview: '#c65bff', requirement: { type: 'stat', stat: 'gamesPlayed', value: 20 },
      apply: { accent: '#c65bff', accentDim: 'rgba(198, 91, 255, 0.18)' } },
  ],

  // rarity is purely presentational (badge color on the Achievements screen).
  ACHIEVEMENTS: [
    { id: 'ach_first_tetris', name: 'Quadrilateral', description: 'Clear a Tetris — four lines at once.', rarity: 'common', requirement: { type: 'stat', stat: 'totalTetrises', value: 1 }, rewardXp: 50 },
    { id: 'ach_tetris_10', name: 'Tetris Machine', description: 'Clear 10 Tetrises.', rarity: 'rare', requirement: { type: 'stat', stat: 'totalTetrises', value: 10 }, rewardXp: 150 },
    { id: 'ach_combo_10', name: 'Chain Reaction', description: 'Reach a 10x combo.', rarity: 'rare', requirement: { type: 'stat', stat: 'bestCombo', value: 10 }, rewardXp: 100 },
    { id: 'ach_combo_20', name: 'Unstoppable', description: 'Reach a 20x combo.', rarity: 'legendary', requirement: { type: 'stat', stat: 'bestCombo', value: 20 }, rewardXp: 250 },
    { id: 'ach_first_tspin', name: 'Spin Doctor', description: 'Land your first T-spin.', rarity: 'common', requirement: { type: 'stat', stat: 'totalTSpins', value: 1 }, rewardXp: 50 },
    { id: 'ach_b2b_5', name: 'Relentless', description: 'Reach a 5-clear back-to-back streak.', rarity: 'epic', requirement: { type: 'stat', stat: 'bestBackToBackStreak', value: 5 }, rewardXp: 120 },
    { id: 'ach_perfect_clear', name: 'Immaculate', description: 'Achieve a perfect clear.', rarity: 'epic', requirement: { type: 'stat', stat: 'totalPerfectClears', value: 1 }, rewardXp: 200 },
    { id: 'ach_level_10', name: 'Rising Star', description: 'Reach player level 10.', rarity: 'rare', requirement: { type: 'level', value: 10 }, rewardXp: 0 },
    { id: 'ach_level_25', name: 'Veteran', description: 'Reach player level 25.', rarity: 'legendary', requirement: { type: 'level', value: 25 }, rewardXp: 0 },
    { id: 'ach_score_10000', name: 'Five Figures', description: 'Score 10,000 points in a single game.', rarity: 'common', requirement: { type: 'stat', stat: 'bestScore', value: 10000 }, rewardXp: 100 },
    { id: 'ach_score_50000', name: 'High Roller', description: 'Score 50,000 points in a single game.', rarity: 'epic', requirement: { type: 'stat', stat: 'bestScore', value: 50000 }, rewardXp: 300 },
    { id: 'ach_lines_500', name: 'Line Cook', description: 'Clear 500 total lines.', rarity: 'rare', requirement: { type: 'stat', stat: 'totalLines', value: 500 }, rewardXp: 150 },
  ],
};
