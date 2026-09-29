import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { collectGameplayEvents } from './gameplaySignals.js';
import { createModeWorld } from './modeWorlds.js';
import { BoardEffects3D } from './BoardEffects3D.js';
import { graphicsPreset } from './graphicsQuality.js';
import { BoardHousing3D } from './BoardHousing3D.js';
import { WORLD_LIGHTING, reflectionStudio } from './worldLighting.js';
import { PIECE_TYPES, roundedBlockGeometry, createBlockAppearance } from './blockAppearance.js';
import { createBoardSurfaceMaterial } from './boardSurface.js';
import { FallingEffects3D } from './FallingEffects3D.js';

const BASE_SETTINGS = Object.freeze({
  reducedMotion: false,
  colorblindMode: false,
  particleIntensity: 1,
  glowIntensity: 1,
  graphicsQuality: 'high',
  background3D: true,
  ambientOcclusion: true,
});

/**
 * Convert a DOM client rectangle into the pixel-coordinate world used by the
 * full-window orthographic camera. X is centered; Y is centered and positive up.
 */
export function rectToWorldRect(rect, viewportWidth, viewportHeight) {
  return {
    x: rect.left + rect.width / 2 - viewportWidth / 2,
    y: viewportHeight / 2 - (rect.top + rect.height / 2),
    width: rect.width,
    height: rect.height,
  };
}

function worldCellPosition(rect, cols, rows, col, row, z) {
  const cellWidth = rect.width / cols;
  const cellHeight = rect.height / rows;
  return {
    x: rect.x + (col + 0.5) * cellWidth - rect.width / 2,
    y: rect.y + rect.height / 2 - (row + 0.5) * cellHeight,
    z,
    cellWidth,
    cellHeight,
  };
}

function pieceCells(shapes, type, rotation = 0) {
  return shapes?.[type]?.[rotation] || [];
}

/** Read-only 3D presentation adapter. Gameplay and Canvas remain authoritative. */
export class PremiumSceneRenderer {
  constructor({
    canvas,
    boardCanvas,
    nextCanvas,
    holdCanvas,
    onAvailabilityChange,
    rendererFactory = (options) => new THREE.WebGLRenderer(options),
  } = {}) {
    this.canvas = canvas;
    this.boardCanvas = boardCanvas;
    this.nextCanvas = nextCanvas;
    this.holdCanvas = holdCanvas;
    this.onAvailabilityChange = onAvailabilityChange;
    this.windowRef = typeof window === 'undefined' ? null : window;
    this.available = false;
    this.disposed = false;
    this.THREE = THREE;
    this.renderer = null;
    this.composer = null;
    this.bloomPass = null;
    this.aoPass = null;
    this.environmentTarget = null;
    this.settings = { ...BASE_SETTINGS };
    this.blockMaterial = { family: 'ceramic', roughness: 0.28, metalness: 0.48, clearcoat: 0.84, emissiveIntensity: 0.2 };
    this.blockAppearance = createBlockAppearance();
    this.boardTheme = { bgTop: '#111a2e', bgBottom: '#080b14', gridColor: '#78d2ff', gridAlpha: 0.11 };
    this.pieceColors = {};
    this.materials = new Map();
    this.ghostMaterials = new Map();
    this.dimMaterials = new Map();
    this.meshPools = { board: [], active: [], ghost: [], next: [], hold: [] };
    this.shapes = null;
    this.elapsedMs = 0;
    this._viewportWidth = 0;
    this._viewportHeight = 0;
    this._pixelRatio = 0;
    this.modeWorld = null;
    this.eventCursor = null;
    this.runId = null;
    this.modeId = null;
    this.pieceMotion = null;
    this.backgroundPalette = null;
    this.ambientParticleColors = null;
    this.ambientParticleShape = 'spark';
    this.clearEffect = null;

    this.scene = new THREE.Scene();
    this.worldScene = new THREE.Scene();
    this.worldScene.background = new THREE.Color('#0a1722');
    this.worldCamera = new THREE.PerspectiveCamera(35, 1, 1, 4000);
    this.worldCamera.position.set(0, 90, 1000);
    this.worldCamera.lookAt(0, 0, -180);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 3000);
    this.camera.position.set(0, 0, 1200);
    this.camera.lookAt(0, 0, 0);

