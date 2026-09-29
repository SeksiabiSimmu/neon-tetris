import * as THREE from 'three';
import { createModeWorld } from '../rendering/modeWorlds.js';
import { PIECE_TYPES, roundedBlockGeometry, createBlockAppearance } from '../rendering/blockAppearance.js';
import { WORLD_LIGHTING, reflectionStudio } from '../rendering/worldLighting.js';
import { BoardHousing3D } from '../rendering/BoardHousing3D.js';
import { createBoardSurfaceMaterial } from '../rendering/boardSurface.js';
import { graphicsPreset } from '../rendering/graphicsQuality.js';
import { FallingEffects3D } from '../rendering/FallingEffects3D.js';
import { BoardEffects3D } from '../rendering/BoardEffects3D.js';

const WIDTH = 860, HEIGHT = 440;
const DEMO_BOARD = Object.freeze({ x: -214, y: 0, width: 220, height: 308 });

/** One temporary, read-only WebGL inspector; no gameplay state or animation loop. */
export class CustomizationPreview3D {
  constructor(canvas, initialMode = 'endless') {
    this.canvas = canvas;
    this.disposed = false;
    this.materials = new Map();
    try {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    this.renderer.autoClear = false;
    this.worldScene = new THREE.Scene();
    this.worldCamera = new THREE.PerspectiveCamera(35, WIDTH / HEIGHT, 1, 4000);
    this.worldCamera.position.set(0, 90, 1000);
    this.worldCamera.lookAt(0, 0, -180);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-WIDTH / 2, WIDTH / 2, HEIGHT / 2, -HEIGHT / 2, 0.1, 2000);
    this.camera.position.z = 1000;
    this.blockGeometry = roundedBlockGeometry();
    this.appearance = createBlockAppearance();
    this.blocks = [];
    this.elapsed = 0;
    this.mode = null;
    this.world = null;
    this._buildSample();
    this.fallingEffects = new FallingEffects3D(this.scene);
    this.demoBoardEffects = new BoardEffects3D(this.scene, this.blockGeometry, this.materials);
    this._buildDemoPiece();
    this.setMode(initialMode);
    this._onContextLost = (event) => {
      event.preventDefault();
      this.lost = true;
      this.canvas.parentElement.querySelector('.customization-preview-fallback')?.removeAttribute('hidden');
    };
    this._onContextRestored = () => {
      if (this.disposed) return;
      this.lost = false;
      this.canvas.parentElement.querySelector('.customization-preview-fallback')?.setAttribute('hidden', '');
      this.resize();
      this.render(0);
    };
    canvas.addEventListener('webglcontextlost', this._onContextLost);
    canvas.addEventListener('webglcontextrestored', this._onContextRestored);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  _buildSample() {
    const boardMaterial = createBoardSurfaceMaterial();
    const board = new THREE.Mesh(new THREE.PlaneGeometry(226, 326), boardMaterial);
    board.position.set(-214, 0, -8);
    this.boardMesh = board;
    this.scene.add(board);
    this.boardHousing = new BoardHousing3D(this.scene);
    const lines = [];
    for (let x = 0; x <= 10; x += 1) {
      const px = -324 + x * 22;
      lines.push(px, -154, -6, px, 154, -6);
    }
    for (let y = 0; y <= 14; y += 1) {
      const py = -154 + y * 22;
      lines.push(-324, py, -6, -104, py, -6);
    }
    const grid = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lines, 3)),
      new THREE.LineBasicMaterial({ color: '#6f9dab', transparent: true, opacity: 0.2 }));
    this.grid = grid;
    this.scene.add(grid);
    const border = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-324, -154, -4), new THREE.Vector3(-104, -154, -4),
      new THREE.Vector3(-104, 154, -4), new THREE.Vector3(-324, 154, -4),
    ]), new THREE.LineBasicMaterial({ color: '#a7d7de', transparent: true, opacity: 0.8 }));
    this.scene.add(border);
    this.border = border;

    for (const type of PIECE_TYPES) {
      const material = new THREE.MeshPhysicalMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.12,
        roughness: 0.4, metalness: 0.08, clearcoat: 0.72 });
      this.materials.set(type, material);
    }
    const add = (type, x, y, cell, col, row) => {
      const block = new THREE.Mesh(this.blockGeometry, this.materials.get(type));
      block.position.set(x + col * cell, y - row * cell, 4);
      block.scale.set(cell * 0.89, cell * 0.89, cell * 0.65);
      this.scene.add(block);
      this.blocks.push(block);
    };
    const shapes = window.TETRIS.SHAPES;
    PIECE_TYPES.forEach((type, index) => {
      const column = index % 2, row = Math.floor(index / 2);
      const cells = shapes[type][0];
      const minX = Math.min(...cells.map(([x]) => x)), minY = Math.min(...cells.map(([, y]) => y));
      for (const [x, y] of cells) add(type, 18 + column * 183, 125 - row * 94, 25, x - minX, y - minY);
    });
    const arrangement = [
      ['I', 0, 13], ['O', 4, 12], ['T', 7, 12], ['S', 1, 10],
      ['Z', 5, 10], ['J', 0, 8], ['L', 6, 8],
    ];
    for (const [type, x, y] of arrangement) {
      const cells = shapes[type][0];
      const minX = Math.min(...cells.map(([cx]) => cx)), minY = Math.min(...cells.map(([, cy]) => cy));
      for (const [cx, cy] of cells) add(type, -313, 143, 22, x + cx - minX, y + cy - minY);
    }
    this.hemi = new THREE.HemisphereLight('#dce5e9', '#17212a', 1.15);
    this.key = new THREE.DirectionalLight('#ffffff', 1.3);
    this.rim = new THREE.PointLight('#89a7aa', 0.4, 900, 2);
    this.rim.position.set(0, 0, 80);
    this.scene.add(this.hemi, this.key, this.rim);
  }

  _buildDemoPiece() {
    const shapes = window.TETRIS.SHAPES;
    this.demoPiece = {
      type: 'T', col: 3, row: 0, rotation: 0,
      getCells() { return shapes.T[0].map(([dx, dy]) => ({ col: this.col + dx, row: this.row + dy })); },
    };
    this.demoMeshes = Array.from({ length: 4 }, () => {
      const mesh = new THREE.Mesh(this.blockGeometry, this.materials.get('T'));
      mesh.scale.set(19.6, 19.6, 14.3);
      mesh.visible = false;
      mesh.renderOrder = 9;
      this.scene.add(mesh);
      return mesh;
    });
    this.demoGame = { runId: 'preview-0', state: 'PLAYING',
      board: { cols: 10, rows: 14 }, activePiece: null, clearingRows: null, isSoftDropping: false };
    this.demoAction = null;
    this.demoAge = 0;
    this.demoSerial = 0;
  }

  demonstrate(action) {
    if (this.disposed || this.lost || this.settings?.reducedMotion
      || !['fall', 'softDrop', 'hardDrop', 'landing', 'clear'].includes(action)) return;
    this.demoSerial += 1;
    this.demoAction = action;
    this.demoAge = 0;
    this.demoPiece.row = 0;
    this.demoGame.runId = `preview-${this.demoSerial}`;
    this.demoGame.activePiece = action === 'clear' ? null : this.demoPiece;
    this.demoGame.clearingRows = action === 'clear' ? [12] : null;
    this.demoGame.isSoftDropping = action === 'softDrop';
    this.demoMeshes.forEach((mesh) => { mesh.visible = action !== 'clear'; });
    this.fallingEffects.reset();
    this.demoBoardEffects.reset();
    this.render(0);
  }

  _updateDemo(dt) {
    const action = this.demoAction;
    const events = [];
    if (!action) return events;
    const before = this.demoAge;
    this.demoAge += dt;
    if (action === 'fall' || action === 'softDrop') {
      const duration = action === 'softDrop' ? 440 : 1040;
      this.demoPiece.row = Math.min(9, 9 * this.demoAge / duration);
      if (this.demoAge >= duration && before < duration) {
        events.push({ type: 'lock', detail: this._demoLockDetail() });
      }
    } else if (action === 'hardDrop' && before === 0 && dt > 0) {
      this.demoPiece.row = 9;
      const detail = this._demoLockDetail();
      events.push({ type: 'hardDrop', detail: { ...detail, fromRow: 0 } }, { type: 'lock', detail });
    } else if (action === 'landing' && before === 0 && dt > 0) {
      this.demoPiece.row = 9;
      events.push({ type: 'lock', detail: this._demoLockDetail() });
    } else if (action === 'clear') {
      if (before === 0 && dt > 0) events.push({ type: 'clear', detail: { linesCleared: 1, comboCount: 0 } });
      if (this.demoAge >= 240) this.demoGame.clearingRows = null;
    }
    this.demoPiece.getCells().forEach((cell, index) => {
      const mesh = this.demoMeshes[index];
      mesh.position.set(DEMO_BOARD.x - DEMO_BOARD.width / 2 + (cell.col + 0.5) * 22,
        DEMO_BOARD.y + DEMO_BOARD.height / 2 - (cell.row + 0.5) * 22, 8);
    });
    if (this.demoAge > 1450) {
      this.demoAction = null;
      this.demoGame.activePiece = null;
      this.demoMeshes.forEach((mesh) => { mesh.visible = false; });
    }
    return events;
  }

  _demoLockDetail() {
    return { id: this.demoSerial, type: 'T', col: this.demoPiece.col,
      row: this.demoPiece.row, rotation: 0, cells: this.demoPiece.getCells() };
  }

  setMode(mode) {
    if (this.disposed || mode === this.mode) return;
    this.demoAction = null;
    this.demoGame.activePiece = null;
    this.demoMeshes.forEach((mesh) => { mesh.visible = false; });
    this.fallingEffects.reset();
    this.demoBoardEffects.reset();
    if (this.world) {
      this.worldScene.remove(this.world.group);
      this.world.dispose();
    }
    this.world = createModeWorld(mode);
    this.mode = this.world.descriptor.id;
    const art = WORLD_LIGHTING[this.mode] || WORLD_LIGHTING.endless;
    this.key.position.set(art.position[0] * 0.45, art.position[1] * 0.5, 650);
    this.key.color.set(art.key).lerp(new THREE.Color('#ffffff'), 0.65);
    this.hemi.color.set(art.fill).lerp(new THREE.Color('#e5e9ec'), 0.68);
    this.hemi.groundColor.set(art.ground);
    this.rim.color.set(art.rim).lerp(new THREE.Color('#ffffff'), 0.48);
    this.environmentTarget?.dispose();
    this.environmentTarget = null;
    try {
      const studio = reflectionStudio(this.mode);
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      try { this.environmentTarget = pmrem.fromScene(studio, 0.04); }
      finally { pmrem.dispose(); studio.dispose(); }
      this.worldScene.environment = this.environmentTarget.texture;
      this.scene.environment = this.environmentTarget.texture;
      this.worldScene.environmentIntensity = 0.38;
      this.scene.environmentIntensity = 0.32;
    } catch (error) {
      this.worldScene.environment = null;
      this.scene.environment = null;
      console.warn('Customization reflections unavailable.', error);
    }
    this.particles = null;
    this.clearEffect = null;
    this.worldScene.add(this.world.group);
    const preset = graphicsPreset(this.settings?.graphicsQuality || 'high');
    this.world.setQuality?.({ ...preset, shadowSize: 0 });
    this.world.setFiltering?.(preset.anisotropy);
    this.boardHousing.update({ x: -214, y: 0, width: 220, height: 308 }, this.mode, this.settings?.glowIntensity ?? 1);
    if (this.background) this.world.setPalette(this.background.nebulaColors, this.background.style, this.background.sceneId);
    this.resize();
  }

  setCombination({ skin, material, fallingEffect, board, background, particles, clearEffect, settings }) {
    if (this.disposed) return;
    this.settings = settings || {};
    this.skin = skin;
    this.material = material;
    this.fallingEffect = fallingEffect;
    this.fallingEffects.setEffect(fallingEffect?.effectId || 'none');
    const preset = graphicsPreset(this.settings.graphicsQuality || 'high');
    this.world?.setQuality?.({ ...preset, shadowSize: 0 });
    this.world?.setFiltering?.(preset.anisotropy);
    this.resize();
    this.background = background;
    this.world?.setPalette(background?.nebulaColors, background?.style, background?.sceneId);
    if (particles && particles !== this.particles) {
      this.world?.setAmbientParticles(particles.ambientColors, particles.shape);
      this.particles = particles;
    }
    if (clearEffect && clearEffect !== this.clearEffect) {
      this.world?.setClearEffect(clearEffect);
      this.clearEffect = clearEffect;
    }
    for (const type of PIECE_TYPES) {
      const blockMaterial = this.materials.get(type);
      blockMaterial.color.set(this.settings.colorblindMode ? window.TETRIS.COLORBLIND_PALETTE[type] : skin?.colors?.[type] || '#ffffff');
      blockMaterial.emissive.copy(blockMaterial.color);
      if (material?.emissiveAccent) blockMaterial.emissive.lerp(new THREE.Color(material.emissiveAccent), 0.35);
      blockMaterial.emissiveIntensity = (material?.emissiveIntensity ?? 0.16) * (this.settings.glowIntensity ?? 1);
      this.appearance.apply(blockMaterial, material);
    }
    this.boardMesh.material.uniforms.uTop.value.set(board?.bgTop || '#111a2e');
    this.boardMesh.material.uniforms.uBottom.value.set(board?.bgBottom || '#080b14');
    this.grid.material.color.set(board?.gridColor || '#6f9dab');
    this.grid.material.opacity = this.settings.glowIntensity > 0 ? (board?.gridAlpha ?? 0.11) * 0.65 : 0.035;
    this.border.material.color.set(board?.gridColor || '#a7d7de');
    this.boardHousing.update({ x: -214, y: 0, width: 220, height: 308 }, this.mode, this.settings.glowIntensity ?? 1);
  }

  resize() {
    if (this.disposed) return;
    const width = Math.max(1, this.canvas.clientWidth), height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setPixelRatio(Math.min(this.settings?.graphicsQuality === 'low' ? 1 : 2, window.devicePixelRatio || 1));
    this.renderer.setSize(width, height, false);
    this.worldCamera.aspect = width / height;
    this.worldCamera.updateProjectionMatrix();
    const background = this.world?.group.children.find((child) => child.isMesh && child.material?.uniforms?.uTop);
    if (background) {
      const distance = this.worldCamera.position.z + 280;
      const heightWorld = 2 * distance * Math.tan(THREE.MathUtils.degToRad(this.worldCamera.fov / 2));
      background.scale.set(heightWorld * this.worldCamera.aspect * 1.02, heightWorld * 1.02, 1);
      background.position.set(0, 0, -280);
    }
    const ratio = Math.max(WIDTH / width, HEIGHT / height);
    this.camera.left = -width * ratio / 2;
    this.camera.right = width * ratio / 2;
    this.camera.top = height * ratio / 2;
    this.camera.bottom = -height * ratio / 2;
    this.camera.updateProjectionMatrix();
  }

  render(dt = 16.7) {
    if (this.disposed || this.lost || document.hidden || !this.world) return;
    if (this.canvas.width !== Math.round(this.canvas.clientWidth * this.renderer.getPixelRatio())
      || this.canvas.height !== Math.round(this.canvas.clientHeight * this.renderer.getPixelRatio())) this.resize();
    const reducedMotion = !!this.settings?.reducedMotion;
    this.elapsed += reducedMotion ? 0 : Math.min(50, dt);
    const demoDt = reducedMotion ? 0 : Math.min(50, dt);
    const demoEvents = this._updateDemo(demoDt);
    this.appearance.update({ timeMs: this.elapsed, dtMs: demoDt, reducedMotion,
      locked: demoEvents.some(({ type }) => type === 'lock'),
      cleared: demoEvents.some(({ type }) => type === 'clear') });
    this.fallingEffects.update({ game: this.demoGame, events: demoEvents, boardRect: DEMO_BOARD,
      settings: { reducedMotion, particleIntensity: (this.settings?.particleIntensity ?? 80) / 100 },
      dtMs: demoDt, shapes: window.TETRIS.SHAPES });
    this.demoBoardEffects.update(this.demoGame, demoEvents, DEMO_BOARD,
      { reducedMotion, particleIntensity: (this.settings?.particleIntensity ?? 80) / 100,
        glowIntensity: this.settings?.glowIntensity ?? 1 }, window.TETRIS.SHAPES,
      this.settings?.colorblindMode ? window.TETRIS.COLORBLIND_PALETTE : this.skin?.colors || window.TETRIS.COLORS,
      this.clearEffect?.flashColor || '#85eaff', demoDt);
    this.world.update({ dtMs: reducedMotion ? 0 : dt, elapsedMs: this.elapsed,
      game: { runId: 'customization-preview', scoring: { level: this.mode === 'endless' ? 4 : 1 } },
      events: demoEvents,
      settings: { reducedMotion, particleIntensity: (this.settings?.particleIntensity ?? 80) / 100,
        glowIntensity: this.settings?.glowIntensity ?? 1 } });
    this.renderer.clear();
    this.renderer.render(this.worldScene, this.worldCamera);
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);
  }

  captureBackgroundThumbnail(background) {
    if (this.disposed || this.lost) return null;
    const previous = this.background;
    this.world.setPalette(background?.nebulaColors, background?.style, background?.sceneId);
    this.world.update({ dtMs: 0, elapsedMs: this.elapsed,
      game: { runId: 'customization-preview', scoring: { level: this.mode === 'endless' ? 4 : 1 } },
      settings: { reducedMotion: true, particleIntensity: 0.7, glowIntensity: this.settings?.glowIntensity ?? 1 } });
    this.renderer.clear();
    this.renderer.render(this.worldScene, this.worldCamera);
    const thumb = document.createElement('canvas');
    thumb.width = 136; thumb.height = 80;
    thumb.getContext('2d').drawImage(this.canvas, 0, 0, thumb.width, thumb.height);
    this.world.setPalette(previous?.nebulaColors, previous?.style, previous?.sceneId);
    this.render(0);
    return thumb.toDataURL('image/png');
  }

  captureMaterialThumbnail(material) {
    if (this.disposed || this.lost) return null;
    const previous = this.material;
    for (const blockMaterial of this.materials.values()) this.appearance.apply(blockMaterial, material);
    this.render(0);
    const thumb = document.createElement('canvas');
    thumb.width = 136; thumb.height = 80;
    const width = this.canvas.width, height = this.canvas.height;
    thumb.getContext('2d').drawImage(this.canvas, width * .51, height * .37, width * .15, height * .19,
      0, 0, thumb.width, thumb.height);
    if (previous) for (const blockMaterial of this.materials.values()) this.appearance.apply(blockMaterial, previous);
    return thumb.toDataURL('image/png');
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this._onContextLost) this.canvas.removeEventListener('webglcontextlost', this._onContextLost);
    if (this._onContextRestored) this.canvas.removeEventListener('webglcontextrestored', this._onContextRestored);
    this.world?.dispose();
    this.environmentTarget?.dispose();
    this.fallingEffects?.dispose();
    this.demoBoardEffects?.dispose();
    this.boardHousing?.dispose();
    this.blockGeometry?.dispose();
    this.appearance?.dispose();
    this.materials.forEach((material) => material.dispose());
    this.scene?.traverse((object) => {
      if (object.geometry && object.geometry !== this.blockGeometry) object.geometry.dispose();
      if (object.material && ![...this.materials.values()].includes(object.material)) object.material.dispose();
    });
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
  }
}
