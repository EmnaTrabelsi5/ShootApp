/* =========================================================
   YALLA • Maillots en 3D (three.js)
   - tringle : chaque maillot est un vrai volume (tissu bombé, plis, manches),
     suspendu à son cintre ; il suit les boutons de la page (glisser, filtres,
     survol, balancement) et pivote de face au survol
   - fiche : le maillot décroché tourne en 3D (dos ↔ face)
   Si WebGL n'est pas disponible, les maillots dessinés (SVG) restent affichés.
   ========================================================= */
import * as THREE from "three";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const gs = window.gsap;
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const FONT = '"Barlow Condensed", "Inter", sans-serif';

/* ---------- Silhouette du maillot (mêmes unités que le SVG : 220 × 300) ---------- */
const Y0 = 30, Y1 = 300; // zone du tissu (le crochet est au-dessus)
const CONTOUR = (() => {
  const p = [[82, 36]];
  const q = (c, f, n) => { const a = p[p.length - 1]; for (let i = 1; i <= n; i++) { const t = i / n, u = (1 - t) ** 2, v = 2 * (1 - t) * t, w = t * t; p.push([u * a[0] + v * c[0] + w * f[0], u * a[1] + v * c[1] + w * f[1]]); } };
  const l = (f, n) => { const a = p[p.length - 1]; for (let i = 1; i <= n; i++) { const t = i / n; p.push([a[0] + (f[0] - a[0]) * t, a[1] + (f[1] - a[1]) * t]); } };
  q([110, 46], [138, 36], 12);          // col (dos)
  l([178, 47], 7);                      // épaule
  q([195, 68], [208, 103], 9);          // manche, bord extérieur
  l([186, 118], 5);                     // bas de manche
  l([166, 92], 6);                      // dessous de bras
  q([160, 190], [169, 287], 16);        // flanc
  q([110, 298], [51, 287], 16);         // bas du maillot
  q([60, 190], [54, 92], 16);           // flanc
  l([34, 118], 6);
  l([12, 103], 5);
  q([25, 68], [42, 47], 9);
  l([82, 36], 7);
  p.pop();
  return p;
})();

const dedans = (x, y) => {
  let c = false;
  for (let i = 0, j = CONTOUR.length - 1; i < CONTOUR.length; j = i++) {
    const [xi, yi] = CONTOUR[i], [xj, yj] = CONTOUR[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const plusProche = (x, y) => {
  let best = Infinity, bx = 0, by = 0;
  for (let i = 0, j = CONTOUR.length - 1; i < CONTOUR.length; j = i++) {
    const [ax, ay] = CONTOUR[j], [cx, cy] = CONTOUR[i];
    const dx = cx - ax, dy = cy - ay;
    let t = ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1);
    t = Math.max(0, Math.min(1, t));
    const px = ax + dx * t, py = ay + dy * t, d = (x - px) ** 2 + (y - py) ** 2;
    if (d < best) { best = d; bx = px; by = py; }
  }
  return [Math.sqrt(best), bx, by];
};

/* Grille calée sur la silhouette : les points extérieurs sont ramenés sur le bord */
const GRILLE = (() => {
  const NX = 66, NY = 88, n = (NX + 1) * (NY + 1);
  const sx = new Float32Array(n), sy = new Float32Array(n), d = new Float32Array(n);
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
    const k = j * (NX + 1) + i;
    let x = (220 * i) / NX, y = Y0 + ((Y1 - Y0) * j) / NY;
    const [dist, bx, by] = plusProche(x, y);
    if (dedans(x, y)) d[k] = dist; else { x = bx; y = by; d[k] = 0; }
    sx[k] = x; sy[k] = y;
  }
  const avant = [], arriere = [];
  const garde = (a, b, c) => {
    const cx = (sx[a] + sx[b] + sx[c]) / 3, cy = (sy[a] + sy[b] + sy[c]) / 3;
    const aire = Math.abs((sx[b] - sx[a]) * (sy[c] - sy[a]) - (sx[c] - sx[a]) * (sy[b] - sy[a]));
    return aire > 0.02 && dedans(cx, cy);
  };
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, e = c + 1;
    if (garde(a, c, b)) { avant.push(a, c, b); arriere.push(a, b, c); }
    if (garde(b, c, e)) { avant.push(b, c, e); arriere.push(b, e, c); }
  }
  return { n, sx, sy, d, avant, arriere };
})();

