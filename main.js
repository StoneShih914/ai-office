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

// ---------- voxel cyberpunk city (instanced) ----------
const GROUND = -110;
const winTex = canvasTex(64, 256, (g, w, h) => {
  g.fillStyle = '#07070c'; g.fillRect(0, 0, w, h);
  for (let y = 4; y < h; y += 8) for (let x = 3; x < w; x += 8) { const r = Math.random(); if (r < 0.32) { g.fillStyle = r < 0.06 ? '#7ff' : r < 0.12 ? '#f8a' : '#ffd9a0'; g.globalAlpha = 0.35 + Math.random() * 0.6; g.fillRect(x, y, 4, 4); } }
});
winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping; winTex.repeat.set(2, 3);
const towerMat = new THREE.MeshStandardMaterial({ color: 0x15151f, roughness: 0.6, metalness: 0.4, emissiveMap: winTex, emissive: 0xffffff, emissiveIntensity: 1.3 });
const towers = []; const NT = 420;
for (let i = 0; i < NT; i++) {
  let x, z; do { x = (rnd() - 0.5) * 700; z = -rnd() * 520 + 140; } while (Math.abs(x) < 45 && z > -55 && z < 60);
  if (x < -230) continue; // waterfront to the west
  const near = Math.hypot(x, z) < 160; const w = 10 + rnd() * 22, d = 10 + rnd() * 22;
  const top = GROUND + 30 + rnd() * (near ? 120 : 170);
  towers.push({ x, z, w, d, h: top - GROUND });
}
const tGeo = new THREE.BoxGeometry(1, 1, 1);
const tInst = new THREE.InstancedMesh(tGeo, towerMat, towers.length);
const neonGeo = new THREE.BoxGeometry(1, 1, 1);
const NEON = [0x22f3ff, 0xff2fb0, 0x39ff7a, 0xffd23a, 0x8a5bff];
const strips = [];
const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();
towers.forEach((t, i) => {
  mtx.compose(p3.set(t.x, GROUND + t.h / 2, t.z), q.identity(), s3.set(t.w, t.h, t.d)); tInst.setMatrixAt(i, mtx);
  const c = NEON[Math.floor(rnd() * NEON.length)];
  if (rnd() < 0.7) { // vertical edge strips
    const sx = rnd() < 0.5 ? 1 : -1; strips.push({ p: [t.x + sx * t.w / 2, GROUND + t.h / 2, t.z + t.d / 2], s: [0.5, t.h, 0.5], c });
  }
  const nb = Math.floor(rnd() * 3);
  for (let k = 0; k < nb; k++) { const y = GROUND + t.h * (0.4 + rnd() * 0.6); strips.push({ p: [t.x, y, t.z + t.d / 2 + 0.1], s: [t.w * 1.01, 0.5, 0.3], c: NEON[Math.floor(rnd() * 5)] }); }
  if (rnd() < 0.35) strips.push({ p: [t.x, GROUND + t.h + 0.3, t.z], s: [t.w + 0.4, 0.6, t.d + 0.4], c });
});
tInst.receiveShadow = false; scene.add(tInst);
const sInst = new THREE.InstancedMesh(neonGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), strips.length);
strips.forEach((s, i) => { mtx.compose(p3.set(...s.p), q.identity(), s3.set(...s.s)); sInst.setMatrixAt(i, mtx); sInst.setColorAt(i, new THREE.Color(s.c).multiplyScalar(2.2)); });
scene.add(sInst);
// ground + waterfront
add(new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2), M(0x0a0a12, 0.9), 0, GROUND, 0, scene, false);
const water = add(new THREE.PlaneGeometry(600, 1400).rotateX(-Math.PI / 2), M(0x0b1830, 0.08, 0.9), -540, GROUND + 0.5, -100, scene, false);
// boardwalk lights along waterfront
const lampN = 60, lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc070).multiplyScalar(3), toneMapped: false }), lampN);
for (let i = 0; i < lampN; i++) { mtx.makeTranslation(-238, GROUND + 4, 140 - i * 11); lamps.setMatrixAt(i, mtx); } scene.add(lamps);
// elevated highways + light trails
const roadMat = M(0x1b1b24, 0.8, 0.2);
const HW = [{ axis: 'x', z: -75, y: -40 }, { axis: 'x', z: 95, y: -55 }, { axis: 'z', x: -70, y: -30 }, { axis: 'z', x: 80, y: -48 }];
HW.forEach(h => {
  const L = 900; const g = h.axis === 'x' ? new THREE.BoxGeometry(L, 1.2, 14) : new THREE.BoxGeometry(14, 1.2, L);
  add(g, roadMat, h.axis === 'x' ? 0 : h.x, h.y, h.axis === 'x' ? h.z : -100, scene, false);
  const rail = h.axis === 'x' ? new THREE.BoxGeometry(L, 0.3, 0.3) : new THREE.BoxGeometry(0.3, 0.3, L);
  for (const o of [-7, 7]) add(rail, E(0x22f3ff, 1.4), h.axis === 'x' ? 0 : h.x + o, h.y + 0.9, h.axis === 'x' ? h.z + o : -100, scene, false);
  for (let k = -400; k < 400; k += 60) { const px = h.axis === 'x' ? k : h.x, pz = h.axis === 'x' ? h.z : k - 100; add(new THREE.BoxGeometry(4, h.y - GROUND, 4), roadMat, px, (h.y + GROUND) / 2, pz, scene, false); }
});
const CARS = 360; const cars = [];
const carInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.5, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), CARS);
for (let i = 0; i < CARS; i++) { const h = HW[i % HW.length]; const dir = rnd() < 0.5 ? 1 : -1; cars.push({ h, dir, t: rnd() * 900 - 450, v: 25 + rnd() * 25, lane: dir * (2 + rnd() * 3.5) }); carInst.setColorAt(i, new THREE.Color(dir > 0 ? 0xfff0d8 : 0xff2a3a).multiplyScalar(dir > 0 ? 2.5 : 3)); }
scene.add(carInst);
function updateCars(dt) {
  cars.forEach((c, i) => {
    c.t += c.v * c.dir * dt; if (c.t > 450) c.t -= 900; if (c.t < -450) c.t += 900;
    const { h } = c; const L = 6;
    if (h.axis === 'x') mtx.compose(p3.set(c.t, h.y + 1, h.z + c.lane), q.identity(), s3.set(L, 0.6, 0.6));
    else mtx.compose(p3.set(h.x + c.lane, h.y + 1, c.t - 100), q.identity(), s3.set(0.6, 0.6, L));
    carInst.setMatrixAt(i, mtx);
  });
  carInst.instanceMatrix.needsUpdate = true;
}
// billboards
function signTex(text, col, bg = '#0a0610') {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = col; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    g.font = 'bold 140px "Noto Sans TC",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = col; g.shadowBlur = 30; g.fillStyle = col; g.fillText(text, w / 2, h / 2 + 8); g.fillStyle = '#fff'; g.shadowBlur = 6; g.globalAlpha = .55; g.fillText(text, w / 2, h / 2 + 8);
  });
}
const billboards = [];
[['夜城', '#ff2fb0', -55, -10, -70, 0.25], ['GaN⚡', '#22f3ff', 50, -5, -85, -0.3], ['STONE', '#ffd23a', 8, 18, -120, 0], ['夜城', '#39ff7a', -95, -25, 30, 1.2], ['GaN⚡', '#ff2fb0', 95, -20, 10, -1.3]].forEach(([t, c, x, y, z, ry]) => {
  const mat = new THREE.MeshBasicMaterial({ map: signTex(t, c), toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6), side: THREE.DoubleSide });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(36, 18), mat); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m);
  box(38, 20, 1, M(0x111118, 0.5, 0.6), 0, 0, -0.6, m, false); billboards.push({ mat, next: 0 });
});
// holograms
const holoHead = new THREE.Group(); holoHead.position.set(-38, 8, -48); scene.add(holoHead);
{
  const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; const y = (t - 0.5) * 2; let r = Math.sin(t * Math.PI) * (0.78 + 0.12 * Math.sin(t * 9)); if (t < 0.18) r *= 0.7 + t; pts.push(new THREE.Vector2(r, y)); }
  const hm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3fb4).multiplyScalar(2), wireframe: true, transparent: true, opacity: 0.75, toneMapped: false });
  const head = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), hm); head.scale.set(6, 8, 6.6); holoHead.add(head);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 6), hm); nose.rotation.x = Math.PI / 2; nose.position.set(0, -0.5, 5.6); holoHead.add(nose);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(9, 0.12, 6, 64), hm); ring.rotation.x = Math.PI / 2; ring.position.y = -9; holoHead.add(ring);
}
const holoFig = new THREE.Group(); holoFig.position.set(42, -30, -40); scene.add(holoFig);
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
const stoneSign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: signTex('STONE', '#ffd23a'), toneMapped: false, transparent: true })); stoneSign.position.set(11.5, 2.7, -2.96); scene.add(stoneSign);
// 小R 秘書台
{ const g = new THREE.Group(); g.position.set(6.2, 0, -1.7); scene.add(g); const m = M(MOR.rose, 0.6); box(1.6, 1.05, 0.12, m, 0, 0.53, 0.38, g); box(1.6, 0.04, 0.65, M(MOR.white, 0.4), 0, 0.76, 0.05, g); box(1.7, 0.04, 0.2, M(0xd8c9b0, 0.3, 0.3), 0, 1.07, 0.38, g); blob(6.2, -1.7, 2.2, 1.4); }
monitor(6.2, 0.78, -1.75, 0); chair(6.2, -2.35, 0); seatAt('xiaoR', 6.2, -2.3, 0, 'seat', [[5.0, -0.3], [5.0, -2.4]]);
// 小米 standing desk
desk(1.5, -5.6, Math.PI, 1.4, 0.7, MOR.sage).position.y = 0.32; monitor(1.5, 1.08, -5.75, 0, scene, scrMats[1]);
seatAt('xiaomi', 1.5, -5.0, Math.PI, 'stand');
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
  { key: '小米', name: '小米', role: '經理 · 蘿格風', tag: '#ff9de2', desk: 'xiaomi', look: { skin: 0xe8c0a0, hair: 0xe4d6b8, hs: 'bob', top: 0x2e2a26, jacket: 0x1f1c1a, trim: 0xc9a14a, pants: 0x221f1d, shoes: 0x3a2a20, clipboard: true, female: true } },
  { key: '小R', name: '小R', role: '秘書 · 茱蒂風', tag: '#ff5fa2', desk: 'xiaoR', look: { skin: 0xeec4a5, hair: 0x5a3a28, tip: 0x2fd6c6, hs: 'undercut', top: 0x3a6f8e, jacket: null, pants: 0x4b4a55, shoes: 0x222, female: true } },
  { key: '百靈鳥', name: '百靈鳥', role: '研究 · 奧特風', tag: '#4ff3ff', desk: 'desk0', look: { skin: 0xf0d6c4, hair: 0xf4f4f8, hs: 'long', top: 0x111116, jacket: null, pants: 0x111116, shoes: 0x111, glowLines: 0x4ff3ff, female: true } },
  { key: '寫哥', name: '寫哥', role: '寫作 · V 風（武士夾克）', tag: '#ffe14d', desk: 'desk1', look: { skin: 0xdcae8c, hair: 0x241a14, hs: 'short', top: 0x222, jacket: 0x141414, collar: 0xe8c43a, samurai: true, pants: 0x232330, shoes: 0x222 } },
  { key: '大投', name: '大投', role: '投資 · 竹村風', tag: '#ff5555', desk: 'desk2', look: { skin: 0xc99a76, hair: 0x141414, hs: 'buzz', top: 0xdcdcdc, jacket: 0x1c2230, pants: 0x1c2230, shoes: 0x111, cyberEyes: true, tall: 1.05 } },
  { key: '財財', name: '財財', role: '財務 · 帕南風', tag: '#ffa94d', desk: 'desk3', look: { skin: 0xd8a888, hair: 0x231610, hs: 'ponytail', top: 0x6b5a48, jacket: 0x6a3f26, pants: 0x3d3a40, shoes: 0x4a2e1c, female: true } },
  { key: '大E', name: '大E', role: '工程 · 傑克風', tag: '#39ff7a', desk: 'desk4', look: { skin: 0xb98563, hair: 0x1a120c, hs: 'bald', top: 0x3a3a3a, jacket: 0x8a6a2a, pants: 0x2a2f3a, shoes: 0x222, beard: true, chain: true, big: 1.15 } },
  { key: 'Fellow', name: 'Fellow', role: '功率半導體專家 · 維克多風', tag: '#a98bff', desk: 'desk5', look: { skin: 0xd2a68a, hair: 0x9a9a9a, hs: 'short', top: 0x2a3a4a, jacket: 0xd8d4c8, pants: 0x3a3a3a, shoes: 0x222, glasses: true, beard: true, grey: true } },
];
const SIM_BUBBLES = { working: ['專注中…', '寫程式', '整理報告', '跑模型', '回覆訊息', 'GaN 元件分析', '審閱合約', '對帳中'], idle: ['☕ 喝咖啡', '休息一下', '看夜景', '想點子', '伸展'], meeting: ['開會中', '簡報', '討論大任務'] };
function buildChar(L) {
  const root = new THREE.Group(); const S = (L.tall || 1) * (L.female ? 0.94 : 1); const W = L.big || 1;
  const skin = M(L.skin, 0.55), hairM = M(L.hair, 0.5), topM = M(L.top, 0.75), jackM = L.jacket != null ? M(L.jacket, L.samurai ? 0.4 : 0.6, L.samurai ? 0.15 : 0) : topM, pantM = M(L.pants, 0.8), shoeM = M(L.shoes, 0.4);
  const metal = M(0xcfd3d8, 0.18, 1);
  const body = new THREE.Group(); body.scale.setScalar(S); root.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.93; body.add(hips);
  const cap = (r, l, m, x, y, z, p, sx = 1, sz = 1) => { const o = add(new THREE.CapsuleGeometry(r, l, 6, 14), m, x, y, z, p); o.scale.set(sx, 1, sz); return o; };
  cap(0.14 * W, 0.08, pantM, 0, 0.02, 0, hips, 1.15, 0.8); // pelvis
  const spine = new THREE.Group(); spine.position.y = 0.08; hips.add(spine);
  const chest = new THREE.Group(); chest.position.y = 0.0; spine.add(chest);
  // torso via lathe for smooth taper
  const prof = [[0.0, 0], [0.13, 0.0], [0.135, 0.08], [0.125, 0.2], [0.15, 0.34], [0.17 * (L.female ? 0.92 : 1), 0.44], [0.15, 0.5], [0.06, 0.55], [0, 0.56]].map(([r, y]) => new THREE.Vector2(r * W, y));
  const torso = add(new THREE.LatheGeometry(prof, 20), L.jacket != null ? jackM : topM, 0, 0, 0, chest); torso.scale.set(1.18, 1, 0.72);
  if (L.jacket != null) { const sh = add(new THREE.LatheGeometry(prof.slice(0, 7).map(v => new THREE.Vector2(v.x * 0.98, v.y)), 20, 0, 1), topM, 0, 0.002, 0.01, chest); sh.scale.set(1.0, 1, 0.74); sh.rotation.y = -0.5; } // shirt V under open jacket
  if (L.collar) { const c = add(new THREE.TorusGeometry(0.11, 0.035, 8, 20), M(L.collar, 0.4), 0, 0.5, 0, chest); c.rotation.x = Math.PI / 2; c.scale.set(1.1, 0.8, 1); }
  if (L.trim) for (const s of [-1, 1]) box(0.015, 0.45, 0.01, M(L.trim, 0.3, 0.8), s * 0.06, 0.25, 0.115, chest);
  if (L.samurai) { const logo = canvasTex(128, 128, (g) => { g.fillStyle = '#d02b2b'; g.font = 'bold 54px serif'; g.textAlign = 'center'; g.fillText('侍', 64, 70); g.fillStyle = '#e8c43a'; g.font = '20px sans-serif'; g.fillText('SAMURAI', 64, 104); }); add(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: logo, transparent: true }), 0, 0.32, -0.115, chest, false).rotation.y = Math.PI; }
  if (L.glowLines) { for (const s of [-1, 1]) box(0.008, 0.45, 0.008, E(L.glowLines, 2.5), s * 0.07, 0.27, 0.112, chest, false); box(0.2, 0.008, 0.008, E(L.glowLines, 2.5), 0, 0.42, 0.11, chest, false); }
  if (L.chain) { const c = add(new THREE.TorusGeometry(0.08, 0.008, 6, 20), M(0xe0b040, 0.2, 1), 0, 0.46, 0.06, chest); c.rotation.x = 1.2; }
  if (L.clipboard) { /* attached to hand later */ }
  // neck & head
  cyl(0.045, 0.055, 0.1, skin, 0, 0.58, 0, chest);
  const head = new THREE.Group(); head.position.y = 0.64; chest.add(head);
  const skull = add(new THREE.SphereGeometry(0.105, 28, 20), skin, 0, 0.1, 0, head); skull.scale.set(0.92, 1.12, 1.0);
  const jaw = add(new THREE.SphereGeometry(0.08, 20, 12), skin, 0, 0.04, 0.02, head); jaw.scale.set(0.9, 0.8, 1);
  for (const s of [-1, 1]) {
    const eye = add(new THREE.SphereGeometry(0.014, 10, 8), M(0xffffff, 0.2), s * 0.036, 0.11, 0.088, head, false);
    add(new THREE.SphereGeometry(0.008, 8, 6), L.cyberEyes ? E(0xff3030, 3) : M(0x1d140e, 0.2), s * 0.036, 0.11, 0.1, head, false);
    box(0.035, 0.007, 0.01, hairM, s * 0.037, 0.135, 0.097, head, false).rotation.z = s * -0.12;
    add(new THREE.SphereGeometry(0.022, 8, 6), skin, s * 0.097, 0.1, 0, head).scale.set(0.5, 1, 0.8);
  }
  const nose = add(new THREE.ConeGeometry(0.014, 0.04, 8), skin, 0, 0.085, 0.105, head, false); nose.rotation.x = Math.PI / 2 - 0.3;
  box(0.035, 0.006, 0.01, M(0x8a4a44, 0.5), 0, 0.045, 0.094, head, false);
  if (L.beard) { const b = add(new THREE.SphereGeometry(0.06, 16, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.5), hairM, 0, 0.055, 0.035, head); b.scale.set(1.05, 1, 1.05); }
  if (L.aviators) { const am = M(0x1a1a1a, 0.05, 0.9); for (const s of [-1, 1]) { const l = add(new THREE.SphereGeometry(0.025, 14, 8), am, s * 0.038, 0.105, 0.1, head, false); l.scale.set(1.1, 0.85, 0.3); } box(0.15, 0.005, 0.005, M(0xd4b060, 0.2, 1), 0, 0.122, 0.104, head, false); }
  if (L.glasses) { const gm = M(0x333, 0.3, 0.6); for (const s of [-1, 1]) add(new THREE.TorusGeometry(0.019, 0.003, 6, 16), gm, s * 0.037, 0.11, 0.104, head, false); }
  // hair
  const hTop = (r = 0.112, a = 0.55) => add(new THREE.SphereGeometry(r, 26, 16, 0, Math.PI * 2, 0, Math.PI * a), hairM, 0, 0.11, -0.005, head);
  switch (L.hs) {
    case 'slick': { const h = hTop(0.113, 0.5); h.scale.set(0.95, 1.12, 1.06); h.rotation.x = -0.15; break; }
    case 'bob': { const h = hTop(0.118, 0.62); h.scale.set(1.0, 1.1, 1.05); const b = add(new THREE.CylinderGeometry(0.115, 0.12, 0.13, 24, 1, true, Math.PI * 0.62, Math.PI * 1.76), hairM, 0, 0.06, -0.005, head); b.material = b.material.clone(); b.material.side = THREE.DoubleSide; break; }
    case 'undercut': { const h = hTop(0.112, 0.4); h.scale.set(0.95, 1.15, 1.05); const s = add(new THREE.SphereGeometry(0.09, 16, 10), M(L.tip, 0.5), 0.03, 0.2, 0.01, head); s.scale.set(1.1, 0.5, 1.2); s.rotation.z = -0.4; break; }
    case 'long': { const h = hTop(0.116, 0.6); h.scale.set(0.98, 1.12, 1.06); const b = add(new THREE.CapsuleGeometry(0.1, 0.25, 6, 16), hairM, 0, -0.07, -0.05, head); b.scale.set(1.05, 1, 0.55); break; }
    case 'ponytail': { const h = hTop(0.113, 0.55); h.scale.set(0.95, 1.12, 1.05); tube([[0, 0.17, -0.1], [0, 0.1, -0.17], [0, -0.05, -0.16], [0, -0.18, -0.12]], 0.03, hairM, head); break; }
    case 'buzz': { const h = hTop(0.108, 0.48); h.scale.set(0.95, 1.13, 1.03); break; }
    case 'bald': { const h = hTop(0.107, 0.3); h.scale.set(0.95, 1.13, 1.03); h.material = M(L.hair, 0.9); break; }
    default: { const h = hTop(0.114, 0.52); h.scale.set(0.97, 1.13, 1.06); }
  }
  // arms
  const arm = {};
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.19 * W, 0.47, 0); chest.add(sh);
    const isMetal = L.silverArm && s === 1;
    const sleeve = isMetal ? metal : (L.jacket != null ? jackM : topM);
    add(new THREE.SphereGeometry(0.06 * W, 14, 10), sleeve, 0, 0, 0, sh);
    cap(0.048 * W, 0.2, sleeve, 0, -0.14, 0, sh);
    const el = new THREE.Group(); el.position.y = -0.28; sh.add(el);
    cap(0.042 * W, 0.19, isMetal ? metal : (L.jacket != null && !L.samurai ? jackM : (L.jacket != null ? jackM : skin)), 0, -0.12, 0, el);
    if (isMetal) for (let k = 0; k < 4; k++) box(0.09, 0.006, 0.09, M(0x777, 0.3, 1), 0, -0.04 - k * 0.06, 0, el, false);
    const hand = add(new THREE.SphereGeometry(0.04, 12, 10), isMetal ? metal : skin, 0, -0.27, 0.01, el); hand.scale.set(0.8, 1.15, 0.6);
    if (L.clipboard && s === -1) { const cb = box(0.2, 0.27, 0.012, M(0x6b4a2a, 0.6), 0, -0.27, 0.09, el); cb.rotation.x = -1.2; box(0.16, 0.2, 0.004, M(0xf5f2ea, 0.8), 0, 0.01, 0.008, cb, false); }
    arm[s] = { sh, el };
  }
  // legs
  const leg = {};
  for (const s of [-1, 1]) {
    const th = new THREE.Group(); th.position.set(s * 0.085 * W, -0.02, 0); hips.add(th);
    cap(0.068 * W, 0.32, pantM, 0, -0.21, 0, th);
    const kn = new THREE.Group(); kn.position.y = -0.43; th.add(kn);
    cap(0.055 * W, 0.32, pantM, 0, -0.2, 0, kn);
    const ft = box(0.09, 0.06, 0.22, shoeM, 0, -0.45, 0.04, kn);
    leg[s] = { th, kn };
  }
  const contact = blob(0, 0, 0.8, 0.8, root); contact.position.y = 0.014;
  root.traverse(o => { if (o.isMesh) o.userData.root = root; });
  return { root, hips, spine, chest, head, arm, leg };
}
const agents = AG.map((a, i) => {
  const rig = buildChar(a.look);
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
  if (st === 'working') target = ag.desk;
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
    if (d < 0.05) { ag.path.shift(); if (!ag.path.length) { const sp = SPOT[ag.spot]; ag.mode = sp.type === 'stand' ? 'stand' : 'sit'; if (ag.key === '小米' && ag.state === 'working' && ag.spot === 'xiaomi') ag.mode = 'stand'; } }
    else { const st = Math.min(d, ag.spd * dt); root.position.x += dx / d * st; root.position.z += dz / d * st; const yaw = Math.atan2(dx, dz); let dy = yaw - root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); root.rotation.y += dy * Math.min(1, dt * 10); }
    const w = T * 7.5; const sw = Math.sin(w);
    for (const s of [-1, 1]) { lerpA(r.leg[s].th.rotation, 'x', sw * 0.55 * s, k); lerpA(r.leg[s].kn.rotation, 'x', Math.max(0, Math.sin(w * s + 1.2 * s)) * 0.9 * 0.9 + 0.08, k); lerpA(r.arm[s].sh.rotation, 'x', -sw * 0.45 * s, k); lerpA(r.arm[s].el.rotation, 'x', -0.35, k); lerpA(r.arm[s].sh.rotation, 'z', s * 0.06, k); }
    lerpA(r.hips.position, 'y', 0.93 + Math.abs(Math.cos(w)) * 0.03, k); lerpA(r.spine.rotation, 'x', 0.05, k); r.spine.rotation.y = sw * 0.08; lerpA(r.head.rotation, 'x', 0, k);
    return;
  }
  const sp = SPOT[ag.spot]; let dy = sp.rot - root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); root.rotation.y += dy * Math.min(1, dt * 5);
  lerpA(root.position, 'x', sp.x, k * 0.5); lerpA(root.position, 'z', sp.z, k * 0.5);
  r.spine.rotation.y *= 0.9;
  if (ag.mode === 'sit') {
    const atDesk = sp.type === 'seat' && !sp.type.includes('lounge') && ag.state === 'working';
    const lounge = sp.type === 'lounge';
    lerpA(r.hips.position, 'y', lounge ? 0.5 : 0.53, k);
    for (const s of [-1, 1]) {
      lerpA(r.leg[s].th.rotation, 'x', -1.5, k); lerpA(r.leg[s].kn.rotation, 'x', 1.45, k);
      if (atDesk) { const typ = Math.sin(T * 18 + s * 1.7) * 0.06; lerpA(r.arm[s].sh.rotation, 'x', -0.75 + typ, k); lerpA(r.arm[s].el.rotation, 'x', -0.95 - typ, k); lerpA(r.arm[s].sh.rotation, 'z', s * 0.12, k); }
      else if (ag.state === 'meeting') { lerpA(r.arm[s].sh.rotation, 'x', -0.55 + (s > 0 ? Math.max(0, Math.sin(T * 1.3)) * -0.5 : 0), k); lerpA(r.arm[s].el.rotation, 'x', -1.0, k); lerpA(r.arm[s].sh.rotation, 'z', s * 0.1, k); }
      else { lerpA(r.arm[s].sh.rotation, 'x', -0.35, k); lerpA(r.arm[s].el.rotation, 'x', -0.9, k); lerpA(r.arm[s].sh.rotation, 'z', s * 0.15, k); }
    }
    lerpA(r.spine.rotation, 'x', atDesk ? 0.12 : lounge ? -0.18 : 0.02, k);
    r.head.rotation.x = atDesk ? 0.08 + Math.sin(T * 0.7) * 0.03 : Math.sin(T * 0.4) * 0.05; r.head.rotation.y = Math.sin(T * 0.3) * (atDesk ? 0.08 : 0.3);
  } else { // stand / idle
    lerpA(r.hips.position, 'y', 0.93 + Math.sin(T * 1.6) * 0.004, k);
    for (const s of [-1, 1]) { lerpA(r.leg[s].th.rotation, 'x', 0, k); lerpA(r.leg[s].kn.rotation, 'x', 0.03, k); }
    const clip = ag.key === '小米';
    for (const s of [-1, 1]) {
      if (clip && s === -1) { lerpA(r.arm[s].sh.rotation, 'x', -0.35, k); lerpA(r.arm[s].el.rotation, 'x', -1.1, k); }
      else if (sp.type === 'stand' && ag.spot.startsWith('pantry') && s === 1) { lerpA(r.arm[s].sh.rotation, 'x', -0.3, k); lerpA(r.arm[s].el.rotation, 'x', -1.6 + Math.max(0, Math.sin(T * 0.6)) * -0.3, k); }
      else if (ag.spot === 'xiaomi' && s === 1) { lerpA(r.arm[s].sh.rotation, 'x', -0.6 + Math.sin(T * 12) * 0.05, k); lerpA(r.arm[s].el.rotation, 'x', -0.9, k); }
      else { lerpA(r.arm[s].sh.rotation, 'x', Math.sin(T * 1.2 + s) * 0.04, k); lerpA(r.arm[s].el.rotation, 'x', -0.12, k); }
      lerpA(r.arm[s].sh.rotation, 'z', s * 0.07, k);
    }
    lerpA(r.spine.rotation, 'x', 0, k); r.head.rotation.y = Math.sin(T * 0.35) * 0.45; r.head.rotation.x = Math.sin(T * 0.5) * 0.05;
  }
}
// 小米 patrol while working
const PATROL = [[-0.4, 0.4], [-8.2, 0.4], [-8.2, 4.4], [0.3, 4.4], [0.3, -0.3], [4.5, -0.3]];
let patrolNext = 20;

