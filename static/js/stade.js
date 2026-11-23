/* =============================================================================
   YALLA · Accueil 3D « Le terrain t'attend »
   Stade procédural three.js + parcours au scroll (GSAP ScrollTrigger + Lenis)
   ============================================================================= */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * clamp(t); };
const bump = (a, peak, b, v) => (v < peak ? smooth(a, peak, v) : 1 - smooth(peak, b, v));
const SNAP = new URLSearchParams(location.search).has("snap");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isTouch = window.matchMedia("(pointer: coarse)").matches;
const col = (hex) => new THREE.Color(hex); // converti en linéaire

const loaderPct = $("#loader-pct");
const loaderBar = $("#loader-bar");
let loadValue = 0;
const setLoad = (v) => {
  gsap.to({ v: loadValue }, {
    v, duration: 0.5, ease: "power2.out",
    onUpdate() { const n = Math.round(this.targets()[0].v); loaderPct.textContent = n; loaderBar.style.width = n + "%"; },
  });
  loadValue = v;
};
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/* -----------------------------------------------------------------------------
   Rendu
----------------------------------------------------------------------------- */
const canvas = $("#scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
let DPR = Math.min(window.devicePixelRatio || 1, 1.6);
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.5, 3000);
camera.position.set(-45, 105, 215);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.5, 0.5, 1.15);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* Éclairage d'ambiance HDR + texture de gazon réelle */
const ASSET = (f) => new URL("../stade/" + f, import.meta.url).href;
const pmrem = new THREE.PMREMGenerator(renderer);
const [hdr, grassTex] = await Promise.all([
  new RGBELoader().loadAsync(ASSET("ciel.hdr")),
  new THREE.TextureLoader().loadAsync(ASSET("gazon.jpg")),
]);
scene.environment = pmrem.fromEquirectangular(hdr).texture;
hdr.dispose();
scene.environmentIntensity = 0.5;
grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
grassTex.colorSpace = THREE.SRGBColorSpace;
grassTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
setLoad(35);

/* Uniformes partagés */
const U = {
  uTime: { value: 0 },
  uNight: { value: 0 },
  uFlood: { value: 0 },
  uSunDir: { value: new THREE.Vector3(-0.8, 0.26, 0.55).normalize() },
};

const GLSL_COMMON = /* glsl */`
  vec3 s2l(vec3 c) { return pow(c, vec3(2.2)); }
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float hash13(vec3 p3) { p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
  }
`;

/* -----------------------------------------------------------------------------
   Ciel : coucher de soleil -> nuit étoilée
----------------------------------------------------------------------------- */
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(1600, 48, 24),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTime: U.uTime, uNight: U.uNight, uSunDir: U.uSunDir },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      ${GLSL_COMMON}
      uniform float uTime, uNight; uniform vec3 uSunDir; varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir); float h = d.y;
        float sd = max(dot(d, uSunDir), 0.);
        // crépuscule
        vec3 zen = s2l(vec3(.36, .52, .84));
        vec3 mid = s2l(vec3(.98, .64, .58));
        vec3 hor = s2l(vec3(1., .80, .52));
        vec3 dusk = mix(hor, mid, smoothstep(0.0, .16, h));
        dusk = mix(dusk, zen, smoothstep(.12, .62, h));
        dusk += s2l(vec3(1., .72, .42)) * pow(sd, 6.) * .9;
        dusk += vec3(1., .85, .6) * smoothstep(.9990, .9996, sd) * 8.;
        dusk = mix(dusk, s2l(vec3(.86, .62, .52)), smoothstep(0., -.08, h));
        // nuit
        vec3 nz = s2l(vec3(.03, .05, .12)), nh = s2l(vec3(.13, .17, .30));
        vec3 night = mix(nh, nz, smoothstep(0., .5, h));
        night += s2l(vec3(1., .55, .25)) * .35 * exp(-max(h, 0.) * 14.);
        vec3 q = d * 260.; vec3 id = floor(q);
        float r = hash13(id);
        float star = step(.986, r) * smoothstep(.22, .0, length(fract(q) - .5));
        star *= .6 + .4 * sin(uTime * (1.5 + r * 4.) + r * 60.);
        night += vec3(star) * 2.2 * smoothstep(.04, .25, h);
        gl_FragColor = vec4(mix(dusk, night, uNight), 1.);
      }`,
  })
);
sky.frustumCulled = false;
scene.add(sky);

/* Brouillard (matériaux standards) */
const FOG_DUSK = col("#e8a985"), FOG_NIGHT = col("#0e1628");
scene.fog = new THREE.Fog(FOG_DUSK.clone(), 260, 1100);

/* Lumières */
const hemi = new THREE.HemisphereLight(col("#ffd9b8"), col("#43513f"), 1.3);
scene.add(hemi);
const sun = new THREE.DirectionalLight(col("#ffc58a"), 3.2);
sun.position.copy(U.uSunDir.value).multiplyScalar(260);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -140, right: 140, top: 140, bottom: -140, near: 10, far: 600 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.6;
scene.add(sun);
const KEY_DIR = new THREE.Vector3(), FLOOD_DIR = new THREE.Vector3(0.25, 1, 0.35).normalize();
const SUN_C = col("#ffc58a"), FLOOD_C = col("#eef3ff");
const flood = new THREE.DirectionalLight(col("#f4f7ff"), 0);
flood.position.set(30, 120, 50);
scene.add(flood);
const flood2 = new THREE.DirectionalLight(col("#f4f7ff"), 0);
flood2.position.set(-40, 90, -60);
scene.add(flood2);

/* -----------------------------------------------------------------------------
   Géométrie du stade : tribunes rectangulaires à coins pleins, style Old Trafford
----------------------------------------------------------------------------- */
const A0 = 60, B0 = 42, SE = 12;
function sePoint(theta, d) {
  const c = Math.cos(theta), s = Math.sin(theta), e = 2 / SE;
  return [(A0 + d) * Math.sign(c) * Math.pow(Math.abs(c), e), (B0 + d) * Math.sign(s) * Math.pow(Math.abs(s), e)];
}
/* La tribune sud (côté tunnel) est plus basse, à un seul étage visuel */
function standScale(theta) {
  const south = smooth(0.72, 0.93, Math.sin(theta));
  return { ds: lerp(1, 0.66, south), hs: lerp(1, 0.58, south) };
}
function standPoint(theta, d, h) {
  const { ds, hs } = standScale(theta);
  const [x, z] = sePoint(theta, d * ds);
  return [x, h * hs, z];
}

/** Points régulièrement espacés (en mètres) le long d'un contour de tribune. */
function arcSamples(d, h, step, N = 12000) {
  const out = [];
  let [px, py, pz] = standPoint(0, d, h), pth = 0, need = step;
  for (let k = 1; k <= N; k++) {
    const th = (k / N) * Math.PI * 2;
    const [x, y, z] = standPoint(th, d, h);
    let L = Math.hypot(x - px, z - pz);
    let sx = px, sy = py, sz = pz, sth = pth;
    while (L >= need) {
      const f = need / L;
      sx += (x - sx) * f; sy += (y - sy) * f; sz += (z - sz) * f; sth += (th - sth) * f;
      out.push({ th: sth, p: [sx, sy, sz] });
      L -= need; need = step;
    }
    need -= L;
    px = x; py = y; pz = z; pth = th;
  }
  return out;
}

/* Profil des tribunes (d = recul depuis le bord intérieur, h = hauteur) */
const LOWER = { d0: 1.2, h0: 1.5, rows: 26, tread: 0.8, riser: 0.37 };
const UPPER = { d0: 23.8, h0: 15.2, rows: 30, tread: 0.8, riser: 0.5 };
const tierEnd = (t) => [t.d0 + t.rows * t.tread, t.h0 + t.rows * t.riser];
const [LD1, LH1] = tierEnd(LOWER); // 22, 11.1
const [UD1, UH1] = tierEnd(UPPER); // 47.8, 30.2
const ROOF_FRONT = 19, ROOF_BACK = 51, ROOF_H0 = 37, ROOF_H1 = 40.5;

function standSegments() {
  const S = [];
  const seg = (pts, kind, extra = {}) => S.push({ pts, kind, ...extra });
  seg([[0, 0], [LOWER.d0 - 0.2, 0]], 0);
  seg([[LOWER.d0 - 0.2, 0], [LOWER.d0 - 0.2, LOWER.h0]], 7); // mur avant (pub)
  seg([[LOWER.d0 - 0.2, LOWER.h0], [LOWER.d0, LOWER.h0]], 0);
  for (const [tier, T] of [[1, LOWER], [2, UPPER]]) {
    for (let i = 0; i < T.rows; i++) {
      const d = T.d0 + i * T.tread, h = T.h0 + i * T.riser;
      seg([[d, h], [d, h + T.riser]], 2, { tier, rowF: i / T.rows });
      seg([[d, h + T.riser], [d + T.tread, h + T.riser]], 1, { tier, rowF: (i + 0.5) / T.rows });
    }
    if (tier === 1) {
      seg([[LD1, LH1], [LD1 + 0.6, LH1]], 0);
      seg([[LD1 + 0.6, LH1], [LD1 + 0.6, UPPER.h0 - 1.2]], 3); // loges vitrées
      seg([[LD1 + 0.6, UPPER.h0 - 1.2], [UPPER.d0, UPPER.h0 - 1.2]], 0);
      seg([[UPPER.d0, UPPER.h0 - 1.2], [UPPER.d0, UPPER.h0]], 0);
    }
  }
  seg([[UD1, UH1], [UD1, UH1 + 2.2]], 0);
  seg([[UD1, UH1 + 2.2], [ROOF_BACK - 1.5, UH1 + 2.2]], 0);
  seg([[ROOF_BACK - 1.5, UH1 + 2.2], [ROOF_BACK - 1.5, 0]], 4); // façade
  return S;
}

/** Ruban qui suit le contour des tribunes entre deux points de profil. */
function ribbon(segs, { M = 360, t0 = 0, t1 = Math.PI * 2, color = "#cccccc" } = {}) {
  const pos = [], colr = [], uv = [], seat = [], idx = [];
  let base = 0;
  const c = col(color);
  for (const sg of segs) {
    const [[d0, h0], [d1, h1]] = sg.pts;
    let len = 0, prev = null;
    for (let i = 0; i <= M; i++) {
      const th = t0 + (i / M) * (t1 - t0);
      const p0 = standPoint(th, d0, h0), p1 = standPoint(th, d1, h1);
      if (prev) len += Math.hypot(p0[0] - prev[0], p0[2] - prev[2]);
      prev = p0;
      pos.push(...p0, ...p1);
      colr.push(c.r, c.g, c.b, c.r, c.g, c.b);
      uv.push(i / M, 0, i / M, 1);
      const k = sg.kind ?? 0;
      seat.push(len, sg.tier || 0, sg.rowF || 0, k, len, sg.tier || 0, sg.rowF || 0, k);
      if (i < M) { const a = base + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    base += (M + 1) * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colr, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("aSeat", new THREE.Float32BufferAttribute(seat, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* Texte écrit avec les sièges blancs dans la tribune nord (comme les grands stades anglais) */
const LETTERS = (() => {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, 1024, 128);
  g.fillStyle = "#fff";
  g.font = '800 104px "Barlow Condensed", "Arial Narrow", sans-serif';
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("YALLA  FOOTLAB", 512, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.generateMipmaps = true;
  return { canvas: c, tex, draw() { g.fillStyle = "#000"; g.fillRect(0, 0, 1024, 128); g.fillStyle = "#fff"; g.font = '800 104px "Barlow Condensed", "Arial Narrow", sans-serif'; g.fillText("YALLA  FOOTLAB", 512, 68); tex.needsUpdate = true; this.data = g.getImageData(0, 0, 1024, 128).data; } };
})();
await (document.fonts ? document.fonts.load('800 104px "Barlow Condensed"') : Promise.resolve());
LETTERS.draw();
const LET_X = 46, LET_V0 = 0.18, LET_V1 = 0.86;
function letterMask(x, z, tier, rowF) {
  if (tier !== 2 || z > 0 || Math.abs(x) > LET_X || !LETTERS.data) return 0;
  const u = (x + LET_X) / (2 * LET_X), v = (rowF - LET_V0) / (LET_V1 - LET_V0);
  if (v < 0 || v > 1) return 0;
  const px = Math.min(1023, Math.floor(u * 1024)), py = Math.min(127, Math.floor((1 - v) * 128));
  return LETTERS.data[(py * 1024 + px) * 4] / 255;
}

/* Texture LED défilante (panneaux + bande de tribune) */
function ledTexture(text, { bg = "#0a0a0c", fg = "#ffffff", alt = "#ff3b3b", w = 2048, h = 96 } = {}) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.font = `800 ${Math.round(h * 0.72)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  g.textBaseline = "middle";
  let x = 20, k = 0;
  while (x < w) {
    const t = text[k % text.length];
    g.fillStyle = k % 2 ? alt : fg;
    g.fillText(t, x, h * 0.54);
    x += g.measureText(t).width + h * 0.6;
    k++;
  }
  g.fillStyle = "rgba(0,0,0,.28)";
  for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

const stadium = new THREE.Group();
scene.add(stadium);

/* Tribunes : sièges rouges individuels, loges vitrées, façade */
const standUniforms = { uLetters: { value: LETTERS.tex }, uNight: U.uNight };
const standMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.05, side: THREE.DoubleSide });
standMat.customProgramCacheKey = () => "stands";
standMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, standUniforms);
  sh.vertexShader = "attribute vec4 aSeat;\nvarying vec4 vSeat;\nvarying vec3 vWP;\n" + sh.vertexShader.replace(
    "#include <begin_vertex>", "#include <begin_vertex>\nvSeat = aSeat; vWP = position;");
  sh.fragmentShader = "varying vec4 vSeat;\nvarying vec3 vWP;\nuniform sampler2D uLetters;\nuniform float uNight;\n" + GLSL_COMMON + sh.fragmentShader.replace(
    "#include <color_fragment>",
    /* glsl */`#include <color_fragment>
     float kind = floor(vSeat.w + .5);
     float tier = floor(vSeat.y + .5);
     vec3 cc = diffuseColor.rgb;
     if (kind > .5 && kind < 2.5) {
       float s = fract(vSeat.x / .52);
       float gap = smoothstep(0., .1, s) * smoothstep(1., .9, s);
       vec3 red = s2l(vec3(.66, .05, .09)) * (.9 + .2 * hash12(vec2(floor(vSeat.x / .52), vSeat.z * 97.)));
       if (tier > 1.5 && vWP.z < 0. && abs(vWP.x) < ${LET_X}.) {
         vec2 luv = vec2((vWP.x + ${LET_X}.) / ${2 * LET_X}., (vSeat.z - ${LET_V0}) / ${(LET_V1 - LET_V0).toFixed(3)});
         if (luv.y > 0. && luv.y < 1.) red = mix(red, vec3(.82), texture2D(uLetters, luv).r);
       }
       cc = red * mix(.25, 1., gap) * (kind > 1.5 ? .55 : 1.);
     } else if (kind > 2.5 && kind < 3.5) {
       float w = step(.15, fract(vSeat.x / 4.)) * step(fract(vSeat.x / 4.), .92);
       cc = mix(s2l(vec3(.08, .09, .11)), s2l(vec3(.25, .3, .36)), w * .5);
     } else if (kind > 3.5 && kind < 4.5) {
       float panel = step(.06, fract(vSeat.x / 6.));
       float h = vWP.y;
       cc = s2l(vec3(.34, .35, .38)) * mix(.7, 1., panel);
       float band = smoothstep(.3, 0., abs(h - 9.)) ;
       cc = mix(cc, s2l(vec3(.62, .06, .1)), smoothstep(1.4, 1.2, abs(h - 9.)));
       cc = mix(cc, s2l(vec3(.15, .18, .22)), step(14., h) * step(h, 22.) * .8);
     } else if (kind > 6.5) {
       cc = s2l(vec3(.06, .06, .07));
     }
     diffuseColor.rgb = cc;`).replace(
    "#include <emissivemap_fragment>",
    /* glsl */`#include <emissivemap_fragment>
     if (kind > 2.5 && kind < 3.5) {
       float lit = step(.45, hash12(vec2(floor(vSeat.x / 4.), 3.)));
       float w = step(.15, fract(vSeat.x / 4.)) * step(fract(vSeat.x / 4.), .92);
       float mull = step(.08, fract(vSeat.x / 1.)) ;
       totalEmissiveRadiance += s2l(vec3(1., .78, .5)) * w * lit * mull * uNight * .1;
     }
     if (kind > 3.5 && kind < 4.5) {
       float win = step(14., vWP.y) * step(vWP.y, 22.) * step(.25, fract(vSeat.x / 3.)) * step(fract(vSeat.x / 3.), .8);
       totalEmissiveRadiance += s2l(vec3(1., .85, .6)) * win * step(.4, hash12(vec2(floor(vSeat.x / 3.), 9.))) * uNight * .9;
     }`);
};
const stands = new THREE.Mesh(ribbon(standSegments(), { color: "#bdbab4" }), standMat);
stands.castShadow = true;
stands.receiveShadow = true;
stadium.add(stands);

