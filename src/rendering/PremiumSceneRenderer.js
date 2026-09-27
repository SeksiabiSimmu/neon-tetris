import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { collectGameplayEvents } from './gameplaySignals.js';
import { createModeWorld } from './modeWorlds.js';

const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const BASE_SETTINGS = Object.freeze({
  reducedMotion: false,
  colorblindMode: false,
  screenShake: 1,
  particleIntensity: 1,
  glowIntensity: 1,
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

function roundedBlockGeometry() {
  const shape = new THREE.Shape();
  const inset = 0.07;
  const radius = 0.17;
  shape.moveTo(-0.5 + inset + radius, -0.5 + inset);
  shape.lineTo(0.5 - inset - radius, -0.5 + inset);
  shape.quadraticCurveTo(0.5 - inset, -0.5 + inset, 0.5 - inset, -0.5 + inset + radius);
  shape.lineTo(0.5 - inset, 0.5 - inset - radius);
  shape.quadraticCurveTo(0.5 - inset, 0.5 - inset, 0.5 - inset - radius, 0.5 - inset);
  shape.lineTo(-0.5 + inset + radius, 0.5 - inset);
  shape.quadraticCurveTo(-0.5 + inset, 0.5 - inset, -0.5 + inset, 0.5 - inset - radius);
  shape.lineTo(-0.5 + inset, -0.5 + inset + radius);
  shape.quadraticCurveTo(-0.5 + inset, -0.5 + inset, -0.5 + inset + radius, -0.5 + inset);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.035,
    bevelThickness: 0.035,
    curveSegments: 4,
  });
  geometry.center();
  return geometry;
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
    this.settings = { ...BASE_SETTINGS };
    this.blockMaterial = { roughness: 0.28, metalness: 0.48, clearcoat: 0.84, emissiveIntensity: 0.2 };
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
    this.shakeEnvelope = 0;
    this.backgroundPalette = null;
    this.ambientParticleColors = null;
    this.ambientParticleShape = 'spark';
    this.clearEffect = null;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 3000);
    this.camera.position.set(0, 0, 1200);
    this.camera.lookAt(0, 0, 0);

    this._createSharedResources();
    this._createBoardPresentation();
    this._createPieceLayers();
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
      this._setupBloom();
      this.resize();
      this._setAvailable(true);
    } catch (error) {
      try { this.composer?.dispose?.(); } catch { /* Preserve the Canvas fallback if partial cleanup fails. */ }
      try { this.renderer?.dispose?.(); } catch { /* Preserve the Canvas fallback if partial cleanup fails. */ }
      this.composer = null;
      this.bloomPass = null;
      this.renderer = null;
      this._setAvailable(false);
    }
  }

  _createSharedResources() {
    this.blockGeometry = roundedBlockGeometry();
    this.panelMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color(this.boardTheme.bgTop) },
        uBottom: { value: new THREE.Color(this.boardTheme.bgBottom) },
        uOpacity: { value: 0.72 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uBottom;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          gl_FragColor = vec4(mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y)), uOpacity);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
    });
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

    this.ambientLight = new THREE.HemisphereLight('#c6f0ff', '#152034', 1.2);
    this.keyLight = new THREE.DirectionalLight('#ffffff', 1.75);
    this.keyLight.position.set(-1, 1, 2);
    this.rimLight = new THREE.PointLight('#4dd8ff', 1.5, 900, 2);
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

  _setupBloom() {
    // Test/fallback renderers need no post-processing; the real WebGL path gets
    // a low-strength bloom pass that keeps the canvas alpha channel intact.
    if (!this.renderer?.isWebGLRenderer) return;
    const size = this.renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(size, 0.32, 0.72, 0.64);
    this.composer.addPass(this.bloomPass);
    this._applyBloomSettings();
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
    this.resize();
    this._setAvailable(true);
  }

  resize() {
    if (!this.renderer || this.disposed) return;
    const fallbackRect = this.canvas?.getBoundingClientRect?.() || { width: 1, height: 1 };
    const width = Math.max(1, this.windowRef?.innerWidth || fallbackRect.width || 1);
    const height = Math.max(1, this.windowRef?.innerHeight || fallbackRect.height || 1);
    const pixelRatio = Math.max(1, this.windowRef?.devicePixelRatio || 1);
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
    this.composer?.setPixelRatio?.(pixelRatio);
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
        this.scene.remove(this.modeWorld.group);
        this.modeWorld.dispose();
      }
      this.modeWorld = createModeWorld(mode);
      this.modeId = this.modeWorld.descriptor.id;
      this.eventCursor = null;
      this.runId = null;
      this.scene.add(this.modeWorld.group);
      if (this.backgroundPalette) this.modeWorld.setPalette(this.backgroundPalette.colors, this.backgroundPalette.style);
      if (this.ambientParticleColors) this.modeWorld.setAmbientParticles(this.ambientParticleColors, this.ambientParticleShape);
      if (this.clearEffect) this.modeWorld.setClearEffect(this.clearEffect);
    }

    if (this.runId !== game.runId) {
      this.runId = game.runId;
      this.eventCursor = null;
      this.shakeEnvelope = 0;
    }

    const collection = collectGameplayEvents(game, this.eventCursor);
    this.eventCursor = collection.cursor;
    collection.events.forEach((event) => {
      if (this.settings.reducedMotion) return;
      const intensity = {
        move: 0.04, rotate: 0.06, softDrop: 0.05, hardDrop: 0.35, lock: 0.14,
        clear: 0.52, tSpin: 0.62, combo: 0.16, backToBack: 0.22,
        perfectClear: 0.72, levelUp: 0.64, hold: 0.08,
      }[event.type] || 0;
      this.shakeEnvelope = Math.min(1, this.shakeEnvelope + intensity);
    });

    const dt = Math.min(50, Math.max(0, meta.dt || 16.7));
    this.shakeEnvelope *= Math.exp(-dt / 220);
    const shake = this.settings.reducedMotion ? 0 : this.shakeEnvelope * this.settings.screenShake * 9;
    const time = this.elapsedMs + (this.windowRef?.performance?.now?.() || 0);
    this.camera.position.x = Math.sin(time * 0.035) * shake;
    this.camera.position.y = Math.cos(time * 0.047) * shake * 0.55;

    const background = this.modeWorld.group.children.find((child) => child.isMesh && child.material?.uniforms?.uTop);
    if (background) {
      background.scale.set(this._viewportWidth, this._viewportHeight, 1);
      background.position.set(0, 0, -280);
    }
    this.modeWorld.update({
      dtMs: dt,
      elapsedMs: this.elapsedMs,
      game,
      events: collection.events,
      settings: this.settings,
      viewportWidth: this._viewportWidth,
      viewportHeight: this._viewportHeight,
    });
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
      mesh.scale.set(point.cellWidth * 0.9, point.cellHeight * 0.9, Math.min(point.cellWidth, point.cellHeight) * 0.17);
      mesh.visible = true;
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

  _buildPieceBlocks(piece) {
    if (!piece) return [];
    return piece.getCells().filter(({ row }) => row >= 0).map(({ col, row }) => ({ type: piece.type, col, row }));
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
      mesh.scale.set(block.cell * 0.86, block.cell * 0.86, block.cell * 0.14);
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
    if (meta.dt) this.elapsedMs += meta.dt;
    if (this._viewportWidth !== (this.windowRef?.innerWidth || this._viewportWidth)
      || this._viewportHeight !== (this.windowRef?.innerHeight || this._viewportHeight)
      || this._pixelRatio !== (this.windowRef?.devicePixelRatio || this._pixelRatio)) this.resize();

    this.shapes = meta.shapes || this.shapes || this.windowRef?.TETRIS?.SHAPES || null;
    this.pieceColors = pieceColors || this.pieceColors;
    const boardRect = this._positionBoard(game);
    if (!boardRect) return;
    this.gridMaterial.color.set(this.boardTheme.gridColor || '#78d2ff');
    this.gridMaterial.opacity = this.settings.glowIntensity > 0 ? (this.boardTheme.gridAlpha || 0.1) : 0.035;
    this._applyBoardTheme();

    const boardBlocks = this._buildBoardBlocks(game);
    this._placeBlocks('board', boardBlocks, boardRect, game.board.cols, game.board.rows, this.pieceColors, 0, 1);
    const activeBlocks = this._buildPieceBlocks(game.activePiece);
    this._placeBlocks('active', activeBlocks, boardRect, game.board.cols, game.board.rows, this.pieceColors, 8, 1);
    const ghostBlocks = this._buildGhostBlocks(game);
    this._placeBlocks('ghost', ghostBlocks, boardRect, game.board.cols, game.board.rows, this.pieceColors, 4, 0.25);

    const nextTypes = game.pieceQueue?.peek?.(5) || [];
    this._placePreviewBlocks('next', nextTypes, this.nextCanvas, this.pieceColors, 0.96);
    const holdTypes = game.holdType ? [game.holdType] : [];
    this._placePreviewBlocks('hold', holdTypes, this.holdCanvas, this.pieceColors, game.canHold ? 0.96 : 0.38);

    this.rimLight.color.set(this.boardTheme.gridColor || '#4dd8ff');
    this.rimLight.intensity = this.settings.glowIntensity * (this.settings.reducedMotion ? 0.45 : 0.8);
    this._updateModeWorld(game, meta);
    this._applyBloomSettings();
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  setBlockMaterial(data = {}) {
    this.blockMaterial = {
      ...this.blockMaterial,
      roughness: clamp(data.roughness, 0.04, 1, this.blockMaterial.roughness),
      metalness: clamp(data.metalness, 0, 1, this.blockMaterial.metalness),
      clearcoat: clamp(data.clearcoat, 0, 1, this.blockMaterial.clearcoat),
      emissiveIntensity: clamp(data.emissiveIntensity, 0, 2.5, this.blockMaterial.emissiveIntensity),
      emissiveAccent: data.emissiveAccent || null,
    };
    this.materials.forEach((material) => {
      material.roughness = this.blockMaterial.roughness;
      material.metalness = this.blockMaterial.metalness;
      material.clearcoat = this.blockMaterial.clearcoat;
      material.emissiveIntensity = this.blockMaterial.emissiveIntensity * this.settings.glowIntensity;
    });
    [this.ghostMaterials, this.dimMaterials].forEach((variants) => variants.forEach((material) => {
      material.roughness = this.blockMaterial.roughness;
      material.metalness = this.blockMaterial.metalness;
      material.clearcoat = this.blockMaterial.clearcoat;
    }));
  }

  setSettings(settings = {}) {
    this.settings = {
      ...this.settings,
      ...settings,
      screenShake: clamp(settings.screenShake, 0, 1, this.settings.screenShake),
      particleIntensity: clamp(settings.particleIntensity, 0, 1, this.settings.particleIntensity),
      glowIntensity: clamp(settings.glowIntensity, 0, 1.5, this.settings.glowIntensity),
    };
    this.materials.forEach((material) => {
      material.emissiveIntensity = this.blockMaterial.emissiveIntensity * this.settings.glowIntensity;
    });
    this.ghostMaterials.forEach((material) => { material.emissiveIntensity = 0.08 * this.settings.glowIntensity; });
    this.dimMaterials.forEach((material) => { material.emissiveIntensity = 0.06 * this.settings.glowIntensity; });
    this.ambientLight.intensity = this.settings.reducedMotion ? 0.8 : 1.2;
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

  setBackgroundPalette(colors, style) {
    this.backgroundPalette = { colors, style };
    this.modeWorld?.setPalette(colors, style);
  }

  setClearEffect(effect = {}) {
    this.clearEffect = { ...effect };
    this.modeWorld?.setClearEffect(this.clearEffect);
  }

  _applyBloomSettings() {
    if (!this.bloomPass) return;
    const enabled = this.settings.glowIntensity > 0 && !this.settings.reducedMotion;
    this.bloomPass.enabled = enabled;
    this.bloomPass.strength = enabled ? 0.24 * this.settings.glowIntensity : 0;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas?.removeEventListener?.('webglcontextlost', this._onContextLost, false);
    this.canvas?.removeEventListener?.('webglcontextrestored', this._onContextRestored, false);
    if (this.modeWorld) {
      this.scene.remove(this.modeWorld.group);
      this.modeWorld.dispose();
      this.modeWorld = null;
    }
    this.composer?.dispose?.();
    this.bloomPass?.dispose?.();
    this.gridLines.geometry.dispose();
    this.boardBorder.geometry.dispose();
    this.boardBacking.geometry.dispose();
    this.blockGeometry.dispose();
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