const lisse = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* Une moitié du maillot : cote = +1 (dos, nom et numéro), -1 (devant, écusson) */
function moitie(ph1, ph2, cote) {
  const { n, sx, sy, d } = GRILLE;
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const R = 24;
  for (let k = 0; k < n; k++) {
    const x = sx[k], y = sy[k];
    const prof = Math.sqrt(Math.min(d[k], R) / R);                       // bord fin, centre bombé
    let z = prof * (7 + 7 * (1 - ((x - 110) / 110) ** 2) + 4 * Math.exp(-(((y - 54) / 20) ** 2)));
    const pli = (0.62 * Math.sin(x * 0.072 + ph1) + 0.38 * Math.sin(x * 0.16 + ph2)) * lisse(96, 280, y);
    z += 4.2 * pli * Math.min(d[k] / 12, 1);                             // plis verticaux du tissu
    z += 2.2 * Math.sin(y * 0.05 + ph2) * lisse(60, 150, Math.abs(x - 110) + 40) * Math.min(d[k] / 10, 1) * 0.5;
    pos[k * 3] = x - 110;
    pos[k * 3 + 1] = -(y - 4);
    pos[k * 3 + 2] = z * cote;
    uv[k * 2] = cote > 0 ? x / 220 : 1 - x / 220;
    uv[k * 2 + 1] = 1 - (y - Y0) / (Y1 - Y0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(cote > 0 ? GRILLE.avant : GRILLE.arriere);
  g.computeVertexNormals();
  return g;
}
const VARIANTES = [[0.4, 1.9], [2.2, 0.3], [4.1, 3.3]].map(([a, b]) => ({ dos: moitie(a, b, 1), devant: moitie(a, b, -1) }));

/* Cintre en bois + crochet chromé (le crochet s'enroule autour de la tringle, en y = 0) */
const GEO_CINTRE = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
  new THREE.Vector3(-72, -47, 0), new THREE.Vector3(-40, -36, 0), new THREE.Vector3(0, -26, 0),
  new THREE.Vector3(40, -36, 0), new THREE.Vector3(72, -47, 0),
]), 40, 3.4, 10, false);
const GEO_CROCHET = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, -27, 0), new THREE.Vector3(0, -15, 0), new THREE.Vector3(0, -6, 3),
  new THREE.Vector3(0, 1, 7), new THREE.Vector3(0, 7, 3.5), new THREE.Vector3(0, 7, -3),
  new THREE.Vector3(0, 2, -7), new THREE.Vector3(0, -3, -6),
]), 40, 1.5, 8, false);

/* ---------- Texture : le tissu, le nom, le numéro ---------- */
function trace(ctx) {
  ctx.beginPath();
  CONTOUR.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}