/* Bande LED au-dessus des loges */
const ribbonTex = ledTexture(["YALLA", "•", "FOOTLAB PRO", "•", "74 000 VOIX", "•"], { h: 96 });
ribbonTex.repeat.x = 22;
const ribbonMat = new THREE.MeshBasicMaterial({ map: ribbonTex, side: THREE.DoubleSide });
const ledRibbon = new THREE.Mesh(ribbon([{ pts: [[UPPER.d0 - 0.05, UPPER.h0 - 1.15], [UPPER.d0 - 0.05, UPPER.h0 - 0.05]] }]), ribbonMat);
stadium.add(ledRibbon);

/* Toit en porte-à-faux, gris foncé */
const roofMat = new THREE.MeshStandardMaterial({ color: col("#5b6068"), roughness: 0.6, metalness: 0.35, side: THREE.DoubleSide });
const ROOF_C = roofMat.color.clone();
const roof = new THREE.Mesh(ribbon([{ pts: [[ROOF_FRONT, ROOF_H0], [ROOF_BACK, ROOF_H1]] }]), roofMat);
roof.castShadow = true;
stadium.add(roof);
const fasciaMat = new THREE.MeshStandardMaterial({ color: col("#e9ecef"), roughness: 0.45, metalness: 0.3, side: THREE.DoubleSide });
const fascia = new THREE.Mesh(ribbon([{ pts: [[ROOF_FRONT, ROOF_H0 - 2.4], [ROOF_FRONT, ROOF_H0 + 1.4]] }]), fasciaMat);
fascia.castShadow = true;
stadium.add(fascia);
/* Fermes blanches au-dessus du toit (la signature des grands stades anglais) */
{
  const spots = arcSamples(ROOF_FRONT, ROOF_H0, 7.5, 8000);
  const N = spots.length;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const trusses = new THREE.InstancedMesh(geo, fasciaMat, N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  spots.forEach(({ th }, i) => {
    const a = standPoint(th, ROOF_FRONT, ROOF_H0 + 1.4), b = standPoint(th, ROOF_BACK - 4, ROOF_H1 + 0.4);
    const dx = b[0] - a[0], dz = b[2] - a[2], dy = b[1] - a[1];
    const L = Math.hypot(dx, dz);
    e.set(0, -Math.atan2(dz, dx), Math.atan2(dy + 2.2, L), "YZX");
    q.setFromEuler(e);
    m.compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.9, (a[2] + b[2]) / 2), q, new THREE.Vector3(L, 0.35, 0.3));
    trusses.setMatrixAt(i, m);
  });
  trusses.castShadow = true;
  stadium.add(trusses);
}

/* Rampes de projecteurs sous le bord du toit, une par tribune */
const lampCanvas = document.createElement("canvas");
lampCanvas.width = 128; lampCanvas.height = 32;
{
  const g = lampCanvas.getContext("2d");
  g.fillStyle = "#1a1d1f"; g.fillRect(0, 0, 128, 32);
  for (let x = 0; x < 4; x++) {
    const cx = 16 + x * 32, cy = 16;
    const r = g.createRadialGradient(cx, cy, 1, cx, cy, 13);
    r.addColorStop(0, "#ffffff"); r.addColorStop(0.6, "#e8eeff"); r.addColorStop(1, "#5a6068");
    g.fillStyle = r; g.fillRect(cx - 13, cy - 11, 26, 22);
  }
}
const lampTex = new THREE.CanvasTexture(lampCanvas);
lampTex.colorSpace = THREE.SRGBColorSpace;
lampTex.wrapS = THREE.RepeatWrapping;
lampTex.repeat.x = 60;

const curtainMatBase = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uOn: { value: 0 } },
  vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: /* glsl */`uniform float uOn; varying vec2 vUv;
    void main() { float a = pow(1. - vUv.y, 2.2) * .07 * uOn; gl_FragColor = vec4(vec3(.95, .97, 1.) * a, 1.); }`,
});
/* Les quatre tribunes : est, sud, ouest, nord */
const SIDES = [[-Math.PI / 4, Math.PI / 4], [Math.PI / 4, (3 * Math.PI) / 4], [(3 * Math.PI) / 4, (5 * Math.PI) / 4], [(5 * Math.PI) / 4, (7 * Math.PI) / 4]];
const pylons = SIDES.map(([t0, t1], i) => {
  const lampMat = new THREE.MeshBasicMaterial({ map: lampTex, color: new THREE.Color(0.2, 0.2, 0.2), side: THREE.DoubleSide });
  const lamps = new THREE.Mesh(ribbon([{ pts: [[ROOF_FRONT - 0.15, ROOF_H0 - 2.3], [ROOF_FRONT - 0.15, ROOF_H0 - 1.2]] }], { M: 90, t0, t1 }), lampMat);
  stadium.add(lamps);
  const beamMat = curtainMatBase.clone();
  const curtain = new THREE.Mesh(ribbon([{ pts: [[ROOF_FRONT - 0.3, ROOF_H0 - 2.4], [-14, 0.2]] }], { M: 90, t0, t1 }), beamMat);
  curtain.renderOrder = 5;
  stadium.add(curtain);
  const mid = (t0 + t1) / 2;
  const hw = standPoint(mid, ROOF_FRONT, ROOF_H0);
  return { lampMat, beamMat, i, headWorld: new THREE.Vector3(...hw) };
});

