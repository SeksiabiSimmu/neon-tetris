import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PremiumSceneRenderer, rectToWorldRect } from '../src/rendering/PremiumSceneRenderer.js';
import * as THREE from 'three';

class MockCanvas extends EventTarget {
  constructor(rect) {
    super();
    this.rect = rect;
    this.width = 0;
    this.height = 0;
  }

  getBoundingClientRect() {
    return this.rect;
  }
}

function createMockRenderer() {
  let renderCalls = 0;
  return {
    isWebGLRenderer: false,
    setPixelRatio() {},
    setSize() {},
    setClearColor() {},
    render() { renderCalls += 1; },
    get renderCalls() { return renderCalls; },
    dispose() {},
  };
}

function createMockGame() {
  const cells = (type, col, row, rotation = 0) => [
    { type, col: col + 0, row: row + 0 },
    { type, col: col + 1, row: row + 0 },
    { type, col: col + 2, row: row + 0 },
    { type, col: col + 1, row: row + 1 + rotation * 0 },
  ];
  const activePiece = { type: 'T', col: 3, row: 0, rotation: 0, getCells: () => cells('T', 3, 0) };
  return {
    runId: 1,
    mode: 'endless',
    state: 'PLAYING',
    board: { cols: 10, rows: 20, grid: Array.from({ length: 20 }, () => Array(10).fill(null)) },
    activePiece,
    holdType: 'I',
    canHold: true,
    isSoftDropping: false,
    scoring: { level: 1 },
    pieceQueue: { peek: () => ['O', 'I', 'J', 'L', 'S'] },
    getGhostRow: () => 17,
  };
}

test('maps DOM rectangles to centered positive-up orthographic coordinates', () => {
  assert.deepEqual(
    rectToWorldRect({ left: 100, top: 50, width: 300, height: 600 }, 1000, 800),
    { x: -250, y: 50, width: 300, height: 600 },
  );
  assert.deepEqual(
    rectToWorldRect({ x: 0, y: 0, left: 0, top: 0, width: 200, height: 100 }, 200, 100),
    { x: 0, y: 0, width: 200, height: 100 },
  );
});

test('WebGL board and preview surfaces do not blur scene pixels behind them', () => {
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(styles, /body\.webgl-ready\s+\.board-frame\s*\{[^}]*backdrop-filter:\s*none/s);
  assert.match(styles, /body\.webgl-ready\s+\.preview-panel\s*\{[^}]*backdrop-filter:\s*none/s);
});

test('keeps Canvas rendering available when WebGL initialization fails', () => {
  const canvas = new MockCanvas({ left: 0, top: 0, width: 10, height: 10 });
  const availability = [];
  const renderer = new PremiumSceneRenderer({
    canvas,
    onAvailabilityChange: (available) => availability.push(available),
    rendererFactory: () => { throw new Error('no WebGL'); },
  });

  assert.equal(renderer.available, false);
  assert.deepEqual(availability, [false]);
  renderer.dispose();
});

test('disposes a partially initialized WebGL backend before falling back', () => {
  const canvas = new MockCanvas({ left: 0, top: 0, width: 10, height: 10 });
  let disposed = false;
  const backend = createMockRenderer();
  backend.setSize = () => { throw new Error('renderer setup failed'); };
  backend.dispose = () => { disposed = true; };
  const renderer = new PremiumSceneRenderer({ canvas, rendererFactory: () => backend });

  assert.equal(renderer.available, false);
  assert.equal(disposed, true);
  renderer.dispose();
});