function texteAjuste(ctx, txt, x, y, max) {
  const w = ctx.measureText(txt).width;
  if (w <= max) { ctx.fillText(txt, x, y); return; }
  ctx.save(); ctx.translate(x, y); ctx.scale(max / w, 1); ctx.fillText(txt, 0, 0); ctx.restore();
}
function peindre(canvas, { num = "", nom = "", gk = false, face = false }) {
  const W = canvas.width, H = canvas.height, ctx = canvas.getContext("2d");
  const ky = H / (Y1 - Y0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.setTransform(W / 220, 0, 0, ky, 0, -Y0 * ky);
  const fond = gk ? "#e3ad12" : "#0f7a40";
  const encre = gk ? "#151515" : "#f4f4ef";
  const accent = gk ? "#151515" : "#c9f23a";
  ctx.fillStyle = fond; ctx.fillRect(-10, 0, 240, 320);

  ctx.save(); trace(ctx); ctx.clip();
  // motif ton sur ton en diagonale
  ctx.fillStyle = gk ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.07)";
  for (let i = -320; i < 260; i += 24) { ctx.beginPath(); ctx.moveTo(i, 30); ctx.lineTo(i + 9, 30); ctx.lineTo(i + 279, 300); ctx.lineTo(i + 270, 300); ctx.fill(); }
  // empiècements des épaules
  ctx.fillStyle = gk ? "rgba(0,0,0,.12)" : "rgba(0,0,0,.18)";
  ctx.beginPath(); ctx.moveTo(42, 47); ctx.lineTo(82, 36); ctx.quadraticCurveTo(70, 60, 58, 92); ctx.lineTo(54, 92); ctx.lineTo(12, 103); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(178, 47); ctx.lineTo(138, 36); ctx.quadraticCurveTo(150, 60, 162, 92); ctx.lineTo(166, 92); ctx.lineTo(208, 103); ctx.closePath(); ctx.fill();
  ctx.restore();

  ctx.lineCap = "round"; ctx.lineJoin = "round";
  // bandes sur les flancs
  ctx.strokeStyle = encre; ctx.globalAlpha = 0.85; ctx.lineWidth = 4; ctx.setLineDash([14, 10]);
  ctx.beginPath(); ctx.moveTo(58, 140); ctx.lineTo(57, 278); ctx.moveTo(162, 140); ctx.lineTo(163, 278); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  // bas de manches
  ctx.strokeStyle = accent; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(203, 101); ctx.lineTo(183, 113); ctx.moveTo(17, 101); ctx.lineTo(37, 113); ctx.stroke();
  // ourlet
  ctx.strokeStyle = encre; ctx.globalAlpha = 0.7; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(52, 277); ctx.quadraticCurveTo(110, 288, 168, 277); ctx.stroke(); ctx.globalAlpha = 1;
  // col
  ctx.fillStyle = accent; ctx.beginPath();
  if (face) { ctx.moveTo(82, 36); ctx.lineTo(110, 68); ctx.lineTo(138, 36); ctx.lineTo(130, 36); ctx.lineTo(110, 58); ctx.lineTo(90, 36); }
  else { ctx.moveTo(82, 36); ctx.quadraticCurveTo(110, 46, 138, 36); ctx.lineTo(135, 44); ctx.quadraticCurveTo(110, 54, 85, 44); }
  ctx.closePath(); ctx.fill();

  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = encre;
  if (!face) {
    ctx.font = `800 23px ${FONT}`;
    texteAjuste(ctx, nom, 110, 99, 118);
    ctx.font = `800 114px ${FONT}`;
    ctx.lineWidth = 3; ctx.strokeStyle = gk ? "rgba(255,255,255,.25)" : "rgba(0,0,0,.28)";
    ctx.strokeText(num, 111, 216);
    texteAjuste(ctx, num, 110, 215, 150);
  } else {
    ctx.beginPath(); ctx.arc(146, 104, 15, 0, Math.PI * 2);
    ctx.fillStyle = "#0b1a10"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = accent === "#151515" ? "#c9f23a" : accent; ctx.stroke();
    ctx.fillStyle = "#c9f23a"; ctx.font = `800 21px ${FONT}`; ctx.fillText("Y", 146, 112);
    ctx.fillStyle = encre; ctx.font = `800 26px ${FONT}`; ctx.fillText(num, 74, 114);
    ctx.font = '30px "Permanent Marker", cursive'; ctx.fillText("YALLA", 110, 170);
  }
  // grain du tissu
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const pas = Math.max(2, Math.round(W / 256));
  for (let y = 0; y < H; y += pas) for (let x = (y / pas) % 2 ? pas : 0; x < W; x += pas * 2) {
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,.05)" : "rgba(255,255,255,.035)";
    ctx.fillRect(x, y, pas, pas);
  }
}
function texture(canvas, renderer) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}

function lumieres(scene) {
  scene.add(new THREE.HemisphereLight(0xffe6c4, 0x24140a, 1.25));
  const cle = new THREE.DirectionalLight(0xffd6a0, 2.6);
  scene.add(cle, cle.target);
  const contre = new THREE.DirectionalLight(0xffa65a, 1.6);   // le bandeau LED, derrière en haut
  scene.add(contre, contre.target);
  const appoint = new THREE.DirectionalLight(0xa9c2ff, 0.45);
  scene.add(appoint, appoint.target);
  return { cle, contre, appoint };
}
const chrome = () => new THREE.MeshStandardMaterial({ color: 0xd5d8db, metalness: 0.75, roughness: 0.28 });
const bois = () => new THREE.MeshStandardMaterial({ color: 0xcaa173, metalness: 0, roughness: 0.6 });
const tissu = (map) => new THREE.MeshStandardMaterial({ map, roughness: 0.82, metalness: 0 });

function nouveauRendu() {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.2;
  r.setClearColor(0x000000, 0);
  return r;
}