/* Sol extérieur + parvis */
const ground = new THREE.Mesh(new THREE.CircleGeometry(1400, 64), new THREE.MeshStandardMaterial({ color: col("#4c5a48"), roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.4;
ground.receiveShadow = true;
scene.add(ground);
const plaza = new THREE.Mesh(new THREE.RingGeometry(40, 135, 96, 1), new THREE.MeshStandardMaterial({ color: col("#6f6c66"), roughness: 0.95 }));
plaza.rotation.x = -Math.PI / 2;
plaza.scale.set(1.25, 1.0, 1);
plaza.position.y = -0.02;
plaza.receiveShadow = true;
scene.add(plaza);
const PLAZA_C = plaza.material.color.clone(), GROUND_C = ground.material.color.clone();
/* -----------------------------------------------------------------------------
   Pelouse : bandes de tonte + tracés FIFA, tout en shader
----------------------------------------------------------------------------- */
const pitchMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
pitchMat.onBeforeCompile = (sh) => {
  sh.uniforms.uGrass = { value: grassTex };
  sh.vertexShader = "varying vec2 vPitch;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvPitch = position.xy;");
  sh.fragmentShader = "varying vec2 vPitch;\nuniform sampler2D uGrass;\n" + GLSL_COMMON + /* glsl */`
    float sdBox(vec2 p, vec2 b) { vec2 q = abs(p) - b; return length(max(q, 0.)) + min(max(q.x, q.y), 0.); }
    float markings(vec2 p) {
      vec2 a = abs(p);
      float d = abs(sdBox(p, vec2(52.5, 34.)));
      d = min(d, a.y < 34. ? a.x : 1e3);
      d = min(d, abs(length(p) - 9.15));
      d = min(d, abs(sdBox(vec2(a.x - 44.25, p.y), vec2(8.25, 20.16))));
      d = min(d, abs(sdBox(vec2(a.x - 49.75, p.y), vec2(2.75, 9.16))));
      float arc = abs(length(vec2(a.x - 41.5, p.y)) - 9.15);
      d = min(d, a.x < 36. ? arc : 1e3);
      float corner = abs(length(vec2(a.x - 52.5, a.y - 34.)) - 1.);
      d = min(d, (a.x < 52.5 && a.y < 34.) ? corner : 1e3);
      return d;
    }
  ` + sh.fragmentShader.replace("#include <color_fragment>", /* glsl */`
    #include <color_fragment>
    vec2 p = vPitch;
    vec2 a = abs(p);
    float stripe = mod(floor((p.x + 52.5) / 5.833), 2.);
    vec3 tex = texture2D(uGrass, p / 9.).rgb * .55 + texture2D(uGrass, p / 2.3 + .37).rgb * .45;
    float lum = dot(tex, vec3(.3, .59, .11));
    vec3 grass = s2l(vec3(.20, .46, .14)) * (.55 + lum * 1.25);
    grass *= mix(1.12, .84, stripe);
    float n = vnoise(p * .35) * .6 + vnoise(p * 1.3) * .4;
    grass *= .9 + .16 * n;
    float wear = smoothstep(9., 0., length(vec2(a.x - 47., p.y * 1.3))) * .25;
    grass = mix(grass, s2l(vec3(.42, .50, .25)), wear * vnoise(p * 3.));
    float outside = smoothstep(.0, .6, max(a.x - 56., a.y - 38.));
    vec3 c = mix(grass, grass * .72, outside);
    float d = markings(p);
    float aa = fwidth(d) * 1.2 + .001;
    float line = 1. - smoothstep(.06, .06 + aa, d);
    line = max(line, 1. - smoothstep(.2, .2 + aa, length(p)));
    line = max(line, 1. - smoothstep(.2, .2 + aa, length(vec2(a.x - 41.5, p.y))));
    c = mix(c, vec3(.62), line * (1. - outside));
    diffuseColor.rgb = c;
  `);
};
const pitch = new THREE.Mesh(new THREE.PlaneGeometry(132, 98, 1, 1), pitchMat);
pitch.rotation.x = -Math.PI / 2;
pitch.receiveShadow = true;
stadium.add(pitch);

/* Panneaux publicitaires LED autour du terrain */
const adTex = ledTexture(["YALLA", "•", "FOOTLAB PRO", "•", "LE TERRAIN T'ATTEND", "•"], { h: 96 });
const ads = [];
function adBoard(len, x, z, rotY) {
  const t = adTex.clone(); t.needsUpdate = true; t.repeat.x = len / 14;
  const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.95, 0.12), [
    new THREE.MeshStandardMaterial({ color: col("#0b0f0c") }), new THREE.MeshStandardMaterial({ color: col("#0b0f0c") }),
    new THREE.MeshStandardMaterial({ color: col("#0b0f0c") }), new THREE.MeshStandardMaterial({ color: col("#0b0f0c") }),
    new THREE.MeshBasicMaterial({ map: t }), new THREE.MeshStandardMaterial({ color: col("#0b0f0c") }),
  ]);
  m.position.set(x, 0.48, z);
  m.rotation.y = rotY;
  m.castShadow = true;
  stadium.add(m);
  ads.push({ tex: t, mat: m.material[4] });
}
adBoard(104, 0, -37.2, 0);
adBoard(40, -32, 37.2, Math.PI);
adBoard(40, 32, 37.2, Math.PI);
adBoard(26, -57.6, -17, Math.PI / 2);
adBoard(26, -57.6, 17, Math.PI / 2);
adBoard(26, 57.6, -17, -Math.PI / 2);
adBoard(26, 57.6, 17, -Math.PI / 2);

/* Tunnel des vestiaires + bancs */
const darkMat = new THREE.MeshStandardMaterial({ color: col("#121815"), roughness: 0.6 });
const tunnel = new THREE.Group();
const tBox = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 3.2), darkMat);
tBox.position.set(0, 1.5, 0);
tunnel.add(tBox);
const tMouth = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.4), new THREE.MeshBasicMaterial({ color: col("#020403") }));
tMouth.position.set(0, 1.2, -1.61);
tMouth.rotation.y = Math.PI;
tunnel.add(tMouth);
const tFrameMat = new THREE.MeshBasicMaterial({ color: col("#d4ff3a") });
const tFrame = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.16, 0.1), tFrameMat);
tFrame.position.set(0, 2.55, -1.66);
tunnel.add(tFrame);
tunnel.position.set(0, 0, B0 - 0.6);
tunnel.castShadow = true;
stadium.add(tunnel);

const benchGlass = new THREE.MeshStandardMaterial({ color: col("#cfe8ff"), transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.2 });
function dugout(x) {
  const g = new THREE.Group();
  const back = new THREE.Mesh(new THREE.BoxGeometry(8, 1.9, 0.2), darkMat); back.position.set(0, 0.95, 1.1); g.add(back);
  const seats = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.5, 0.7), new THREE.MeshStandardMaterial({ color: col("#2a7a48") })); seats.position.set(0, 0.45, 0.6); g.add(seats);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 8, 24, 1, true, Math.PI, Math.PI), benchGlass);
  top.rotation.z = Math.PI / 2; top.rotation.x = 0; top.position.set(0, 0.9, 0.6); top.scale.set(1, 1, 0.9); g.add(top);
  g.position.set(x, 0, 41.2);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  stadium.add(g);
}
dugout(-11);
dugout(11);

/* Écran géant derrière le but ouest */
const screenCanvas = document.createElement("canvas");
screenCanvas.width = 1024; screenCanvas.height = 440;
const screenTex = new THREE.CanvasTexture(screenCanvas);
screenTex.colorSpace = THREE.SRGBColorSpace;
function drawScreen(home, away, label, hot = false) {
  const g = screenCanvas.getContext("2d");
  const W = 1024, H = 440;
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, hot ? "#d4ff3a" : "#0c1f14"); grd.addColorStop(1, hot ? "#8fc21a" : "#05110a");
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  g.fillStyle = hot ? "#07140c" : "#ffffff";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.font = '800 92px "Barlow Condensed", "Arial Narrow", sans-serif';
  g.fillText("YALLA", W * 0.22, H * 0.36);
  g.fillText("VISITEURS", W * 0.78, H * 0.36);
  g.font = '800 170px "Barlow Condensed", "Arial Narrow", sans-serif';
  g.fillStyle = hot ? "#07140c" : "#d4ff3a";
  g.fillText(`${home} - ${away}`, W * 0.5, H * 0.38);
  g.font = '800 70px "Barlow Condensed", "Arial Narrow", sans-serif';
  g.fillStyle = hot ? "#07140c" : "rgba(255,255,255,.8)";
  g.fillText(label, W * 0.5, H * 0.78);
  g.fillStyle = "rgba(0,0,0,.22)";
  for (let y = 0; y < H; y += 5) g.fillRect(0, y, W, 2);
  screenTex.needsUpdate = true;
}
const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });
const screen = new THREE.Group();
const screenFace = new THREE.Mesh(new THREE.PlaneGeometry(24, 10.3), screenMat);
screen.add(screenFace);
const screenBack = new THREE.Mesh(new THREE.BoxGeometry(25, 11.2, 0.8), darkMat);
screenBack.position.z = -0.45;
screen.add(screenBack);
screen.position.set(-(A0 + 21), 29.5, 0);
screen.rotation.y = Math.PI / 2;
screen.rotation.x = 0;
stadium.add(screen);

