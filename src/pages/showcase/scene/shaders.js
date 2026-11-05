/**
 * @fileoverview GLSL-материалы сцены /new. Каждый объект — набор uniforms и шейдеров
 * для передачи в <shaderMaterial {...Material} />.
 */
import * as THREE from 'three'

/** Фоновый вихрь-портал из бирюзового и пурпурного. */
export const PortalShaderMaterial = {
  uniforms: {
    uTime: { value: 0 },
    uColorCyan: { value: new THREE.Color('#00f3ff') },
    uColorMagenta: { value: new THREE.Color('#ff007f') }
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vPosition;
    void main() {
      vUv = uv;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColorCyan;
    uniform vec3 uColorMagenta;
    varying vec2 vUv;
    varying vec3 vPosition;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }

    void main() {
      vec2 uv = vUv - 0.5;

      float angle = atan(uv.y, uv.x);
      float radius = length(uv);

      float twist = angle + 4.5 * radius - uTime * 2.0;

      vec2 noiseUV = vec2(cos(twist) * 1.5, sin(twist) * 1.5) * radius * 4.0;
      float n = noise(noiseUV + uTime * 0.5) * 0.5 + noise(noiseUV * 2.0 - uTime * 0.8) * 0.25;

      float ring = sin(radius * 32.0 - uTime * 6.0) * 0.5 + 0.5;

      vec3 finalColor = mix(uColorCyan, uColorMagenta, n * 1.5 + ring * 0.2);

      float core = exp(-pow(radius / 0.08, 2.0)) * 2.5;
      finalColor += uColorCyan * core;

      float alpha = smoothstep(0.5, 0.25, radius);

      gl_FragColor = vec4(finalColor, alpha * (0.8 + core));
    }
  `
}

/** Пульсирующее плазменное ядро в моторном отсеке. */
export const PlasmaCoreShaderMaterial = {
  uniforms: {
    uTime: { value: 0 },
    uColorCore: { value: new THREE.Color('#00f3ff') },
    uColorCorona: { value: new THREE.Color('#ff007f') }
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColorCore;
    uniform vec3 uColorCorona;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;

    float hash(vec3 p) {
      p = fract(p * vec3(443.8975, 397.2973, 491.1871));
      p += dot(p.xyz, p.yzx + 19.19);
      return fract(p.x * p.y * p.z);
    }

    float noise(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      vec3 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(
          mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), u.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), u.x),
          u.y
        ),
        mix(
          mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), u.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), u.x),
          u.y
        ),
        u.z
      );
    }

    void main() {
      float rim = 1.0 - max(0.0, dot(vNormal, vec3(0.0, 0.0, 1.0)));
      rim = pow(rim, 2.5);

      vec3 noiseCoord = vPosition * 4.0 + vec3(0.0, uTime * 1.5, 0.0);
      float n = noise(noiseCoord) * 0.5 + noise(noiseCoord * 2.0 - vec3(uTime, 0.0, uTime)) * 0.25;

      float pulse = sin(uTime * 4.0) * 0.12 + 0.88;

      vec3 col = mix(uColorCore, uColorCorona, rim * pulse + n * 0.4);

      col += uColorCore * (n * 0.6) + vec3(1.0) * pow(rim, 6.0) * 0.8;

      float alpha = rim * 1.2 + n * 0.5;

      gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
    }
  `
}

/** Полупрозрачный конус сканера с бегущими полосами; виден только в режиме рентгена. */
export const ScanConeShaderMaterial = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#00f3ff') },
    uTransition: { value: 0 }
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vPosition;
    void main() {
      vUv = uv;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uTransition;
    varying vec2 vUv;
    varying vec3 vPosition;
    void main() {
      float vertFade = smoothstep(-2.75, -1.0, vPosition.y) * smoothstep(2.75, 1.0, vPosition.y);

      float radialFade = 1.0 - length(vPosition.xz) * 0.35;

      float sweep1 = sin(vPosition.y * 6.0 - uTime * 4.5) * 0.5 + 0.5;
      float sweep2 = cos(vPosition.y * 10.0 + uTime * 3.0) * 0.5 + 0.5;
      float sweep = mix(sweep1, sweep2, 0.4);

      vec3 finalColor = uColor * (0.3 + sweep * 0.7);
      float alpha = vertFade * radialFade * 0.18 * uTransition;

      gl_FragColor = vec4(finalColor, alpha);
    }
  `
}
