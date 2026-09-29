import * as THREE from 'three';
import { WORLD_LIGHTING } from './worldLighting.js';

/** A shallow board socket in the orthographic pass; every rail clears the grid. */
export class BoardHousing3D {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'board-housing';
    scene.add(this.group);
    this.metal = new THREE.MeshPhysicalMaterial({ color: '#4a5c63', metalness: 0.7,
      roughness: 0.43, clearcoat: 0.3, envMapIntensity: 0.55 });
    this.recess = new THREE.MeshStandardMaterial({ color: '#141d25', metalness: 0.35, roughness: 0.73 });
    this.edge = new THREE.MeshStandardMaterial({ color: '#64757a', emissive: '#46656a',
      emissiveIntensity: 0.08, metalness: 0.55, roughness: 0.38 });
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    this.geometry = geometry;
    this.rails = Array.from({ length: 4 }, () => {
      const rail = new THREE.Mesh(geometry, this.metal);
      rail.userData.frameRail = true;
      this.group.add(rail);
      return rail;
    });
    this.innerEdges = Array.from({ length: 4 }, () => {
      const edge = new THREE.Mesh(geometry, this.edge);
      this.group.add(edge);
      return edge;
    });
    this.sockets = Array.from({ length: 4 }, () => {
      const socket = new THREE.Mesh(geometry, this.recess);
      this.group.add(socket);
      return socket;
    });
    this.lastMode = null;
    this.group.visible = false;
  }

  update(rect, mode, glowIntensity = 1) {
    if (!rect) { this.group.visible = false; return; }
    this.group.visible = true;
    const art = WORLD_LIGHTING[mode] || WORLD_LIGHTING.endless;
    if (this.lastMode !== mode) {
      this.lastMode = mode;
      this.metal.color.set(art.frame);
      this.metal.metalness = art.metalness;
      this.edge.color.set(art.frame).lerp(new THREE.Color(art.rim), 0.27);
      this.edge.emissive.set(art.rim);
    }
    this.edge.emissiveIntensity = Math.min(0.14, Math.max(0, glowIntensity) * 0.055);
    const { x, y, width: w, height: h } = rect;
    const thickness = 8;
    const offset = 7.5;
    const railData = [
      [x-w/2-offset,y,thickness,h+27],
      [x+w/2+offset,y,thickness,h+27],
      [x,y+h/2+offset,w+27,thickness],
      [x,y-h/2-offset,w+27,thickness],
    ];
    this.rails.forEach((rail, i) => {
      const [px,py,sx,sy] = railData[i];
      rail.position.set(px,py,-7);
      rail.scale.set(sx,sy,10);
    });
    this.innerEdges.forEach((edge, i) => {
      const vertical = i < 2;
      edge.position.set(vertical ? x+(i?1:-1)*(w/2+3.5) : x,
        vertical ? y : y+(i===2?1:-1)*(h/2+3.5), -2.5);
      edge.scale.set(vertical?1.2:w+7,vertical?h+7:1.2,1.5);
    });
    this.sockets.forEach((socket, i) => {
      socket.position.set(x+(i%2?1:-1)*(w/2+7.5),
        y+(i<2?1:-1)*(h/2+7.5),-0.8);
      socket.scale.set(3,3,1);
    });
  }

  dispose() {
    this.group.removeFromParent();
    this.geometry.dispose();
    this.metal.dispose();
    this.recess.dispose();
    this.edge.dispose();
  }
}