/* -----------------------------------------------------------------------------
   Public : un supporter par siège (silhouettes tête + épaules en shader)
----------------------------------------------------------------------------- */
const crowd = (() => {
  const P = [], C = [], K = [], SEED = [], ANG = [];
  const shirts = [["#c8102e", 46], ["#e01b2f", 12], ["#ffffff", 10], ["#111111", 12], ["#2b3440", 8], ["#7a0c19", 6], ["#f2c230", 2], ["#1f2a52", 4]];
  const total = shirts.reduce((a, s) => a + s[1], 0);
  const pick = () => { let r = Math.random() * total; for (const [c, w] of shirts) { if ((r -= w) <= 0) return col(c); } return col("#c8102e"); };
  const skins = ["#f1c9a5", "#e0ac7e", "#c68863", "#8d5a3b", "#5c3a24"].map(col);
  const hairs = ["#1b1410", "#3b2a1e", "#6b4a2b", "#b08850", "#2a2a2a"].map(col);
  const awayShirt = ["#ffffff", "#1f3b8a", "#ffffff", "#9fb8e8"].map(col);
  const step = isTouch ? 0.72 : 0.52;
  for (const [tier, T] of [[1, LOWER], [2, UPPER]]) {
    for (let i = 0; i < T.rows; i++) {
      const d = T.d0 + i * T.tread + T.tread * 0.45, h = T.h0 + (i + 1) * T.riser;
      const rowF = (i + 0.5) / T.rows;
      for (const { p } of arcSamples(d, h, step, 6000)) {
        const [x, y, z] = p;
        if (tier === 1 && z > 0 && Math.abs(x) < 5 && i < 9) continue; // tunnel
        if (letterMask(x, z, tier, rowF) > 0.3) continue; // lettres blanches visibles
        P.push(x, y + 0.62, z);
        const a = Math.atan2(z, x);
        const away = Math.abs(a) < 0.2 && tier === 2;
        const sc = away ? awayShirt[(Math.random() * awayShirt.length) | 0] : pick();
        const f = 0.8 + Math.random() * 0.35;
        C.push(sc.r * f, sc.g * f, sc.b * f);
        const sk = skins[(Math.random() * skins.length) | 0], hr = hairs[(Math.random() * hairs.length) | 0];
        K.push(sk.r, sk.g, sk.b, hr.r, hr.g, hr.b);
        SEED.push(Math.random());
        ANG.push(a);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("aColor", new THREE.Float32BufferAttribute(C, 3));
  const skinArr = new Float32Array(SEED.length * 3), hairArr = new Float32Array(SEED.length * 3);
  for (let i = 0; i < SEED.length; i++) { skinArr.set(K.slice(i * 6, i * 6 + 3), i * 3); hairArr.set(K.slice(i * 6 + 3, i * 6 + 6), i * 3); }
  g.setAttribute("aSkin", new THREE.BufferAttribute(skinArr, 3));
  g.setAttribute("aHair", new THREE.BufferAttribute(hairArr, 3));
  g.setAttribute("aSeed", new THREE.Float32BufferAttribute(SEED, 1));
  g.setAttribute("aAng", new THREE.Float32BufferAttribute(ANG, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime, uNight: U.uNight, uFlood: U.uFlood,
      uScale: { value: 500 }, uSize: { value: 0.66 }, uFill: { value: 0.3 }, uWave: { value: 0 }, uCheer: { value: 0 },
    },
    vertexShader: /* glsl */`
      attribute vec3 aColor, aSkin, aHair; attribute float aSeed, aAng;
      uniform float uTime, uScale, uSize, uFill, uWave, uCheer, uNight, uFlood;
      varying vec3 vCol, vSkin, vHair; varying float vFlash, vArms;
      void main() {
        vec3 p = position;
        float vis = step(aSeed, uFill);
        float w = smoothstep(.72, 1., sin(aAng * 2. - uTime * 1.7)) * uWave;
        float jump = abs(sin(uTime * 8. + aSeed * 40.)) * uCheer;
        float stand = max(w, uCheer * step(.25, aSeed));
        p.y += stand * .35 + jump * .35 + w * .3;
        vArms = max(w, jump * step(.5, aSeed));
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = min(vis * uSize * uScale / -mv.z, 26.);
        float fl = fract(sin(aSeed * 912.3 + floor(uTime * 2.2 + aSeed * 7.)) * 43758.5);
        vFlash = step(.9993, fl) * uNight;
        vec3 dusk = vec3(1., .88, .78);
        float L = .1 + .55 * uFlood;
        vec3 light = mix(dusk, vec3(L), uNight);
        vCol = aColor * light; vSkin = aSkin * light; vHair = aHair * light;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vCol, vSkin, vHair; varying float vFlash, vArms;
      void main() {
        vec2 c = gl_PointCoord - .5; c.y = -c.y;
        float head = length((c - vec2(0., .2)) / vec2(.15, .17));
        float body = length((c - vec2(0., -.26)) / vec2(.34, .3));
        float arms = vArms > .5 ? max(step(abs(abs(c.x) - .3), .055) * step(-.1, c.y) * step(c.y, .48), 0.) : 0.;
        if (head > 1. && body > 1. && arms < .5) discard;
        vec3 colr = vCol;
        if (head <= 1.) colr = c.y > .27 ? vHair : vSkin;
        else if (arms > .5 && body > 1.) colr = vCol * .9;
        colr *= .82 + .3 * (c.y + .5);
        colr = mix(colr, vec3(5.), vFlash * step(head, 1.));
        gl_FragColor = vec4(colr, 1.);
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  stadium.add(pts);
  return { mat, count: SEED.length };
})();
/* -----------------------------------------------------------------------------
   Ville autour du stade (fenêtres allumées la nuit)
----------------------------------------------------------------------------- */
{
  const N = 320;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uNight: U.uNight, uFogDusk: { value: FOG_DUSK }, uFogNight: { value: FOG_NIGHT } },
    vertexShader: /* glsl */`
      varying vec3 vW; varying vec3 vN; varying float vDist;
      void main() {
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.);
        vW = w.xyz; vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vec4 mv = viewMatrix * w; vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      ${GLSL_COMMON}
      uniform float uNight; uniform vec3 uFogDusk, uFogNight;
      varying vec3 vW; varying vec3 vN; varying float vDist;
      void main() {
        vec3 n = normalize(vN);
        float side = abs(n.y) < .5 ? 1. : 0.;
        float coord = abs(n.x) > .5 ? vW.z : vW.x;
        vec2 cell = vec2(floor(coord / 2.6), floor(vW.y / 3.4));
        vec2 f = vec2(fract(coord / 2.6), fract(vW.y / 3.4));
        float win = step(.25, f.x) * step(f.x, .75) * step(.3, f.y) * step(f.y, .78) * side;
        float lit = step(.55, hash12(cell + floor(vW.xz / 50.) * 7.));
        vec3 duskC = mix(s2l(vec3(.20, .20, .28)), s2l(vec3(.45, .34, .34)), clamp(dot(n, normalize(vec3(-.8, .3, .5))), 0., 1.) * .7);
        vec3 nightC = s2l(vec3(.05, .07, .11));
        vec3 c = mix(duskC, nightC, uNight);
        c += win * lit * s2l(vec3(1., .78, .45)) * mix(.15, 1.3, uNight);
        float fog = smoothstep(200., 1000., vDist);
        c = mix(c, mix(uFogDusk, uFogNight, uNight), fog * mix(.55, .8, uNight));
        gl_FragColor = vec4(c, 1.);
      }`,
  });
  const city = new THREE.InstancedMesh(geo, mat, N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 360 + Math.pow(Math.random(), 0.7) * 620;
    const h = 8 + Math.pow(Math.random(), 2.4) * 70 * (r > 600 ? 1.4 : 1);
    p.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.round(a / (Math.PI / 2)) * (Math.PI / 2) + (Math.random() - 0.5) * 0.3);
    s.set(12 + Math.random() * 26, h, 12 + Math.random() * 26);
    m.compose(p, q, s);
    city.setMatrixAt(i, m);
  }
  scene.add(city);
}

/* Parc arboré autour du stade */
{
  const N = 520;
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 4, 6); trunkGeo.translate(0, 2, 0);
  const crownGeo = new THREE.IcosahedronGeometry(3.6, 1); crownGeo.translate(0, 6.6, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: col("#5b4632"), roughness: 1 }), N);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const greens = ["#2f6b34", "#3d7f3a", "#4f8f3c", "#295a30", "#6b9a3f"].map(col);
  let n = 0;
  while (n < N) {
    const a = Math.random() * Math.PI * 2;
    const r = 1 + Math.random() * 1.15;
    const x = Math.cos(a) * 160 * r * 1.15, z = Math.sin(a) * 135 * r;
    if (Math.abs(x) < 30 && z > 0) continue; // allée principale
    p.set(x, 0, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28);
    const k = 0.7 + Math.random() * 0.8;
    sc.set(k, k * (0.9 + Math.random() * 0.4), k);
    m.compose(p, q, sc);
    trunks.setMatrixAt(n, m); crowns.setMatrixAt(n, m);
    crowns.setColorAt(n, greens[(Math.random() * greens.length) | 0]);
    n++;
  }
  trunks.castShadow = crowns.castShadow = true;
  crowns.receiveShadow = true;
  scene.add(trunks, crowns);
}

/* -----------------------------------------------------------------------------
   Buts + filets déformables
----------------------------------------------------------------------------- */
const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, emissive: col("#ffffff"), emissiveIntensity: 0.05 });
const nets = [];
function makeGoal(side) {
  const g = new THREE.Group();
  g.position.x = side * 52.5;
  const up = new THREE.CylinderGeometry(0.06, 0.06, 2.44, 12);
  for (const z of [-3.66, 3.66]) { const p = new THREE.Mesh(up, postMat); p.position.set(0, 1.22, z); p.castShadow = true; g.add(p); }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7.44, 12), postMat);
  bar.rotation.x = Math.PI / 2; bar.position.y = 2.44; bar.castShadow = true;
  g.add(bar);
  // filet
  const segs = [];
  const surf = (fn, nu, nv) => {
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
      const p = fn(i / nu, j / nv);
      if (i < nu) segs.push(...p, ...fn((i + 1) / nu, j / nv));
      if (j < nv) segs.push(...p, ...fn(i / nu, (j + 1) / nv));
    }
  };
  const D = 2.0;
  surf((u, v) => [side * D, v * 1.9, -3.66 + u * 7.32], 30, 8);
  surf((u, v) => [side * v * D, 2.44 - v * 0.54, -3.66 + u * 7.32], 30, 8);
  for (const z of [-3.66, 3.66]) surf((u, v) => [side * u * D, v * (2.44 - u * 0.54), z], 8, 9);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(segs, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uImpact: { value: new THREE.Vector3(side * 2, 1.6, 2.9) }, uAmt: { value: 0 }, uTime: U.uTime, uSide: { value: side }, uLight: { value: 1 } },
    vertexShader: /* glsl */`
      uniform vec3 uImpact; uniform float uAmt, uTime, uSide;
      void main() {
        vec3 p = position;
        vec3 d = p - uImpact; d.x *= .6;
        float k = exp(-dot(d, d) / 1.6) * uAmt;
        float depth = abs(p.x) / 2.;
        p.x += uSide * k * (0.9 + .1 * sin(uTime * 26.)) * (.3 + depth);
        p.y -= k * .15;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
      }`,
    fragmentShader: /* glsl */`
      uniform float uLight;
      void main() { gl_FragColor = vec4(vec3(.95) * uLight, .55); }`,
  });
  const net = new THREE.LineSegments(geo, mat);
  g.add(net);
  stadium.add(g);
  nets.push(mat);
  return g;
}
makeGoal(-1);
makeGoal(1);

/* -----------------------------------------------------------------------------
   Ballon (motif icosaèdre tronqué en shader)
----------------------------------------------------------------------------- */
const BALL_R = 0.17;
const ballCenters = (() => {
  const phi = (1 + Math.sqrt(5)) / 2, ip = 1 / phi, out = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    out.push([0, a, b * phi], [a, b * phi, 0], [b * phi, 0, a]);
  }
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) out.push([a, b, c]);
  for (const a of [-1, 1]) for (const b of [-1, 1]) out.push([0, a * ip, b * phi], [a * ip, b * phi, 0], [b * phi, 0, a * ip]);
  return out.map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());
})();
const ballMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0 });
ballMat.onBeforeCompile = (sh) => {
  sh.uniforms.uC = { value: ballCenters };
  sh.vertexShader = "varying vec3 vObj;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;");
  sh.fragmentShader = "varying vec3 vObj;\nuniform vec3 uC[32];\n" + sh.fragmentShader.replace("#include <color_fragment>", /* glsl */`
    #include <color_fragment>
    vec3 n = normalize(vObj);
    float b1 = -2., b2 = -2.; int bi = 0;
    for (int i = 0; i < 32; i++) {
      float d = dot(n, uC[i]);
      if (d > b1) { b2 = b1; b1 = d; bi = i; } else if (d > b2) { b2 = d; }
    }
    float seam = 1. - smoothstep(0., .02, b1 - b2);
    vec3 c = bi < 12 ? vec3(.012, .014, .02) : vec3(.95);
    if (bi < 12 && b1 < .955) c = mix(vec3(.62, .9, .05), c, .35);
    c *= 1. - .55 * seam;
    diffuseColor.rgb = c;`);
};
const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 48, 32), ballMat);
ball.castShadow = true;
ball.position.set(0, BALL_R, 0);
stadium.add(ball);

/* -----------------------------------------------------------------------------
   Joueurs (silhouettes stylisées) + formations
----------------------------------------------------------------------------- */
/* Joueurs : modèle 3D animé (attente / course), maillots peints en shader */
const playerGLTF = await new GLTFLoader().loadAsync(new URL("../stade/joueur.glb", import.meta.url).href, (e) => {
  if (e.total) setLoad(40 + Math.round((e.loaded / e.total) * 30));
});
const clips = Object.fromEntries(playerGLTF.animations.map((a) => [a.name, a]));
const KITS = {
  home: { shirt: "#d0182b", shorts: "#ffffff", socks: "#121212", boots: "#151515" },
  homeGK: { shirt: "#1f9d55", shorts: "#111111", socks: "#1f9d55", boots: "#151515" },
  away: { shirt: "#f3f3f3", shorts: "#1c2f6b", socks: "#f3f3f3", boots: "#eeeeee" },
  awayGK: { shirt: "#f2c230", shorts: "#222222", socks: "#f2c230", boots: "#151515" },
};
const SKINS = ["#f0c7a2", "#d9a47a", "#b87a55", "#8a5636", "#5e3a24"];
const HAIRS = ["#1a1410", "#2e2119", "#5b3d22", "#a5804d", "#0e0e0e"];
function kitMaterial(k) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.02 });
  m.customProgramCacheKey = () => "kit";
  m.onBeforeCompile = (sh) => {
    for (const key of ["shirt", "shorts", "socks", "boots", "skin", "hair"]) sh.uniforms["u_" + key] = { value: col(k[key]) };
    sh.vertexShader = "varying vec3 vKit;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvKit = position;");
    sh.fragmentShader = "varying vec3 vKit;\nuniform vec3 u_shirt, u_shorts, u_socks, u_boots, u_skin, u_hair;\n" + sh.fragmentShader.replace(
      "#include <color_fragment>", /* glsl */`#include <color_fragment>
      float y = vKit.y, ax = abs(vKit.x);
      vec3 c = u_shirt;
      if (y < .075) c = u_boots;
      else if (y < .47) c = u_socks;
      else if (y < .82) c = u_skin;
      else if (y < 1.) c = u_shorts;
      else if (y > 1.55) c = y > 1.7 && vKit.z < .08 ? u_hair : u_skin;
      else if (ax > .39) c = u_skin;
      else if (y > 1.47 && ax < .07 && vKit.z > 0.) c = u_shorts;
      diffuseColor.rgb = c;`);
  };
  return m;
}
const ringGeo = new THREE.RingGeometry(0.62, 0.82, 40);
const ringMats = {
  home: new THREE.MeshBasicMaterial({ color: col("#ff3b4e"), transparent: true, opacity: 0, depthWrite: false }),
  away: new THREE.MeshBasicMaterial({ color: col("#9fb8ff"), transparent: true, opacity: 0, depthWrite: false }),
};
function makePlayer(team, gk) {
  const outer = new THREE.Group();
  const inner = new THREE.Group();
  outer.add(inner);
  const rig = SkeletonUtils.clone(playerGLTF.scene);
  inner.add(rig);
  const k = { ...KITS[team + (gk ? "GK" : "")], skin: SKINS[(Math.random() * SKINS.length) | 0], hair: HAIRS[(Math.random() * HAIRS.length) | 0] };
  const mat = kitMaterial(k);
  let upLegR = null, legR = null;
  rig.traverse((o) => {
    if (o.isMesh) { o.material = mat; o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; }
    if (o.isBone && o.name.endsWith("RightUpLeg")) upLegR = o;
    if (o.isBone && o.name.endsWith("RightLeg")) legR = o;
  });
  const mixer = new THREE.AnimationMixer(rig);
  const idle = mixer.clipAction(clips.idle), run = mixer.clipAction(clips.run);
  idle.play(); run.play();
  run.setEffectiveWeight(0);
  idle.time = Math.random() * clips.idle.duration;
  run.time = Math.random() * clips.run.duration;
  const ring = new THREE.Mesh(ringGeo, ringMats[team]);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  ring.renderOrder = 2;
  outer.add(ring);
  stadium.add(outer);
  return { outer, inner, rig, mixer, idle, run, upLegR, legR, ring, team, gk, last: new THREE.Vector3(), speed: 0, heading: team === "home" ? Math.PI / 2 : -Math.PI / 2 };
}
const homeTeam = Array.from({ length: 11 }, (_, i) => makePlayer("home", i === 0));
const awayTeam = Array.from({ length: 11 }, (_, i) => makePlayer("away", i === 0));
const allPlayers = [...homeTeam, ...awayTeam];

const FORMATIONS = {
  433: { pts: [[-.94, 0], [-.7, -.75], [-.74, -.27], [-.74, .27], [-.7, .75], [-.45, -.45], [-.52, 0], [-.45, .45], [-.16, -.7], [-.1, 0], [-.16, .7]], lines: [[1, 2, 3, 4], [5, 6, 7], [8, 9, 10]],
    note: "Le 4-3-3 : largeur sur les ailes et pressing haut." },
  442: { pts: [[-.94, 0], [-.7, -.75], [-.74, -.27], [-.74, .27], [-.7, .75], [-.42, -.8], [-.47, -.26], [-.47, .26], [-.42, .8], [-.14, -.22], [-.14, .22]], lines: [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10]],
    note: "Le 4-4-2 : deux lignes de quatre compactes et deux attaquants pour presser." },
  352: { pts: [[-.94, 0], [-.72, -.45], [-.76, 0], [-.72, .45], [-.4, -.88], [-.5, -.32], [-.58, 0], [-.5, .32], [-.4, .88], [-.14, -.22], [-.14, .22]], lines: [[1, 2, 3], [4, 5, 6, 7, 8], [9, 10]],
    note: "Le 3-5-2 : trois centraux solides et des pistons qui couvrent tout le couloir." },
  4231: { pts: [[-.94, 0], [-.7, -.75], [-.74, -.27], [-.74, .27], [-.7, .75], [-.55, -.22], [-.55, .22], [-.32, -.66], [-.3, 0], [-.32, .66], [-.1, 0]], lines: [[1, 2, 3, 4], [5, 6], [7, 8, 9], [10]],
    note: "Le 4-2-3-1 : double pivot pour l'équilibre, un meneur libre derrière l'avant-centre." },
};
let formation = "433";
const toPitch = ([x, z], mirror = false) => new THREE.Vector3((mirror ? -x : x) * 50, 0, z * 30);

/* Coup franc : positions */
const FK_BALL = new THREE.Vector3(27.5, BALL_R, -8);
const FK_TARGET = new THREE.Vector3(52.6, 2.05, 2.9);
const FK_CTRL = new THREE.Vector3(41, 5.6, -13);
const fkDir = new THREE.Vector3(FK_TARGET.x - FK_BALL.x, 0, FK_TARGET.z - FK_BALL.z).normalize();
const fkPerp = new THREE.Vector3(-fkDir.z, 0, fkDir.x);
const wallCenter = FK_BALL.clone().add(new THREE.Vector3(25, 0, 8).normalize().multiplyScalar(9.15));
function layout(name) {
  const H = [], A = [];
  if (name === "freekick") {
    H.push(new THREE.Vector3(-46, 0, 0));
    H.push(FK_BALL.clone().addScaledVector(fkDir, -0.9).setY(0)); // tireur
    const homeSpots = [[44, -6], [45.5, 2], [46, 6.5], [43, 9], [47.5, -2], [41, -1], [30, 8], [20, 12], [12, -14]];
    homeSpots.forEach(([x, z]) => H.push(new THREE.Vector3(x, 0, z)));
    A.push(new THREE.Vector3(52.0, 0, 0.4));
    [-1.2, -0.4, 0.4, 1.2].forEach((o) => A.push(wallCenter.clone().addScaledVector(fkPerp, o).setY(0)));
    const awaySpots = [[45, -4.5], [46.5, 3.2], [47, 7.5], [44, 10], [48.2, -0.6], [36, 12]];
    awaySpots.forEach(([x, z]) => A.push(new THREE.Vector3(x, 0, z)));
  } else {
    const f = name === "tactic" ? FORMATIONS[formation] : FORMATIONS["433"];
    f.pts.forEach((p) => H.push(toPitch(p)));
    FORMATIONS["442"].pts.forEach((p) => A.push(toPitch(p, true)));
  }
  return { H, A };
}
let currentLayout = "";
function applyLayout(name, instant = false) {
  if (name === currentLayout && name !== "tactic") return;
  currentLayout = name;
  const { H, A } = layout(name);
  const go = (pl, v, i) => {
    if (instant) { pl.outer.position.copy(v); return; }
    gsap.to(pl.outer.position, { x: v.x, z: v.z, duration: 1.5 + Math.random() * 0.5, ease: "power2.inOut", delay: i * 0.025, overwrite: true });
  };
  homeTeam.forEach((p, i) => go(p, H[i], i));
  awayTeam.forEach((p, i) => go(p, A[i], i));
}
applyLayout("kickoff", true);

/* Lignes tactiques */
const tacticGeo = new THREE.BufferGeometry();
const tacticPos = new Float32Array(40 * 6);
tacticGeo.setAttribute("position", new THREE.BufferAttribute(tacticPos, 3));
const tacticMat = new THREE.LineBasicMaterial({ color: col("#d4ff3a"), transparent: true, opacity: 0, depthWrite: false });
const tacticLines = new THREE.LineSegments(tacticGeo, tacticMat);
tacticLines.frustumCulled = false;
stadium.add(tacticLines);
function updateTacticLines() {
  const f = FORMATIONS[formation];
  let k = 0;
  const put = (a, b) => {
    const pa = homeTeam[a].outer.position, pb = homeTeam[b].outer.position;
    tacticPos.set([pa.x, 0.12, pa.z, pb.x, 0.12, pb.z], k * 6); k++;
  };
  f.lines.forEach((ln) => {
    const sorted = [...ln].sort((a, b) => homeTeam[a].outer.position.z - homeTeam[b].outer.position.z);
    for (let i = 0; i < sorted.length - 1; i++) put(sorted[i], sorted[i + 1]);
  });
  for (let i = 0; i < f.lines.length - 1; i++) {
    const a = f.lines[i], b = f.lines[i + 1];
    a.forEach((ia) => {
      let best = b[0], bd = 1e9;
      b.forEach((ib) => { const d = homeTeam[ia].outer.position.distanceToSquared(homeTeam[ib].outer.position); if (d < bd) { bd = d; best = ib; } });
      put(ia, best);
    });
  }
  tacticGeo.setDrawRange(0, k * 2);
  tacticGeo.attributes.position.needsUpdate = true;
}

/* -----------------------------------------------------------------------------
   Confettis
----------------------------------------------------------------------------- */
const confetti = (() => {
  const N = 1400;
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), colr = new Float32Array(N * 3), life = new Float32Array(N);
  const palette = ["#d4ff3a", "#ffffff", "#2f9a55", "#facc15"].map(col);
  for (let i = 0; i < N; i++) { const c = palette[i % 4]; colr.set([c.r * 1.6, c.g * 1.6, c.b * 1.6], i * 3); pos[i * 3 + 1] = -100; }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aColor", new THREE.BufferAttribute(colr, 3));
  g.setAttribute("aLife", new THREE.BufferAttribute(life, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uScale: crowd.mat.uniforms.uScale, uTime: U.uTime },
    vertexShader: /* glsl */`
      attribute vec3 aColor; attribute float aLife; uniform float uScale, uTime; varying vec3 vC; varying float vL;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.);
        gl_Position = projectionMatrix * mv;
        float flip = abs(sin(uTime * 9. + position.x * 3.));
        gl_PointSize = min(.35 * uScale / -mv.z, 18.) * (.35 + .65 * flip) * step(.001, aLife);
        vC = aColor; vL = aLife;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vC; varying float vL;
      void main() { vec2 c = abs(gl_PointCoord - .5); if (max(c.x, c.y * 1.6) > .5) discard; gl_FragColor = vec4(vC, clamp(vL, 0., 1.)); }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  let active = false;
  return {
    burst() {
      for (let i = 0; i < N; i++) {
        const sideZ = (Math.random() - 0.5) * 70;
        pos.set([62 + Math.random() * 18, 6 + Math.random() * 16, sideZ], i * 3);
        vel.set([-(4 + Math.random() * 9), 8 + Math.random() * 12, (Math.random() - 0.5) * 8], i * 3);
        life[i] = 3 + Math.random() * 2.5;
      }
      active = true;
    },
    update(dt) {
      if (!active) return;
      let alive = 0;
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) continue;
        alive++;
        life[i] -= dt;
        vel[i * 3 + 1] -= 9.8 * dt * 0.35;
        for (let k = 0; k < 3; k++) { vel[i * 3 + k] *= 1 - 1.2 * dt; pos[i * 3 + k] += vel[i * 3 + k] * dt; }
        pos[i * 3] += Math.sin(U.uTime.value * 3 + i) * dt * 0.8;
      }
      g.attributes.position.needsUpdate = true;
      g.attributes.aLife.needsUpdate = true;
      if (!alive) active = false;
    },
    reset() { life.fill(0); g.attributes.aLife.needsUpdate = true; active = false; },
  };
})();

/* -----------------------------------------------------------------------------
   Sections, ancres de scroll et caméra
----------------------------------------------------------------------------- */
const sections = $$("main .sec").map((el) => ({ id: el.id, el, top: 0, range: 1 }));
const secById = Object.fromEntries(sections.map((s) => [s.id, s]));
function measure() {
  const vh = innerHeight;
  sections.forEach((s) => {
    const r = s.el.getBoundingClientRect();
    s.top = r.top + scrollY;
    s.range = Math.max(1, s.el.offsetHeight - vh);
  });
  keys.forEach((k) => { const s = secById[k.at[0]]; k.px = s.top + k.at[1] * s.range; });
}
const prog = (id) => { const s = secById[id]; return clamp((scrollY - s.top) / s.range); };

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
let exploreYaw = 0, exploreYawTarget = 0;
const orbit = (extra) => () => {
  const a = -2.25 + exploreYaw + extra;
  return v3(Math.cos(a) * 255, 150, Math.sin(a) * 255);
};
const ballFollowPos = () => ball.position.clone().add(v3(-5.2, 1.1, -3.2));
const ballFollowTgt = () => ball.position.clone().add(v3(9, 0.2, 4));

const keys = [
  { at: ["hero", 0], pos: v3(-45, 105, 215), tgt: v3(-6, 4, 0), shift: 1 },
  { at: ["hero", 1], pos: v3(-80, 70, 150), tgt: v3(-4, 6, 0), shift: 0.75 },
  { at: ["stade", 0.5], pos: v3(-34, 26, 30), tgt: v3(12, 12, -40), shift: 0.6 },
  { at: ["stade", 1], pos: v3(-12, 8, 34), tgt: v3(22, 7, -24), shift: 0.45 },
  { at: ["terrain", 0.5], pos: v3(-6, 1.7, 22), tgt: v3(26, 1.4, -4), shift: -0.5 },
  { at: ["terrain", 1], pos: v3(13, 1.3, -4), tgt: v3(40, 1.4, -6), shift: -0.3 },
  { at: ["but", 0.12], pos: v3(18.5, 2.7, -16.5), tgt: v3(52.5, 1.6, 0), shift: 0.3 },
  { at: ["but", 0.5], pos: ballFollowPos, tgt: ballFollowTgt, shift: 0.15 },
  { at: ["but", 0.8], pos: v3(45.2, 2.4, -7.2), tgt: v3(52.8, 1.9, 2.4), shift: 0 },
  { at: ["but", 1], pos: v3(35, 10, -28), tgt: v3(50, 1.5, 0), shift: 0.3 },
  { at: ["tactique", 0.15], pos: v3(-4, 112, 42), tgt: v3(-4, 0, 3), shift: -0.42 },
  { at: ["tactique", 1], pos: v3(-10, 96, 56), tgt: v3(-10, 0, 4), shift: -0.42 },
  { at: ["explorer", 0.1], pos: orbit(0), tgt: v3(0, 4, 0), shift: 0.32 },
  { at: ["explorer", 1], pos: orbit(0.9), tgt: v3(0, 4, 0), shift: 0.32 },
  { at: ["rejoindre", 1], pos: v3(10, 150, 245), tgt: v3(0, 8, 0), shift: 0 },
];
const ev = (k, f) => (typeof k[f] === "function" ? k[f]() : k[f]);
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return new THREE.Vector3().addScaledVector(p0, -0.5 * t3 + t2 - 0.5 * t)
    .addScaledVector(p1, 1.5 * t3 - 2.5 * t2 + 1)
    .addScaledVector(p2, -1.5 * t3 + 2 * t2 + 0.5 * t)
    .addScaledVector(p3, 0.5 * t3 - 0.5 * t2);
}
function cameraFromScroll(y) {
  let i = 0;
  while (i < keys.length - 2 && y >= keys[i + 1].px) i++;
  const a = keys[i], b = keys[i + 1];
  const t = clamp((y - a.px) / Math.max(1, b.px - a.px));
  const k0 = keys[Math.max(0, i - 1)], k3 = keys[Math.min(keys.length - 1, i + 2)];
  const pos = catmull(ev(k0, "pos"), ev(a, "pos"), ev(b, "pos"), ev(k3, "pos"), t);
  const tgt = catmull(ev(k0, "tgt"), ev(a, "tgt"), ev(b, "tgt"), ev(k3, "tgt"), t);
  const st = t * t * (3 - 2 * t);
  return { pos, tgt, shift: lerp(a.shift, b.shift, st) };
}

