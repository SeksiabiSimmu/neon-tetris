import * as THREE from 'three';

// Authored surface families and reusable construction parts. Dimensions use the
// same world units as the landmarks; mapping stays consistent across modules.
export function surfaceMaps(kind) {
  const size = 256;
  const color = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  let seed = 713;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      seed = (seed * 16807) % 2147483647;
      const grain = (seed / 2147483647 - 0.5);
      const stone = kind === 'stone';
      const strata = Math.sin(y * 0.16 + Math.sin(x * 0.024) * 2.1);
      const brushing = Math.sin(y * 2.2) * 2 + grain * 3;
      const seam = !stone && (x < 2 || y < 2) ? -18 : 0;
      const inset = !stone && x > 17 && x < 23 && y > 24 && y < 90 ? -9 : 0;
      const value = stone ? 152 + strata * 5 + grain * 6 : 168 + brushing + seam + inset;
      const rough = stone ? 207 + strata * 8 + grain * 7 : 134 + brushing * 3 + (seam ? 28 : 0);
      const i = (y * size + x) * 4;
      color.set([value, value, value, 255], i);
      roughness.set([rough, rough, rough, 255], i);
    }
  }
  const make = (data, colorSpace) => {
    const map = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    map.colorSpace = colorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.magFilter = THREE.LinearFilter;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.generateMipmaps = true;
    map.needsUpdate = true;
    return map;
  };
  return { map: make(color, THREE.SRGBColorSpace), detail: make(roughness, THREE.NoColorSpace) };
}

export function artMaterials({ metal = '#78878e', stone = '#667071', accent = '#91c6c6' } = {}) {
  const panel = surfaceMaps('panel');
  const rock = surfaceMaps('stone');
  const materials = {
    metal: new THREE.MeshStandardMaterial({ color: metal, map: panel.map, roughnessMap: panel.detail, roughness: 0.78, metalness: 0.72, envMapIntensity: 0.55 }),
    dark: new THREE.MeshStandardMaterial({ color: '#1b272d', roughness: 0.58, metalness: 0.48 }),
    stone: new THREE.MeshStandardMaterial({ color: stone, map: rock.map, roughnessMap: rock.detail, bumpMap: rock.detail, bumpScale: 0.35, roughness: 1, metalness: 0.02 }),
    trim: new THREE.MeshStandardMaterial({ color: '#adb4af', roughness: 0.32, metalness: 0.82, envMapIntensity: 0.65 }),
    light: new THREE.MeshStandardMaterial({ color: '#3b4948', emissive: accent, emissiveIntensity: 0.7, roughness: 0.45, metalness: 0.25 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#38545b', roughness: 0.18, metalness: 0.4, clearcoat: 0.8, envMapIntensity: 0.7 }),
  };
  return { materials, textures: [panel.map, panel.detail, rock.map, rock.detail] };
}

export function mapSurface(geometry, scale = 128) {
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i += 1) {
    const nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i)), nz = Math.abs(normal.getZ(i));
    uv[i * 2] = (nx > nz && nx > ny ? position.getZ(i) : position.getX(i)) / scale;
    uv[i * 2 + 1] = (ny > nz && ny > nx ? position.getZ(i) : position.getY(i)) / scale;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

export function profile(points, depth, bevel = 3, holes = []) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel,
    bevelSegments: 2, steps: 1, curveSegments: 32,
  });
  geometry.translate(0, 0, -depth / 2);
  return mapSurface(geometry);
}

export function chamferedBox(w, h, d, corner = 6) {
  const c = Math.min(corner, w * 0.2, h * 0.2);
  return profile([[-w/2+c,-h/2],[w/2-c,-h/2],[w/2,-h/2+c],[w/2,h/2-c],
    [w/2-c,h/2],[-w/2+c,h/2],[-w/2,h/2-c],[-w/2,-h/2+c]], d, Math.min(c * 0.3, 3));
}

export function arcProfile(inner, outer, depth, start = 0, length = Math.PI * 2) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, start, start + length, false);
  if (length >= Math.PI * 2 - 0.001) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  } else {
    shape.absarc(0, 0, inner, start + length, start, true);
    shape.closePath();
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true,
    bevelSize: 2, bevelThickness: 2, bevelSegments: 1, steps: 1, curveSegments: 48 });
  geo.translate(0, 0, -depth / 2);
  return mapSurface(geo);
}

export function addMesh(parent, geometry, material, x = 0, y = 0, z = 0, cast = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function instances(parent, geometry, material, transforms, { cast = true, secondary = false } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  const dummy = new THREE.Object3D();
  transforms.forEach((t, i) => {
    dummy.position.set(...(t.position || [0,0,0]));
    dummy.rotation.set(...(t.rotation || [0,0,0]));
    dummy.scale.set(...(t.scale || [1,1,1]));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  mesh.userData.secondary = secondary;
  mesh.computeBoundingSphere();
  parent.add(mesh);
  return mesh;
}

export function strut(parent, a, b, width, material) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const mesh = addMesh(parent, chamferedBox(width, start.distanceTo(end), width, 3), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
  return mesh;
}

export function applyArtQuality(group, preset) {
  const high = !!preset?.ao;
  group.traverse(object => {
    if (object.userData.secondary) object.visible = high;
    if (!object.shadow) return;
    const size = preset?.shadowSize || 0;
    object.castShadow = size > 0 && !!object.userData.keyShadow;
    if (size && object.shadow.mapSize.width !== size) {
      object.shadow.dispose();
      object.shadow.map = null;
      object.shadow.mapPass = null;
      object.shadow.mapSize.set(size, size);
      object.shadow.needsUpdate = true;
    }
  });
}
