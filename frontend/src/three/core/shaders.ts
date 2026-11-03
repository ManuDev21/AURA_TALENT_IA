// Ruido simplex 3D (Ashima Arts / Stefan Gustavson, licencia MIT)
const SIMPLEX_NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`

export const coreVertexShader = /* glsl */ `
uniform float uTime;
uniform float uAmplitude;
uniform float uFrequency;
uniform float uSpeed;
uniform float uAudio;

varying vec3 vNormal;
varying vec3 vViewDir;
varying float vNoise;
varying vec3 vPosition;

${SIMPLEX_NOISE}

void main() {
  float t = uTime * uSpeed;
  float n = snoise(normal * uFrequency + vec3(t, t * 0.7, t * 0.4));
  float detail = snoise(normal * uFrequency * 2.7 - vec3(t * 1.3)) * 0.35;
  float displacement = (n + detail) * uAmplitude * (1.0 + uAudio * 1.8);
  vec3 displaced = position + normal * displacement;

  vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(cameraPosition - worldPosition.xyz);
  vNoise = n;
  vPosition = position;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`

export const coreFragmentShader = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uRim;
uniform float uScan;
uniform vec3 uColorA;
uniform vec3 uColorB;

varying vec3 vNormal;
varying vec3 vViewDir;
varying float vNoise;
varying vec3 vPosition;

void main() {
  vec3 normal = normalize(vNormal);
  float fresnel = pow(1.0 - clamp(dot(normal, vViewDir), 0.0, 1.0), 2.0);
  float mixer = smoothstep(-0.55, 0.85, vNoise);
  vec3 base = mix(uColorA * 0.78, uColorB * 1.15, mixer);

  // Venas de energia sobre la superficie
  float veins = smoothstep(0.38, 0.5, abs(fract(vNoise * 3.0 + uTime * 0.15) - 0.5));
  base += uColorB * veins * 0.32;

  // Barrido del scanner (ANALYZING / VISION / GESTURE)
  float scanPos = sin(uTime * 1.6) * 1.05;
  float scanBand = exp(-pow((vPosition.y - scanPos) * 9.0, 2.0)) * uScan;

  vec3 color = base * (uEnergy * 1.25) + uColorB * fresnel * (uRim * 1.35) + vec3(1.0, 0.9, 0.75) * scanBand * 0.95;
  gl_FragColor = vec4(color, 1.0);
}
`

export const haloVertexShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(cameraPosition - worldPosition.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`

export const haloFragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  float glow = pow(clamp(dot(normalize(vNormal), vViewDir), 0.0, 1.0), 2.1);
  float boost = uIntensity * 1.45;
  gl_FragColor = vec4(uColor * glow * boost, clamp(glow * boost * 0.95, 0.0, 1.0));
}
`

export const particleVertexShader = /* glsl */ `
uniform float uTime;
uniform float uSize;
uniform float uPixelRatio;
attribute float aSeed;
varying float vAlpha;
void main() {
  vec3 p = position;
  float wobble = sin(uTime * 0.6 + aSeed * 6.2831) * 0.08;
  p += normalize(p) * wobble;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * uPixelRatio * (0.6 + aSeed) * (1.0 / -mvPosition.z);
  vAlpha = 0.35 + 0.65 * fract(aSeed * 13.7 + uTime * 0.05);
  gl_Position = projectionMatrix * mvPosition;
}
`

export const particleFragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float strength = pow(1.0 - d * 2.0, 2.2);
  gl_FragColor = vec4(uColor, strength * vAlpha * uOpacity);
}
`