// ---------- status: ./status.json every 60s, fallback simulation ----------
let live = false;
async function poll() {
  try {
    const r = await fetch('./status.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw 0; const j = await r.json();
    let any = false;
    agents.forEach(ag => { const s = j.agents && j.agents[ag.key]; if (s && s.state) { any = true; ag.live = true; ag.status = s.status || ''; ag.bubble = s.bubble || ''; if (s.state !== ag.state) applyState(ag, s.state); } else ag.live = false; });
    live = any; document.getElementById('srcv').textContent = any ? `status.json · ${j.updatedAt || '—'}` : '模擬（status.json 無資料）';
  } catch { live = false; document.getElementById('srcv').textContent = '模擬（讀取失敗）'; }
  refreshUI();
}
let bigTaskUntil = 0;
function simulate(t) {
  if (t > bigTaskUntil + 70 && Math.random() < 0.002) { bigTaskUntil = t + 30; agents.forEach(ag => { if (!ag.live && ['Stone', '小米', '大投', '財財', 'Fellow', '寫哥'].includes(ag.key)) { ag.simUntil = t + 30; ag.status = '大任務：GaN 產品線策略'; ag.bubble = '討論大任務'; applyState(ag, 'meeting'); } }); refreshUI(); }
  agents.forEach(ag => {
    if (ag.live || t < ag.simUntil) return;
    const st = Math.random() < (ag.key === 'Stone' ? 0.8 : 0.68) ? 'working' : 'idle';
    ag.simUntil = t + 18 + Math.random() * 30; const pool = SIM_BUBBLES[st]; ag.bubble = pool[Math.floor(Math.random() * pool.length)]; ag.status = st === 'working' ? '處理任務中' : '充電中';
    applyState(ag, st); refreshUI();
  });
}
const ST_LABEL = { working: '工作中', idle: '閒置', meeting: '開會' }, ST_COL = { working: '#39ff7a', idle: '#ffd23a', meeting: '#ff3fb4' };
function drawBoard() {
  const { g, c } = boardTex.userData; const w = c.width, h = c.height;
  g.fillStyle = '#0a0d16'; g.fillRect(0, 0, w, h); g.strokeStyle = '#22f3ff'; g.lineWidth = 3; g.strokeRect(8, 8, w - 16, h - 16);
  g.fillStyle = '#22f3ff'; g.font = 'bold 40px "Noto Sans TC",sans-serif'; g.fillText('團隊狀態 · TEAM STATUS', 34, 62);
  g.fillStyle = '#8890a8'; g.font = '22px sans-serif'; g.fillText(live ? 'LIVE · status.json' : 'SIMULATION', w - 250, 60);
  agents.forEach((a, i) => { const col = i < 5 ? 0 : 1, row = i % 5; const x = 34 + col * 495, y = 120 + row * 76; g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(x - 8, y - 38, 470, 64); g.fillStyle = ST_COL[a.state]; g.beginPath(); g.arc(x + 10, y - 6, 9, 0, 7); g.fill(); g.fillStyle = a.tag; g.font = 'bold 30px "Noto Sans TC",sans-serif'; g.fillText(a.name, x + 32, y + 4); g.fillStyle = '#cfd6e6'; g.font = '24px "Noto Sans TC",sans-serif'; g.fillText(`${ST_LABEL[a.state]} · ${(a.bubble || '').slice(0, 10)}`, x + 170, y + 2); });
  boardTex.needsUpdate = true;
}
function refreshUI() {
  document.getElementById('rows').innerHTML = agents.map((a, i) => `<div class="row" data-i="${i}"><span class="dot" style="background:${ST_COL[a.state]};box-shadow:0 0 6px ${ST_COL[a.state]}"></span><span class="n" style="color:${a.tag}">${a.name}</span><span class="s">${ST_LABEL[a.state]} · ${a.bubble || '—'}</span></div>`).join('');
  document.querySelectorAll('.row').forEach(r => r.onclick = () => select(+r.dataset.i));
  agents.forEach(a => { a.bub.textContent = a.bubble || ''; a.bub.style.display = a.bubble ? '' : 'none'; });
  drawBoard(); if (selected != null) showInfo();
}
// ---------- UI: nav + info ----------
const ZONES = [
  ['總覽', [16, 15, 22], [-1, 0, -1]], ['開放辦公', [3, 4.5, 8], [-4, 0.8, 2.2]], ['Stone 辦公室', [6, 4, -0.5], [11.5, 0.9, -6.5]], ['秘書台', [3.5, 2.8, 1.5], [6.2, 0.9, -2]],
  ['會議桌', [-0.5, 4, -1], [-3, 0.8, -6.3]], ['茶水間', [-9, 3, -3], [-12.4, 1, -7.6]], ['Bauhaus 休憩', [-6, 4, 9.5], [-10.5, 0.5, 4.5]], ['展示區', [7, 3, 4.5], [12, 1.2, 6.5]], ['夜城', [30, 30, 50], [0, -10, -60]],
];
const nav = document.getElementById('nav'); let fly = null;
ZONES.forEach(([n, p, t], i) => { const b = document.createElement('button'); b.textContent = n; b.onclick = () => goZone(i); nav.appendChild(b); });
function goZone(i) { const [, p, t] = ZONES[i]; fly = { t0: performance.now(), p0: camera.position.clone(), q0: controls.target.clone(), p1: new THREE.Vector3(...p), q1: new THREE.Vector3(...t) }; [...nav.children].forEach((b, j) => b.classList.toggle('on', j === i)); }
let selected = null;
function select(i) { selected = i; showInfo(); const a = agents[i]; const p = a.rig.root.position; fly = { t0: performance.now(), p0: camera.position.clone(), q0: controls.target.clone(), p1: new THREE.Vector3(p.x + 3, 2.8, p.z + 3.5), q1: new THREE.Vector3(p.x, 1, p.z) }; }
function showInfo() { const a = agents[selected]; const box = document.getElementById('info'); box.style.display = 'block'; document.getElementById('in').innerHTML = `<span style="color:${a.tag};text-shadow:0 0 10px ${a.tag}">${a.name}</span>`; document.getElementById('ir').textContent = a.role; document.getElementById('ik').innerHTML = `<div><span>狀態</span>${ST_LABEL[a.state]}</div><div><span>任務</span>${a.status || '—'}</div><div><span>訊息</span>${a.bubble || '—'}</div><div><span>位置</span>${spotName(a.spot)}</div><div><span>來源</span>${a.live ? 'status.json' : '模擬'}</div>`; }
function spotName(s) { return s.startsWith('desk') ? '開放辦公區' : s.startsWith('meet') ? '會議桌' : s.startsWith('pantry') ? '茶水間' : s.startsWith('lounge') ? 'Bauhaus 休憩區' : s.startsWith('display') || s.startsWith('sofa') ? '展示區' : s === 'stone' ? '私人辦公室' : s === 'xiaoR' ? '秘書台' : s === 'xiaomi' ? '經理站立桌' : s; }
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
refreshUI(); poll(); setInterval(poll, 60000);
if (Q.has('zone')) goZone(+Q.get('zone'));
const clock = new THREE.Clock(); let el = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05); el += dt;
  if (fly) { const u = Math.min(1, (performance.now() - fly.t0) / 1600), e = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; camera.position.lerpVectors(fly.p0, fly.p1, e); controls.target.lerpVectors(fly.q0, fly.q1, e); if (u >= 1) fly = null; }
  controls.update();
  if (!SHOT) simulate(el);
  const xm = agents[1];
  if (!xm.live && xm.state === 'working' && el > patrolNext && xm.mode !== 'walk') { patrolNext = el + 40; occupied.delete(xm.spot); xm.path = PATROL.concat([[1.5, -5.0]]).map(p => p.slice()); xm.mode = 'walk'; xm.spot = 'xiaomi'; occupied.add('xiaomi'); }
  agents.forEach(a => animate(a, dt, el));
  updateCars(dt); updateSteam(dt, el);
  holoHead.rotation.y += dt * 0.3; holoFig.rotation.y -= dt * 0.15; holoHead.children.forEach(c => c.material.opacity = 0.55 + Math.sin(el * 13) * 0.08 + (Math.random() < 0.02 ? -0.4 : 0));
  billboards.forEach(b => { if (el > b.next) { b.next = el + 0.05 + Math.random() * (Math.random() < 0.1 ? 0.2 : 3); b.mat.color.setScalar(Math.random() < 0.15 ? 0.25 : 1.6); } });
  const far = camera.position.distanceTo(controls.target) > 16; agents.forEach(a => a.bub.style.opacity = far ? 0 : 1);
  composer.render(); labelR.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
window.__ready = true;
