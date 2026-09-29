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
//   blockMaterials: { family, roughness, metalness, clearcoat, emissiveIntensity }
//   fallingEffects: { effectId }                          (piece trail and landing)
//   boardThemes:    { bgTop, bgBottom, gridColor, gridAlpha }
//   backgrounds:    { nebulaColors: [...], style, sceneId? } (palette or 3D place)
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

  CATEGORIES: ['pieceSkins', 'blockMaterials', 'fallingEffects', 'boardThemes', 'backgrounds', 'particleEffects', 'clearEffects', 'uiThemes'],

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
    { id: 'material_stained_glass', category: 'blockMaterials', name: 'Stained Glass', preview: '#c7a78b', description: 'Colored panes held by dark leading, with a clear solid silhouette.', requirement: { type: 'default' },
      apply: { family: 'stained-glass', roughness: 0.16, metalness: 0.12, clearcoat: 0.96, emissiveIntensity: 0.11, emissiveAccent: '#ecd0ac' } },
    { id: 'material_reactor_cells', category: 'blockMaterials', name: 'Reactor Cells', preview: '#8ebc97', description: 'Armored frames around controlled energy cores and precise seams.', requirement: { type: 'level', value: 3 },
      apply: { family: 'reactor-cells', roughness: 0.38, metalness: 0.68, clearcoat: 0.42, emissiveIntensity: 0.22, emissiveAccent: '#b6e7ba' } },
    { id: 'material_porcelain_dynasty', category: 'blockMaterials', name: 'Porcelain Dynasty', preview: '#b9d5de', description: 'Glazed ceramic, fine motifs, and selective gold repairs.', requirement: { type: 'stat', stat: 'totalLines', value: 30 },
      apply: { family: 'porcelain-dynasty', roughness: 0.22, metalness: 0.07, clearcoat: 0.94, emissiveIntensity: 0.07, emissiveAccent: '#f2ddaa' } },
    { id: 'material_pocket_gardens', category: 'blockMaterials', name: 'Pocket Gardens', preview: '#90ad7d', description: 'Small moss and stone arrangements within clean colored borders.', requirement: { type: 'stat', stat: 'gamesPlayed', value: 5 },
      apply: { family: 'pocket-gardens', roughness: 0.67, metalness: 0.06, clearcoat: 0.16, emissiveIntensity: 0.04, emissiveAccent: '#bad6a2' } },
    { id: 'material_comic_ink', category: 'blockMaterials', name: 'Comic Ink', preview: '#f2c879', description: 'Printed halftone faces and decisive inked outlines.', requirement: { type: 'default' },
      apply: { family: 'comic-ink', roughness: 0.75, metalness: 0, clearcoat: 0.04, emissiveIntensity: 0.03, emissiveAccent: '#fff4de' } },
    { id: 'material_deep_sea_relics', category: 'blockMaterials', name: 'Deep-Sea Relics', preview: '#87aaa4', description: 'Weathered marine ceramic with etched currents and restrained mineral cracks.', requirement: { type: 'level', value: 5 },
      apply: { family: 'deep-sea-relics', roughness: 0.74, metalness: 0.06, clearcoat: 0.25, emissiveIntensity: 0.08, emissiveAccent: '#a3d7d3' } },
    { id: 'material_meteorite', category: 'blockMaterials', name: 'Meteorite', preview: '#aa8878', description: 'Pitted stone, colored mineral veins, and a softly heated rim.', requirement: { type: 'stat', stat: 'totalPiecesPlaced', value: 100 },
      apply: { family: 'meteorite', roughness: 0.91, metalness: 0.14, clearcoat: 0.08, emissiveIntensity: 0.1, emissiveAccent: '#f1a477' } },
    { id: 'material_aurora_crystal', category: 'blockMaterials', name: 'Aurora Crystal', preview: '#aec8c5', description: 'Frosted crystal faces with slow internal ribbons of color.', requirement: { type: 'level', value: 6 },
      apply: { family: 'aurora-crystal', roughness: 0.26, metalness: 0.1, clearcoat: 0.82, emissiveIntensity: 0.1, emissiveAccent: '#b4dfe3' } },
    { id: 'material_building_bricks', category: 'blockMaterials', name: 'Building Bricks', preview: '#d4af80', description: 'Molded plastic studs, crisp seams, and subtle surface scratches.', requirement: { type: 'stat', stat: 'totalLines', value: 55 },
      apply: { family: 'building-bricks', roughness: 0.42, metalness: 0, clearcoat: 0.35, emissiveIntensity: 0.02, emissiveAccent: '#e9d3ad' } },
    { id: 'material_jelly_cubes', category: 'blockMaterials', name: 'Jelly Cubes', preview: '#d6a2b8', description: 'Soft translucent-looking cells with a contained settling motion.', requirement: { type: 'stat', stat: 'gamesPlayed', value: 8 },
      apply: { family: 'jelly-cubes', roughness: 0.15, metalness: 0, clearcoat: 1, emissiveIntensity: 0.07, emissiveAccent: '#f5bfd0' } },
    { id: 'material_arcade_carpet', category: 'blockMaterials', name: 'Arcade Carpet', preview: '#967993', description: 'Tactile woven fabric with restrained printed geometric motifs.', requirement: { type: 'level', value: 7 },
      apply: { family: 'arcade-carpet', roughness: 1, metalness: 0, clearcoat: 0, emissiveIntensity: 0, emissiveAccent: '#b39ba8' } },
    { id: 'material_tiny_aquariums', category: 'blockMaterials', name: 'Tiny Aquariums', preview: '#7aabb1', description: 'Miniature aquatic scenes inside sturdy colored cell frames.', requirement: { type: 'stat', stat: 'totalTetrises', value: 3 },
      apply: { family: 'tiny-aquariums', roughness: 0.2, metalness: 0.16, clearcoat: 0.9, emissiveIntensity: 0.08, emissiveAccent: '#a8d9dd' } },
    { id: 'material_toy_blocks', category: 'blockMaterials', name: 'Toy Blocks', preview: '#bca285', description: 'Painted wood with visible grain, worn corners, and small stamps.', requirement: { type: 'stat', stat: 'totalPiecesPlaced', value: 250 },
      apply: { family: 'toy-blocks', roughness: 0.82, metalness: 0, clearcoat: 0.08, emissiveIntensity: 0, emissiveAccent: '#d8bb95' } },
    { id: 'material_circuit_boards', category: 'blockMaterials', name: 'Circuit Boards', preview: '#76ad9e', description: 'Fine metallic traces with a short signal response on clears.', requirement: { type: 'achievement', id: 'ach_first_tspin' },
      apply: { family: 'circuit-boards', roughness: 0.54, metalness: 0.45, clearcoat: 0.35, emissiveIntensity: 0.08, emissiveAccent: '#a8d6bd' } },
    { id: 'material_space_freight', category: 'blockMaterials', name: 'Space Freight', preview: '#aeb5b4', description: 'Ribbed cargo panels, fasteners, and colored structural markings.', requirement: { type: 'level', value: 8 },
      apply: { family: 'space-freight', roughness: 0.6, metalness: 0.63, clearcoat: 0.12, emissiveIntensity: 0.02, emissiveAccent: '#c8d0ca' } },
    { id: 'material_mechanical_keys', category: 'blockMaterials', name: 'Mechanical Keys', preview: '#aab2b8', description: 'Sculpted keycaps, subtle legends, and a brief lock response.', requirement: { type: 'stat', stat: 'bestCombo', value: 5 },
      apply: { family: 'mechanical-keys', roughness: 0.54, metalness: 0.08, clearcoat: 0.28, emissiveIntensity: 0.03, emissiveAccent: '#d9dee0' } },
    { id: 'material_retro_displays', category: 'blockMaterials', name: 'Retro Displays', preview: '#91b5a4', description: 'Controlled phosphor faces with subtle display scanlines.', requirement: { type: 'stat', stat: 'totalLines', value: 110 },
      apply: { family: 'retro-displays', roughness: 0.32, metalness: 0.14, clearcoat: 0.64, emissiveIntensity: 0.11, emissiveAccent: '#b2d4b4' } },
    { id: 'material_black_ice', category: 'blockMaterials', name: 'Black Ice', preview: '#728c9b', description: 'Dark polished ice crossed by recognizable colored fractures.', requirement: { type: 'level', value: 9 },
      apply: { family: 'black-ice', roughness: 0.12, metalness: 0.08, clearcoat: 0.95, emissiveIntensity: 0.08, emissiveAccent: '#9bc8d8' } },
    { id: 'material_dungeon_treasure', category: 'blockMaterials', name: 'Dungeon Treasure', preview: '#bc9c68', description: 'Engraved enamel and metal with selective gem details.', requirement: { type: 'achievement', id: 'ach_perfect_clear' },
      apply: { family: 'dungeon-treasure', roughness: 0.28, metalness: 0.67, clearcoat: 0.62, emissiveIntensity: 0.08, emissiveAccent: '#ebd093' } },
    { id: 'material_cosmic_windows', category: 'blockMaterials', name: 'Cosmic Windows', preview: '#9b9fc8', description: 'Crisp solid frames containing restrained distant space imagery.', requirement: { type: 'level', value: 10 },
      apply: { family: 'cosmic-windows', roughness: 0.22, metalness: 0.38, clearcoat: 0.82, emissiveIntensity: 0.08, emissiveAccent: '#c4c4e8' } },

    // --- movement-driven falling effects, independent of ambient particles ---
    { id: 'fall_none', category: 'fallingEffects', name: 'None', preview: '#8f9aa1', description: 'A clean piece silhouette without a movement trail.', requirement: { type: 'default' },
      apply: { effectId: 'none' } },
    { id: 'fall_fire', category: 'fallingEffects', name: 'Fire', preview: '#e8a464', description: 'Small rising flames leave a few embers on landing.', requirement: { type: 'level', value: 2 },
      apply: { effectId: 'fire' } },
    { id: 'fall_bubbles', category: 'fallingEffects', name: 'Bubbles', preview: '#8bb9c4', description: 'Air rings float away from falling pieces and disperse on landing.', requirement: { type: 'default' },
      apply: { effectId: 'bubbles' } },
    { id: 'fall_water', category: 'fallingEffects', name: 'Water', preview: '#83adcb', description: 'A short droplet trail ends in a shallow edge splash.', requirement: { type: 'stat', stat: 'totalLines', value: 20 },
      apply: { effectId: 'water' } },
    { id: 'fall_smoke', category: 'fallingEffects', name: 'Smoke', preview: '#a8a2a1', description: 'Thin, quickly fading wisps and a soft contact puff.', requirement: { type: 'stat', stat: 'gamesPlayed', value: 4 },
      apply: { effectId: 'smoke' } },
    { id: 'fall_frost', category: 'fallingEffects', name: 'Frost', preview: '#b1d4dd', description: 'Fine ice crystals and a brief frost outline at rest.', requirement: { type: 'level', value: 4 },
      apply: { effectId: 'frost' } },
    { id: 'fall_lightning', category: 'fallingEffects', name: 'Lightning', preview: '#e4dd9a', description: 'Quick arcs between cells and one short landing pulse.', requirement: { type: 'stat', stat: 'totalTSpins', value: 3 },
      apply: { effectId: 'lightning' } },
    { id: 'fall_lava', category: 'fallingEffects', name: 'Lava', preview: '#d88764', description: 'Molten droplets cool into a few sparks on contact.', requirement: { type: 'level', value: 5 }, apply: { effectId: 'lava' } },
    { id: 'fall_wind', category: 'fallingEffects', name: 'Wind', preview: '#a8c4bb', description: 'Fine curved streaks finish in a short outward gust.', requirement: { type: 'stat', stat: 'totalLines', value: 50 }, apply: { effectId: 'wind' } },
    { id: 'fall_stardust', category: 'fallingEffects', name: 'Stardust', preview: '#d4c7a1', description: 'Small stars settle into a brief landing constellation.', requirement: { type: 'level', value: 6 }, apply: { effectId: 'stardust' } },
    { id: 'fall_cherry_blossoms', category: 'fallingEffects', name: 'Cherry Blossoms', preview: '#dbaab5', description: 'A few tumbling petals scatter as the piece lands.', requirement: { type: 'stat', stat: 'gamesPlayed', value: 10 }, apply: { effectId: 'cherry-blossoms' } },
    { id: 'fall_digital_glitch', category: 'fallingEffects', name: 'Digital Glitch', preview: '#9da8bf', description: 'Brief pixel fragments trail motion without obscuring the board.', requirement: { type: 'stat', stat: 'bestCombo', value: 7 }, apply: { effectId: 'digital-glitch' } },
    { id: 'fall_ink', category: 'fallingEffects', name: 'Ink', preview: '#858d98', description: 'Short brush-like strokes and a contained landing splatter.', requirement: { type: 'stat', stat: 'totalPiecesPlaced', value: 500 }, apply: { effectId: 'ink' } },
    { id: 'fall_fireflies', category: 'fallingEffects', name: 'Fireflies', preview: '#c5c88a', description: 'Sparse warm followers disperse when the piece locks.', requirement: { type: 'level', value: 7 }, apply: { effectId: 'fireflies' } },
    { id: 'fall_soap_film', category: 'fallingEffects', name: 'Soap Film', preview: '#acc1c1', description: 'Iridescent edge bubbles stretch and pop after landing.', requirement: { type: 'stat', stat: 'totalTetrises', value: 6 }, apply: { effectId: 'soap-film' } },
    { id: 'fall_autumn_leaves', category: 'fallingEffects', name: 'Autumn Leaves', preview: '#bd9a6c', description: 'Small leaves drift around the falling piece and settle quickly.', requirement: { type: 'level', value: 8 }, apply: { effectId: 'autumn-leaves' } },
    { id: 'fall_comet', category: 'fallingEffects', name: 'Comet', preview: '#a7c1d0', description: 'A tapered trail intensifies during a hard drop.', requirement: { type: 'achievement', id: 'ach_tetris_10' }, apply: { effectId: 'comet' } },

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
    { id: 'bg_japanese_courtyard', category: 'backgrounds', name: 'Japanese Courtyard', preview: '#9dac88', description: 'Weathered timber, planted stone, and quiet daylight around a garden focal point.', requirement: { type: 'default' },
      apply: { nebulaColors: ['#b8c7aa', '#9aaa87', '#dcc9aa'], style: 'nebula', sceneId: 'japanese-courtyard' } },
    { id: 'bg_rainy_observatory', category: 'backgrounds', name: 'Rainy Observatory', preview: '#829ba5', description: 'A brass telescope and warm interior beneath a rain-washed glass dome.', requirement: { type: 'level', value: 3 },
      apply: { nebulaColors: ['#879eae', '#d2b381', '#455a70'], style: 'aurora', sceneId: 'rainy-observatory' } },
    { id: 'bg_desert_monument', category: 'backgrounds', name: 'Desert Monument', preview: '#d0a477', description: 'Layered sandstone architecture in late light above distant dunes.', requirement: { type: 'stat', stat: 'totalPiecesPlaced', value: 60 },
      apply: { nebulaColors: ['#d6a77b', '#a66b55', '#e6c599'], style: 'solar', sceneId: 'desert-monument' } },
    { id: 'bg_underwater_ruins', category: 'backgrounds', name: 'Underwater Ruins', preview: '#729e9d', description: 'Submerged masonry, selective growth, and filtered ocean light.', requirement: { type: 'stat', stat: 'totalLines', value: 40 },
      apply: { nebulaColors: ['#7aafb2', '#3e737f', '#b1c3a2'], style: 'aurora', sceneId: 'underwater-ruins' } },
    { id: 'bg_lunar_outpost', category: 'backgrounds', name: 'Lunar Outpost', preview: '#acb5b8', description: 'A practical scientific station above craters with distant Earth.', requirement: { type: 'level', value: 5 },
      apply: { nebulaColors: ['#a9b9c2', '#687b91', '#d4bda3'], style: 'orbit', sceneId: 'lunar-outpost' } },
    { id: 'bg_alpine_retreat', category: 'backgrounds', name: 'Alpine Retreat', preview: '#b5b5a5', description: 'Warm timber shelter, a quiet hearth, and snowfall beyond mountain windows.', requirement: { type: 'level', value: 6 },
      apply: { nebulaColors: ['#c8d6d6', '#899da6', '#d8b88b'], style: 'aurora', sceneId: 'alpine-retreat' } },
    { id: 'bg_cloud_sanctuary', category: 'backgrounds', name: 'Cloud Sanctuary', preview: '#c3c7bb', description: 'Pale stone terraces and suspended fabric above layered clouds.', requirement: { type: 'stat', stat: 'totalLines', value: 75 },
      apply: { nebulaColors: ['#d1d4c8', '#aab9c2', '#d5bd9e'], style: 'nebula', sceneId: 'cloud-sanctuary' } },
    { id: 'bg_autumn_library', category: 'backgrounds', name: 'Autumn Library', preview: '#aa8567', description: 'Carved shelving, books, leather, and golden window light.', requirement: { type: 'stat', stat: 'totalPiecesPlaced', value: 400 },
      apply: { nebulaColors: ['#c09a70', '#6e5549', '#d5b88c'], style: 'solar', sceneId: 'autumn-library' } },
    { id: 'bg_volcanic_coast', category: 'backgrounds', name: 'Volcanic Coast', preview: '#847474', description: 'Black-rock cliffs frame ocean depth, distant lava, and drifting steam.', requirement: { type: 'level', value: 8 },
      apply: { nebulaColors: ['#9b7c74', '#475d68', '#d39a75'], style: 'solar', sceneId: 'volcanic-coast' } },
    { id: 'bg_paper_landscape', category: 'backgrounds', name: 'Paper Landscape', preview: '#cfbfa8', description: 'Folded paper forms, layered cut edges, and gentle suspended motion.', requirement: { type: 'stat', stat: 'gamesPlayed', value: 15 },
      apply: { nebulaColors: ['#e5d6ba', '#b1c0b7', '#cda68d'], style: 'prism', sceneId: 'paper-landscape' } },
    { id: 'bg_clockmakers_workshop', category: 'backgrounds', name: "Clockmaker's Workshop", preview: '#b09875', description: 'Slow coherent mechanisms among brass, wood, enamel, and tools.', requirement: { type: 'stat', stat: 'totalTetrises', value: 8 },
      apply: { nebulaColors: ['#b9a27d', '#6e6f6b', '#d5b684'], style: 'clockwork', sceneId: 'clockmakers-workshop' } },
    { id: 'bg_rainforest_temple', category: 'backgrounds', name: 'Rainforest Temple', preview: '#7a9a7c', description: 'Weathered temple architecture beneath roots, water, and canopy light.', requirement: { type: 'level', value: 10 },
      apply: { nebulaColors: ['#8da98b', '#456a64', '#b7b78f'], style: 'aurora', sceneId: 'rainforest-temple' } },

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
