// Stone's AI 夜城 office — fully procedural Three.js (no external models/assets)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const Q = new URLSearchParams(location.search);
const SHOT = Q.has('shot');
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: SHOT });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);
const labelR = new CSS2DRenderer();
labelR.setSize(innerWidth, innerHeight);
Object.assign(labelR.domElement.style, { position: 'fixed', inset: '0', pointerEvents: 'none' });
app.appendChild(labelR.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0b0a1c, 0.0042);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 1500);
camera.position.set(16, 15, 22);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-1, 0, -1);
controls.enableDamping = true; controls.maxPolarAngle = 1.45; controls.minDistance = 4; controls.maxDistance = 90;

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

// ---------- helpers ----------
const M = (c, r = 0.7, m = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...extra });
const E = (c, i = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), toneMapped: false });
function add(geo, mat, x = 0, y = 0, z = 0, parent = scene, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  parent.add(m); return m;
}
const box = (w, h, d, mat, x, y, z, p, s) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, p, s);
const cyl = (rt, rb, h, mat, x, y, z, p, seg = 20) => add(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, p);
function tube(points, r, mat, p = scene, closed = false) {
  const c = new THREE.CatmullRomCurve3(points.map(v => new THREE.Vector3(...v)), closed, 'catmullrom', 0.1);
  return add(new THREE.TubeGeometry(c, 48, r, 8, closed), mat, 0, 0, 0, p);
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData = { c, g }; return t;
}
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const aoTex = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
const aoMat = new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false });
function blob(x, z, sx, sz, p = scene) { const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), aoMat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.012, z); m.renderOrder = 1; p.add(m); return m; }

// ---------- sky, sun / moon (real Asia/Taipei time) ----------
const skyU = { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: 'varying vec3 vp;void main(){vp=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: 'uniform vec3 top,mid,bot;varying vec3 vp;void main(){float h=vp.y;vec3 c=h>0.?mix(mid,top,pow(h,.55)):mix(mid,bot,clamp(-h*4.,0.,1.));gl_FragColor=vec4(c,1.);}'
}));
scene.add(sky);
const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.castShadow = true; sunLight.shadow.mapSize.set(2048, 2048);
Object.assign(sunLight.shadow.camera, { left: -20, right: 20, top: 16, bottom: -16, near: 1, far: 120 });
sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = 0.03; sunLight.shadow.radius = 4;
scene.add(sunLight, sunLight.target);
const orb = new THREE.Mesh(new THREE.SphereGeometry(14, 32, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, toneMapped: false }));
scene.add(orb);
const hemi = new THREE.HemisphereLight(0x8a7cff, 0x1a1020, 0.6); scene.add(hemi);
function taipeiTime() { const d = new Date(); const u = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600; return (u + 8) % 24; }
function updateSky() {
  const h = Q.has('hour') ? +Q.get('hour') : taipeiTime();
  const a = (h - 6) / 12 * Math.PI; const el = Math.sin(a); const day = THREE.MathUtils.smoothstep(el, -0.15, 0.35);
  const isSun = el > -0.05; const ang = isSun ? a : a + Math.PI;
  const dir = new THREE.Vector3(Math.cos(ang) * 0.8, Math.max(0.25, Math.abs(Math.sin(ang))), -0.6).normalize();
  orb.position.copy(dir).multiplyScalar(700);
  orb.material.color.set(isSun ? 0xfff1d0 : 0xdfe8ff).multiplyScalar(isSun ? 3 : 1.6);
  sunLight.position.copy(dir).multiplyScalar(60); sunLight.target.position.set(0, 0, 0);
  sunLight.color.set(isSun ? (day < 0.6 ? 0xffb27a : 0xfff4e6) : 0x9fb4ff);
  sunLight.intensity = isSun ? 0.6 + day * 1.8 : 0.55;
  const dusk = 1 - Math.abs(day - 0.5) * 2;
  skyU.top.value.set(0x070718).lerp(new THREE.Color(0x3f7cc4), day);
  skyU.mid.value.set(0x2a0f3d).lerp(new THREE.Color(0xff7a4a), dusk * 0.6).lerp(new THREE.Color(0xa9c8e6), day * day);
  skyU.bot.value.set(0x0a0812);
  scene.fog.color.copy(skyU.mid.value).lerp(new THREE.Color(0x0b0a1c), 0.55 - day * 0.3);
  hemi.intensity = 0.45 + day * 0.6; scene.environmentIntensity = 0.3 + day * 0.4;
  renderer.toneMappingExposure = 1.0 + (1 - day) * 0.15;
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  document.getElementById('clock').textContent = `台北時間 ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${isSun ? '☀ 太陽' : '☾ 月亮'}`;
}