const opacite = (el) => { const v = el?.style.opacity; return v === "" || v == null ? 1 : parseFloat(v); };
const prop = (el, p) => (gs && el ? parseFloat(gs.getProperty(el, p)) || 0 : 0);

/* =================== LA TRINGLE =================== */
async function tringle() {
  const zone = $("#penderie"), rail = $("#lr-rail"), track = $("#lr-track"), barre = $(".vr-bar", rail || document);
  const boutons = rail ? $$(".shirt", rail) : [];
  if (!rail || !track || !barre || !boutons.length) return;

  const rendu = nouveauRendu();
  rendu.shadowMap.enabled = true;
  rendu.shadowMap.type = THREE.PCFSoftShadowMap;
  const toile = rendu.domElement;
  toile.className = "vr-gl";
  toile.setAttribute("aria-hidden", "true");
  // styles posés ici aussi : sans eux (ancienne feuille CSS en cache), la toile pousserait la tringle à l'infini
  toile.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;z-index:0;pointer-events:none;display:block";

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(20, 1, 1, 6000);
  const L = lumieres(scene);
  L.cle.castShadow = true;
  L.cle.shadow.mapSize.set(2048, 1024);
  L.cle.shadow.bias = -0.0004;
  L.cle.shadow.normalBias = 1.2;

  const tige = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 28), chrome());
  tige.rotation.z = Math.PI / 2;
  tige.castShadow = true;
  scene.add(tige);
  const mur = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.42 }));
  mur.receiveShadow = true;
  scene.add(mur);

  const devants = {};
  const devant = (gk) => {
    if (!devants[gk]) { const c = document.createElement("canvas"); c.width = 384; c.height = 480; peindre(c, { gk, face: true }); devants[gk] = texture(c, rendu); }
    return devants[gk];
  };

  const items = boutons.map((btn, i) => {
    const kit = $(".kit", btn), s3 = $(".shirt-3d", btn);
    const gk = !!kit?.classList.contains("kit-gk");
    const nom = ($(".kit-name", btn)?.textContent || "").trim();
    const num = ($(".kit-num", btn)?.textContent || "").trim();
    const c = document.createElement("canvas"); c.width = 512; c.height = 640;
    peindre(c, { num, nom, gk });
    const v = VARIANTES[i % VARIANTES.length];
    const mats = [tissu(texture(c, rendu)), tissu(devant(gk)), bois(), chrome()];
    const dos = new THREE.Mesh(v.dos, mats[0]), dvt = new THREE.Mesh(v.devant, mats[1]);
    const cintre = new THREE.Mesh(GEO_CINTRE, mats[2]), crochet = new THREE.Mesh(GEO_CROCHET, mats[3]);
    [dos, dvt, cintre, crochet].forEach((m) => { m.castShadow = true; });
    const racine = new THREE.Group(), balance = new THREE.Group(), pivot = new THREE.Group();
    pivot.add(dos, dvt, cintre);
    balance.add(crochet, pivot);
    racine.add(balance);
    scene.add(racine);
    const profil = -1.2 + Math.sin(i * 12.9898) * 0.06; // de profil, un peu irrégulier
    return { btn, kit, s3, racine, balance, pivot, mats, profil, rot: profil, z: 0, op: 1, cle: "" };
  });

  let W = 0, H = 0, barreY = 0, echelle = 1, sale = true;
  const mesure = () => {
    W = rail.clientWidth; H = rail.clientHeight;
    if (!W || !H || H > 2000) return;
    rendu.setSize(W, H, false);
    camera.aspect = W / H;
    camera.position.set(0, 0, H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.updateProjectionMatrix();
    barreY = barre.offsetTop + barre.offsetHeight / 2;
    echelle = (items[0].s3.offsetWidth || 180) / 220;
    const r = Math.max(2, barre.offsetHeight / 2);
    tige.scale.set(r, barre.offsetWidth + 40, r);
    tige.position.set(barre.offsetLeft + barre.offsetWidth / 2 - W / 2, H / 2 - barreY, 0);
    mur.scale.set(W * 2, H * 2, 1);
    mur.position.set(0, 0, -95 * echelle);
    L.cle.position.set(-W * 0.18, H * 0.55, 900); L.cle.target.position.set(0, -H * 0.1, 0);
    const cam = L.cle.shadow.camera;
    cam.left = -W * 0.75; cam.right = W * 0.75; cam.top = H * 0.9; cam.bottom = -H * 0.9; cam.near = 10; cam.far = 3000;
    cam.updateProjectionMatrix();
    L.contre.position.set(0, H * 0.6, -700);
    L.appoint.position.set(W * 0.6, -H * 0.2, 500);
    items.forEach((it) => it.racine.scale.setScalar(echelle));
    sale = true;
  };

  let enCours = false, visible = false, avant = 0, raf = 0;
  const image = (now) => {
    raf = enCours ? requestAnimationFrame(image) : 0;
    const dt = Math.min(0.05, (now - (avant || now)) / 1000); avant = now;
    const k = reduce ? 1 : 1 - Math.exp(-dt * 9);
    const rr = rail.getBoundingClientRect();
    const tire = rail.classList.contains("is-dragging");
    const baseTrack = track.offsetTop;
    let bouge = sale; sale = false;
    for (const it of items) {
      const r = it.btn.getBoundingClientRect();
      const vu = r.width > 0 && !it.btn.classList.contains("is-taken");
      if (it.racine.visible !== vu) { it.racine.visible = vu; bouge = true; }
      if (!vu) continue;
      const dy = r.top - rr.top - (baseTrack + it.btn.offsetTop) + prop(it.s3, "y");
      const X = r.left - rr.left + r.width / 2 - W / 2;
      const Y = H / 2 - (barreY + dy);
      const survol = !tire && it.btn.matches(":hover, :focus-visible");
      // même angle apparent partout sur la tringle (on compense la perspective)
      const comp = -Math.atan(X / camera.position.z);
      const cibleRot = (survol ? 0 : it.profil) + comp, cibleZ = survol ? 30 : 0;
      it.rot += (cibleRot - it.rot) * k;
      it.z += (cibleZ - it.z) * k;
      if (Math.abs(cibleRot - it.rot) < 1e-4) it.rot = cibleRot;
      if (Math.abs(cibleZ - it.z) < 1e-3) it.z = cibleZ;
      const sw = -prop(it.kit, "rotation") * (Math.PI / 180);
      const op = opacite(it.btn) * opacite(it.s3);
      const cle = `${X.toFixed(1)}|${Y.toFixed(1)}|${it.rot.toFixed(4)}|${it.z.toFixed(2)}|${sw.toFixed(4)}|${op.toFixed(3)}`;
      if (cle === it.cle) continue;
      it.cle = cle; bouge = true;
      it.racine.position.set(X, Y, it.z * echelle);
      it.balance.rotation.z = sw;
      it.pivot.rotation.y = it.rot;
      if (op !== it.op) {
        it.op = op;
        it.mats.forEach((m) => { m.transparent = op < 0.999; m.opacity = op; });
      }
    }
    if (bouge) rendu.render(scene, camera);
  };
  const lance = () => {
    const doit = visible && !document.hidden;
    if (doit && !enCours) { enCours = true; avant = 0; raf = requestAnimationFrame(image); }
    else if (!doit && enCours) { enCours = false; cancelAnimationFrame(raf); }
  };

  rail.prepend(toile);
  mesure();
  image(performance.now());
  zone.classList.add("is-3d");
  new ResizeObserver(() => { mesure(); }).observe(rail);
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; lance(); }, { rootMargin: "120px" }).observe(rail);
  document.addEventListener("visibilitychange", lance);
}

