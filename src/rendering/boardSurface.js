import * as THREE from 'three';

/** Shared board gradient for gameplay and the customization inspector. */
export function createBoardSurfaceMaterial(theme = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(theme.bgTop || '#111a2e') },
      uBottom: { value: new THREE.Color(theme.bgBottom || '#080b14') },
      uOpacity: { value: 0.94 },
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
}