// ---------- Manhattan-style street grid city (instanced) ----------
const GROUND = -110;
const towerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.35 });
towerMat.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;').replace('#include <project_vertex>', `#include <project_vertex>
  vec4 wp4 = vec4(transformed, 1.0); vec3 nn = normal;
  #ifdef USE_INSTANCING
  wp4 = instanceMatrix * wp4; nn = mat3(instanceMatrix) * nn;
  #endif
  wp4 = modelMatrix * wp4; vWP = wp4.xyz; vWN = normalize(mat3(modelMatrix) * nn);`);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;').replace('#include <emissivemap_fragment>', `
  vec3 an = abs(vWN); float side = step(an.y, 0.5);
  float u = an.x > 0.5 ? vWP.z : vWP.x;
  vec2 cell = vec2(u / 3.3, (vWP.y + 110.0) / 3.7); vec2 fc = fract(cell); vec2 id = floor(cell);
  float win = step(0.16, fc.x) * step(fc.x, 0.84) * step(0.22, fc.y) * step(fc.y, 0.86);
  float hsh = fract(sin(dot(id + vec2(floor(vWP.z * 0.07) * 3.1 + an.x * 7.0, floor(vWP.x * 0.07) * 1.7), vec2(12.9898, 78.233))) * 43758.5453);
  float lit = step(0.7, hsh);
  vec3 wc = mix(vec3(1.0, 0.76, 0.48), vec3(0.62, 0.85, 1.0), step(0.88, hsh));
  float ground = (vWP.y < -105.5) ? 1.0 : 0.0;
  diffuseColor.rgb *= mix(1.0, 0.45, win * side);
  totalEmissiveRadiance += side * (win * lit * wc * (0.35 + 0.5 * fract(hsh * 13.0)) * (1.0 - ground) + ground * step(0.15, fc.x) * vec3(1.0, 0.82, 0.6) * 0.9);`);
};
// grid definition (meters). Avenues run N–S (z), streets E–W (x)
const AVES = [], STS = []; for (let i = 0; i < 8; i++) AVES.push(-630 + 180 * i); for (let k = 0; k < 9; k++) STS.push(-440 + 80 * k);
const AW = 20, SW = 14, SIDE = 5; // road widths, sidewalk
const Z0 = -480, Z1 = 240, X0 = -650, X1 = 720;
add(new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2), M(0x16161b, 0.92), 0, GROUND, 0, scene, false).receiveShadow = false;
add(new THREE.PlaneGeometry(700, 1600).rotateX(-Math.PI / 2), M(0x0a1626, 0.06, 0.9), -1005, GROUND + 0.3, -100, scene, false);
function inst(geo, mat, list, colorFn) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  list.forEach((t, i) => { mtx.compose(p3.set(t[0], t[1], t[2]), q.setFromEuler(new THREE.Euler(0, t[6] || 0, 0)), s3.set(t[3], t[4], t[5])); m.setMatrixAt(i, mtx); if (colorFn) m.setColorAt(i, colorFn(t, i)); });
  m.count = list.length; scene.add(m); return m;
}
const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();
const UB = new THREE.BoxGeometry(1, 1, 1);
// sidewalks (one raised slab per block) + waterfront promenade
const blocksX = [], blocksZ = [];
for (let i = 0; i < AVES.length; i++) blocksX.push(AVES[i] + 90); blocksX.unshift(-720);
for (let z = -480; z <= 240; z += 80) blocksZ.push(z);
const walks = [];
blocksX.forEach(cx => blocksZ.forEach(cz => { if (cx < -640) return; walks.push([cx, GROUND + 0.12, cz, 180 - AW, 0.24, 80 - SW]); }));
walks.push([-650, GROUND + 0.12, -120, 20, 0.24, 760]);
inst(UB, M(0x4b4b52, 0.85), walks);
const curbs = walks.map(w => [w[0], GROUND + 0.05, w[2], w[3] + 0.4, 0.1, w[5] + 0.4]); inst(UB, M(0x6a6a70, 0.7), curbs);
// lane markings + crosswalks
const marks = [], xw = [];
const nearSt = z => STS.some(s => Math.abs(z - s) < SW / 2 + 4), nearAv = x => AVES.some(a => Math.abs(x - a) < AW / 2 + 4);
AVES.forEach(ax => { for (const o of [-5, 0, 5]) for (let z = Z0; z < Z1; z += 9) if (!nearSt(z)) marks.push([ax + o, GROUND + 0.02, z, 0.15, 0.02, 3]); });
STS.forEach(sz => { for (let x = X0; x < X1; x += 9) if (!nearAv(x)) marks.push([x, GROUND + 0.02, sz, 3, 0.02, 0.15]); });
AVES.forEach(ax => STS.forEach(sz => {
  for (const sgn of [-1, 1]) {
    for (let x = -AW / 2 + 0.6; x < AW / 2; x += 1.1) xw.push([ax + x, GROUND + 0.025, sz + sgn * (SW / 2 + 1.8), 0.55, 0.02, 3]);
    for (let z = -SW / 2 + 0.6; z < SW / 2; z += 1.1) xw.push([ax + sgn * (AW / 2 + 1.8), GROUND + 0.025, sz + z, 3, 0.02, 0.55]);
  }
}));
inst(UB, new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.6 }), marks.concat(xw));
// buildings (blocks filled with lots, setbacks, rooftops)
const FAC = [0x6b6560, 0x5a5048, 0x7a7068, 0x3f444c, 0x2c3038, 0x8a8278, 0x4d3c34, 0x555a60, 0x23262c];
const bld = [], tanks = [], tankLegs = [], acs = [], crowns = [], strips = [];
const PLAZA = { x: -90, z: -120 };
const corners = [];
for (const qx of [-1, 1]) for (const qz of [-1, 1]) { const C = { x: PLAZA.x + qx * (AW / 2 + SIDE), z: PLAZA.z + qz * (SW / 2 + SIDE) }; corners.push({ qx, qz, C, x0: Math.min(C.x, C.x + qx * 36), x1: Math.max(C.x, C.x + qx * 36), z0: Math.min(C.z, C.z + qz * 28), z1: Math.max(C.z, C.z + qz * 28) }); }
const NEONC = [0x22f3ff, 0xff2fb0, 0x39ff7a, 0xffd23a, 0x8a5bff];
function addBuilding(x0, x1, z0, z1, h, cx, cz, forceFlat) {
  const col = FAC[Math.floor(rnd() * FAC.length)];
  let w = x1 - x0, d = z1 - z0, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, y = GROUND + 0.24, hh = h;
  const tiers = forceFlat ? 1 : h > 130 ? 3 : h > 65 ? 2 : 1;
  for (let t = 0; t < tiers; t++) {
    const th = tiers === 1 ? hh : t === 0 ? hh * (0.45 + rnd() * 0.2) : t === 1 && tiers === 3 ? hh * 0.3 : hh - (y - GROUND);
    const hth = Math.max(6, t === tiers - 1 ? GROUND + hh - y : th);
    bld.push([mx, y + hth / 2, mz, w, hth, d, 0, col]);
    if (t < tiers - 1) { y += hth; w *= 0.72 + rnd() * 0.12; d *= 0.72 + rnd() * 0.12; mx += (rnd() - 0.5) * 2; } else y += hth;
  }
  // rooftop
  if (!forceFlat && h < 120 && rnd() < 0.35) { const tx = mx + (rnd() - 0.5) * w * 0.4, tz = mz + (rnd() - 0.5) * d * 0.4; tanks.push([tx, y + 4.5, tz, 1, 1, 1]); for (const a of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) tankLegs.push([tx + a[0] * 1.6, y + 1.5, tz + a[1] * 1.6, 0.25, 3, 0.25]); }
  const na = Math.floor(rnd() * 4); for (let k = 0; k < na; k++) acs.push([mx + (rnd() - 0.5) * w * 0.6, y + 0.8, mz + (rnd() - 0.5) * d * 0.6, 2 + rnd() * 2.5, 1.6, 1.5 + rnd() * 2]);
  bld.push([mx, y + 0.6, mz, w + 0.3, 1.2, d + 0.3, 0, col]); // parapet cap
  if (h > 90 && rnd() < 0.5) crowns.push([mx, y + 1.3, mz, w + 0.5, 0.35, d + 0.5, 0, NEONC[Math.floor(rnd() * 5)]]);
  if (h > 110 && rnd() < 0.4) strips.push([mx + w / 2, GROUND + h * 0.55, mz + d / 2, 0.35, h * 0.9, 0.35, 0, NEONC[Math.floor(rnd() * 5)]]);
  if (h > 160 && rnd() < 0.6) bld.push([mx, y + 12, mz, 0.6, 24, 0.6, 0, 0x888888]); // spire
}
blocksX.forEach(cx => blocksZ.forEach(cz => {
  if (cx < -640) return;
  const dist = Math.hypot(cx, cz + 60), office = cx === 0 && cz === 0;
  for (const row of [-1, 1]) {
    let x = cx - 75; const zf = row < 0 ? cz - 28 : cz + 28;
    while (x < cx + 75) {
      let lw = Math.min(cx + 75 - x, 14 + rnd() * 26); if (cx + 75 - x - lw < 10) lw = cx + 75 - x;
      const depth = 18 + rnd() * 10; const z0 = row < 0 ? zf : zf - depth, z1 = row < 0 ? zf + depth : zf;
      const xa = x, xb = x + lw - 0.6; x += lw;
      if (office && Math.abs((xa + xb) / 2) < 30) continue;
      if (corners.some(c => xb > c.x0 && xa < c.x1 && z1 > c.z0 && z0 < c.z1)) continue;
      let h = 22 + Math.pow(rnd(), 1.6) * (dist < 260 ? 210 : dist < 450 ? 140 : 90);
      if (office) h = Math.min(h, 85);
      addBuilding(xa, xb, z0, z1, h, cx, cz);
    }
  }
}));
corners.forEach(c => addBuilding(c.x0, c.x1, c.z0, c.z1, 80 + rnd() * 50, 0, 0, false));
const bInst = inst(UB, towerMat, bld, t => new THREE.Color(t[7]));
const metalDark = M(0x3b3530, 0.8, 0.2);
const tankG = new THREE.CylinderGeometry(2.2, 2.2, 4.5, 14); const tankRoof = new THREE.ConeGeometry(2.4, 1.8, 14);
inst(tankG, M(0x5b4636, 0.9), tanks); inst(tankRoof, M(0x2e2620, 0.8), tanks.map(t => [t[0], t[1] + 3.1, t[2], 1, 1, 1])); inst(UB, metalDark, tankLegs);
inst(UB, M(0x8a8c90, 0.5, 0.6), acs);
inst(UB, new THREE.MeshBasicMaterial({ toneMapped: false }), crowns.concat(strips), t => new THREE.Color(t[7]).multiplyScalar(2));
// streetlights
const poles = [], bulbs = [], pools = [];
AVES.forEach(ax => { for (const sg of [-1, 1]) for (let z = Z0; z < Z1; z += 32) if (!nearSt(z)) { const x = ax + sg * (AW / 2 + 1); poles.push([x, GROUND + 4.2, z, 0.18, 8.4, 0.18]); bulbs.push([x - sg * 1.4, GROUND + 8.3, z, 0.9, 0.25, 0.5]); pools.push([x - sg * 2.5, GROUND + 0.04, z, 12, 1, 12]); } });
STS.forEach(sz => { for (const sg of [-1, 1]) for (let x = X0; x < X1; x += 32) if (!nearAv(x)) { const z = sz + sg * (SW / 2 + 1); poles.push([x, GROUND + 4.2, z, 0.18, 8.4, 0.18]); bulbs.push([x, GROUND + 8.3, z - sg * 1.4, 0.5, 0.25, 0.9]); pools.push([x, GROUND + 0.04, z - sg * 2.5, 12, 1, 12]); } });
for (let z = Z0; z < Z1; z += 14) { bulbs.push([-659, GROUND + 3.5, z, 0.5, 0.5, 0.5]); poles.push([-659, GROUND + 1.75, z, 0.12, 3.5, 0.12]); }
inst(UB, M(0x2a2b30, 0.5, 0.7), poles);
inst(UB, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd9a0).multiplyScalar(3), toneMapped: false }), bulbs);
const poolTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,200,140,.55)'); gr.addColorStop(1, 'rgba(255,200,140,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
inst(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), pools);
// traffic lights: 4 corner poles per intersection, one head for each direction
const tPoles = [], heads = [], lampsA = [], lampsS = [];
AVES.forEach(ax => STS.forEach(sz => {
  for (const qx of [-1, 1]) for (const qz of [-1, 1]) {
    const x = ax + qx * (AW / 2 + 0.8), z = sz + qz * (SW / 2 + 0.8);
    tPoles.push([x, GROUND + 2.8, z, 0.2, 5.6, 0.2]);
    heads.push([x, GROUND + 5.2, z - qz * 0.35, 0.45, 1.3, 0.45]); lampsA.push([x, GROUND + 5.2, z - qz * 0.6, 0.3, 0.3, 0.06]);
    heads.push([x - qx * 0.35, GROUND + 5.2, z, 0.45, 1.3, 0.45]); lampsS.push([x - qx * 0.6, GROUND + 5.2, z, 0.06, 0.3, 0.3]);
  }
}));
inst(UB, M(0x1e1f24, 0.5, 0.7), tPoles); inst(UB, M(0x15161a, 0.6, 0.4), heads);
const LIGHTMAT = new THREE.MeshBasicMaterial({ toneMapped: false });
const lampAInst = inst(UB, LIGHTMAT, lampsA, () => new THREE.Color(1, 1, 1)), lampSInst = inst(UB, LIGHTMAT.clone(), lampsS, () => new THREE.Color(1, 1, 1));
const CYCLE = 26; let lastPhase = '';
const sigCol = { g: new THREE.Color(0x30ff80).multiplyScalar(3), y: new THREE.Color(0xffb020).multiplyScalar(3), r: new THREE.Color(0xff2a2a).multiplyScalar(3) };
function sigState(t) { const p = t % CYCLE; return { ave: p < 11 ? 'g' : p < 13 ? 'y' : 'r', st: p < 13 ? 'r' : p < 24 ? 'g' : 'y' }; }
function updateSignals(t) { const s = sigState(t); const key = s.ave + s.st; if (key === lastPhase) return; lastPhase = key; for (let i = 0; i < lampsA.length; i++) lampAInst.setColorAt(i, sigCol[s.ave]); for (let i = 0; i < lampsS.length; i++) lampSInst.setColorAt(i, sigCol[s.st]); lampAInst.instanceColor.needsUpdate = true; lampSInst.instanceColor.needsUpdate = true; }
// traffic: one-way avenues & streets (alternating), lanes, car following, stop at red
const lanes = [];
AVES.forEach((ax, i) => { const dir = i % 2 ? 1 : -1; for (const o of [-7.5, -2.5, 2.5, 7.5]) lanes.push({ axis: 'z', c: ax + o, dir, min: Z0, max: Z1, cross: STS, half: SW / 2, sig: 'ave', n: 11 }); });
STS.forEach((sz, k) => { const dir = k % 2 ? 1 : -1; for (const o of [-2.5, 2.5]) lanes.push({ axis: 'x', c: sz + o, dir, min: X0, max: X1, cross: AVES, half: AW / 2, sig: 'st', n: 9 }); });
const cars = []; const CARCOL = [0xf2c200, 0xf2c200, 0xf2c200, 0x1d1d22, 0xd8d8d8, 0x8a1c1c, 0x23324a, 0x555a60, 0xb0b4b8];
lanes.forEach(L => {
  L.len = L.max - L.min; L.s0 = L.dir > 0 ? L.min : -L.max; L.cs = L.cross.map(c => c * L.dir).sort((a, b) => a - b); L.cars = [];
  for (let j = 0; j < L.n; j++) { const c = { L, s: L.s0 + (j + rnd() * 0.5) / L.n * L.len, v: 8, vmax: 11 + rnd() * 5, col: CARCOL[Math.floor(rnd() * CARCOL.length)], len: 4.4 + rnd() * 0.8 }; L.cars.push(c); cars.push(c); }
});
const carBody = new THREE.InstancedMesh(UB, M(0xffffff, 0.35, 0.6), cars.length), carCab = new THREE.InstancedMesh(UB, M(0x101318, 0.15, 0.8), cars.length);
const carHead = new THREE.InstancedMesh(UB, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2d8).multiplyScalar(3), toneMapped: false }), cars.length), carTail = new THREE.InstancedMesh(UB, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff1a28).multiplyScalar(3), toneMapped: false }), cars.length);
cars.forEach((c, i) => carBody.setColorAt(i, new THREE.Color(c.col))); scene.add(carBody, carCab, carHead, carTail);
const fwd = new THREE.Vector3(), cp = new THREE.Vector3();
function updateCars(dt, t) {
  const sg = sigState(t);
  lanes.forEach(L => {
    L.cars.sort((a, b) => a.s - b.s); const n = L.cars.length; const green = sg[L.sig] === 'g';
    for (let j = 0; j < n; j++) {
      const c = L.cars[j]; const lead = L.cars[(j + 1) % n]; let ls = lead.s; if (j === n - 1) ls += L.len;
      let limit = ls - c.s - (c.len + 3);
      if (!green) { for (const x of L.cs) { const stop = x - L.half - 4; if (stop - c.s > -0.5 && x + L.half > c.s) { if (stop - c.s > -0.5) limit = Math.min(limit, stop - c.s); break; } if (x + L.half > c.s) break; } }
      const vt = Math.min(c.vmax, Math.max(0, limit * 0.9));
      c.v += THREE.MathUtils.clamp(vt - c.v, -14 * dt, 3.5 * dt); c.v = Math.max(0, Math.min(c.v, Math.max(0, limit) / Math.max(dt, 1e-3)));
      c.s += c.v * dt; if (c.s > L.s0 + L.len) c.s -= L.len;
    }
  });
  cars.forEach((c, i) => {
    const L = c.L, tt = c.s * L.dir; const yaw = L.axis === 'z' ? (L.dir > 0 ? 0 : Math.PI) : (L.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw); fwd.set(0, 0, 1).applyQuaternion(q);
    const bx = L.axis === 'z' ? L.c : tt, bz = L.axis === 'z' ? tt : L.c, y = GROUND;
    mtx.compose(p3.set(bx, y + 0.65, bz), q, s3.set(1.9, 0.8, c.len)); carBody.setMatrixAt(i, mtx);
    mtx.compose(p3.set(bx - fwd.x * 0.3, y + 1.3, bz - fwd.z * 0.3), q, s3.set(1.7, 0.55, c.len * 0.5)); carCab.setMatrixAt(i, mtx);
    mtx.compose(p3.set(bx + fwd.x * c.len / 2, y + 0.7, bz + fwd.z * c.len / 2), q, s3.set(1.6, 0.18, 0.06)); carHead.setMatrixAt(i, mtx);
    mtx.compose(p3.set(bx - fwd.x * c.len / 2, y + 0.75, bz - fwd.z * c.len / 2), q, s3.set(1.6, 0.16, 0.06)); carTail.setMatrixAt(i, mtx);
  });
  for (const m of [carBody, carCab, carHead, carTail]) m.instanceMatrix.needsUpdate = true;
}
// Times Square-style LED walls at the plaza intersection
const LED = canvasTex(1024, 1024, () => { }); LED.minFilter = THREE.LinearFilter;
const WORDS = ['NOVA', 'AURA', 'VOLT', 'KUMO', 'LUMA', 'ORBIT', 'PULSE', 'ZENITH', '霓虹', '未來', 'ARC', 'MIRA'];
function drawLED(t) {
  const { g } = LED.userData; const S = 256;
  for (let i = 0; i < 16; i++) {
    const x = (i % 4) * S, y = Math.floor(i / 4) * S, type = i % 8, hue = (i * 47 + t * 20) % 360, w = WORDS[i % WORDS.length];
    g.save(); g.beginPath(); g.rect(x, y, S, S); g.clip();
    if (type === 0) { const gr = g.createLinearGradient(x, y, x + S, y + S); gr.addColorStop(0, `hsl(${hue},90%,55%)`); gr.addColorStop(1, `hsl(${(hue + 80) % 360},85%,35%)`); g.fillStyle = gr; g.fillRect(x, y, S, S); g.fillStyle = '#fff'; g.font = 'bold 70px sans-serif'; g.textAlign = 'center'; g.fillText(w, x + S / 2 + Math.sin(t) * 20, y + S / 2 + 25); }
    else if (type === 1) { g.fillStyle = '#05070d'; g.fillRect(x, y, S, S); g.font = 'bold 38px monospace'; for (let r = 0; r < 5; r++) { const off = (t * (60 + r * 25)) % 600; g.fillStyle = r % 2 ? '#39ff7a' : '#ff4d5e'; g.fillText(`${WORDS[(r + i) % 12]} ${(100 + Math.sin(r + t * 0.3) * 40).toFixed(1)} ${r % 2 ? '▲' : '▼'}   ${WORDS[(r + 5) % 12]} ${(50 + r * 7).toFixed(1)}`, x - off + 260, y + 50 + r * 48); } }
    else if (type === 2) { g.fillStyle = `hsl(${hue},70%,12%)`; g.fillRect(x, y, S, S); for (let r = 8; r > 0; r--) { g.strokeStyle = `hsla(${(hue + r * 25) % 360},100%,60%,${0.9 - r * 0.08})`; g.lineWidth = 9; g.beginPath(); g.arc(x + S / 2, y + S / 2, ((r * 18 + t * 50) % 150), 0, 7); g.stroke(); } }
    else if (type === 3) { g.fillStyle = '#0b0614'; g.fillRect(x, y, S, S); for (let b = 0; b < 16; b++) { const h = (0.5 + 0.5 * Math.sin(t * 4 + b * 0.7 + i)) * 200 + 20; g.fillStyle = `hsl(${(hue + b * 12) % 360},100%,55%)`; g.fillRect(x + 6 + b * 15.6, y + S - h, 11, h); } }
    else if (type === 4) { g.fillStyle = '#f4f1ea'; g.fillRect(x, y, S, S); g.fillStyle = `hsl(${hue},80%,50%)`; g.beginPath(); g.roundRect(x + 30, y + 40, 90, 90, 22); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 10; g.beginPath(); g.arc(x + 75, y + 85, 26, 0.3, 5.5); g.stroke(); g.fillStyle = '#111'; g.font = 'bold 54px sans-serif'; g.fillText(w, x + 30, y + 200); }
    else if (type === 5) { g.fillStyle = `hsl(${hue},90%,50%)`; g.fillRect(x, y, S, S); g.fillStyle = 'rgba(0,0,0,.35)'; for (let k = -10; k < 10; k++) { const o = (t * 80) % 60; g.beginPath(); g.moveTo(x + k * 60 + o, y); g.lineTo(x + k * 60 + 30 + o, y); g.lineTo(x + k * 60 + 30 + o - S, y + S); g.lineTo(x + k * 60 + o - S, y + S); g.fill(); } g.fillStyle = '#fff'; g.font = 'bold 64px sans-serif'; g.fillText(w, x + 20, y + 150); }
    else if (type === 6) { const gr = g.createRadialGradient(x + S / 2, y + S / 2, 10, x + S / 2, y + S / 2, 200); gr.addColorStop(0, `hsl(${(hue + 180) % 360},100%,70%)`); gr.addColorStop(1, '#060310'); g.fillStyle = gr; g.fillRect(x, y, S, S); g.fillStyle = 'rgba(255,255,255,.9)'; g.font = 'bold 120px sans-serif'; g.textAlign = 'center'; g.fillText(String(Math.floor(t * 3) % 100).padStart(2, '0'), x + S / 2, y + S / 2 + 40); }
    else { g.fillStyle = '#020308'; g.fillRect(x, y, S, S); g.strokeStyle = `hsl(${hue},100%,60%)`; g.lineWidth = 6; g.beginPath(); for (let k = 0; k <= 40; k++) { const px = x + k * S / 40; g.lineTo(px, y + S / 2 + Math.sin(k * 0.5 + t * 3) * 60 * Math.sin(t * 0.7 + i)); } g.stroke(); g.fillStyle = '#fff'; g.font = '30px sans-serif'; g.textAlign = 'left'; g.fillText(w + ' LIVE', x + 14, y + 40); }
    g.restore();
  }
  LED.needsUpdate = true;
}
const ledMat = new THREE.MeshBasicMaterial({ map: LED, toneMapped: false, color: new THREE.Color(1.05, 1.05, 1.05) });
const ledBack = M(0x0b0b10, 0.5, 0.6);
function cellGeo(w, h, cell) { const g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv; const cx = cell % 4, cy = Math.floor(cell / 4); for (let i = 0; i < uv.count; i++) uv.setXY(i, (cx + uv.getX(i)) / 4, (3 - cy + uv.getY(i)) / 4); return g; }
function ledWall(cx, cz, ry, W, Htot) {
  const grp = new THREE.Group(); grp.position.set(cx, GROUND, cz); grp.rotation.y = ry; scene.add(grp);
  box(W + 1, Htot + 1, 0.5, ledBack, 0, 5 + Htot / 2, -0.2, grp, false);
  let y = 5;
  while (y < 5 + Htot - 3) {
    const rh = Math.min(5 + Htot - y, rnd() < 0.25 ? 2.4 : 4 + rnd() * 7);
    if (rh < 2.4) break;
    const n = rh < 3 ? 1 : 1 + Math.floor(rnd() * 3); let x = -W / 2;
    for (let k = 0; k < n; k++) { const sw = k === n - 1 ? W / 2 - x : (W / n) * (0.7 + rnd() * 0.6); const cell = rh < 3 ? 1 + 8 * Math.floor(rnd() * 2) : Math.floor(rnd() * 16); const m = new THREE.Mesh(cellGeo(sw - 0.5, rh - 0.5, cell), ledMat); m.position.set(x + sw / 2, y + rh / 2, 0.12); grp.add(m); x += sw; }
    y += rh;
  }
}
corners.forEach(c => {
  ledWall(c.C.x - c.qx * 0.4, c.C.z + c.qz * 14, c.qx > 0 ? -Math.PI / 2 : Math.PI / 2, 26, 38 + rnd() * 14);
  ledWall(c.C.x + c.qx * 18, c.C.z - c.qz * 0.4, c.qz > 0 ? Math.PI : 0, 34, 38 + rnd() * 14);
});
[[0xff3fb4, -90, -100], [0x22f3ff, -90, -140]].forEach(([c, x, z]) => { const l = new THREE.PointLight(c, 3000, 90, 2); l.position.set(x, GROUND + 18, z); scene.add(l); });
const billboards = [];

// holograms
const holoHead = new THREE.Group(); holoHead.position.set(-38, 8, -48); scene.add(holoHead);
{
  const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; const y = (t - 0.5) * 2; let r = Math.sin(t * Math.PI) * (0.78 + 0.12 * Math.sin(t * 9)); if (t < 0.18) r *= 0.7 + t; pts.push(new THREE.Vector2(r, y)); }
  const hm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3fb4).multiplyScalar(2), wireframe: true, transparent: true, opacity: 0.75, toneMapped: false });
  const head = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), hm); head.scale.set(6, 8, 6.6); holoHead.add(head);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 6), hm); nose.rotation.x = Math.PI / 2; nose.position.set(0, -0.5, 5.6); holoHead.add(nose);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(9, 0.12, 6, 64), hm); ring.rotation.x = Math.PI / 2; ring.position.y = -9; holoHead.add(ring);
}
const holoFig = new THREE.Group(); holoFig.position.set(60, -20, -95); scene.add(holoFig);
{
  const bm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x3a8bff).multiplyScalar(2), wireframe: true, transparent: true, opacity: 0.6, toneMapped: false });
  const parts = [[new THREE.CapsuleGeometry(3, 9, 4, 10), 0, 22, 0], [new THREE.SphereGeometry(2.6, 12, 10), 0, 33, 0], [new THREE.CapsuleGeometry(1.2, 11, 4, 8), -4.5, 21, 0], [new THREE.CapsuleGeometry(1.2, 11, 4, 8), 4.5, 21, 0], [new THREE.CapsuleGeometry(1.5, 13, 4, 8), -1.8, 8, 0], [new THREE.CapsuleGeometry(1.5, 13, 4, 8), 1.8, 8, 0]];
  parts.forEach(([g, x, y, z]) => { const m = new THREE.Mesh(g, bm); m.position.set(x, y, z); holoFig.add(m); });
  holoFig.children[2].rotation.z = -0.25; holoFig.children[3].rotation.z = 0.25;
}

// ---------- office building & interior ----------
const OW = 30, OD = 18; // x ∈ [-15,15], z ∈ [-9,9]
const MOR = { floor: 0x77736f, wall: 0xa8a39d, warm: 0xb9ada0, sage: 0x9aa595, blue: 0x8f9aa6, rose: 0xb59c98, dark: 0x4a4a4f, wood: 0x9c7d62, white: 0xc9c4bc };
box(OW + 2, 3, OD + 2, M(0x2a2a33, 0.6, 0.3), 0, -1.52, 0, scene, false); // slab
for (let i = 0; i < 6; i++) box(OW - 2 - i * 0.6, 40, OD - 2 - i * 0.6, towerMat, 0, -23 - i * 40, 0, scene, false); // tower below
const reflector = new Reflector(new THREE.PlaneGeometry(OW, OD), { textureWidth: 1024, textureHeight: 640, color: 0x777777 });
reflector.rotation.x = -Math.PI / 2; reflector.position.y = -0.002; scene.add(reflector);
const floorTex = canvasTex(1024, 1024, (g, w, h) => { g.fillStyle = '#625f5c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},${Math.random() * .05})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 2; for (let i = 0; i <= w; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } });
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(4, 2.4);
const floor = add(new THREE.PlaneGeometry(OW, OD).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.4, metalness: 0.05, transparent: true, opacity: 0.9 }), 0, 0, 0);
floor.castShadow = false;
// floor-to-ceiling glass + mullions
const H = 3.4;
const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x9fc4d8, roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.5 });
const frameMat = M(0x2b2c31, 0.4, 0.7);
function glassWall(x1, z1, x2, z2, h = H, mull = 2.5) {
  const L = Math.hypot(x2 - x1, z2 - z1), a = Math.atan2(z2 - z1, x2 - x1), cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  const g = new THREE.Mesh(new THREE.PlaneGeometry(L, h), glassMat); g.position.set(cx, h / 2, cz); g.rotation.y = -a; scene.add(g);
  const n = Math.max(1, Math.round(L / mull));
  for (let i = 0; i <= n; i++) { const t = i / n; box(0.045, h, 0.045, frameMat, x1 + (x2 - x1) * t, h / 2, z1 + (z2 - z1) * t); }
  const top = box(L, 0.08, 0.08, frameMat, cx, h, cz); top.rotation.y = -a; const bot = box(L, 0.06, 0.1, frameMat, cx, 0.03, cz); bot.rotation.y = -a;
}
glassWall(-15, -9, 15, -9); glassWall(-15, -9, -15, 9); glassWall(15, -9, 15, 9); glassWall(-15, 9, 15, 9);
// ceiling beams (cutaway) + light strips
for (let x = -9; x <= 9; x += 6) for (let z = -5; z <= 5; z += 5) { box(0.01, 0.4, 0.01, frameMat, x, H - 0.2, z, scene, false); box(1.4, 0.03, 0.14, E(0xfff2dc, 1.6), x, H - 0.4, z, scene, false); box(1.44, 0.05, 0.18, M(0x2b2c31, 0.4, 0.6), x, H - 0.37, z, scene, false); }
// interior partition / feature wall (display zone)
box(0.25, H, 7, M(MOR.wall, 0.9), 14.6, H / 2, 4.6);
box(7.2, H, 0.25, M(MOR.sage, 0.9), 11.2, H / 2, 8.75);

// monitors
const codeTex = canvasTex(256, 160, (g, w, h) => { g.fillStyle = '#0b1220'; g.fillRect(0, 0, w, h); const cs = ['#4ff3ff', '#ff79c6', '#a6e22e', '#e6db74', '#8be9fd', '#cfd6e6']; for (let y = 10; y < h; y += 9) { let x = 8 + Math.floor(Math.random() * 4) * 10; while (x < w - 20 && Math.random() < .8) { const l = 10 + Math.random() * 40; g.fillStyle = cs[Math.floor(Math.random() * cs.length)]; g.globalAlpha = .85; g.fillRect(x, y, l, 4); x += l + 6; } } });
const chartTex = canvasTex(256, 160, (g, w, h) => { g.fillStyle = '#0d0f1a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#39ff7a'; g.lineWidth = 3; g.beginPath(); let y = 110; for (let x = 0; x < w; x += 8) { y += (Math.random() - .55) * 14; g.lineTo(x, y); } g.stroke(); g.fillStyle = '#ffd23a'; for (let i = 0; i < 12; i++) g.fillRect(14 + i * 19, 150 - Math.random() * 40, 10, 40); });
const scrMats = [codeTex, chartTex].map(t => new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.3, 1.3, 1.3), toneMapped: false }));
function monitor(x, y, z, ry, p = scene, mat = scrMats[0], w = 0.62) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; p.add(g);
  box(w, w * 0.6, 0.03, M(0x1a1a1e, 0.4, 0.5), 0, 0.3, 0, g); add(new THREE.PlaneGeometry(w - 0.04, w * 0.6 - 0.04), mat, 0, 0.3, 0.017, g, false);
  box(0.05, 0.25, 0.05, M(0x2a2a2e, 0.4, 0.8), 0, 0.08, -0.04, g); box(0.22, 0.015, 0.16, M(0x2a2a2e, 0.4, 0.8), 0, 0.007, -0.04, g);
  const glow = new THREE.PointLight(0x7fd8ff, 0.12, 1.8, 2); glow.position.set(0, 0.3, 0.3); g.add(glow);
  return g;
}
function chair(x, z, ry, col = MOR.dark) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  const mat = M(col, 0.8);
  box(0.5, 0.08, 0.48, mat, 0, 0.46, 0, g); box(0.48, 0.55, 0.07, mat, 0, 0.8, -0.24, g).rotation.x = -0.08;
  cyl(0.03, 0.03, 0.4, M(0x777, 0.3, 0.9), 0, 0.24, 0, g);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const l = box(0.04, 0.03, 0.3, M(0x333, 0.4, 0.8), Math.sin(a) * 0.15, 0.04, Math.cos(a) * 0.15, g); l.rotation.y = a; }
  blob(x, z, 0.9, 0.9); return g;
}
function desk(x, z, ry, w = 1.5, d = 0.7, col = MOR.white) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  box(w, 0.04, d, M(col, 0.45), 0, 0.74, 0, g);
  for (const sx of [-1, 1]) box(0.04, 0.72, d - 0.1, M(0x3a3a40, 0.4, 0.8), sx * (w / 2 - 0.06), 0.37, 0, g);
  box(0.42, 0.015, 0.14, M(0x222226, 0.6), 0, 0.77, 0.12, g); // keyboard
  blob(x, z, w + 0.6, d + 0.6); return g;
}
// seats: pos where hips go, rot = facing yaw (local +z forward)
const SPOT = {};
function seatAt(name, x, z, rot, type = 'seat', via = []) { SPOT[name] = { x, z, rot, type, via }; }
// open-plan desks (6)
const openX = [-6, -4, -2];
openX.forEach((x, i) => {
  desk(x, 1.85, Math.PI); monitor(x, 0.76, 2.05, 0); chair(x, 1.2, 0); seatAt('desk' + i, x, 1.25, Math.PI);
  desk(x, 2.75, 0); monitor(x, 0.76, 2.55, Math.PI, scene, scrMats[1]); chair(x, 3.4, Math.PI); seatAt('desk' + (i + 3), x, 3.35, 0, 'seat', [[0.3, 4.3], [x, 4.3]]);
});
// fix: front row faces +z toward monitor (rot 0); back row faces -z
openX.forEach((x, i) => { SPOT['desk' + i].rot = 0; SPOT['desk' + (i + 3)].rot = Math.PI; });
// extra desks for URAKAKERA + dr eggbot
(() => {
  const x = 0;
  desk(x, 1.85, Math.PI); monitor(x, 0.76, 2.05, 0); chair(x, 1.2, 0); seatAt('desk6', x, 1.25, 0);
  desk(x, 2.75, 0); monitor(x, 0.76, 2.55, Math.PI, scene, scrMats[1]); chair(x, 3.4, Math.PI); seatAt('desk7', x, 3.35, Math.PI, 'seat', [[0.3, 4.3], [x, 4.3]]);
  box(1.5, 0.3, 0.02, M(MOR.sage, 0.9), x, 1.0, 2.3);
})();

for (let k = 0; k < 3; k++) box(1.5, 0.3, 0.02, M(MOR.sage, 0.9), openX[k], 1.0, 2.3); // privacy panels
// plants
function plant(x, z, s = 1) { cyl(0.22 * s, 0.17 * s, 0.45 * s, M(0xd6d0c8, 0.6), x, 0.225 * s, z); for (let i = 0; i < 9; i++) { const l = add(new THREE.SphereGeometry(0.16 * s, 8, 6), M(0x5f7a5a, 0.8), x + (rnd() - .5) * 0.35 * s, (0.6 + rnd() * 0.5) * s, z + (rnd() - .5) * 0.35 * s); l.scale.set(1, 1.6, 0.6); l.rotation.set(rnd(), rnd(), rnd()); } blob(x, z, 0.8 * s, 0.8 * s); }
plant(-8.6, 1.2); plant(-8.6, 3.6); plant(0.8, 4.4); plant(14, -8.2, 1.3); plant(-14.2, 8.2, 1.4); plant(4.5, 8.2, 1.2);

// Stone's private glass office
glassWall(8, -3, 15, -3, H, 1.4); glassWall(8, -9, 8, -4.6, H, 1.4); glassWall(8, -3.4, 8, -3, H, 1);
box(6.8, 0.012, 5.8, M(0x5e5a57, 0.7), 11.5, 0.006, -6, scene, false);
desk(11.3, -6.4, 0, 2.2, 0.9, 0x2b2622).children[0].material = M(0x3a2c22, 0.35, 0.1);
monitor(10.8, 0.76, -6.75, 0, scene, scrMats[1], 0.8); monitor(11.8, 0.76, -6.75, 0, scene, scrMats[0], 0.8);
chair(11.3, -7.25, 0, 0x2a1a16); seatAt('stone', 11.3, -7.2, 0, 'seat', [[7.4, -4], [9, -4], [11.3, -4.8]]);
box(1.8, 0.9, 0.45, M(0x3a3a3e, 0.6), 13.8, 0.45, -8.4); // credenza
// 小R 秘書台
{ const g = new THREE.Group(); g.position.set(6.2, 0, -1.7); scene.add(g); const m = M(MOR.rose, 0.6); box(1.6, 1.05, 0.12, m, 0, 0.53, 0.38, g); box(1.6, 0.04, 0.65, M(MOR.white, 0.4), 0, 0.76, 0.05, g); box(1.7, 0.04, 0.2, M(0xd8c9b0, 0.3, 0.3), 0, 1.07, 0.38, g); blob(6.2, -1.7, 2.2, 1.4); }
monitor(6.2, 0.78, -1.75, 0); chair(6.2, -2.35, 0); seatAt('xiaoR', 6.2, -2.3, 0, 'seat', [[5.0, -0.3], [5.0, -2.4]]);
// meeting table
{ const g = new THREE.Group(); g.position.set(-3, 0, -5.6); scene.add(g); const top = add(new THREE.CylinderGeometry(1, 1, 0.06, 48), M(0xc9c2b8, 0.3), 0, 0.75, 0, g); top.scale.set(2.1, 1, 0.8); cyl(0.08, 0.2, 0.72, M(0x333, 0.3, 0.9), -1.2, 0.36, 0, g); cyl(0.08, 0.2, 0.72, M(0x333, 0.3, 0.9), 1.2, 0.36, 0, g); blob(-3, -5.6, 5.2, 2.6); }
const meetSeats = [];
[[-4.2, -4.55, Math.PI], [-3, -4.55, Math.PI], [-1.8, -4.55, Math.PI], [-4.2, -6.65, 0], [-3, -6.65, 0], [-1.8, -6.65, 0], [-5.55, -5.6, Math.PI / 2], [-0.45, -5.6, -Math.PI / 2]].forEach(([x, z, r], i) => {
  chair(x, z, r, MOR.blue); const via = z < -6 ? [[-6.2, -3.6], [-6.2, -6.9], [x, -7.1]] : []; seatAt('meet' + i, x, z, r, 'seat', via); meetSeats.push('meet' + i);
});
// team wall board
const boardTex = canvasTex(1024, 512, () => { });
const board = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1), new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false, color: new THREE.Color(1.15, 1.15, 1.15) }));
board.position.set(-3, 1.85, -8.7); scene.add(board); box(4.4, 2.3, 0.08, M(0x1d1e24, 0.4, 0.6), -3, 1.85, -8.78); box(0.1, 0.8, 0.1, frameMat, -3, 0.4, -8.75);
// pantry
{
  const wood = M(MOR.wood, 0.55); const g = new THREE.Group(); scene.add(g);
  box(5, 0.92, 0.7, M(MOR.warm, 0.6), -12, 0.46, -8.4, g); box(5.1, 0.05, 0.75, M(0xe9e5df, 0.25, 0.05), -12, 0.94, -8.4, g);
  box(5, 0.8, 0.4, wood, -12, 2.3, -8.65, g); // upper cabinet
  // coffee machine
  box(0.55, 0.6, 0.45, M(0x2a2a2e, 0.25, 0.8), -13.6, 1.27, -8.4, g); box(0.4, 0.06, 0.2, M(0x888, 0.2, 1), -13.6, 1.08, -8.25, g);
  add(new THREE.CylinderGeometry(0.05, 0.04, 0.1, 12), M(0xffffff, 0.3), -13.6, 1.03, -8.25, g);
  box(0.12, 0.05, 0.01, E(0x39ff7a, 2), -13.6, 1.45, -8.17, g, false);
  // snack cabinet with glass
  box(1.1, 1.9, 0.6, M(MOR.blue, 0.6), -9.2, 0.95, -8.4, g);
  const sc = ['#ff5f6d', '#ffc371', '#4ff3ff', '#b9f', '#7f7'];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) box(0.18, 0.25, 0.15, M(sc[(r + c) % 5], 0.5), -9.55 + c * 0.23, 0.3 + r * 0.42, -8.2, g);
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.8), glassMat); gl.position.set(-9.2, 0.95, -8.09); g.add(gl);
  // high table + stools
  box(2.2, 0.05, 0.6, M(0xb9b3ab, 0.5), -12, 1.05, -6.2, g); cyl(0.05, 0.05, 1.05, M(0x333, 0.3, 0.9), -12, 0.52, -6.2, g);
  for (const x of [-12.8, -11.2]) { cyl(0.18, 0.18, 0.05, M(MOR.rose, 0.6), x, 0.75, -5.6, g); cyl(0.025, 0.12, 0.74, M(0x333, 0.3, 0.9), x, 0.37, -5.6, g); }
  blob(-12, -8.3, 5.6, 1.4); blob(-12, -6, 2.8, 1.6);
}
seatAt('pantry0', -13.6, -7.6, Math.PI, 'stand'); seatAt('pantry1', -12.6, -6.8, 0, 'stand'); seatAt('pantry2', -11.2, -5.5, Math.PI, 'stand'); seatAt('pantry3', -10, -7.4, Math.PI * 0.8, 'stand');
// steam particles
const STEAM = 40; const steamGeo = new THREE.BufferGeometry(); const sp = new Float32Array(STEAM * 3); const sl = [];
for (let i = 0; i < STEAM; i++) { sl.push(Math.random()); }
steamGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
const steamTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
const steam = new THREE.Points(steamGeo, new THREE.PointsMaterial({ map: steamTex, size: 0.14, transparent: true, opacity: 0.45, depthWrite: false })); scene.add(steam);
function updateSteam(dt, t) { for (let i = 0; i < STEAM; i++) { sl[i] += dt * 0.35; if (sl[i] > 1) sl[i] = 0; const l = sl[i]; sp[i * 3] = -13.6 + Math.sin(t * 2 + i) * 0.04 * l * 3; sp[i * 3 + 1] = 1.1 + l * 0.9; sp[i * 3 + 2] = -8.25 + Math.cos(t * 1.7 + i) * 0.03 * l * 3; } steamGeo.attributes.position.needsUpdate = true; }

// lounge — Bauhaus
{
  const cx = -10.5, cz = 4.8;
  // rug: red/yellow/blue blocks
  const rug = canvasTex(512, 384, (g, w, h) => { g.fillStyle = '#e8e2d6'; g.fillRect(0, 0, w, h); g.fillStyle = '#c8312b'; g.fillRect(30, 30, 200, 190); g.fillStyle = '#e9b52a'; g.fillRect(250, 30, 230, 110); g.fillStyle = '#1f4e9a'; g.fillRect(250, 160, 120, 194); g.fillStyle = '#111'; g.fillRect(30, 240, 200, 18); g.fillRect(390, 160, 18, 194); g.fillRect(230, 30, 20, 324); });
  add(new THREE.PlaneGeometry(5.6, 4.2).rotateX(-Math.PI / 2), M(0xffffff, 0.95, 0, { map: rug }), cx, 0.01, cz).castShadow = false;
  const chrome = M(0xdddddd, 0.15, 1), leather = M(0x161414, 0.55), tan = M(0x9b6a43, 0.5);
  // Wassily chair (tubular steel + leather straps)
  function wassily(x, z, ry) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    for (const s of [-1, 1]) { tube([[s * 0.36, 0, 0.35], [s * 0.36, 0, -0.35], [s * 0.36, 0.62, -0.3], [s * 0.36, 0.62, 0.3], [s * 0.36, 0.3, 0.35]], 0.018, chrome, g); }
    tube([[-0.36, 0, 0.35], [0.36, 0, 0.35]], 0.018, chrome, g); tube([[-0.36, 0.85, -0.38], [0.36, 0.85, -0.38]], 0.018, chrome, g);
    box(0.7, 0.02, 0.55, leather, 0, 0.42, 0.03, g).rotation.x = -0.1; box(0.7, 0.42, 0.02, leather, 0, 0.66, -0.34, g).rotation.x = -0.18;
    for (const s of [-1, 1]) box(0.02, 0.12, 0.6, leather, s * 0.36, 0.56, 0, g);
    blob(x, z, 1.1, 1.1); return g;
  }
  // Barcelona chair (X frame + tufted cushions)
  function barcelona(x, z, ry) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    for (const s of [-1, 1]) { tube([[s * 0.36, 0, 0.38], [s * 0.36, 0.3, 0.05], [s * 0.36, 0.78, -0.4]], 0.016, chrome, g); tube([[s * 0.36, 0, -0.36], [s * 0.36, 0.25, 0], [s * 0.36, 0.36, 0.38]], 0.016, chrome, g); }
    const seat = add(new THREE.BoxGeometry(0.72, 0.12, 0.62, 6, 1, 6), tan, 0, 0.4, 0.02, g); seat.rotation.x = 0.05;
    const back = add(new THREE.BoxGeometry(0.72, 0.62, 0.12, 6, 6, 1), tan, 0, 0.72, -0.3, g); back.rotation.x = -0.32;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { add(new THREE.SphereGeometry(0.012, 6, 4), M(0x5a3a24, 0.6), -0.27 + i * 0.18, 0.465, -0.22 + j * 0.15, g, false); }
    blob(x, z, 1.1, 1.1); return g;
  }
  wassily(cx - 1.6, cz + 0.4, Math.PI / 2 + 0.3); barcelona(cx + 1.5, cz + 0.6, -Math.PI / 2 - 0.25); barcelona(cx, cz - 1.3, 0.05);
  seatAt('lounge0', cx - 1.55, cz + 0.42, Math.PI / 2 + 0.3, 'lounge'); seatAt('lounge1', cx + 1.45, cz + 0.62, -Math.PI / 2 - 0.25, 'lounge'); seatAt('lounge2', cx, cz - 1.25, 0.05, 'lounge');
  // Noguchi table: glass triangle-ish top on two interlocking wood pieces
  const ng = new THREE.Group(); ng.position.set(cx, 0, cz + 0.3); scene.add(ng);
  const shape = new THREE.Shape(); shape.moveTo(-0.7, -0.5); shape.quadraticCurveTo(0.2, -0.7, 0.75, -0.1); shape.quadraticCurveTo(0.6, 0.55, -0.1, 0.5); shape.quadraticCurveTo(-0.85, 0.3, -0.7, -0.5);
  const topG = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 }); topG.rotateX(-Math.PI / 2);
  const gm = new THREE.MeshPhysicalMaterial({ color: 0xb8d8d0, roughness: 0.05, transparent: true, opacity: 0.35, metalness: 0.1 });
  add(topG, gm, 0, 0.38, 0, ng);
  const w1 = new THREE.Shape(); w1.moveTo(-0.45, 0); w1.quadraticCurveTo(-0.5, 0.3, -0.2, 0.36); w1.lineTo(0.4, 0.36); w1.quadraticCurveTo(0.1, 0.2, 0.2, 0); w1.lineTo(-0.45, 0);
  const wg = new THREE.ExtrudeGeometry(w1, { depth: 0.08, bevelEnabled: false }); const wm = M(0x2b1d14, 0.5);
  add(wg, wm, 0, 0, -0.04, ng).rotation.y = 0.5; add(wg, wm, 0, 0, 0.04, ng).rotation.y = -1.9;
  // Arco lamp
  const ag = new THREE.Group(); ag.position.set(cx - 2.6, 0, cz - 1.6); scene.add(ag);
  box(0.4, 0.5, 0.26, M(0xf0eee9, 0.25), 0, 0.25, 0, ag);
  tube([[0, 0.5, 0], [0.1, 1.6, 0.1], [0.6, 2.25, 0.6], [1.3, 2.25, 1.3], [1.7, 1.75, 1.7]], 0.022, chrome, ag);
  const shade = add(new THREE.SphereGeometry(0.22, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(0xdddddd, 0.15, 1, { side: THREE.DoubleSide }), 1.72, 1.72, 1.72, ag); shade.rotation.x = 0;
  add(new THREE.SphereGeometry(0.06, 10, 8), E(0xfff0c8, 1.4), 1.72, 1.66, 1.72, ag, false);
  const al = new THREE.PointLight(0xffd7a0, 6, 6, 2); al.position.set(1.72, 1.55, 1.72); ag.add(al);
}
// display / lounge zone: mech figure, rat, bike
function plinth(x, z, h = 0.9, w = 0.8) { box(w, h, w, M(MOR.white, 0.5), x, h / 2, z); box(w + 0.02, 0.02, w + 0.02, E(0x22f3ff, 0.9), x, h, z, scene, false); blob(x, z, w + 0.6, w + 0.6); return h; }
const mech = new THREE.Group(); scene.add(mech);
{
  const h = plinth(10.2, 7.6, 0.6, 1.0); mech.position.set(10.2, h, 7.6); mech.rotation.y = -2.5;
  const red = M(0xb0161c, 0.35, 0.55), gold = M(0xe0b050, 0.3, 0.75), glow = E(0x9ff6ff, 1.3);
  const part = (g, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = add(g, m, x, y, z, mech); o.scale.set(sx, sy, sz); return o; };
  part(new THREE.CapsuleGeometry(0.2, 0.3, 6, 14), red, 0, 1.25, 0, 1.2, 1, 0.75); // chest
  part(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 20), glow, 0, 1.33, 0.155).rotation.x = Math.PI / 2; // arc reactor
  part(new THREE.CapsuleGeometry(0.15, 0.12, 4, 12), gold, 0, 0.92, 0, 1.1, 1, 0.8); // abs
  part(new THREE.SphereGeometry(0.13, 20, 16), red, 0, 1.68, 0, 0.9, 1.1, 0.95); part(new THREE.BoxGeometry(0.17, 0.17, 0.05), gold, 0, 1.66, 0.11); // faceplate
  for (const s of [-1, 1]) {
    part(new THREE.BoxGeometry(0.05, 0.015, 0.01), glow, s * 0.04, 1.69, 0.14); part(new THREE.SphereGeometry(0.1, 14, 10), red, s * 0.29, 1.43, 0);
    part(new THREE.CapsuleGeometry(0.065, 0.25, 4, 10), gold, s * 0.33, 1.15, 0).rotation.z = s * 0.12; part(new THREE.CapsuleGeometry(0.07, 0.22, 4, 10), red, s * 0.36, 0.83, 0.03).rotation.z = s * 0.05;
    part(new THREE.CapsuleGeometry(0.09, 0.32, 4, 10), red, s * 0.11, 0.55, 0); part(new THREE.CapsuleGeometry(0.075, 0.3, 4, 10), gold, s * 0.11, 0.2, 0.01); part(new THREE.BoxGeometry(0.13, 0.06, 0.22), red, s * 0.11, 0.02, 0.04);
    part(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 12), glow, s * 0.37, 0.67, 0.03);
  }
}
const rat = new THREE.Group(); scene.add(rat);
{
  const h = plinth(12.4, 7.6, 0.8, 0.8); rat.position.set(12.4, h, 7.6); rat.rotation.y = -2.2;
  const g = M(0x4fae3a, 0.45, 0.1), red = M(0xd61f1f, 0.3), white = M(0xf4f4f4, 0.4), dk = M(0x1a1a1a, 0.4);
  const part = (geo, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = add(geo, m, x, y, z, rat); o.scale.set(sx, sy, sz); return o; };
  part(new THREE.SphereGeometry(0.2, 20, 16), g, 0, 0.32, 0, 1, 1.25, 0.9); // body
  part(new THREE.SphereGeometry(0.22, 24, 18), g, 0, 0.75, 0.05, 1.05, 0.9, 1); // big head
  part(new THREE.SphereGeometry(0.09, 16, 12), g, 0, 0.66, 0.25, 1.1, 0.8, 1.1); // snout
  for (const s of [-1, 1]) {
    part(new THREE.SphereGeometry(0.075, 16, 12), white, s * 0.08, 0.84, 0.2); part(new THREE.SphereGeometry(0.04, 12, 10), red, s * 0.085, 0.84, 0.265); part(new THREE.SphereGeometry(0.018, 8, 6), dk, s * 0.085, 0.84, 0.3);
    part(new THREE.SphereGeometry(0.12, 16, 12), g, s * 0.2, 0.98, -0.02, 1, 1, 0.3).rotation.z = s * 0.4;
    part(new THREE.CapsuleGeometry(0.035, 0.22, 4, 8), g, s * 0.2, 0.33, 0.05).rotation.z = s * 0.6; part(new THREE.CapsuleGeometry(0.05, 0.12, 4, 8), g, s * 0.1, 0.08, 0.06);
  }
  part(new THREE.BoxGeometry(0.14, 0.03, 0.02), white, 0, 0.6, 0.31); // teeth grin
  part(new THREE.SphereGeometry(0.03, 8, 6), dk, 0, 0.69, 0.34);
  tube([[0, 0.2, -0.15], [0, 0.05, -0.35], [0.15, 0.1, -0.5], [0.3, 0.35, -0.45]], 0.015, g, rat);
  part(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 20), M(0xe6c44a, 0.3, 0.8), 0, 1.0, 0.0); // 'RF' halo plaque
}
// wall-mounted single-speed bike on feature wall
{
  const bk = new THREE.Group(); bk.position.set(14.42, 1.7, 4.6); bk.rotation.y = -Math.PI / 2; scene.add(bk);
  const frame = M(0x2fb5a8, 0.35, 0.6), blk = M(0x111, 0.6), cr = M(0xcccccc, 0.2, 1);
  for (const x of [-0.5, 0.5]) { add(new THREE.TorusGeometry(0.34, 0.025, 10, 40), blk, x, 0, 0, bk); add(new THREE.TorusGeometry(0.3, 0.008, 6, 40), cr, x, 0, 0, bk); for (let i = 0; i < 8; i++) { const sp = add(new THREE.CylinderGeometry(0.003, 0.003, 0.6, 3), cr, x, 0, 0, bk, false); sp.rotation.z = i / 8 * Math.PI; } }
  const P = { rear: [-0.5, 0, 0], bb: [-0.05, -0.02, 0], seat: [-0.17, 0.42, 0], head: [0.36, 0.4, 0], front: [0.5, 0, 0] };
  [[P.rear, P.bb], [P.bb, P.seat], [P.seat, P.rear], [P.seat, P.head], [P.head, P.bb], [P.head, P.front]].forEach(([a, b]) => tube([a, b], 0.017, frame, bk));
  tube([[-0.2, 0.42, 0], [-0.2, 0.52, 0]], 0.012, cr, bk); box(0.2, 0.04, 0.07, blk, -0.2, 0.54, 0, bk);
  tube([[0.38, 0.46, 0], [0.42, 0.52, -0.2], [0.5, 0.48, -0.25]], 0.012, cr, bk); tube([[0.38, 0.46, 0], [0.42, 0.52, 0.2], [0.5, 0.48, 0.25]], 0.012, cr, bk);
  add(new THREE.TorusGeometry(0.08, 0.01, 6, 20), cr, -0.05, -0.02, 0.03, bk);
  box(0.06, 0.06, 0.12, M(0x333, 0.4, 0.8), 0, -0.45, 0.12, bk);
}
seatAt('display0', 11.2, 6.2, Math.PI * 0.95, 'stand'); seatAt('display1', 13.2, 5.0, -Math.PI / 2, 'stand'); seatAt('display2', 9.6, 5.4, 0.6, 'stand');
// sofa in display zone
{ const g = new THREE.Group(); g.position.set(11, 0, 2.4); scene.add(g); const m = M(MOR.sage, 0.85); box(2.4, 0.4, 0.85, m, 0, 0.2, 0, g); box(2.4, 0.5, 0.2, m, 0, 0.55, -0.35, g); for (const s of [-1, 1]) box(0.2, 0.55, 0.85, m, s * 1.2, 0.3, 0, g); blob(11, 2.4, 3, 1.4); }
seatAt('sofa0', 10.4, 2.55, 0, 'lounge'); seatAt('sofa1', 11.6, 2.55, 0, 'lounge');
// warm interior fill lights
[[-3, 2.8, 2], [6, 2.8, -1], [11, 2.8, -6], [-11, 3.1, -4.2], [11, 2.8, 5]].forEach(([x, y, z]) => { const l = new THREE.PointLight(0xffe2c0, 2.6, 11, 2); l.position.set(x, y, z); scene.add(l); });
const neonEdge = (x1, z1, x2, z2, c) => { const L = Math.hypot(x2 - x1, z2 - z1); const m = box(L, 0.03, 0.03, E(c, 1.1), (x1 + x2) / 2, 0.02, (z1 + z2) / 2, scene, false); m.rotation.y = -Math.atan2(z2 - z1, x2 - x1); };
neonEdge(-15, 9.02, 15, 9.02, 0x22f3ff); neonEdge(15.02, -9, 15.02, 9, 0xff2fb0); neonEdge(-15.02, -9, -15.02, 9, 0xff2fb0); neonEdge(-15, -9.02, 15, -9.02, 0x22f3ff);

// ---------- characters ----------
const AG = [
  { key: 'Stone', name: 'Stone', role: '老闆 · 強尼銀手風', tag: '#ffd23a', desk: 'stone', look: { skin: 0xd9a483, hair: 0x1a1410, hs: 'slick', top: 0x1b1b1d, jacket: 0x262628, pants: 0x2a2a30, shoes: 0x1a1a1a, aviators: true, silverArm: true, beard: true } },
  { key: '小R', name: '小R', role: '秘書 · 茱蒂風', tag: '#ff5fa2', desk: 'xiaoR', look: { skin: 0xeec4a5, hair: 0x5a3a28, tip: 0x2fd6c6, hs: 'undercut', top: 0x3a6f8e, jacket: null, pants: 0x4b4a55, shoes: 0x222, female: true } },
  { key: '百靈鳥', name: '百靈鳥', role: '研究 · 奧特風', tag: '#4ff3ff', desk: 'desk0', look: { skin: 0xf0d6c4, hair: 0xf4f4f8, hs: 'long', top: 0x111116, jacket: null, pants: 0x111116, shoes: 0x111, glowLines: 0x4ff3ff, female: true } },
  { key: '寫哥', name: '寫哥', role: '寫作 · V 風（武士夾克）', tag: '#ffe14d', desk: 'desk1', look: { skin: 0xdcae8c, hair: 0x241a14, hs: 'short', top: 0x222, jacket: 0x141414, collar: 0xe8c43a, samurai: true, pants: 0x232330, shoes: 0x222 } },
  { key: '大投', name: '大投', role: '投資 · 竹村風', tag: '#ff5555', desk: 'desk2', look: { skin: 0xc99a76, hair: 0x141414, hs: 'buzz', top: 0xdcdcdc, jacket: 0x1c2230, pants: 0x1c2230, shoes: 0x111, cyberEyes: true, tall: 1.05 } },
  { key: '財財', name: '財財', role: '財務 · 帕南風', tag: '#ffa94d', desk: 'desk3', look: { skin: 0xd8a888, hair: 0x231610, hs: 'ponytail', top: 0x6b5a48, jacket: 0x6a3f26, pants: 0x3d3a40, shoes: 0x4a2e1c, female: true } },
  { key: '大E', name: '大E', role: '工程 · 傑克風', tag: '#39ff7a', desk: 'desk4', look: { skin: 0xb98563, hair: 0x1a120c, hs: 'bald', top: 0x3a3a3a, jacket: 0x8a6a2a, pants: 0x2a2f3a, shoes: 0x222, beard: true, chain: true, big: 1.15 } },
  { key: 'Fellow', name: 'Fellow', role: '功率半導體專家 · 維克多風', tag: '#a98bff', desk: 'desk5', look: { skin: 0xd2a68a, hair: 0x9a9a9a, hs: 'short', top: 0x2a3a4a, jacket: 0xd8d4c8, pants: 0x3a3a3a, shoes: 0x222, glasses: true, beard: true, grey: true } },
  { key: 'URAKAKERA', name: 'URAKAKERA', role: '協作 · 待補', tag: '#7ec8ff', desk: 'desk6', look: { skin: 0xe0b898, hair: 0x2a1810, hs: 'short', top: 0x1a2a3a, jacket: 0x243040, pants: 0x1e2430, shoes: 0x111 } },
  { key: 'dr eggbot', name: 'dr eggbot', role: '編排 · 待補', tag: '#ff7eb6', desk: 'desk7', look: { skin: 0xf0d0b0, hair: 0xf5e6c8, hs: 'buzz', top: 0x2a1a2a, jacket: 0x4a2040, pants: 0x2a2030, shoes: 0x222 } },
];
const SIM_BUBBLES = { working: ['專注中…', '寫程式', '整理報告', '跑模型', '回覆訊息', 'GaN 元件分析', '審閱合約', '對帳中'], idle: ['☕ 喝咖啡', '休息一下', '看夜景', '想點子', '伸展'], meeting: ['開會中', '簡報', '討論大任務'] };
// ---- Minecraft-style voxel characters: 64x64 pixel skins painted on canvas, nearest filtering ----
const PX = 0.056, HIPY = 12 * PX;
const PARTS = { head: [0, 0, 8, 8, 8], hat: [32, 0, 8, 8, 8], body: [16, 16, 8, 12, 4], rarm: [40, 16, 4, 12, 4], larm: [32, 48, 4, 12, 4], rleg: [0, 16, 4, 12, 4], lleg: [16, 48, 4, 12, 4] };
function regs(ox, oy, w, h, d) { return { top: [ox + d, oy, w, d], bottom: [ox + d + w, oy, w, d], right: [ox, oy + d, d, h], front: [ox + d, oy + d, w, h], left: [ox + d + w, oy + d, d, h], back: [ox + 2 * d + w, oy + d, w, h] }; }
function uvBox(part, gh, hs, scale = 1) {
  const [ox, oy, W, H, D] = PARTS[part]; const g = new THREE.BoxGeometry(W * PX * scale, gh * PX * scale, D * PX * scale);
  const r = regs(ox, oy, W, H, D); ['right', 'front', 'left', 'back'].forEach(k => { r[k] = [r[k][0], r[k][1] + hs, r[k][2], gh]; });
  const order = ['left', 'right', 'top', 'bottom', 'front', 'back']; const uv = g.attributes.uv; const e = 0.02;
  for (let f = 0; f < 6; f++) { const [x, y, w, h] = r[order[f]]; for (let k = 0; k < 4; k++) { const i = f * 4 + k; const U = uv.getX(i), V = uv.getY(i); uv.setXY(i, (x + e + U * (w - 2 * e)) / 64, 1 - (y + e + (1 - V) * (h - 2 * e)) / 64); } }
  return g;
}
const LOOKS = {
  Stone: { skin: '#d9a483', hair: '#17120e', top: '#1b1b1d', sleeve: null, pants: '#2a2a30', shoes: '#141414' },
  '小R': { skin: '#f0c7a8', hair: '#5a3a28', top: '#3a6f8e', sleeve: null, pants: '#4b4a5a', shoes: '#222' },
  '百靈鳥': { skin: '#f3dccd', hair: '#f4f4f8', top: '#111116', sleeve: '#111116', pants: '#111116', shoes: '#0c0c0c' },
  '寫哥': { skin: '#dcae8c', hair: '#241a14', top: '#141414', sleeve: '#141414', pants: '#232330', shoes: '#222' },
  '大投': { skin: '#c99a76', hair: '#111', top: '#1c2230', sleeve: '#1c2230', pants: '#1c2230', shoes: '#0d0d0d', scale: 1.05 },
  '財財': { skin: '#d8a888', hair: '#231610', top: '#8a6a48', sleeve: '#6a3f26', pants: '#3d3a40', shoes: '#4a2e1c' },
  '大E': { skin: '#b98563', hair: '#1a120c', top: '#3a3a3a', sleeve: '#d9822b', pants: '#2a2f3a', shoes: '#222', big: true },
  'Fellow': { skin: '#d2a68a', hair: '#a4a4a4', top: '#2a3a4a', sleeve: '#d8d4c8', pants: '#3a3a3a', shoes: '#222' },
};
function paintSkin(key) {
  const L = LOOKS[key];
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = 64; return c; };
  const c = mk(), g = c.getContext('2d'), gc = mk(), gg = gc.getContext('2d'); gg.fillStyle = '#000'; gg.fillRect(0, 0, 64, 64);
  let glow = false;
  const R = (x, y, w, h, col, ctx = g) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  const F = (part, face) => regs(...PARTS[part])[face];
  const P = (part, face, x, y, w, h, col) => { const r = F(part, face); R(r[0] + x, r[1] + y, w, h, col); };
  const G = (part, face, x, y, w, h, col) => { P(part, face, x, y, w, h, col); const r = F(part, face); R(r[0] + x, r[1] + y, w, h, col, gg); glow = true; };
  const fill = (part, col) => { const r = regs(...PARTS[part]); for (const k in r) R(...r[k], col); };
  const sides = (part, y, h, col) => ['front', 'back', 'left', 'right'].forEach(f => { const r = F(part, f); R(r[0], r[1] + y, r[2], h, col); });
  // base
  fill('head', L.skin); fill('body', L.top);
  for (const a of ['rarm', 'larm']) { fill(a, L.skin); if (L.sleeve) { sides(a, 0, 11, L.sleeve); P(a, 'top', 0, 0, 4, 4, L.sleeve); } else { sides(a, 0, 2, L.top); P(a, 'top', 0, 0, 4, 4, L.top); } }
  for (const l of ['rleg', 'lleg']) { fill(l, L.pants); sides(l, 10, 2, L.shoes); P(l, 'bottom', 0, 0, 4, 4, L.shoes); }
  if (L.sleeve && L.sleeve !== L.top) { sides('body', 0, 12, L.sleeve); P('body', 'front', 3, 0, 2, 12, L.top); P('body', 'top', 0, 0, 8, 4, L.sleeve); }
  // hair + face
  const hc = L.hair; P('head', 'top', 0, 0, 8, 8, hc); P('head', 'back', 0, 0, 8, 7, hc); P('head', 'left', 0, 0, 8, 3, hc); P('head', 'right', 0, 0, 8, 3, hc); P('head', 'front', 0, 0, 8, 2, hc);
  P('head', 'left', 5, 3, 3, 2, hc); P('head', 'right', 0, 3, 3, 2, hc);
  const face = (eye = '#2b1d14') => { P('head', 'front', 1, 4, 2, 1, '#f4f4f4'); P('head', 'front', 5, 4, 2, 1, '#f4f4f4'); P('head', 'front', 2, 4, 1, 1, eye); P('head', 'front', 5, 4, 1, 1, eye); P('head', 'front', 1, 3, 2, 1, '#00000040'); P('head', 'front', 5, 3, 2, 1, '#00000040'); P('head', 'front', 3, 5, 2, 1, '#00000022'); P('head', 'front', 3, 6, 2, 1, '#8a4a40'); };
  const hat = (fn) => fn();
  switch (key) {
    case 'Stone': face(); P('head', 'front', 0, 3, 8, 1, '#c9a24a'); P('head', 'front', 1, 3, 2, 2, '#0d0d10'); P('head', 'front', 5, 3, 2, 2, '#0d0d10'); P('head', 'front', 1, 3, 1, 1, '#5a6a80'); P('head', 'front', 5, 3, 1, 1, '#5a6a80');
      P('head', 'front', 2, 6, 4, 2, '#2a1d15'); P('head', 'front', 3, 6, 2, 1, '#6b3b30'); P('head', 'front', 0, 1, 8, 1, hc);
      P('body', 'front', 1, 0, 6, 12, '#1b1b1d'); P('body', 'front', 3, 0, 2, 5, '#3a3a40'); P('body', 'front', 3, 3, 1, 1, '#c8c8c8'); P('body', 'front', 0, 9, 8, 1, '#4a3a2a');
      { const r = regs(...PARTS.larm); for (const k in r) R(...r[k], '#c3c8d0'); for (let y = 2; y < 12; y += 3) sides('larm', y, 1, '#7d838d'); sides('larm', 0, 2, '#a01a20'); }
      sides('rarm', 4, 1, '#3a5a5a'); P('rarm', 'front', 1, 6, 2, 2, '#3a5a5a'); break;
    case '小R': face('#3a2a20'); P('head', 'right', 0, 1, 8, 7, '#6b4a3a55'); P('head', 'left', 0, 0, 8, 6, hc); P('head', 'top', 1, 0, 2, 8, '#2fd6c6'); P('head', 'top', 5, 0, 2, 8, '#ff5fa2'); P('head', 'front', 4, 0, 4, 3, hc); P('head', 'front', 5, 2, 2, 1, '#ff5fa2'); P('head', 'front', 1, 1, 2, 1, '#2fd6c6');
      P('hat', 'left', 0, 2, 8, 5, hc); P('hat', 'left', 2, 5, 3, 2, '#ff5fa2'); P('hat', 'back', 4, 1, 4, 6, hc);
      P('body', 'front', 0, 0, 8, 12, '#3a6f8e'); P('body', 'front', 1, 0, 1, 4, '#cfcfd8'); P('body', 'front', 6, 0, 1, 4, '#cfcfd8'); P('body', 'front', 0, 4, 8, 8, '#5a6a8a'); P('body', 'front', 3, 6, 2, 2, '#8a96b0');
      sides('larm', 3, 1, '#2b6e6a'); P('larm', 'front', 1, 5, 2, 3, '#2b6e6a'); P('rarm', 'front', 1, 4, 2, 2, '#7a3a8a'); break;
    case '百靈鳥': face('#4ff3ff'); G('head', 'front', 2, 4, 1, 1, '#4ff3ff'); G('head', 'front', 5, 4, 1, 1, '#4ff3ff'); P('head', 'left', 0, 0, 8, 8, hc); P('head', 'right', 0, 0, 8, 8, hc); P('head', 'back', 0, 0, 8, 8, hc); P('head', 'front', 0, 2, 3, 1, hc); P('head', 'front', 0, 2, 1, 6, hc); P('head', 'front', 7, 2, 1, 6, hc);
      ['left', 'right', 'back'].forEach(f => P('hat', f, 0, 0, 8, 8, hc)); P('hat', 'top', 0, 0, 8, 8, hc);
      G('head', 'front', 0, 5, 1, 1, '#4ff3ff'); G('body', 'front', 2, 0, 1, 12, '#4ff3ff'); G('body', 'front', 5, 0, 1, 12, '#4ff3ff'); G('body', 'front', 2, 6, 4, 1, '#4ff3ff'); G('body', 'back', 3, 0, 2, 12, '#4ff3ff');
      for (const a of ['rarm', 'larm']) { G(a, 'front', 1, 0, 1, 11, '#4ff3ff'); G(a, 'left', 2, 0, 1, 11, '#4ff3ff'); }
      for (const l of ['rleg', 'lleg']) { G(l, 'front', 1, 0, 1, 10, '#4ff3ff'); G(l, 'right', 2, 0, 1, 10, '#4ff3ff'); } break;
    case '寫哥': face(); P('head', 'front', 0, 1, 8, 1, hc); P('head', 'front', 6, 2, 2, 1, hc);
      P('body', 'front', 0, 0, 8, 2, '#e8c43a'); P('body', 'top', 0, 0, 8, 4, '#e8c43a'); P('body', 'front', 3, 2, 2, 10, '#3a3a3a'); P('body', 'front', 0, 2, 1, 10, '#e8c43a');
      P('body', 'back', 0, 0, 8, 2, '#e8c43a'); P('body', 'back', 2, 3, 4, 5, '#d02b2b'); P('body', 'back', 3, 4, 2, 2, '#e8c43a'); P('body', 'back', 1, 9, 6, 1, '#d02b2b');
      sides('rarm', 9, 1, '#e8c43a'); sides('larm', 9, 1, '#e8c43a'); sides('rarm', 2, 1, '#d02b2b'); sides('larm', 2, 1, '#d02b2b'); break;
    case '大投': face('#ff2a2a'); G('head', 'front', 2, 4, 1, 1, '#ff2a2a'); G('head', 'front', 5, 4, 1, 1, '#ff2a2a'); P('head', 'left', 0, 2, 8, 6, L.skin); P('head', 'right', 0, 2, 8, 6, L.skin); P('head', 'back', 0, 3, 8, 5, L.skin); P('head', 'front', 0, 1, 8, 1, L.skin); P('head', 'left', 3, 4, 2, 1, '#6a6a70'); P('head', 'right', 3, 4, 2, 1, '#6a6a70');
      P('body', 'front', 3, 0, 2, 12, '#e4e4e4'); P('body', 'front', 3, 1, 2, 8, '#202020'); P('body', 'front', 2, 0, 1, 7, '#2a3346'); P('body', 'front', 5, 0, 1, 7, '#2a3346'); sides('rarm', 11, 1, L.skin); sides('larm', 11, 1, L.skin); break;
    case '財財': face('#2a1a10'); P('head', 'front', 0, 2, 1, 5, hc); P('head', 'front', 7, 2, 1, 5, hc); P('head', 'left', 0, 0, 8, 6, hc); P('head', 'right', 0, 0, 8, 6, hc); P('head', 'back', 0, 0, 8, 8, hc);
      for (let y = 0; y < 8; y += 2) { P('hat', 'back', 3, y, 2, 1, hc); P('hat', 'back', 2, y + 1, 2, 1, '#3a2418'); P('hat', 'back', 4, y + 1, 2, 1, hc); }
      P('body', 'front', 0, 9, 8, 1, '#3a2418'); P('body', 'front', 3, 9, 2, 1, '#c9a14a'); P('body', 'front', 2, 2, 4, 1, '#a88a68'); break;
    case '大E': face(); P('head', 'top', 0, 0, 8, 8, '#2a1d15'); P('head', 'left', 0, 0, 8, 1, '#2a1d15'); P('head', 'right', 0, 0, 8, 1, '#2a1d15'); P('head', 'left', 0, 1, 8, 4, L.skin); P('head', 'right', 0, 1, 8, 4, L.skin); P('head', 'back', 0, 1, 8, 7, L.skin); P('head', 'front', 0, 0, 8, 2, L.skin); P('head', 'front', 0, 0, 8, 1, '#2a1d15');
      P('head', 'front', 1, 5, 6, 3, '#1a120c'); P('head', 'front', 3, 6, 2, 1, '#6b3b30'); P('head', 'left', 6, 5, 2, 3, '#1a120c'); P('head', 'right', 0, 5, 2, 3, '#1a120c');
      P('body', 'front', 2, 2, 4, 1, '#e0b040'); P('body', 'front', 3, 3, 2, 1, '#e0b040'); P('body', 'back', 1, 3, 6, 4, '#b96a20'); sides('rarm', 3, 1, '#b96a20'); sides('larm', 3, 1, '#b96a20'); break;
    case 'Fellow': face('#3a3020'); P('head', 'front', 1, 4, 2, 1, '#e8e8e8'); P('head', 'front', 0, 3, 8, 1, '#333'); P('head', 'front', 0, 5, 3, 0.01, '#333'); P('head', 'front', 1, 6, 6, 2, '#9a9a9a'); P('head', 'front', 3, 6, 2, 1, '#6b3b30'); P('head', 'front', 0, 1, 8, 1, L.skin);
      P('body', 'front', 3, 0, 2, 12, L.top); G('body', 'front', 5, 3, 1, 1, '#39ff7a'); P('body', 'front', 1, 7, 2, 2, '#bab6aa');
      for (const l of ['rleg', 'lleg']) sides(l, 0, 3, L.sleeve); break;
  }
  // subtle per-pixel noise for crafted look
  const id = g.getImageData(0, 0, 64, 64); const d = id.data; for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const n = (Math.random() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(id, 0, 0);
  const T = (cv) => { const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; return t; };
  return { map: T(c), glow: glow ? T(gc) : null };
}
function buildChar(a) {
  const L = LOOKS[a.key]; const tx = paintSkin(a.key);
  const mat = new THREE.MeshStandardMaterial({ map: tx.map, roughness: 0.8, alphaTest: 0.5, emissiveMap: tx.glow, emissive: tx.glow ? 0xffffff : 0x000000, emissiveIntensity: tx.glow ? 2.2 : 0 });
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const S = L.scale || 1; body.scale.set(S * (L.big ? 1.14 : 1), S * (L.big ? 1.03 : 1), S * (L.big ? 1.18 : 1));
  const mesh = (geo, p, y, x = 0, z = 0) => add(geo, mat, x, y, z, p);
  const hips = new THREE.Group(); hips.position.y = HIPY; body.add(hips);
  const leg = {};
  for (const s of [-1, 1]) {
    const part = s < 0 ? 'rleg' : 'lleg';
    const th = new THREE.Group(); th.position.set(s * 2 * PX, 0, 0); hips.add(th); mesh(uvBox(part, 6, 0), th, -3 * PX);
    const kn = new THREE.Group(); kn.position.y = -6 * PX; th.add(kn); mesh(uvBox(part, 6, 6), kn, -3 * PX);
    leg[s] = { th, kn };
  }
  const spine = new THREE.Group(); hips.add(spine); const chest = spine;
  mesh(uvBox('body', 12, 0), chest, 6 * PX);
  const head = new THREE.Group(); head.position.y = 12 * PX; chest.add(head);
  mesh(uvBox('head', 8, 0), head, 4 * PX); mesh(uvBox('hat', 8, 0, 1.125), head, 4 * PX);
  if (a.key === '百靈鳥') box(8 * PX, 9 * PX, 0.8 * PX, M(0xf4f4f8, 0.6), 0, 1 * PX, -2.6 * PX, chest);
  if (a.key === '財財') for (const s of [-1, 1]) box(1.4 * PX, 8 * PX, 1.4 * PX, M(0x231610, 0.7), s * 1.6 * PX, -1 * PX, -4.7 * PX, head);
  const arm = {};
  for (const s of [-1, 1]) {
    const part = s < 0 ? 'rarm' : 'larm';
    const sh = new THREE.Group(); sh.position.set(s * 6 * PX, 10 * PX, 0); chest.add(sh); mesh(uvBox(part, 6, 0), sh, -1 * PX);
    const el = new THREE.Group(); el.position.y = -4 * PX; sh.add(el); mesh(uvBox(part, 6, 6), el, -3 * PX);
    arm[s] = { sh, el };
  }
  const contact = blob(0, 0, 0.8, 0.8, root); contact.position.y = 0.014;
  root.traverse(o => { if (o.isMesh) o.userData.root = root; });
  return { root, hips, spine, chest, head, arm, leg };
}
const agents = AG.map((a, i) => {
  const rig = buildChar(a);
  const sp = SPOT[a.desk]; rig.root.position.set(sp.x, 0, sp.z); scene.add(rig.root);
  const el = document.createElement('div'); el.style.position = 'relative';
  el.innerHTML = `<div class="bub"></div><div class="tag" style="color:${a.tag}">${a.name}</div>`;
  const label = new CSS2DObject(el); label.position.set(0, 2.05 * (a.look.tall || 1), 0); rig.root.add(label);
  el.querySelector('.tag').addEventListener('click', () => select(i));
  return { ...a, rig, el, bub: el.querySelector('.bub'), state: 'working', status: '', bubble: '', spot: a.desk, path: [], mode: 'sit', phase: rnd() * 10, spd: 1.25 + rnd() * 0.3, simUntil: 0 };
});
const occupied = new Set(agents.map(a => a.spot));
const corridorZ = -0.3;
function planPath(ag, target) {
  const from = SPOT[ag.spot], to = SPOT[target]; const pts = [];
  (from.via || []).slice().reverse().forEach(p => pts.push(p));
  const a = pts.length ? pts[pts.length - 1] : [ag.rig.root.position.x, ag.rig.root.position.z];
  const b = to.via && to.via.length ? to.via[0] : [to.x, to.z];
  pts.push([a[0], corridorZ], [b[0], corridorZ]);
  (to.via || []).forEach(p => pts.push(p)); pts.push([to.x, to.z]);
  occupied.delete(ag.spot); occupied.add(target); ag.spot = target; ag.path = pts; ag.mode = 'walk';
}
function freeSpot(list) { const f = list.filter(s => !occupied.has(s)); return f.length ? f[Math.floor(Math.random() * f.length)] : null; }
const IDLE = ['pantry0', 'pantry1', 'pantry2', 'pantry3', 'lounge0', 'lounge1', 'lounge2', 'display0', 'display1', 'display2', 'sofa0', 'sofa1'];
function applyState(ag, st) {
  if (!['working', 'idle', 'meeting'].includes(st)) st = 'working';
  const prev = ag.state; ag.state = st;
  let target = ag.spot;
  if (st === 'working' || st === 'waiting') target = ag.desk;
  else if (st === 'meeting') { target = (ag.key === 'Stone' && !occupied.has('meet6')) ? 'meet6' : (meetSeats.includes(ag.spot) ? ag.spot : freeSpot(meetSeats) || ag.desk); }
  else if (st === 'idle') target = IDLE.includes(ag.spot) ? ag.spot : (freeSpot(IDLE) || ag.desk);
  if (target !== ag.spot) planPath(ag, target);
}
// animation
const lerpA = (o, k, v, t) => { o[k] += (v - o[k]) * t; };
function animate(ag, dt, t) {
  const r = ag.rig, root = r.root; const T = t + ag.phase; const k = Math.min(1, dt * 8);
  if (ag.mode === 'walk') {
    const [tx, tz] = ag.path[0]; const dx = tx - root.position.x, dz = tz - root.position.z; const d = Math.hypot(dx, dz);
    if (d < 0.05) { ag.path.shift(); if (!ag.path.length) { const sp = SPOT[ag.spot]; ag.mode = sp.type === 'stand' ? 'stand' : 'sit'; } }
    else { const st = Math.min(d, ag.spd * dt); root.position.x += dx / d * st; root.position.z += dz / d * st; const yaw = Math.atan2(dx, dz); let dy = yaw - root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); root.rotation.y += dy * Math.min(1, dt * 10); }
    const w = T * 7.5; const sw = Math.sin(w);
    for (const s of [-1, 1]) { lerpA(r.leg[s].th.rotation, 'x', sw * 0.55 * s, k); lerpA(r.leg[s].kn.rotation, 'x', Math.max(0, Math.sin(w * s + 1.2 * s)) * 0.9 * 0.9 + 0.08, k); lerpA(r.arm[s].sh.rotation, 'x', -sw * 0.45 * s, k); lerpA(r.arm[s].el.rotation, 'x', -0.35, k); lerpA(r.arm[s].sh.rotation, 'z', s * 0.06, k); }
    lerpA(r.hips.position, 'y', HIPY + Math.abs(Math.cos(w)) * 0.03, k); lerpA(r.spine.rotation, 'x', 0.05, k); r.spine.rotation.y = sw * 0.08; lerpA(r.head.rotation, 'x', 0, k);
    return;
  }
  const sp = SPOT[ag.spot]; let dy = sp.rot - root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); root.rotation.y += dy * Math.min(1, dt * 5);
  lerpA(root.position, 'x', sp.x, k * 0.5); lerpA(root.position, 'z', sp.z, k * 0.5);
  r.spine.rotation.y *= 0.9;
  if (ag.mode === 'sit') {
    const atDesk = sp.type === 'seat' && !sp.type.includes('lounge') && (ag.state === 'working' || ag.state === 'waiting');
    const lounge = sp.type === 'lounge';
    lerpA(r.hips.position, 'y', lounge ? 0.44 : 0.47, k);
    for (const s of [-1, 1]) {
      lerpA(r.leg[s].th.rotation, 'x', -1.5, k); lerpA(r.leg[s].kn.rotation, 'x', 1.45, k);
      if (atDesk) { const typ = Math.sin(T * 18 + s * 1.7) * 0.06; lerpA(r.arm[s].sh.rotation, 'x', -0.75 + typ, k); lerpA(r.arm[s].el.rotation, 'x', -0.95 - typ, k); lerpA(r.arm[s].sh.rotation, 'z', s * 0.12, k); }
      else if (ag.state === 'meeting') { lerpA(r.arm[s].sh.rotation, 'x', -0.55 + (s > 0 ? Math.max(0, Math.sin(T * 1.3)) * -0.5 : 0), k); lerpA(r.arm[s].el.rotation, 'x', -1.0, k); lerpA(r.arm[s].sh.rotation, 'z', s * 0.1, k); }
      else { lerpA(r.arm[s].sh.rotation, 'x', -0.35, k); lerpA(r.arm[s].el.rotation, 'x', -0.9, k); lerpA(r.arm[s].sh.rotation, 'z', s * 0.15, k); }
    }
    lerpA(r.spine.rotation, 'x', atDesk ? 0.12 : lounge ? -0.18 : 0.02, k);
    r.head.rotation.x = atDesk ? 0.08 + Math.sin(T * 0.7) * 0.03 : Math.sin(T * 0.4) * 0.05; r.head.rotation.y = Math.sin(T * 0.3) * (atDesk ? 0.08 : 0.3);
  } else { // stand / idle
    lerpA(r.hips.position, 'y', HIPY + Math.sin(T * 1.6) * 0.004, k);
    for (const s of [-1, 1]) { lerpA(r.leg[s].th.rotation, 'x', 0, k); lerpA(r.leg[s].kn.rotation, 'x', 0.03, k); }
    const clip = false;
    for (const s of [-1, 1]) {
      if (clip && s === -1) { lerpA(r.arm[s].sh.rotation, 'x', -0.35, k); lerpA(r.arm[s].el.rotation, 'x', -1.1, k); }
      else if (sp.type === 'stand' && ag.spot.startsWith('pantry') && s === 1) { lerpA(r.arm[s].sh.rotation, 'x', -0.3, k); lerpA(r.arm[s].el.rotation, 'x', -1.6 + Math.max(0, Math.sin(T * 0.6)) * -0.3, k); }
      else { lerpA(r.arm[s].sh.rotation, 'x', Math.sin(T * 1.2 + s) * 0.04, k); lerpA(r.arm[s].el.rotation, 'x', -0.12, k); }
      lerpA(r.arm[s].sh.rotation, 'z', s * 0.07, k);
    }
    lerpA(r.spine.rotation, 'x', 0, k); r.head.rotation.y = Math.sin(T * 0.35) * 0.45; r.head.rotation.x = Math.sin(T * 0.5) * 0.05;
  }
}
// ---------- status: ./status.json every 60s, fallback simulation ----------
let live = false;
async function poll() {
  try {
    const r = await fetch('./status.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw 0; const j = await r.json();
    let any = false;
    agents.forEach(ag => {
      const s = j.agents && j.agents[ag.key];
      // public schema: { status: working|idle|waiting, time } — never task/bubble text
      const st = s && (s.status || s.state);
      if (s && st && ST_LABEL[st]) {
        any = true; ag.live = true; ag.updatedAt = s.time || j.updatedAt || '';
        // public page: badge/bubble show ONLY status label (no task)
        ag.status = ST_LABEL[st];
        ag.bubble = ST_LABEL[st];
        if (st !== ag.state) applyState(ag, st);
      } else if (ag.key !== 'Stone') {
        ag.live = false;
      }
    });
    live = any; document.getElementById('srcv').textContent = any ? `status.json · ${j.updatedAt || '—'}` : '模擬（status.json 無資料）';
    if (any) refreshUI();
  } catch { live = false; document.getElementById('srcv').textContent = '模擬（讀取失敗）'; }
}
let bigTaskUntil = 0;
function simulate(t) {
  if (t > bigTaskUntil + 70 && Math.random() < 0.002) { bigTaskUntil = t + 30; agents.forEach(ag => { if (!ag.live && ['Stone', '大投', '財財', 'Fellow', '寫哥'].includes(ag.key)) { ag.simUntil = t + 30; ag.status = '大任務：GaN 產品線策略'; ag.bubble = '討論大任務'; applyState(ag, 'meeting'); } }); refreshUI(); }
  agents.forEach(ag => {
    if (ag.live || t < ag.simUntil) return;
    const st = Math.random() < (ag.key === 'Stone' ? 0.8 : 0.68) ? 'working' : 'idle';
    ag.simUntil = t + 18 + Math.random() * 30; const pool = SIM_BUBBLES[st]; ag.bubble = pool[Math.floor(Math.random() * pool.length)]; ag.status = st === 'working' ? '處理任務中' : '充電中';
    applyState(ag, st); refreshUI();
  });
}
const ST_LABEL = { working: '工作中', idle: '閒置', waiting: '等 Stone 決定', meeting: '開會' }, ST_COL = { working: '#39ff7a', idle: '#ffd23a', waiting: '#ff9f43', meeting: '#ff3fb4' };
function drawBoard() {
  const { g, c } = boardTex.userData; const w = c.width, h = c.height;
  g.fillStyle = '#0a0d16'; g.fillRect(0, 0, w, h); g.strokeStyle = '#22f3ff'; g.lineWidth = 3; g.strokeRect(8, 8, w - 16, h - 16);
  g.fillStyle = '#22f3ff'; g.font = 'bold 40px "Noto Sans TC",sans-serif'; g.fillText('團隊狀態 · TEAM STATUS', 34, 62);
  g.fillStyle = '#8890a8'; g.font = '22px sans-serif'; g.fillText(live ? 'LIVE · status.json' : 'SIMULATION', w - 250, 60);
  agents.forEach((a, i) => { const col = i < 6 ? 0 : 1, row = i % 6; const x = 34 + col * 495, y = 110 + row * 68; g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(x - 8, y - 38, 470, 64); g.fillStyle = ST_COL[a.state]; g.beginPath(); g.arc(x + 10, y - 6, 9, 0, 7); g.fill(); g.fillStyle = a.tag; g.font = 'bold 30px "Noto Sans TC",sans-serif'; g.fillText(a.name, x + 32, y + 4); g.fillStyle = '#cfd6e6'; g.font = '24px "Noto Sans TC",sans-serif'; g.fillText(`${ST_LABEL[a.state] || a.state}`, x + 170, y + 2); });
  boardTex.needsUpdate = true;
}
function refreshUI() {
  document.getElementById('rows').innerHTML = agents.map((a, i) => `<div class="row" data-i="${i}"><span class="dot" style="background:${ST_COL[a.state]||'#888'};box-shadow:0 0 6px ${ST_COL[a.state]||'#888'}"></span><span class="n" style="color:${a.tag}">${a.name}</span><span class="s"><span class="badge b-${a.state}">${ST_LABEL[a.state]||a.state}</span></span></div>`).join('');
  document.querySelectorAll('.row').forEach(r => r.onclick = () => select(+r.dataset.i));
  agents.forEach(a => { a.bub.textContent = a.bubble || ''; a.bub.style.display = a.bubble ? '' : 'none'; });
  drawBoard(); if (selected != null) showInfo();
}
// ---------- UI: nav + info ----------
const ZONES = [
  ['總覽', [16, 15, 22], [-1, 0, -1]], ['開放辦公', [3, 4.5, 8], [-4, 0.8, 2.2]], ['Stone 辦公室', [6, 4, -0.5], [11.5, 0.9, -6.5]], ['秘書台', [3.5, 2.8, 1.5], [6.2, 0.9, -2]],
  ['會議桌', [-0.5, 4, -1], [-3, 0.8, -6.3]], ['茶水間', [-9, 3, -3], [-12.4, 1, -7.6]], ['Bauhaus 休憩', [-6, 4, 9.5], [-10.5, 0.5, 4.5]], ['展示區', [7, 3, 4.5], [12, 1.2, 6.5]], ['時代廣場', [-80, GROUND + 9, -62], [-92, GROUND + 18, -125]], ['街道', [-86, GROUND + 26, 24], [-90, GROUND + 4, -70]], ['夜城', [40, 40, 70], [0, -40, -80]],
];
const nav = document.getElementById('nav'); let fly = null;
ZONES.forEach(([n, p, t], i) => { const b = document.createElement('button'); b.textContent = n; b.onclick = () => goZone(i); nav.appendChild(b); });
function goZone(i) { const [, p, t] = ZONES[i]; fly = { t0: performance.now(), p0: camera.position.clone(), q0: controls.target.clone(), p1: new THREE.Vector3(...p), q1: new THREE.Vector3(...t) }; [...nav.children].forEach((b, j) => b.classList.toggle('on', j === i)); }
let selected = null;
function select(i) { selected = i; showInfo(); const a = agents[i]; const p = a.rig.root.position; fly = { t0: performance.now(), p0: camera.position.clone(), q0: controls.target.clone(), p1: new THREE.Vector3(p.x + 3, 2.8, p.z + 3.5), q1: new THREE.Vector3(p.x, 1, p.z) }; }
function showInfo() { const a = agents[selected]; const box = document.getElementById('info'); box.style.display = 'block'; document.getElementById('in').innerHTML = `<span style="color:${a.tag};text-shadow:0 0 10px ${a.tag}">${a.name}</span>`; document.getElementById('ir').textContent = a.role; document.getElementById('ik').innerHTML = `<div><span>狀態</span>${ST_LABEL[a.state]||a.state}</div><div><span>更新</span>${a.updatedAt || '—'}</div><div><span>位置</span>${spotName(a.spot)}</div><div><span>來源</span>${a.live ? 'status.json（公開僅狀態）' : '模擬'}</div><div style="opacity:.55;font-size:11px;margin-top:6px">任務細節只在本機完整狀態頁</div>`; }
function spotName(s) { return s.startsWith('desk') ? '開放辦公區' : s.startsWith('meet') ? '會議桌' : s.startsWith('pantry') ? '茶水間' : s.startsWith('lounge') ? 'Bauhaus 休憩區' : s.startsWith('display') || s.startsWith('sofa') ? '展示區' : s === 'stone' ? '私人辦公室' : s === 'xiaoR' ? '秘書台' : s; }
document.getElementById('ix').onclick = () => { document.getElementById('info').style.display = 'none'; selected = null; };
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); let down = null;
renderer.domElement.addEventListener('pointerdown', e => down = [e.clientX, e.clientY]);
renderer.domElement.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
  mouse.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects(agents.map(a => a.rig.root), true).find(h => h.object.userData.root);
  if (hit) select(agents.findIndex(a => a.rig.root === hit.object.userData.root));
});

// ---------- post ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.5, 0.9); composer.addPass(bloom);
composer.addPass(new OutputPass());
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); labelR.setSize(innerWidth, innerHeight); });

// ---------- loop ----------
updateSky(); setInterval(updateSky, 30000);
agents.forEach(a => { a.bubble = SIM_BUBBLES.working[Math.floor(Math.random() * 8)]; a.simUntil = 4 + Math.random() * 10; });

// ---------- routines (static) ----------
let ROUTINES = [];
async function loadRoutines() {
  try {
    const r = await fetch('./routines.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return;
    const j = await r.json();
    ROUTINES = j.routines || [];
    const el = document.getElementById('rtrows');
    if (!el) return;
    el.innerHTML = ROUTINES.map(rt => {
      const pending = (rt.name === '待填' || rt.name === '未確認' || rt.schedule === '待填' || rt.schedule === '未確認');
      return `<div class="rt"><span class="bn" style="color:${(AG.find(a=>a.key===rt.bot)||{}).tag||'#aaa'}">${rt.bot}</span>${rt.name} <span class="st">· ${rt.schedule} · ${rt.state}</span>${pending?' <span style="opacity:.45">待填</span>':''}</div>`;
    }).join('');
  } catch {}
}
loadRoutines();

refreshUI(); poll(); setInterval(poll, 60000);
if (Q.has('zone')) goZone(+Q.get('zone'));
const clock = new THREE.Clock(); let el = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05); el += dt;
  if (fly) { const u = Math.min(1, (performance.now() - fly.t0) / 1600), e = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; camera.position.lerpVectors(fly.p0, fly.p1, e); controls.target.lerpVectors(fly.q0, fly.q1, e); if (u >= 1) fly = null; }
  controls.update();
  if (!SHOT) simulate(el);
  agents.forEach(a => animate(a, dt, el));
  updateCars(dt, el); updateSignals(el); if ((el * 12 | 0) !== (window.__lf || 0)) { window.__lf = el * 12 | 0; drawLED(el); } updateSteam(dt, el);
  holoHead.rotation.y += dt * 0.3; holoFig.rotation.y -= dt * 0.15; holoHead.children.forEach(c => c.material.opacity = 0.55 + Math.sin(el * 13) * 0.08 + (Math.random() < 0.02 ? -0.4 : 0));
  billboards.forEach(b => { if (el > b.next) { b.next = el + 0.05 + Math.random() * (Math.random() < 0.1 ? 0.2 : 3); b.mat.color.setScalar(Math.random() < 0.15 ? 0.25 : 1.6); } });
  const far = camera.position.distanceTo(controls.target) > 16; agents.forEach(a => a.bub.style.opacity = far ? 0 : 1);
  composer.render(); labelR.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
window.__ready = true;