test('draws the board, active piece, ghost, and separate preview meshes', () => {
  const rect = { left: 50, top: 20, width: 300, height: 600 };
  const boardCanvas = new MockCanvas(rect);
  const nextCanvas = new MockCanvas({ left: 370, top: 20, width: 120, height: 300 });
  const holdCanvas = new MockCanvas({ left: 370, top: 340, width: 120, height: 100 });
  const canvas = new MockCanvas({ left: 0, top: 0, width: 500, height: 700 });
  const rendererBackend = createMockRenderer();
  const renderer = new PremiumSceneRenderer({
    canvas, boardCanvas, nextCanvas, holdCanvas,
    rendererFactory: () => rendererBackend,
  });
  renderer.render(createMockGame(), { dt: 16, shapes: {
    I: [[ [0, 1], [1, 1], [2, 1], [3, 1] ]], O: [[ [1, 0], [2, 0], [1, 1], [2, 1] ]],
    T: [[ [1, 0], [0, 1], [1, 1], [2, 1] ]], J: [[ [0, 0], [0, 1], [1, 1], [2, 1] ]],
    L: [[ [2, 0], [0, 1], [1, 1], [2, 1] ]], S: [[ [1, 0], [2, 0], [0, 1], [1, 1] ]],
  } }, { I: '#4dd8ff', O: '#ffd84d', T: '#c65bff', J: '#4d7bff', L: '#ff9a4d', S: '#43e07a' });

  assert.equal(rendererBackend.renderCalls, 1);
  assert.equal(renderer.meshPools.active.filter((mesh) => mesh.visible).length, 4);
  assert.equal(renderer.meshPools.ghost.filter((mesh) => mesh.visible).length, 4);
  assert.ok(renderer.meshPools.next.some((mesh) => mesh.visible));
  assert.ok(renderer.meshPools.hold.some((mesh) => mesh.visible));
  renderer.dispose();
});

test('context loss and restore toggle availability without mutating a run', () => {
  const canvas = new MockCanvas({ left: 0, top: 0, width: 10, height: 10 });
  const availability = [];
  const run = { runId: 42, scoring: { level: 3 } };
  const renderer = new PremiumSceneRenderer({
    canvas,
    rendererFactory: createMockRenderer,
    onAvailabilityChange: (available) => availability.push(available),
  });

  const lost = new Event('webglcontextlost', { cancelable: true });
  canvas.dispatchEvent(lost);
  assert.equal(lost.defaultPrevented, true);
  assert.equal(renderer.available, false);

  canvas.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal(renderer.available, true);
  assert.deepEqual(availability, [false, true, false, true]);
  assert.deepEqual(run, { runId: 42, scoring: { level: 3 } });
  renderer.dispose();
});

test('resizes the WebGL canvas, camera, and pixel ratio with the viewport', () => {
  const canvas = new MockCanvas({ left: 0, top: 0, width: 10, height: 10 });
  const ratios = [];
  const sizes = [];
  const backend = createMockRenderer();
  backend.setPixelRatio = (ratio) => ratios.push(ratio);
  backend.setSize = (...size) => sizes.push(size);
  const renderer = new PremiumSceneRenderer({ canvas, rendererFactory: () => backend });
  renderer.windowRef = { innerWidth: 960, innerHeight: 540, devicePixelRatio: 2 };
  renderer.resize();

  assert.equal(ratios.at(-1), 2);
  assert.deepEqual(sizes.at(-1), [960, 540, false]);
  assert.equal(renderer.camera.left, -480);
  assert.equal(renderer.camera.right, 480);
  assert.equal(renderer.camera.top, 270);
  assert.equal(renderer.camera.bottom, -270);
  renderer.dispose();
});

test('applies both ends of the selected board theme gradient in WebGL', () => {
  const renderer = new PremiumSceneRenderer({
    canvas: new MockCanvas({ left: 0, top: 0, width: 10, height: 10 }),
    rendererFactory: createMockRenderer,
  });
  renderer.setBoardTheme({ bgTop: '#123456', bgBottom: '#fedcba' });

  assert.ok(renderer.panelMaterial instanceof THREE.ShaderMaterial);
  assert.equal(renderer.panelMaterial.uniforms.uTop.value.getHexString(), '123456');
  assert.equal(renderer.panelMaterial.uniforms.uBottom.value.getHexString(), 'fedcba');
  renderer.dispose();
});