/* =================== LA FICHE (maillot décroché) =================== */
async function fiche() {
  const wrap = $("#casier"), bouton = $("#fx-kit"), flip = $("#fx-flip"), panneau = $(".fx", wrap || document);
  if (!wrap || !bouton || !flip) return;

  const rendu = nouveauRendu();
  const toile = rendu.domElement;
  toile.className = "fx-gl";
  toile.setAttribute("aria-hidden", "true");
  toile.style.cssText = "position:absolute;left:-30%;top:-10%;width:160%;height:120%;pointer-events:none;display:block";
  bouton.style.position = "relative";
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 1, 1, 5000);
  const L = lumieres(scene);
  L.cle.position.set(-260, 420, 900);
  L.contre.position.set(80, 500, -700);
  L.appoint.position.set(500, -100, 400);

  const cDos = document.createElement("canvas"); cDos.width = 1024; cDos.height = 1280;
  const cDvt = document.createElement("canvas"); cDvt.width = 1024; cDvt.height = 1280;
  const tDos = texture(cDos, rendu), tDvt = texture(cDvt, rendu);
  const v = VARIANTES[0];
  const racine = new THREE.Group(), pivot = new THREE.Group();
  pivot.add(new THREE.Mesh(v.dos, tissu(tDos)), new THREE.Mesh(v.devant, tissu(tDvt)), new THREE.Mesh(GEO_CINTRE, bois()), new THREE.Mesh(GEO_CROCHET, chrome()));
  pivot.position.y = 146; // centre du maillot au centre de l'image
  racine.add(pivot);
  scene.add(racine);

  const remplit = () => {
    const gk = panneau.classList.contains("pos-gardien");
    const num = ($("#fx-num")?.textContent || "").replace("–", "").trim();
    const nom = ($("#cs-nomfam")?.textContent || "").trim().toUpperCase().slice(0, 12);
    peindre(cDos, { num, nom, gk });
    peindre(cDvt, { num, gk, face: true });
    tDos.needsUpdate = tDvt.needsUpdate = true;
  };
  const mesure = () => {
    const w = toile.clientWidth, h = toile.clientHeight;
    if (!w || !h) return;
    rendu.setSize(w, h, false);
    camera.aspect = w / h;
    // le maillot (300 unités) occupe la hauteur du bouton, la toile déborde de 20 %
    camera.position.set(0, 0, (300 * 1.2) / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.updateProjectionMatrix();
  };

  let tilt = 0, cibleTilt = 0, rot = 0, enCours = false, avant = 0, t0 = performance.now();
  const stage = $(".fx-stage", wrap);
  stage.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    const r = bouton.getBoundingClientRect();
    cibleTilt = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / r.width)) * 0.45;
  });
  stage.addEventListener("pointerleave", () => { cibleTilt = 0; });

  const image = (now) => {
    if (!enCours) return;
    requestAnimationFrame(image);
    const dt = Math.min(0.05, (now - (avant || now)) / 1000); avant = now;
    const k = reduce ? 1 : 1 - Math.exp(-dt * 6);
    const t = (now - t0) / 1000;
    const cible = flip.classList.contains("is-front") ? Math.PI : 0;
    rot += (cible - rot) * k;
    tilt += (cibleTilt - tilt) * k;
    pivot.rotation.y = rot + tilt + (reduce ? 0 : Math.sin(t * 0.7) * 0.07);
    racine.rotation.z = reduce ? 0 : Math.sin(t * 1.1) * 0.018;
    rendu.render(scene, camera);
  };
  const etat = () => {
    const ouvert = !wrap.hidden;
    if (ouvert && !enCours) {
      enCours = true; avant = 0;
      rot = flip.classList.contains("is-front") ? Math.PI : 0;
      requestAnimationFrame(() => { mesure(); requestAnimationFrame(image); });
    } else if (!ouvert) enCours = false;
  };

  let attente = 0;
  const change = () => { cancelAnimationFrame(attente); attente = requestAnimationFrame(remplit); };
  new MutationObserver(change).observe($("#fx-num"), { childList: true, characterData: true, subtree: true });
  new MutationObserver(change).observe($("#cs-nomfam"), { childList: true, characterData: true, subtree: true });
  new MutationObserver(change).observe(panneau, { attributes: true, attributeFilter: ["class"] });
  new MutationObserver(etat).observe(wrap, { attributes: true, attributeFilter: ["hidden"] });
  new ResizeObserver(mesure).observe(bouton);

  bouton.appendChild(toile);
  wrap.classList.add("is-3d");
  remplit();
  etat();
}

(async () => {
  try {
    const t = document.createElement("canvas");
    if (!(t.getContext("webgl2") || t.getContext("webgl"))) return;
  } catch (e) { return; }
  try {
    await Promise.all([
      document.fonts.load(`800 40px ${FONT}`),
      document.fonts.load('30px "Permanent Marker"'),
    ]);
  } catch (e) { /* les polices de secours suffisent */ }
  try { await tringle(); } catch (e) { console.warn("Maillots 3D (tringle) indisponibles :", e); $("#penderie")?.classList.remove("is-3d"); }
  try { await fiche(); } catch (e) { console.warn("Maillots 3D (fiche) indisponibles :", e); $("#casier")?.classList.remove("is-3d"); }
})();