/* Visite libre : points d'intérêt */
const SPOTS = [
  { id: "vestiaire", label: "Vestiaire", kicker: "Tunnel des joueurs", p: v3(0, 6, B0 - 1), cam: v3(0, 5, 22), tgt: v3(0, 2, B0),
    desc: "C'est ici que tout commence : composition, causerie, derniers réglages. Votre effectif vous y attend.", cta: true },
  { id: "banc", label: "Banc de touche", kicker: "Zone technique", p: v3(-14, 1.5, 40), cam: v3(-24, 4.5, 27), tgt: v3(-11, 1.2, 41),
    desc: "Le coach, le staff et sept remplaçants prêts à changer le match. Chaque décision se prend à deux mètres de la ligne." },
  { id: "kop", label: "Tribune Nord", kicker: "Trois étages de rouge", p: v3(0, 30, -B0 - 30), cam: v3(0, 8, -6), tgt: v3(0, 20, -B0 - 26),
    desc: "La plus grande tribune du stade, avec le nom du club écrit en sièges blancs. Elle domine la pelouse de plus de 30 mètres." },
  { id: "stretford", label: "Stretford End", kicker: "Tribune ouest", p: v3(-A0 - 30, 24, 8), cam: v3(-20, 7, 4), tgt: v3(-A0 - 24, 16, 0),
    desc: "La tribune derrière le but ouest, celle qui chante le plus fort. C'est vers elle qu'on rêve de marquer." },
  { id: "but", label: "La cage", kicker: "7,32 × 2,44 m", p: v3(52.5, 3.4, 0), cam: v3(37, 3, 7), tgt: v3(52.5, 1.4, 0),
    desc: "Le filet qui tremble, le moment que tout le stade attend. La lucarne droite garde encore la trace du coup franc." },
  { id: "pylone", label: "Rampe de projecteurs", kicker: "2 000 lux", p: pylons[3].headWorld.clone().add(v3(0, -4, 0)), cam: v3(10, 6, 20), tgt: pylons[3].headWorld.clone(),
    desc: "Pas de pylônes : les projecteurs sont alignés sous le bord du toit, tout autour du stade, pour une lumière sans ombre." },
  { id: "ecran", label: "Écran géant", kicker: "24 × 10 m", p: screen.position.clone().add(v3(0, 7, 0)), cam: v3(-40, 18, 18), tgt: screen.position.clone(),
    desc: "Score, ralentis et compte à rebours : visible depuis chaque siège du stade." },
];
const pinsEl = $("#pins");
SPOTS.forEach((s) => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "pin"; b.dataset.spot = s.id;
  b.innerHTML = `<span class="pin-dot"></span><span class="pin-label">${s.label}</span>`;
  b.addEventListener("click", () => focusSpot(s));
  pinsEl.appendChild(b);
  s.el = b;
});
const card = $("#spot-card");
const focus = { amt: 0, pos: new THREE.Vector3(), tgt: new THREE.Vector3(), spot: null };
function focusSpot(s) {
  focus.spot = s;
  focus.pos.copy(s.cam); focus.tgt.copy(s.tgt);
  gsap.to(focus, { amt: 1, duration: 1.8, ease: "power3.inOut", overwrite: true });
  $("#spot-kicker").textContent = s.kicker;
  $("#spot-name").textContent = s.label;
  $("#spot-desc").textContent = s.desc;
  $("#spot-cta").hidden = !s.cta;
  card.hidden = false;
  gsap.fromTo(card, { autoAlpha: 0, x: 40 }, { autoAlpha: 1, x: 0, duration: 0.7, ease: "expo.out", delay: 0.4, overwrite: true });
  SPOTS.forEach((o) => o.el.classList.toggle("is-active", o === s));
}
function unfocus() {
  if (!focus.spot) return;
  focus.spot = null;
  gsap.to(focus, { amt: 0, duration: 1.4, ease: "power3.inOut", overwrite: true });
  gsap.to(card, { autoAlpha: 0, x: 30, duration: 0.35, onComplete: () => { card.hidden = true; } });
  SPOTS.forEach((o) => o.el.classList.remove("is-active"));
}
$("#spot-close").addEventListener("click", unfocus);

