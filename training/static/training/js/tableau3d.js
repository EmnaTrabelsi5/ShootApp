/* Yalla • Tableau tactique en 3D (Three.js, fonctionne hors ligne)
   Lit les positions du tableau 2D (#pitch) : on place les joueurs en 2D, on les regarde en 3D.
   Rien n'est enregistré ici, l'enregistrement reste géré par tableau.js. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";

const pitch = document.getElementById("pitch");
const zone3d = document.getElementById("t3d");
const canvas = document.getElementById("t3d-canvas");
const boutonsVue = document.querySelectorAll("[data-vue]");
if (pitch && zone3d && canvas && boutonsVue.length) init();

function init() {
  const L = 105, W = 68;                 // terrain réglementaire (m)
  const enMouvementReduit = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch (e) {                           // pas de WebGL : on garde la 2D
    document.querySelector('[data-vue="3d"]')?.setAttribute("disabled", "");
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeef5ef);
  scene.fog = new THREE.Fog(0xeef5ef, 110, 220);

  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 400);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.minDistance = 8;
  controls.maxDistance = 140;

  scene.add(new THREE.HemisphereLight(0xe0f2fe, 0x14532d, 1.15));
  const soleil = new THREE.DirectionalLight(0xffffff, 2.1);
  soleil.position.set(-30, 60, 35);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(2048, 2048);
  Object.assign(soleil.shadow.camera, { left: -65, right: 65, top: 45, bottom: -45, near: 1, far: 160 });
  soleil.shadow.bias = -0.0005;
  scene.add(soleil);

  // % du tableau 2D -> mètres (x : but gauche -> but droit, z : haut -> bas)
  const versX = p => (p / 100 - 0.5) * L;
  const versZ = p => (p / 100 - 0.5) * W;

  // ------------------------------------------------------------ terrain
  scene.add(creerTerrain());
  scene.add(creerBut(-L / 2, -1));
  scene.add(creerBut(L / 2, 1));

  function creerTerrain() {
    const g = new THREE.Group();
    const M = 4, PX = 16;                                  // 4 m de bord autour des lignes
    const c = document.createElement("canvas");
    c.width = (L + 2 * M) * PX; c.height = (W + 2 * M) * PX;
    const ctx = c.getContext("2d");
    const X = x => (x + L / 2 + M) * PX, Z = z => (z + W / 2 + M) * PX;
    const bandes = 14, lb = c.width / bandes;
    for (let i = 0; i < bandes; i++) {                     // bandes de tonte, comme la 2D
      ctx.fillStyle = i % 2 ? "#1f7a3a" : "#1b6e34";
      ctx.fillRect(i * lb, 0, lb + 1, c.height);
    }
    for (let i = 0; i < 12000; i++) {                      // léger grain
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2);
    }
    ctx.strokeStyle = "rgba(255,255,255,.9)";
    ctx.fillStyle = "#fff";
    ctx.lineWidth = 0.14 * PX;
    const rect = (x1, z1, x2, z2) => ctx.strokeRect(X(x1), Z(z1), X(x2) - X(x1), Z(z2) - Z(z1));
    rect(-L / 2, -W / 2, L / 2, W / 2);
    ctx.beginPath(); ctx.moveTo(X(0), Z(-W / 2)); ctx.lineTo(X(0), Z(W / 2)); ctx.stroke();
    ctx.beginPath(); ctx.arc(X(0), Z(0), 9.15 * PX, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(X(0), Z(0), 0.3 * PX, 0, Math.PI * 2); ctx.fill();
    [-1, 1].forEach(s => {
      const bx = s * L / 2;
      rect(Math.min(bx, bx - s * 16.5), -20.16, Math.max(bx, bx - s * 16.5), 20.16);
      rect(Math.min(bx, bx - s * 5.5), -9.16, Math.max(bx, bx - s * 5.5), 9.16);
      const px = bx - s * 11;
      ctx.beginPath(); ctx.arc(X(px), Z(0), 0.25 * PX, 0, Math.PI * 2); ctx.fill();
      const a = Math.acos(5.5 / 9.15);
      ctx.beginPath();
      if (s > 0) ctx.arc(X(px), Z(0), 9.15 * PX, Math.PI - a, Math.PI + a);
      else ctx.arc(X(px), Z(0), 9.15 * PX, -a, a);
      ctx.stroke();
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const sol = new THREE.Mesh(new THREE.PlaneGeometry(L + 2 * M, W + 2 * M),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    sol.rotation.x = -Math.PI / 2;
    sol.receiveShadow = true;
    g.add(sol);
    const autour = new THREE.Mesh(new THREE.PlaneGeometry(400, 300),
      new THREE.MeshStandardMaterial({ color: 0x2f7d47, roughness: 1 }));
    autour.rotation.x = -Math.PI / 2;
    autour.position.y = -0.02;
    autour.receiveShadow = true;
    g.add(autour);
    return g;
  }

  function creerBut(x, sens) {
    const g = new THREE.Group();
    const blanc = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const r = 0.07, H = 2.44, Wb = 3.66, P = 1.8;
    const poteau = h => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), blanc); m.castShadow = true; return m; };
    [-Wb, Wb].forEach(z => { const p = poteau(H); p.position.set(x, H / 2, z); g.add(p); });
    const barre = poteau(Wb * 2 + r * 2); barre.rotation.x = Math.PI / 2; barre.position.set(x, H, 0); g.add(barre);
    const filet = new THREE.MeshBasicMaterial({ color: 0xe2e8f0, wireframe: true, transparent: true, opacity: 0.45 });
    const fond = new THREE.Mesh(new THREE.PlaneGeometry(Wb * 2, H, 24, 10), filet);
    fond.position.set(x + sens * P, H / 2, 0); fond.rotation.y = Math.PI / 2; g.add(fond);
    const toit = new THREE.Mesh(new THREE.PlaneGeometry(P, Wb * 2, 8, 24), filet);
    toit.rotation.x = -Math.PI / 2; toit.position.set(x + sens * P / 2, H, 0); g.add(toit);
    [-Wb, Wb].forEach(z => {
      const cote = new THREE.Mesh(new THREE.PlaneGeometry(P, H, 8, 10), filet);
      cote.position.set(x + sens * P / 2, H / 2, z); g.add(cote);
    });
    return g;
  }

  // ------------------------------------------------------------ joueurs
  const PEAUX = [0xf1c27d, 0xc68642, 0x8d5524, 0xe0ac69, 0x5c3a21];
  const mat = col => new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 });

  // Pastille du numéro (mêmes couleurs que les ronds du tableau 2D)
  function pastille(numero, fond, bord, texte) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d");
    ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2);
    ctx.fillStyle = fond; ctx.fill();
    ctx.lineWidth = 10; ctx.strokeStyle = bord; ctx.stroke();
    ctx.fillStyle = texte;
    ctx.font = "800 60px 'Barlow Condensed', Inter, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(numero, 64, 68);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
    s.scale.set(2.6, 2.6, 1);
    s.renderOrder = 10;
    return s;
  }

  function creerJoueur(el, i) {
    const gardien = el.classList.contains("gk");
    const rouge = el.classList.contains("p-red"), vert = el.classList.contains("p-green");
    const maillot = mat(gardien ? 0x111827 : 0x16a34a);
    const short = mat(gardien ? 0x111827 : 0xf8fafc);
    const chaus = mat(gardien ? 0xfacc15 : 0x16a34a);
    const peau = mat(PEAUX[i % PEAUX.length]), noir = mat(0x111111);
    const g = new THREE.Group();
    const cap = (r, l, m) => { const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 4, 10), m); o.castShadow = true; return o; };
    [-0.11, 0.11].forEach(dx => {
      const cuisse = cap(0.085, 0.3, short); cuisse.position.set(dx, 0.72, 0);
      const mollet = cap(0.07, 0.34, chaus); mollet.position.set(dx, 0.34, 0);
      const pied = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.24), noir);
      pied.position.set(dx, 0.06, 0.05); pied.castShadow = true;
      g.add(cuisse, mollet, pied);
    });
    const torse = cap(0.2, 0.42, maillot); torse.position.y = 1.27; torse.scale.set(1.15, 1, 0.8); g.add(torse);
    [-0.31, 0.31].forEach(dx => {
      const bras = cap(0.06, 0.48, maillot); bras.position.set(dx, 1.25, 0); bras.rotation.z = dx < 0 ? -0.12 : 0.12; g.add(bras);
    });
    const tete = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), peau);
    tete.position.y = 1.78; tete.castShadow = true; g.add(tete);
    const cheveux = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.1), noir);
    cheveux.position.y = 1.8; cheveux.rotation.x = -0.25; g.add(cheveux);

    const corps = new THREE.Group();
    corps.add(g);
    g.scale.setScalar(2.4);                 // plus grands que nature pour rester lisibles de loin
    g.rotation.y = Math.PI / 2;             // l'équipe attaque vers la droite (+x)

    const bord = rouge ? "#dc2626" : vert ? "#22c55e" : gardien ? "#111827" : "#ffffff";
    const fond = gardien ? "#111827" : vert ? "#22c55e" : "#ffffff";
    const texte = gardien || vert ? "#ffffff" : rouge ? "#dc2626" : "#0f172a";
    const num = pastille(el.dataset.num || el.textContent.trim(), fond, bord, texte);
    num.position.y = 6;
    corps.add(num);
    if (el.dataset.nom) {                    // nom du joueur convoqué sous la pastille
      const nom = etiquette(el.dataset.nom, "rgba(15,33,24,.85)", "#ffffff", 6.5);
      nom.position.y = 4.4;
      corps.add(nom);
    }

    const ombreRond = new THREE.Mesh(new THREE.CircleGeometry(1.3, 24),
      new THREE.MeshBasicMaterial({ color: bord, transparent: true, opacity: rouge || vert ? 0.55 : 0.25 }));
    ombreRond.rotation.x = -Math.PI / 2; ombreRond.position.y = 0.02;
    corps.add(ombreRond);
    corps.userData.phase = i * 0.7;
    return corps;
  }

  // Étiquette de texte toujours face à la caméra
  function etiquette(txt, fond, couleur, largeur) {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 96;
    const ctx = c.getContext("2d");
    ctx.fillStyle = fond;
    ctx.beginPath(); ctx.roundRect(0, 8, 512, 80, 40); ctx.fill();
    ctx.fillStyle = couleur; ctx.font = "700 44px Inter, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(txt.length > 18 ? txt.slice(0, 17) + "…" : txt, 256, 50);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
    s.scale.set(largeur, largeur * 96 / 512, 1); s.renderOrder = 11;
    return s;
  }

  // Zone de déclenchement : anneau lumineux au sol + étiquette
  function creerZone() {
    const g = new THREE.Group();
    const disque = new THREE.Mesh(new THREE.CircleGeometry(6, 48),
      new THREE.MeshBasicMaterial({ color: 0xd4ff3a, transparent: true, opacity: 0.18, depthWrite: false }));
    disque.rotation.x = -Math.PI / 2; disque.position.y = 0.03;
    const anneau = new THREE.Mesh(new THREE.RingGeometry(5.6, 6, 64),
      new THREE.MeshBasicMaterial({ color: 0xd4ff3a, transparent: true, opacity: 0.9, depthWrite: false }));
    anneau.rotation.x = -Math.PI / 2; anneau.position.y = 0.04;
    const c = document.createElement("canvas");
    c.width = 512; c.height = 96;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "rgba(15,33,24,.9)";
    ctx.beginPath(); ctx.roundRect(0, 8, 512, 80, 40); ctx.fill();
    ctx.fillStyle = "#d4ff3a"; ctx.font = "700 40px Inter, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("Zone de déclenchement", 256, 50);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const etiquette = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
    etiquette.scale.set(10, 1.9, 1); etiquette.position.y = 2.2; etiquette.renderOrder = 11;
    g.add(disque, anneau, etiquette);
    g.userData = { anneau, disque };
    return g;
  }

  // Un objet 3D par élément déplaçable du tableau 2D
  const elements = [...pitch.querySelectorAll("[data-drag]")];
  const objets = elements.map((el, i) => {
    const o = el.dataset.drag === "zone" ? creerZone() : creerJoueur(el, i);
    scene.add(o);
    return { el, o, cible: new THREE.Vector3() };
  });

  function lirePositions(immediat) {
    objets.forEach(({ el, o, cible }) => {
      const x = parseFloat(el.style.left), y = parseFloat(el.style.top);
      if (Number.isNaN(x) || Number.isNaN(y)) return;
      cible.set(versX(x), 0, versZ(y));
      if (immediat) o.position.copy(cible);
    });
  }

  // ------------------------------------------------------------ caméras
  const VUES = {
    tribune: { pos: [0, 54, 66], cible: [0, 0, 7] },
    coach:   { pos: [-4, 5, -40], cible: [6, 0, 4] },        // sur la ligne de touche (côté banc), à hauteur d'homme
    drone:   { pos: [0, 82, 0.1], cible: [0, 0, 2] },        // vue du dessus
    gardien: { pos: [-L / 2 - 6, 3.2, 0], cible: [10, 0, 0] }, // derrière le but de notre gardien
  };
  let anim = null;
  function allerVers(nom, immediat) {
    const v = VUES[nom];
    if (!v) return;
    const fin = { pos: new THREE.Vector3(...v.pos), cible: new THREE.Vector3(...v.cible) };
    document.querySelectorAll("[data-cam]").forEach(b => b.classList.toggle("active", b.dataset.cam === nom));
    if (immediat || enMouvementReduit) {
      camera.position.copy(fin.pos); controls.target.copy(fin.cible); controls.update(); anim = null;
      return;
    }
    anim = { t0: performance.now(), duree: 1100, dPos: camera.position.clone(), dCible: controls.target.clone(), fin };
  }
  const douce = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // ------------------------------------------------------------ boucle
  let actif = false;
  const horloge = new THREE.Clock();
  function taille() {
    const w = zone3d.clientWidth, h = zone3d.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(taille).observe(zone3d);

  function boucle() {
    if (!actif) return;
    requestAnimationFrame(boucle);
    const dt = Math.min(horloge.getDelta(), 0.05), t = horloge.elapsedTime;
    lirePositions(false);
    objets.forEach(({ o, cible }) => {
      o.position.lerp(cible, 1 - Math.pow(0.001, dt));       // glisse vers la position du tableau 2D
      if (o.userData.anneau) {
        const s = 1 + Math.sin(t * 2.4) * 0.06;
        o.userData.anneau.scale.set(s, s, 1);
        o.userData.disque.material.opacity = 0.14 + Math.sin(t * 2.4) * 0.06;
      } else if (!enMouvementReduit) {
        o.children[0].position.y = Math.abs(Math.sin(t * 3 + o.userData.phase)) * 0.06; // petit trottinement sur place
      }
    });
    if (anim) {
      const u = Math.min((performance.now() - anim.t0) / anim.duree, 1), k = douce(u);
      camera.position.lerpVectors(anim.dPos, anim.fin.pos, k);
      controls.target.lerpVectors(anim.dCible, anim.fin.cible, k);
      if (u >= 1) anim = null;
    }
    controls.update();
    renderer.render(scene, camera);
  }

  // ------------------------------------------------------------ bascule 2D / 3D
  let dejaOuvert = false;
  function montrer(vue) {
    const en3d = vue === "3d";
    boutonsVue.forEach(b => { const on = b.dataset.vue === vue; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on); });
    pitch.hidden = en3d;
    zone3d.hidden = !en3d;
    document.getElementById("tac-hint-2d")?.toggleAttribute("hidden", en3d);
    document.getElementById("tac-hint-3d")?.toggleAttribute("hidden", !en3d);
    actif = en3d;
    if (en3d) {
      taille();
      lirePositions(true);
      if (!dejaOuvert) { allerVers("tribune", true); dejaOuvert = true; }
      horloge.getDelta();
      boucle();
    }
  }
  boutonsVue.forEach(b => b.addEventListener("click", () => montrer(b.dataset.vue)));
  document.querySelectorAll("[data-cam]").forEach(b => b.addEventListener("click", () => allerVers(b.dataset.cam)));
}