    this._createSharedResources();
    this._createBoardPresentation();
    this._createPreviewBackdrops();
    this.boardHousing = new BoardHousing3D(this.scene);
    this._createPieceLayers();
    this.boardEffects = new BoardEffects3D(this.scene, this.blockGeometry, this.materials);
    this.fallingEffects = new FallingEffects3D(this.scene);
    this._onContextLost = this._handleContextLost.bind(this);
    this._onContextRestored = this._handleContextRestored.bind(this);
    canvas?.addEventListener?.('webglcontextlost', this._onContextLost, false);
    canvas?.addEventListener?.('webglcontextrestored', this._onContextRestored, false);
    this.onAvailabilityChange?.(false);

    try {
      this.renderer = rendererFactory({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        premultipliedAlpha: true,
      });
      this.renderer.setClearColor?.(0x000000, 0);
      if ('outputColorSpace' in this.renderer) this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      if ('toneMapping' in this.renderer) this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      if ('toneMappingExposure' in this.renderer) this.renderer.toneMappingExposure = 1.16;
      this._setupPostprocessing();
      this.resize();
      this._setAvailable(true);
    } catch (error) {
      try { this.composer?.dispose?.(); } catch { /* Preserve the Canvas fallback if partial cleanup fails. */ }
      try { this.renderer?.dispose?.(); } catch { /* Preserve the Canvas fallback if partial cleanup fails. */ }
      this.composer = null;
      this.bloomPass = null;
      this.environmentTarget?.dispose?.();
      this.environmentTarget = null;
      this.renderer = null;
      this._setAvailable(false);
    }
  }

  _createSharedResources() {
    this.blockGeometry = roundedBlockGeometry();
    this.panelMaterial = createBoardSurfaceMaterial(this.boardTheme);
    this.gridMaterial = new THREE.LineBasicMaterial({
      color: this.boardTheme.gridColor,
      transparent: true,
      opacity: this.boardTheme.gridAlpha,
      depthWrite: false,
    });
    this.borderMaterial = new THREE.LineBasicMaterial({
      color: '#7edfff',
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });

    PIECE_TYPES.forEach((type) => {
      const color = new THREE.Color('#ffffff');
      const material = new THREE.MeshPhysicalMaterial({
        color,
        emissive: color.clone(),
        emissiveIntensity: this.blockMaterial.emissiveIntensity,
        metalness: this.blockMaterial.metalness,
        roughness: this.blockMaterial.roughness,
        clearcoat: this.blockMaterial.clearcoat,
        clearcoatRoughness: 0.2,
      });
      this.materials.set(type, material);
      const ghostMaterial = material.clone();
      ghostMaterial.transparent = true;
      ghostMaterial.opacity = 0.27;
      ghostMaterial.depthWrite = false;
      ghostMaterial.emissiveIntensity = 0.08;
      this.ghostMaterials.set(type, ghostMaterial);
      const dimMaterial = material.clone();
      dimMaterial.transparent = true;
      dimMaterial.opacity = 0.38;
      dimMaterial.depthWrite = false;
      dimMaterial.emissiveIntensity = 0.06;
      this.dimMaterials.set(type, dimMaterial);
    });

    this.ambientLight = new THREE.HemisphereLight('#dce5e9', '#17212a', 0.7);
    this.keyLight = new THREE.DirectionalLight('#ffffff', 1.4);
    this.keyLight.position.set(-180, 240, 650);
    this.rimLight = new THREE.PointLight('#89a7aa', 0.5, 900, 2);
    this.rimLight.position.set(0, 0, 80);
    this.scene.add(this.ambientLight, this.keyLight, this.rimLight);
  }

  _createBoardPresentation() {
    this.boardBacking = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.panelMaterial);
    this.boardBacking.position.z = -4;
    this.boardBacking.visible = false;
    this.scene.add(this.boardBacking);

    this.gridLines = new THREE.LineSegments(new THREE.BufferGeometry(), this.gridMaterial);
    this.gridLines.position.z = -2;
    this.gridLines.visible = false;
    this.scene.add(this.gridLines);

    const borderGeometry = new THREE.BufferGeometry();
    this.boardBorder = new THREE.LineLoop(borderGeometry, this.borderMaterial);
    this.boardBorder.position.z = -1;
    this.boardBorder.visible = false;
    this.scene.add(this.boardBorder);
  }

  _createPieceLayers() {
    this.layers = {};
    Object.entries(this.meshPools).forEach(([name]) => {
      const group = new THREE.Group();
      group.name = `tetris-${name}`;
      this.layers[name] = group;
      this.scene.add(group);
    });
  }

  _createEnvironmentMap(mode = this.modeId || 'endless') {
    this.environmentTarget?.dispose?.();
    this.environmentTarget = null;
    this.worldScene.environment = null;
    this.scene.environment = null;
    if (!this.renderer?.isWebGLRenderer) return;
    let studio;
    let pmrem;
    try {
      studio = reflectionStudio(mode);
      pmrem = new THREE.PMREMGenerator(this.renderer);
      this.environmentTarget = pmrem.fromScene(studio, 0.04);
      this.worldScene.environment = this.environmentTarget.texture;
      this.scene.environment = this.environmentTarget.texture;
      this.worldScene.environmentIntensity = 0.38;
      this.scene.environmentIntensity = 0.32;
    } catch (error) {
      // Geometry and direct lights remain usable without environment reflections.
      console.warn('Environment reflections unavailable.', error);
    } finally {
      pmrem?.dispose();
      studio?.dispose();
    }
  }

  _createPreviewBackdrops() {
    this.previewBackdropGeometry = new THREE.PlaneGeometry(1, 1);
    this.previewBackdropMaterial = new THREE.MeshBasicMaterial({
      color: '#07121c', transparent: true, opacity: 0.72, depthWrite: false,
    });
    this.previewBackdrops = {};
    for (const name of ['next', 'hold']) {
      const backdrop = new THREE.Mesh(this.previewBackdropGeometry, this.previewBackdropMaterial);
      backdrop.position.z = 1;
      backdrop.visible = false;
      this.scene.add(backdrop);
      this.previewBackdrops[name] = backdrop;
    }
  }

  _setupPostprocessing() {
    // Test/fallback renderers need no post-processing; the real WebGL path gets
    // scene-only post-processing. The board is composited afterward at full resolution.
    if (!this.renderer?.isWebGLRenderer) return;
    try {
      const size = this.renderer.getSize(new THREE.Vector2());
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.worldScene, this.worldCamera));
      this.aoPass = new SSAOPass(this.worldScene, this.worldCamera, size.x, size.y);
      this.aoPass.kernelRadius = 12;
      this.aoPass.minDistance = 0.006;
      this.aoPass.maxDistance = 0.12;
      this.composer.addPass(this.aoPass);
      this.bloomPass = new UnrealBloomPass(size, 0.32, 0.72, 0.64);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
      this._applyGraphicsQuality();
      this._applyBloomSettings();
    } catch (error) {
      console.warn('Post-processing unavailable; using direct 3D rendering.', error);
      this.composer?.dispose?.();
      this.composer = null;
      this.aoPass = null;
      this.bloomPass = null;
    }
  }

  _applyGraphicsQuality() {
    if (!this.renderer?.isWebGLRenderer) return;
    const maxSamples = this.renderer.capabilities?.maxSamples ?? 0;
    const maxAnisotropy = this.renderer.capabilities?.getMaxAnisotropy?.() ?? 1;
    const preset = graphicsPreset(this.settings.graphicsQuality, maxSamples, maxAnisotropy);
    this.qualityPreset = preset;
    this.renderer.shadowMap.enabled = preset.shadowSize > 0;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.composer?.setPixelRatio?.(this._pixelRatio * preset.renderScale || preset.renderScale);
    this.composer?.setSize?.(this._viewportWidth || 1, this._viewportHeight || 1);
    if (this.composer?.renderTarget1) this.composer.renderTarget1.samples = preset.samples;
    if (this.composer?.renderTarget2) this.composer.renderTarget2.samples = preset.samples;
    if (this.aoPass) this.aoPass.enabled = preset.ao && this.settings.ambientOcclusion;
    this.modeWorld?.setQuality?.(preset);
    this.modeWorld?.setFiltering?.(preset.anisotropy);
  }

  _setAvailable(available) {
    const next = !!available;
    if (this.available === next) return;
    this.available = next;
    this.onAvailabilityChange?.(next);
  }

  _handleContextLost(event) {
    event.preventDefault?.();
    this._setAvailable(false);
  }

  _handleContextRestored() {
    if (this.disposed || !this.renderer) return;
    try {
      this.composer?.dispose?.();
      this.composer = null;
      this.aoPass = null;
      this.bloomPass = null;
      this._createEnvironmentMap();
      this._setupPostprocessing();
      this.resize();
      this._setAvailable(true);
    } catch (error) {
      console.warn('WebGL context restoration failed; Canvas remains active.', error);
      this._setAvailable(false);
    }
  }

  resize() {
    if (!this.renderer || this.disposed) return;
    const fallbackRect = this.canvas?.getBoundingClientRect?.() || { width: 1, height: 1 };
    const width = Math.max(1, this.windowRef?.innerWidth || fallbackRect.width || 1);
    const height = Math.max(1, this.windowRef?.innerHeight || fallbackRect.height || 1);
    const pixelRatio = Math.max(1, Math.min(2, this.windowRef?.devicePixelRatio || 1));
    this._viewportWidth = width;
    this._viewportHeight = height;
    this._pixelRatio = pixelRatio;
    this.renderer.setPixelRatio?.(pixelRatio);
    this.renderer.setSize?.(width, height, false);

    this.camera.left = -width / 2;
    this.camera.right = width / 2;
    this.camera.top = height / 2;
    this.camera.bottom = -height / 2;
    this.camera.updateProjectionMatrix();
    this.worldCamera.aspect = width / height;
    this.worldCamera.updateProjectionMatrix();
    this.composer?.setPixelRatio?.(pixelRatio * (this.qualityPreset?.renderScale || 1));
    this.composer?.setSize?.(width, height);
  }

  _worldRect(canvas) {
    const rect = canvas?.getBoundingClientRect?.();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return rectToWorldRect(rect, this._viewportWidth, this._viewportHeight);
  }

  _updateModeWorld(game, meta) {
    const mode = game.mode || 'endless';
    if (!this.modeWorld || mode !== this.modeId) {
      if (this.modeWorld) {
        this.worldScene.remove(this.modeWorld.group);
        this.modeWorld.dispose();
      }
      this.modeWorld = createModeWorld(mode);
      this.modeId = this.modeWorld.descriptor.id;
      this._applyModeLighting(this.modeId);
      this._createEnvironmentMap(this.modeId);
      this.eventCursor = null;
      this.runId = null;
      this.boardEffects.reset();
      this.fallingEffects.reset();
      this.pieceMotion = null;
      this.worldScene.add(this.modeWorld.group);
      this.modeWorld.setQuality?.(this.qualityPreset);
      this.modeWorld.setFiltering?.(this.qualityPreset?.anisotropy || 1);
      if (this.backgroundPalette) this.modeWorld.setPalette(this.backgroundPalette.colors, this.backgroundPalette.style, this.backgroundPalette.sceneId);
      if (this.ambientParticleColors) this.modeWorld.setAmbientParticles(this.ambientParticleColors, this.ambientParticleShape);
      if (this.clearEffect) this.modeWorld.setClearEffect(this.clearEffect);
    }

    if (this.runId !== game.runId) {
      this.runId = game.runId;
      this.eventCursor = null;
      this.boardEffects.reset();
      this.fallingEffects.reset();
      this.pieceMotion = null;
    }

    const collection = collectGameplayEvents(game, this.eventCursor);
    this.eventCursor = collection.cursor;
    const dt = Math.min(50, Math.max(0, meta.dt ?? 16.7));

    const background = this.modeWorld.group.children.find((child) => child.isMesh && child.material?.uniforms?.uTop);
    if (background) {
      const distance = this.worldCamera.position.z + 280;
      const height = 2 * distance * Math.tan(THREE.MathUtils.degToRad(this.worldCamera.fov / 2));
      background.scale.set(height * this.worldCamera.aspect * 1.02, height * 1.02, 1);
      background.position.set(0, 0, -280);
    }
    this.modeWorld.update({
      dtMs: game.state === 'PLAYING' && !meta.menuOpen && !this.windowRef?.document?.hidden ? dt : 0,
      elapsedMs: this.elapsedMs,
      game,
      events: collection.events,
      settings: this.settings,
      viewportWidth: this._viewportWidth,
      viewportHeight: this._viewportHeight,
    });
    return collection.events;
  }

  _applyModeLighting(mode) {
    const art = WORLD_LIGHTING[mode] || WORLD_LIGHTING.endless;
    this.keyLight.position.set(art.position[0] * 0.45, art.position[1] * 0.5, 650);
    this.keyLight.color.set(art.key).lerp(new THREE.Color('#ffffff'), 0.65);
    this.keyLight.intensity = 1.3;
    this.ambientLight.color.set(art.fill).lerp(new THREE.Color('#e5e9ec'), 0.68);
    this.ambientLight.groundColor.set(art.ground);
    this.rimLight.color.set(art.rim).lerp(new THREE.Color('#ffffff'), 0.48);
  }

  _ensurePool(name, size) {
    const pool = this.meshPools[name];
    while (pool.length < size) {
      const mesh = new THREE.Mesh(this.blockGeometry, this.materials.get('I'));
      mesh.visible = false;
      mesh.userData.pieceType = 'I';
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.layers[name].add(mesh);
      pool.push(mesh);
    }
    return pool;
  }

  _placeBlocks(name, blocks, rect, cols, rows, pieceColors, z, alpha = 1) {
    if (!rect || !cols || !rows) return;
    const pool = this._ensurePool(name, blocks.length);
    blocks.forEach((block, index) => {
      const mesh = pool[index];
      const color = pieceColors[block.type] || '#ffffff';
      const material = this.materials.get(block.type) || this.materials.get('I');
      const visualMaterial = alpha < 0.5
        ? this.dimMaterials.get(block.type)
        : alpha < 1 ? this.ghostMaterials.get(block.type) : material;
      if (mesh.material !== visualMaterial) mesh.material = visualMaterial;
      visualMaterial.color.set(color);
      this._setEmissiveColor(visualMaterial, color);
      const point = worldCellPosition(rect, cols, rows, block.col, block.row, z);
      mesh.position.set(point.x, point.y, z);
      if (name === 'board') mesh.position.y += this.boardEffects.getRowOffset(block.row, point.cellHeight, this.settings.reducedMotion);
      const clearing = name === 'board' && this._clearingRows?.has(block.row);
      const vanish = clearing && !this.settings.reducedMotion
        ? 1 - Math.max(0, (this._clearProgress - 0.5) * 2) ** 2 : 1;
      mesh.scale.set(point.cellWidth * 0.9, point.cellHeight * 0.9 * vanish,
        Math.min(point.cellWidth, point.cellHeight) * 0.75);
      mesh.visible = vanish > 0.02 && (name !== 'board'
        || !this.boardEffects.getHiddenLockCells()?.has(`${block.col}:${block.row}`));
    });
    for (let i = blocks.length; i < pool.length; i += 1) pool[i].visible = false;
  }

  _positionBoard(game) {
    const rect = this._worldRect(this.boardCanvas);
    if (!rect) return null;
    const width = rect.width;
    const height = rect.height;
    const { cols, rows } = game.board;
    this.boardBacking.position.set(rect.x, rect.y, -4);
    this.boardBacking.scale.set(width, height, 1);
    this.boardBacking.visible = true;
    this.boardHousing.update(rect, game.mode, this.settings.glowIntensity);

    const positions = [];
    const cellWidth = width / cols;
    const cellHeight = height / rows;
    for (let col = 0; col <= cols; col += 1) {
      const x = rect.x - width / 2 + col * cellWidth;
      positions.push(new THREE.Vector3(x, rect.y - height / 2, -2), new THREE.Vector3(x, rect.y + height / 2, -2));
    }
    for (let row = 0; row <= rows; row += 1) {
      const y = rect.y + height / 2 - row * cellHeight;
      positions.push(new THREE.Vector3(rect.x - width / 2, y, -2), new THREE.Vector3(rect.x + width / 2, y, -2));
    }
    const edge = [
      new THREE.Vector3(rect.x - width / 2, rect.y - height / 2, -1),
      new THREE.Vector3(rect.x + width / 2, rect.y - height / 2, -1),
      new THREE.Vector3(rect.x + width / 2, rect.y + height / 2, -1),
      new THREE.Vector3(rect.x - width / 2, rect.y + height / 2, -1),
    ];
    const layoutKey = [rect.x, rect.y, width, height, cols, rows].join(':');
    if (layoutKey !== this._boardLayoutKey) {
      this.gridLines.geometry.setFromPoints(positions);
      this.boardBorder.geometry.setFromPoints(edge);
      this._boardLayoutKey = layoutKey;
    }
    this.gridLines.visible = true;
    this.boardBorder.visible = true;
    return rect;
  }

  _buildBoardBlocks(game) {
    const blocks = [];
    const { grid, cols, rows } = game.board;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const type = grid[row][col];
        if (type) blocks.push({ type, col, row });
      }
    }
    return blocks;
  }

  _buildPieceBlocks(piece, dt) {
    if (!piece) {
      this.pieceMotion = null;
      return [];
    }
    const target = piece.getCells().map(({ col, row }) => ({ col, row }));
    const state = `${piece.col}:${piece.row}:${piece.rotation}`;
    const motion = this.pieceMotion;
    if (!motion || motion.ref !== piece || this.settings.reducedMotion) {
      this.pieceMotion = { ref: piece, state, from: target, to: target, age: 1, life: 1,
        rotation: piece.rotation, row: piece.row };
    } else if (motion.state !== state) {
      const t = Math.min(1, motion.age / motion.life);
      const eased = 1 - (1 - t) ** 3;
      const from = motion.to.map((cell, index) => ({
        col: motion.from[index].col + (cell.col - motion.from[index].col) * eased,
        row: motion.from[index].row + (cell.row - motion.from[index].row) * eased,
      }));
      this.pieceMotion = {
        ref: piece, state, from, to: target, age: 0,
        life: piece.rotation !== motion.rotation ? 125 : piece.row !== motion.row ? 70 : 85,
        rotation: piece.rotation, row: piece.row,
      };
    }
    const current = this.pieceMotion;
    current.age = Math.min(current.life, current.age + Math.max(0, dt ?? 16.7));
    current.rotation = piece.rotation;
    current.row = piece.row;
    const t = Math.min(1, current.age / current.life);
    const eased = 1 - (1 - t) ** 3;
    return current.to.map((cell, index) => ({
      type: piece.type,
      col: current.from[index].col + (cell.col - current.from[index].col) * eased,
      row: current.from[index].row + (cell.row - current.from[index].row) * eased,
    })).filter(({ row }) => row >= -0.5);
  }

  _buildGhostBlocks(game) {
    if (game.state !== 'PLAYING' || !game.activePiece) return [];
    const ghostRow = game.getGhostRow?.();
    if (ghostRow === null || ghostRow === undefined || ghostRow === game.activePiece.row) return [];
    return game.activePiece.getCells(game.activePiece.col, ghostRow, game.activePiece.rotation)
      .filter(({ row }) => row >= 0)
      .map(({ col, row }) => ({ type: game.activePiece.type, col, row }));
  }

  _placePreviewBlocks(name, types, canvas, pieceColors, opacity = 1) {
    const rect = this._worldRect(canvas);
    const backdrop = this.previewBackdrops?.[name];
    if (backdrop) {
      backdrop.visible = !!(rect && types.length);
      if (backdrop.visible) {
        backdrop.position.set(rect.x, rect.y, 1);
        backdrop.scale.set(rect.width, rect.height, 1);
      }
    }
    if (!rect || !types.length) {
      this.meshPools[name].forEach((mesh) => { mesh.visible = false; });
      return;
    }
    const slotHeight = rect.height / types.length;
    const blocks = [];
    types.forEach((type, slotIndex) => {
      const cells = pieceCells(this.shapes, type, 0);
      if (!cells.length) return;
      const minCol = Math.min(...cells.map(([col]) => col));
      const maxCol = Math.max(...cells.map(([col]) => col));
      const minRow = Math.min(...cells.map(([, row]) => row));
      const maxRow = Math.max(...cells.map(([, row]) => row));
      const spanCols = maxCol - minCol + 1;
      const spanRows = maxRow - minRow + 1;
      const cell = Math.min(rect.width / 5, (rect.width - 12) / spanCols, (slotHeight - 8) / spanRows);
      const firstX = rect.x - spanCols * cell / 2 + cell / 2;
      const centerY = rect.y + rect.height / 2 - (slotIndex + 0.5) * slotHeight;
      cells.forEach(([col, row]) => blocks.push({
        type,
        x: firstX + (col - minCol) * cell,
        y: centerY - (row - minRow - (spanRows - 1) / 2) * cell,
        cell,
      }));
    });

    const pool = this._ensurePool(name, blocks.length);
    blocks.forEach((block, index) => {
      const mesh = pool[index];
      const material = this.materials.get(block.type) || this.materials.get('I');
      const visualMaterial = opacity < 0.5 ? this.dimMaterials.get(block.type) : material;
      mesh.material = visualMaterial;
      const color = pieceColors[block.type] || '#ffffff';
      visualMaterial.color.set(color);
      this._setEmissiveColor(visualMaterial, color);
      mesh.position.set(block.x, block.y, 7);
      mesh.scale.set(block.cell * 0.86, block.cell * 0.86, block.cell * 0.6);
      mesh.visible = true;
    });
    for (let index = blocks.length; index < pool.length; index += 1) pool[index].visible = false;
  }

  _setEmissiveColor(material, color) {
    material.emissive.set(color);
    if (this.blockMaterial.emissiveAccent) {
      material.emissive.lerp(new THREE.Color(this.blockMaterial.emissiveAccent), 0.35);
    }
  }

  render(game, meta = {}, pieceColors = {}) {
    if (this.disposed || !this.available || !this.renderer || !game?.board) return;
    const visualDt = game.state === 'PLAYING' && !meta.menuOpen && !this.windowRef?.document?.hidden
      ? meta.dt || 0 : 0;
    this.elapsedMs += visualDt;
    if (this._viewportWidth !== (this.windowRef?.innerWidth || this._viewportWidth)
      || this._viewportHeight !== (this.windowRef?.innerHeight || this._viewportHeight)
      || this._pixelRatio !== (this.windowRef?.devicePixelRatio || this._pixelRatio)) this.resize();

    this.shapes = meta.shapes || this.shapes || this.windowRef?.TETRIS?.SHAPES || null;
    this.pieceColors = pieceColors || this.pieceColors;
    const boardRect = this._positionBoard(game);
    if (!boardRect) return;
    this.gridMaterial.color.set(this.boardTheme.gridColor || '#78d2ff');
    this.gridMaterial.opacity = this.settings.glowIntensity > 0 ? (this.boardTheme.gridAlpha || 0.1) * 0.65 : 0.035;
    this._applyBoardTheme();

    const events = this._updateModeWorld(game, { ...meta, dt: visualDt });
    this.blockAppearance.update({ timeMs: this.elapsedMs, dtMs: visualDt,
      reducedMotion: this.settings.reducedMotion || visualDt <= 0,
      locked: events.some(({ type }) => type === 'lock'),
      cleared: events.some(({ type }) => type === 'clear') });
    this.boardEffects.update(game, events, boardRect, this.settings, this.shapes,
      this.pieceColors, this.clearEffect?.flashColor || '#85eaff', visualDt);
    if (meta.menuOpen || game.state === 'GAME_OVER') this.fallingEffects.reset();
    else this.fallingEffects.update({ game, events, boardRect, settings: this.settings,
      dtMs: visualDt, colors: this.pieceColors, shapes: this.shapes });
    this._clearingRows = game.clearingRows ? new Set(game.clearingRows) : null;
    this._clearProgress = Math.min(1, (game.clearTimer || 0) / 220);

    const boardBlocks = this._buildBoardBlocks(game);
    this._placeBlocks('board', boardBlocks, boardRect, game.board.cols, game.board.rows, this.pieceColors, 0, 1);
    const activeBlocks = this._buildPieceBlocks(game.activePiece, visualDt);
    this._placeBlocks('active', activeBlocks, boardRect, game.board.cols, game.board.rows, this.pieceColors, 8, 1);
    const ghostBlocks = this._buildGhostBlocks(game);
    this._placeBlocks('ghost', ghostBlocks, boardRect, game.board.cols, game.board.rows, this.pieceColors, 4, 0.25);

    const nextTypes = game.pieceQueue?.peek?.(5) || [];
    this._placePreviewBlocks('next', nextTypes, this.nextCanvas, this.pieceColors, 0.96);
    const holdTypes = game.holdType ? [game.holdType] : [];
    this._placePreviewBlocks('hold', holdTypes, this.holdCanvas, this.pieceColors, game.canHold ? 0.96 : 0.38);

    this.rimLight.intensity = 0.22 + Math.min(0.4, this.settings.glowIntensity * (this.settings.reducedMotion ? 0.12 : 0.24));
    this._applyBloomSettings();
    if (this.composer) {
      if (this.settings.background3D) this.composer.render();
      else this.renderer.clear();
      this.renderer.clearDepth();
      const oldAutoClear = this.renderer.autoClear;
      this.renderer.autoClear = false;
      this.renderer.render(this.scene, this.camera);
      this.renderer.autoClear = oldAutoClear;
    } else if (this.renderer.isWebGLRenderer) {
      if (this.settings.background3D) this.renderer.render(this.worldScene, this.worldCamera);
      else this.renderer.clear();
      this.renderer.clearDepth();
      const oldAutoClear = this.renderer.autoClear;
      this.renderer.autoClear = false;
      this.renderer.render(this.scene, this.camera);
      this.renderer.autoClear = oldAutoClear;
    } else this.renderer.render(this.scene, this.camera);
  }

  setBlockMaterial(data = {}) {
    this.blockMaterial = {
      ...this.blockMaterial,
      family: data.family || this.blockMaterial.family,
      roughness: clamp(data.roughness, 0.04, 1, this.blockMaterial.roughness),
      metalness: clamp(data.metalness, 0, 1, this.blockMaterial.metalness),
      clearcoat: clamp(data.clearcoat, 0, 1, this.blockMaterial.clearcoat),
      emissiveIntensity: clamp(data.emissiveIntensity, 0, 2.5, this.blockMaterial.emissiveIntensity),
      emissiveAccent: data.emissiveAccent || null,
    };
    this.materials.forEach((material) => {
      this.blockAppearance.apply(material, this.blockMaterial);
      material.emissiveIntensity = this.blockMaterial.emissiveIntensity * this.settings.glowIntensity;
    });
    [this.ghostMaterials, this.dimMaterials].forEach((variants) => variants.forEach((material) => {
      this.blockAppearance.apply(material, this.blockMaterial, { ghost: true });
    }));
  }

  setFallingEffect(effectId = 'none') {
    this.fallingEffects.setEffect(effectId);
  }

  setSettings(settings = {}) {
    this.settings = {
      ...this.settings,
      ...settings,
      particleIntensity: clamp(settings.particleIntensity, 0, 1, this.settings.particleIntensity),
      glowIntensity: clamp(settings.glowIntensity, 0, 1.5, this.settings.glowIntensity),
    };
    this.materials.forEach((material) => {
      material.emissiveIntensity = this.blockMaterial.emissiveIntensity * this.settings.glowIntensity;
    });
    this.ghostMaterials.forEach((material) => { material.emissiveIntensity = 0.08 * this.settings.glowIntensity; });
    this.dimMaterials.forEach((material) => { material.emissiveIntensity = 0.06 * this.settings.glowIntensity; });
    this.ambientLight.intensity = this.settings.reducedMotion ? 0.8 : 1.2;
    this._applyGraphicsQuality();
    this._applyBloomSettings();
  }

  setBoardTheme(theme = {}) {
    this.boardTheme = { ...this.boardTheme, ...theme };
    this.gridMaterial.color.set(this.boardTheme.gridColor || '#78d2ff');
    this._applyBoardTheme();
  }

  _applyBoardTheme() {
    this.panelMaterial.uniforms.uTop.value.set(this.boardTheme.bgTop || '#111a2e');
    this.panelMaterial.uniforms.uBottom.value.set(this.boardTheme.bgBottom || '#080b14');
  }

  setAmbientParticles(colors, shape) {
    this.ambientParticleColors = colors || null;
    this.ambientParticleShape = shape || 'spark';
    this.modeWorld?.setAmbientParticles(this.ambientParticleColors, this.ambientParticleShape);
  }

  setBackgroundPalette(colors, style, sceneId = null) {
    this.backgroundPalette = { colors, style, sceneId };
    this.modeWorld?.setPalette(colors, style, sceneId);
  }

  setClearEffect(effect = {}) {
    this.clearEffect = { ...effect };
    this.modeWorld?.setClearEffect(this.clearEffect);
  }

  _applyBloomSettings() {
    if (!this.bloomPass) return;
    const enabled = this.qualityPreset?.bloom && this.settings.glowIntensity > 0 && !this.settings.reducedMotion;
    this.bloomPass.enabled = enabled;
    this.bloomPass.strength = enabled ? 0.24 * this.settings.glowIntensity : 0;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas?.removeEventListener?.('webglcontextlost', this._onContextLost, false);
    this.canvas?.removeEventListener?.('webglcontextrestored', this._onContextRestored, false);
    if (this.modeWorld) {
      this.worldScene.remove(this.modeWorld.group);
      this.modeWorld.dispose();
      this.modeWorld = null;
    }
    this.composer?.dispose?.();
    this.bloomPass?.dispose?.();
    this.aoPass?.dispose?.();
    this.environmentTarget?.dispose?.();
    this.boardEffects.dispose();
    this.fallingEffects.dispose();
    this.boardHousing.dispose();
    this.gridLines.geometry.dispose();
    this.boardBorder.geometry.dispose();
    this.boardBacking.geometry.dispose();
    this.previewBackdropGeometry.dispose();
    this.previewBackdropMaterial.dispose();
    this.blockGeometry.dispose();
    this.blockAppearance.dispose();
    this.panelMaterial.dispose();
    this.gridMaterial.dispose();
    this.borderMaterial.dispose();
    this.materials.forEach((material) => material.dispose());
    this.ghostMaterials.forEach((material) => material.dispose());
    this.dimMaterials.forEach((material) => material.dispose());
    this.renderer?.dispose?.();
    this.renderer = null;
    this.composer = null;
    this._setAvailable(false);
  }
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}