/* -----------------------------------------------------------------------------
   Interface : scroll fluide, textes, compteurs, curseur, aimants
----------------------------------------------------------------------------- */
let lenis = null;
if (!reduceMotion && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
$$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
  const t = $(a.getAttribute("href"));
  if (!t) return;
  e.preventDefault();
  unfocus();
  const s = secById[t.id];
  const y = s ? s.top + (t.id === "hero" ? 0 : s.range * 0.35) : t.offsetTop;
  if (lenis) lenis.scrollTo(y, { duration: 2.4, easing: (x) => 1 - Math.pow(1 - x, 4) });
  else window.scrollTo({ top: y, behavior: "smooth" });
}));

/* Découpage des titres */
$$(".hero-title .split").forEach((el) => {
  const html = [];
  el.childNodes.forEach((n) => {
    if (n.nodeType === 3) [...n.textContent].forEach((ch) => html.push(ch === " " ? " " : `<span class="char">${ch}</span>`));
    else { n.classList.add("char"); html.push(n.outerHTML); }
  });
  el.innerHTML = html.join("");
});
$$(".split-words").forEach((el) => {
  el.innerHTML = el.textContent.trim().split(/\s+/).map((w) => `<span class="word"><span>${w}</span></span>`).join(" ");
});

/* Révélations à l'entrée de chaque section */
$$(".sec").forEach((sec) => {
  if (sec.id === "hero") return;
  const words = $$(".word > span", sec);
  const others = $$(".chap, .body, .specs li, .lights, .shot li, .formations, .f-note, .cta-wrap .btn", sec);
  gsap.set(words, { yPercent: 110 });
  gsap.set(others, { autoAlpha: 0, y: 24 });
  ScrollTrigger.create({
    trigger: sec, start: "top 62%", end: "bottom 40%",
    onEnter: () => {
      gsap.to(words, { yPercent: 0, duration: 1.1, ease: "expo.out", stagger: 0.05, overwrite: true });
      gsap.to(others, { autoAlpha: 1, y: 0, duration: 0.9, ease: "expo.out", stagger: 0.06, delay: 0.15, overwrite: true });
      $$("[data-count]", sec).forEach((el) => {
        const end = +el.dataset.count;
        gsap.fromTo({ v: 0 }, { v: 0 }, { v: end, duration: 2, ease: "power3.out", onUpdate() { el.textContent = Math.round(this.targets()[0].v).toLocaleString("fr-FR"); } });
      });
    },
    onEnterBack: () => {
      gsap.to(words, { yPercent: 0, duration: 0.8, ease: "expo.out", stagger: 0.03, overwrite: true });
      gsap.to(others, { autoAlpha: 1, y: 0, duration: 0.6, overwrite: true });
    },
  });
});
/* Le texte du hero s'efface en scrollant */
gsap.to("#hero .sticky", { autoAlpha: 0, y: -80, ease: "none", scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom 60%", scrub: true } });
gsap.to("#scroll-hint", { autoAlpha: 0, scrollTrigger: { trigger: "#hero", start: "top top", end: "20% top", scrub: true } });

/* Curseur personnalisé */
const cursor = $("#cursor");
const cursorLabel = $("#cursor-label");
const mouse = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0 };
if (!isTouch) {
  const qx = gsap.quickTo(cursor, "x", { duration: 0.35, ease: "power3" });
  const qy = gsap.quickTo(cursor, "y", { duration: 0.35, ease: "power3" });
  window.addEventListener("pointermove", (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.nx = e.clientX / innerWidth - 0.5; mouse.ny = e.clientY / innerHeight - 0.5;
    qx(e.clientX); qy(e.clientY);
  });
  document.addEventListener("pointerover", (e) => {
    const t = e.target.closest("a, button, [data-cursor]");
    cursor.classList.toggle("is-hover", !!t);
    const label = t && t.dataset.cursor;
    cursor.classList.toggle("is-label", !!label);
    cursorLabel.textContent = label || "";
  });
  /* Boutons magnétiques */
  $$("[data-magnet]").forEach((el) => {
    const mx = gsap.quickTo(el, "x", { duration: 0.6, ease: "elastic.out(1, .4)" });
    const my = gsap.quickTo(el, "y", { duration: 0.6, ease: "elastic.out(1, .4)" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      mx((e.clientX - r.left - r.width / 2) * 0.3); my((e.clientY - r.top - r.height / 2) * 0.35);
    });
    el.addEventListener("pointerleave", () => { mx(0); my(0); });
  });
}

/* Glisser pour tourner (section Explorer) */
let dragging = false, dragX = 0;
const inExplore = () => { const p = prog("explorer"); return scrollY >= secById.explorer.top - innerHeight * 0.3 && p < 1; };
window.addEventListener("pointerdown", (e) => {
  if (!inExplore() || e.target.closest("a, button, .spot-card, .nav")) return;
  dragging = true; dragX = e.clientX; cursor.classList.add("is-drag");
});
window.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  exploreYawTarget += (e.clientX - dragX) * 0.005;
  dragX = e.clientX;
  if (focus.spot) unfocus();
});
window.addEventListener("pointerup", () => { dragging = false; cursor.classList.remove("is-drag"); });

/* Formations */
const fNote = $("#f-note");
$$(".f-btn").forEach((b) => b.addEventListener("click", () => {
  formation = b.dataset.formation;
  $$(".f-btn").forEach((o) => o.classList.toggle("is-on", o === b));
  gsap.to(fNote, { autoAlpha: 0, y: -6, duration: 0.2, onComplete: () => { fNote.textContent = FORMATIONS[formation].note; gsap.to(fNote, { autoAlpha: 1, y: 0, duration: 0.4 }); } });
  if (currentLayout === "tactic") applyLayout("tactic");
}));

/* Tableau d'affichage */
const board = $(".board");
const boardPhase = $("#board-phase"), boardMin = $("#board-min"), boardProg = $("#board-progress");
const scoreHome = $("#score-home");
let goalScored = false;
function setGoal(on) {
  if (on === goalScored) return;
  goalScored = on;
  scoreHome.textContent = on ? "1" : "0";
  drawScreen(on ? 1 : 0, 0, on ? "BUUUT !" : "89'", on);
  if (on) {
    board.classList.remove("goal"); void board.offsetWidth; board.classList.add("goal");
    confetti.burst();
    gsap.fromTo("#flash", { opacity: 0.85 }, { opacity: 0, duration: 1.4, ease: "power2.out" });
    gsap.to(crowd.mat.uniforms.uCheer, { value: 1, duration: 0.3 });
    gsap.to(crowd.mat.uniforms.uCheer, { value: 0.25, duration: 3, delay: 2.5 });
    gsap.to(screenMat.color, { r: 1.6, g: 1.6, b: 1.6, duration: 0.2, yoyo: true, repeat: 5 });
    const letters = $$("#goal-text span");
    gsap.set("#goal-text", { visibility: "visible" });
    gsap.fromTo(letters, { yPercent: 120, scale: 0.4, rotate: () => gsap.utils.random(-25, 25), autoAlpha: 0 },
      { yPercent: 0, scale: 1, rotate: 0, autoAlpha: 1, duration: 0.8, ease: "back.out(2.2)", stagger: 0.05 });
    gsap.to(letters, { yPercent: -60, autoAlpha: 0, duration: 0.6, ease: "power2.in", stagger: 0.03, delay: 1.9 });
    shake = 1;
  } else {
    confetti.reset();
    gsap.to(crowd.mat.uniforms.uCheer, { value: 0, duration: 0.5 });
    gsap.set("#goal-text span", { autoAlpha: 0 });
  }
}
drawScreen(0, 0, "AVANT-MATCH");

/* Liens de la nav */
const navLinks = $$(".nav-links a");

/* -----------------------------------------------------------------------------
   Boucle principale
----------------------------------------------------------------------------- */
const camPos = camera.position.clone();
const camTgt = new THREE.Vector3(-6, 4, 0);
let viewShift = 1;
let shake = 0;
let intro = reduceMotion || SNAP ? 0 : 1;
let lastSection = "";
let lightsOnUI = -1;
const lightDots = $$("#lights i");
const shotSpeed = $("#shot-speed"), shotSpin = $("#shot-spin"), shotDist = $("#shot-dist");
const tmpV = new THREE.Vector3();
const clock = new THREE.Clock();
let fpsAcc = 0, fpsN = 0, degraded = false;

function ballAt(p) {
  if (p < 0.2) return { pos: FK_BALL.clone(), s: 0 };
  if (p < 0.78) {
    const x = (p - 0.2) / 0.58;
    const s = 1 - Math.pow(1 - x, 1.25);
    const a = (1 - s) * (1 - s), b = 2 * s * (1 - s), c = s * s;
    return { pos: FK_BALL.clone().multiplyScalar(a).addScaledVector(FK_CTRL, b).addScaledVector(FK_TARGET, c), s: x };
  }
  if (p < 0.9) {
    const k = smooth(0.78, 0.9, p);
    return { pos: v3(lerp(52.6, 54.2, k), lerp(2.05, 1.25, k), lerp(2.9, 3.1, k)), s: 1 };
  }
  const k = (p - 0.9) / 0.1;
  return { pos: v3(54.2 - k * 0.3, BALL_R + 1.08 * Math.abs(Math.cos(k * Math.PI * 1.5)) * (1 - k), 3.1), s: 1 };
}

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = (U.uTime.value += dt);
  const y = scrollY;

  /* Section courante */
  let cur = sections[0];
  for (const s of sections) if (y >= s.top - innerHeight * 0.5) cur = s;
  if (cur.id !== lastSection) {
    lastSection = cur.id;
    boardPhase.textContent = cur.el.dataset.phase;
    navLinks.forEach((a) => a.classList.toggle("is-active", a.dataset.link === cur.id));
    const map = { hero: "kickoff", stade: "kickoff", terrain: "kickoff", but: "freekick", tactique: "tactic", explorer: "kickoff", rejoindre: "kickoff" };
    applyLayout(map[cur.id]);
    if (cur.id !== "explorer") unfocus();
  }
  const total = document.documentElement.scrollHeight - innerHeight;
  boardProg.style.width = (clamp(y / total) * 100).toFixed(1) + "%";

  /* Jour -> nuit, projecteurs, public */
  const pStade = prog("stade");
  const pastStade = y > secById.stade.top + secById.stade.range;
  const night = pastStade ? 1 : smooth(0.05, 0.72, pStade);
  U.uNight.value = night;
  let floodSum = 0, nOn = 0;
  pylons.forEach((pl, i) => {
    const on = pastStade ? 1 : smooth(0.3 + i * 0.09, 0.34 + i * 0.09, pStade);
    if (on > 0.5) nOn++;
    const flick = on > 0 && on < 1 ? (Math.sin(t * 70 + i) > 0 ? 1 : 0.35) : 1;
    const v = on * flick;
    pl.lampMat.color.setScalar(0.18 + v * 5);
    pl.beamMat.uniforms.uOn.value = v * (0.35 + 0.65 * night);
    floodSum += v;
  });
  const floodAmt = floodSum / 4;
  U.uFlood.value = floodAmt;
  if (nOn !== lightsOnUI) { lightsOnUI = nOn; lightDots.forEach((d, i) => d.classList.toggle("on", i < nOn)); }

  KEY_DIR.copy(U.uSunDir.value).lerp(FLOOD_DIR, smooth(0.3, 0.8, night)).normalize();
  sun.position.copy(KEY_DIR).multiplyScalar(260);
  sun.intensity = lerp(3.0, 0.35 + floodAmt * 2.1, smooth(0.2, 0.8, night));
  sun.color.lerpColors(SUN_C, FLOOD_C, smooth(0.3, 0.8, night));
  scene.environmentIntensity = lerp(0.55, 0.12 + floodAmt * 0.15, night);
  hemi.intensity = lerp(1.3, 0.3 + floodAmt * 0.4, night);
  hemi.color.lerpColors(col("#ffd9b8"), col("#9fb4d8"), night);
  flood.intensity = floodAmt * 1.9;
  flood2.intensity = floodAmt * 0.8;
  scene.fog.color.lerpColors(FOG_DUSK, FOG_NIGHT, night);
  renderer.toneMappingExposure = lerp(1.0, 1.08, night);
  bloom.strength = lerp(0.25, 0.6, night);
  const dimOut = lerp(1, 0.32, night);
  roofMat.color.copy(ROOF_C).multiplyScalar(lerp(1, 0.5, night));
  plaza.material.color.copy(PLAZA_C).multiplyScalar(dimOut);
  ground.material.color.copy(GROUND_C).multiplyScalar(lerp(1, 0.5, night));
  standMat.color.setScalar(lerp(1, 0.85, night));
  board.classList.toggle("is-away", cur.id === "rejoindre");
  ribbonMat.color.setScalar(lerp(0.85, 1.25, night));
  ads.forEach((a) => { a.tex.offset.x -= dt * 0.04; a.mat.color.setScalar(lerp(0.9, 1.2, night)); });
  ribbonTex.offset.x += dt * 0.0025;
  tFrameMat.color.copy(col("#d4ff3a")).multiplyScalar(lerp(0.8, 2.2, night));
  nets.forEach((m) => { m.uniforms.uLight.value = lerp(0.85, 1.2, night); });

  const cm = crowd.mat.uniforms;
  cm.uFill.value = y < secById.stade.top ? lerp(0.3, 0.5, prog("hero")) : lerp(0.5, 0.94, smooth(0, 0.6, pStade));
  const waveTarget = (cur.id === "stade" && pStade > 0.75) || cur.id === "explorer" || cur.id === "rejoindre" ? 1 : 0;
  cm.uWave.value = lerp(cm.uWave.value, waveTarget, dt * 1.5);

  /* Ballon + coup franc */
  const pBut = prog("but");
  const inBut = cur.id === "but";
  if (inBut || (cur.id === "terrain" && prog("terrain") > 0.95)) {
    const b = ballAt(pBut);
    const prev = ball.position.clone();
    ball.position.copy(b.pos);
    const moved = prev.distanceTo(ball.position);
    ball.rotation.y += moved * 2.4;
    ball.rotation.z -= moved * 3.2;
    const speed = Math.round(lerp(0, 112, smooth(0.18, 0.25, pBut)) - smooth(0.25, 0.78, pBut) * 22);
    shotSpeed.textContent = Math.max(0, speed);
    shotSpin.textContent = (smooth(0.18, 0.26, pBut) * 9.4).toFixed(1).replace(".", ",");
    const dist = pBut < 0.2 ? 25 : Math.max(0, 25 * (1 - b.s));
    shotDist.textContent = dist.toFixed(1).replace(".", ",");
    nets[1].uniforms.uAmt.value = bump(0.78, 0.88, 1.0, pBut) * 1.0;
    nets[1].uniforms.uImpact.value.set(1.9, 1.5, 3.0);
    if (pBut >= 0.79) setGoal(true);
    else if (pBut < 0.7) setGoal(false);
    boardMin.textContent = goalScored ? "90+2'" : "89'";
    // tireur : course d'élan
    const kicker = homeTeam[1];
    const run = 1 - smooth(0.02, 0.2, pBut);
    kicker.inner.position.set(-fkDir.x * run * 3.5, 0, -fkDir.z * run * 3.5);
    kicker.heading = Math.atan2(fkDir.x, fkDir.z);
    // célébration : il file vers le poteau de corner après le but
    const cel = smooth(0.82, 1, pBut);
    kicker.inner.position.x += (44 - FK_BALL.x) * cel;
    kicker.inner.position.z += (-31 - FK_BALL.z) * cel;
    if (cel > 0.01) kicker.heading = Math.atan2(44 - FK_BALL.x, -31 - FK_BALL.z);
    kicker.forceRun = (run > 0.02 && run < 0.98) || (cel > 0.01 && cel < 0.99) ? 1 : 0;
    kicker.kick = -smooth(0.13, 0.19, pBut) * 0.9 * (1 - smooth(0.19, 0.21, pBut)) + smooth(0.19, 0.22, pBut) * 1.5 * (1 - smooth(0.24, 0.36, pBut));
    // mur qui saute
    const j = Math.sin(Math.PI * smooth(0.3, 0.5, pBut));
    for (let i = 1; i <= 4; i++) awayTeam[i].inner.position.y = j * 0.6;
    // gardien qui plonge
    const dive = smooth(0.56, 0.8, pBut);
    const gk = awayTeam[0].inner;
    gk.position.set(0, Math.sin(Math.PI * Math.min(1, dive * 1.2)) * 0.8, dive * 1.9);
    gk.rotation.set(-dive * 1.25, 0, 0);
  } else {
    if (cur.id !== "but") { ball.position.lerp(v3(0, BALL_R, 0), 1); }
    if (y < secById.but.top) setGoal(false);
    homeTeam[1].inner.position.set(0, 0, 0); homeTeam[1].inner.rotation.set(0, 0, 0);
    homeTeam[1].kick = 0; homeTeam[1].forceRun = 0;
    awayTeam[0].inner.position.set(0, 0, 0); awayTeam[0].inner.rotation.set(0, 0, 0);
    for (let i = 1; i <= 4; i++) awayTeam[i].inner.position.y = 0;
    boardMin.textContent = cur.el.dataset.min.padStart(2, "0") + "'";
    if (goalScored) boardMin.textContent = "90+4'";
  }

  /* Joueurs : animations attente / course + orientation */
  allPlayers.forEach((pl) => {
    const wx = pl.outer.position.x + pl.inner.position.x, wz = pl.outer.position.z + pl.inner.position.z;
    const dx = wx - pl.last.x, dz = wz - pl.last.z;
    const v = Math.hypot(dx, dz) / Math.max(dt, 1e-3);
    pl.last.set(wx, 0, wz);
    pl.speed = lerp(pl.speed, Math.min(v, 9), dt * 5);
    const isKicker = inBut && pl === homeTeam[1];
    if (!isKicker) {
      if (v > 0.5) pl.heading = lerpAngle(pl.heading, Math.atan2(dx, dz), dt * 8);
      else pl.heading = lerpAngle(pl.heading, pl.team === "home" ? Math.PI / 2 : -Math.PI / 2, dt * 2);
    }
    pl.rig.rotation.y = pl.heading;
    const runW = isKicker ? (pl.forceRun || 0) : smooth(0.4, 2.5, pl.speed);
    pl.run.setEffectiveWeight(runW);
    pl.idle.setEffectiveWeight(1 - runW);
    pl.run.timeScale = isKicker ? 1.15 : lerp(0.8, 1.2, clamp(pl.speed / 7));
    pl.mixer.update(dt);
    if (pl.kick && pl.upLegR) { pl.upLegR.rotation.x -= pl.kick; if (pl.legR) pl.legR.rotation.x += Math.max(0, -pl.kick) * 1.2; }
  });

  /* Mode tactique : gros anneaux + lignes */
  const pTac = prog("tactique");
  const tacticOn = cur.id === "tactique" ? smooth(0.0, 0.2, pTac) : 0;
  const ringS = 1 + tacticOn * 2.4;
  allPlayers.forEach((pl) => pl.ring.scale.setScalar(pl.team === "home" ? ringS : 1 + tacticOn * 1.6));
  ringMats.home.opacity = tacticOn * 0.9;
  ringMats.away.opacity = tacticOn * 0.55;
  tacticMat.opacity = lerp(tacticMat.opacity, tacticOn * 0.9, dt * 4);
  if (tacticMat.opacity > 0.01) updateTacticLines();

  /* Visite libre */
  exploreYaw = lerp(exploreYaw, exploreYawTarget, dt * 4);
  const exploreOn = cur.id === "explorer" && prog("explorer") > 0.05 && prog("explorer") < 0.98;
  pinsEl.classList.toggle("is-on", exploreOn);

  /* Caméra */
  const c = cameraFromScroll(y);
  let dPos = c.pos, dTgt = c.tgt;
  if (focus.amt > 0) { dPos = dPos.clone().lerp(focus.pos, focus.amt); dTgt = dTgt.clone().lerp(focus.tgt, focus.amt); }
  // parallaxe souris (plus discrète au ras du sol)
  const height = dPos.y;
  const steep = Math.abs(dTgt.clone().sub(dPos).normalize().y);
  const par = clamp(height / 40, 0.15, 1) * (1 - smooth(0.75, 0.95, steep)) * (reduceMotion ? 0 : 1);
  dPos = dPos.clone().add(v3(mouse.nx * 6 * par, -mouse.ny * 3 * par, 0));
  if (intro > 0) dPos.add(v3(-60 * intro, 140 * intro, 120 * intro));
  const k = SNAP ? 1 : 1 - Math.exp(-dt * (inBut ? 9 : 5));
  camPos.lerp(dPos, k);
  camTgt.lerp(dTgt, k);
  camera.position.copy(camPos);
  if (shake > 0) {
    camera.position.add(v3((Math.random() - 0.5) * shake * 0.25, (Math.random() - 0.5) * shake * 0.2, 0));
    shake = Math.max(0, shake - dt * 1.4);
  }
  camera.lookAt(camTgt);
  const wide = camera.aspect > 1.1;
  viewShift = SNAP ? (wide ? c.shift : 0) : lerp(viewShift, wide ? c.shift : 0, dt * 3);
  const W = innerWidth, Hh = innerHeight;
  camera.setViewOffset(W, Hh, -W * 0.16 * viewShift, 0, W, Hh);

  /* Projection des points d'intérêt */
  if (exploreOn) {
    SPOTS.forEach((s) => {
      tmpV.copy(s.p).project(camera);
      const vis = tmpV.z < 1 && Math.abs(tmpV.x) < 1.1 && Math.abs(tmpV.y) < 1.1;
      const sx = (tmpV.x * 0.5 + 0.5) * W, sy = (-tmpV.y * 0.5 + 0.5) * Hh;
      s.el.style.transform = `translate3d(${sx}px, ${sy}px, 0)`;
      s.el.style.opacity = vis ? 1 : 0;
    });
  } else SPOTS.forEach((s) => { s.el.style.opacity = 0; });

  confetti.update(dt);
  composer.render(dt);

  /* Qualité adaptative */
  if (!degraded && t > 3 && t < 8) {
    fpsAcc += dt; fpsN++;
    if (fpsN > 90 && fpsAcc / fpsN > 1 / 32) {
      degraded = true;
      DPR = 1; renderer.setPixelRatio(DPR); composer.setPixelRatio(DPR); resize();
    }
  }
}

function resize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h;
  camera.fov = camera.aspect < 0.9 ? 62 : 42;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  crowd.mat.uniforms.uScale.value = (h * renderer.getPixelRatio() * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  measure();
}
window.addEventListener("resize", () => { resize(); ScrollTrigger.refresh(); });

/* -----------------------------------------------------------------------------
   Démarrage
----------------------------------------------------------------------------- */
(async function start() {
  setLoad(20);
  await (document.fonts ? document.fonts.ready : Promise.resolve());
  drawScreen(0, 0, "AVANT-MATCH");
  [adTex, ribbonTex].forEach((tx) => { tx.needsUpdate = true; });
  setLoad(45);
  await nextFrame();
  resize();
  renderer.compile(scene, camera);
  setLoad(80);
  await nextFrame();
  frame();
  setLoad(100);
  gsap.ticker.add(frame);
  window.__stade = { camera, scene, prog, secById, measure };

  await new Promise((r) => setTimeout(r, 550));
  document.body.classList.remove("is-loading");
  if (lenis) lenis.start();
  const tl = gsap.timeline();
  tl.to("#loader", { yPercent: -100, duration: 1.1, ease: "expo.inOut" })
    .set("#loader", { display: "none" })
    .to({}, { duration: 0 }, 0);
  if (!reduceMotion) {
    tl.to(window, { duration: 0 }, 0);
    if (!SNAP) gsap.to({ v: 1 }, { v: 0, duration: 3.2, ease: "expo.out", delay: 0.2, onUpdate() { intro = this.targets()[0].v; } });
    tl.from(".hero-title .char", { yPercent: 115, rotate: 8, duration: 1.3, ease: "expo.out", stagger: 0.035 }, 0.55)
      .from(".sec-hero .reveal, .nav > *, .board, .scroll-hint", { autoAlpha: 0, y: 20, duration: 1, ease: "expo.out", stagger: 0.07 }, 0.9);
  }
  ScrollTrigger.refresh();
  measure();
})();
