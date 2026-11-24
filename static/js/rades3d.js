/* YALLA · Accueil « Radès » : couche 3D (three.js)
   - Photo d'ouverture et photo de fin en relief (maillage déformé + caméra mobile)
   - Galerie 360° : les photos du stade disposées en anneau autour de la caméra
   - Cartes des rôles inclinées en 3D au survol
   Sans WebGL ou avec « réduire les animations », la page garde ses photos fixes. */
import * as THREE from 'three';

const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
const tactile = matchMedia('(hover: none)').matches;
const DPR = Math.min(devicePixelRatio || 1, 1.75);

const webglOK = () => {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch (e) { return false; }
};

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lisse = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

/* ---------- Souris (partagée) ---------- */
const souris = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  souris.tx = (e.clientX / innerWidth) * 2 - 1;
  souris.ty = (e.clientY / innerHeight) * 2 - 1;
}, { passive: true });

/* ---------- Textures ---------- */
const chargeur = new THREE.TextureLoader();
const texture = (url) => new Promise((ok, ko) => chargeur.load(url, (t) => {
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  ok(t);
}, undefined, ko));

/* Petite tache lumineuse ronde pour les particules */
const spriteLumiere = () => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const d = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  d.addColorStop(0, 'rgba(255,255,255,1)'); d.addColorStop(.35, 'rgba(255,255,255,.55)'); d.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = d; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};

/* ---------- Boucle de rendu commune (seulement les scènes visibles) ---------- */
const scenes = [];
const horloge = new THREE.Clock();
const boucle = () => {
  const t = horloge.getElapsedTime();
  souris.x = lerp(souris.x, souris.tx, 0.06);
  souris.y = lerp(souris.y, souris.ty, 0.06);
  for (const s of scenes) if (s.visible) s.rendu(t);
  requestAnimationFrame(boucle);
};

const surveille = (scene, hote) => {
  new IntersectionObserver(([e]) => { scene.visible = e.isIntersecting; }, { rootMargin: '100px' }).observe(hote);
  scenes.push(scene);
};

const nouveauRendu = (hote, fond) => {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: fond === null, powerPreference: 'high-performance' });
  r.setPixelRatio(DPR);
  r.outputColorSpace = THREE.SRGBColorSpace;
  if (fond !== null) r.setClearColor(fond, 1);
  hote.appendChild(r.domElement);
  return r;
};

/* Progression du défilement d'un élément : 0 quand son haut touche le haut de l'écran, 1 quand il est sorti */
const progression = (el, debut = 'top') => {
  const b = el.getBoundingClientRect();
  if (debut === 'top') return clamp(-b.top / b.height, 0, 1);
  return clamp((innerHeight - b.top) / (innerHeight + b.height), 0, 1); // traversée complète de l'écran
};

/* =====================================================================
   1. Photo en relief
   La photo est posée sur un maillage fin dont chaque sommet avance ou recule
   selon une carte de profondeur « bol de stade » : tribunes proches en bas,
   pelouse au fond, toit qui revient vers nous en haut. La caméra se déplace
   avec la souris et le défilement : les plans glissent les uns sur les autres.
   ===================================================================== */
const profondeurStade = (u, v, o) => {
  // v : 0 en bas de la photo, 1 en haut
  let z = 1 - lisse(0, o.creux, v);              // premier plan (tribune / piste) proche
  z += o.toit * lisse(o.creux + .07, 1, v);      // toit qui avance au-dessus
  z += o.cote * (1 - lisse(0, .5, v)) * (u - .5); // un côté plus proche que l'autre
  z += .08 * Math.sin(u * Math.PI);              // légère courbure de la tribune
  return z;
};

class Relief {
  constructor(hote, url, opts) {
    this.hote = hote; this.opts = opts; this.visible = false;
    this.rendu3d = nouveauRendu(hote, null);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
    this.D = 10;
    this.debut = performance.now();
    texture(url).then((tex) => this.construit(tex)).catch(() => hote.remove());
  }

  construit(tex) {
    const o = this.opts;
    const ar = tex.image.width / tex.image.height;
    const geo = new THREE.PlaneGeometry(ar, 1, 220, 160);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      pos.setZ(i, profondeurStade(uv.getX(i), uv.getY(i), o) * o.relief / 10); // unités du monde (z non mis à l'échelle)
    }
    geo.computeVertexNormals();
    this.ar = ar;
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex }));
    this.scene.add(this.mesh);

    // Poussière dans la lumière des projecteurs
    const n = o.particules;
    const p = new Float32Array(n * 3);
    this.vitesses = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      p[i * 3] = (Math.random() - .5) * 9;
      p[i * 3 + 1] = (Math.random() - .5) * 6;
      p[i * 3 + 2] = Math.random() * 7 + .5;
      this.vitesses[i] = .05 + Math.random() * .12;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({
      size: o.taille, map: spriteLumiere(), transparent: true, opacity: o.opacite,
      depthWrite: false, blending: THREE.AdditiveBlending, color: o.teinte,
    }));
    this.scene.add(this.points);

    this.redimensionne();
    addEventListener('resize', () => this.redimensionne());
    surveille(this, this.hote);
    this.hote.classList.add('is-on');
    document.documentElement.classList.add('has-3d');
  }

  redimensionne() {
    const w = this.hote.clientWidth, h = this.hote.clientHeight;
    this.rendu3d.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // La photo couvre l'écran (comme object-fit: cover), avec une marge pour les mouvements de caméra
    const visH = 2 * this.D * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const visW = visH * this.camera.aspect;
    const s = Math.max(visW / this.ar, visH) * this.opts.marge;
    this.mesh.scale.set(s, s, 1);
    this.mesh.position.y = (this.opts.decalY || 0) * s;
  }

  rendu(t) {
    const o = this.opts;
    const intro = o.intro ? easeOut((performance.now() - this.debut) / 2600) : 1;
    const p = progression(this.hote.closest('section'), o.suivi);
    const auto = tactile ? 1 : .35; // sur mobile, la caméra se balance d'elle-même
    const cx = souris.x * o.amplitude + Math.sin(t * .25) * .35 * auto;
    const cy = -souris.y * o.amplitude * .6 + Math.cos(t * .2) * .18 * auto;
    const z = this.D - (1 - intro) * 3.5 - p * o.travelling; // l'ouverture part de près puis recule
    this.camera.position.set(cx, cy + p * o.monte, z);
    this.camera.lookAt(cx * .25, p * o.monte * .4, 0);
    this.camera.rotation.z += (1 - intro) * .06;

    const pa = this.points.geometry.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      let y = pa.getY(i) + this.vitesses[i] * .016;
      if (y > 3.2) y = -3.2;
      pa.setY(i, y);
      pa.setX(i, pa.getX(i) + Math.sin(t * .6 + i) * .0015);
    }
    pa.needsUpdate = true;
    this.rendu3d.render(this.scene, this.camera);
  }
}

/* =====================================================================
   2. Galerie 360° : les photos forment l'anneau d'un stade autour de la caméra
   ===================================================================== */
class Anneau {
  constructor(hote, urls) {
    this.hote = hote; this.visible = false;
    this.rendu3d = nouveauRendu(hote, 0xf4f6f1);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xf4f6f1, 9, 22);
    this.camera = new THREE.PerspectiveCamera(58, 1, .1, 100);
    this.groupe = new THREE.Group();
    this.scene.add(this.groupe);
    this.rot = 0; this.cible = 0; this.glisse = 0;
    this.n = urls.length;
    const R = 10, pas = (Math.PI * 2) / this.n, arc = pas * .9;
    const hauteur = R * arc * .68;
    Promise.all(urls.map(texture)).then((texs) => {
      texs.forEach((tex, i) => {
        // Vu de l'intérieur du cylindre, l'image serait inversée : on la retourne
        tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = -1; tex.offset.x = 1;
        // Recadrage « cover » pour garder les proportions de la photo
        const arPanneau = (R * arc) / hauteur, arImg = tex.image.width / tex.image.height;
        if (arImg > arPanneau) { const k = arPanneau / arImg; tex.repeat.x = -k; tex.offset.x = 1 - (1 - k) / 2; }
        else { const k = arImg / arPanneau; tex.repeat.y = k; tex.offset.y = (1 - k) / 2; }
        const geo = new THREE.CylinderGeometry(R, R, hauteur, 48, 1, true, i * pas - arc / 2, arc);
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide }));
        this.groupe.add(m);
        // Liseré vert sous chaque photo
        const bord = new THREE.Mesh(
          new THREE.CylinderGeometry(R - .02, R - .02, .12, 48, 1, true, i * pas - arc / 2, arc),
          new THREE.MeshBasicMaterial({ color: 0x1f7a3a, side: THREE.BackSide }));
        bord.position.y = -hauteur / 2 - .25;
        this.groupe.add(bord);
      });
      // Pelouse tracée au sol : le rond central
      const sol = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.5, 96),
        new THREE.MeshBasicMaterial({ color: 0x1f7a3a, transparent: true, opacity: .35 }));
      sol.rotation.x = -Math.PI / 2; sol.position.y = -hauteur / 2 - .6;
      this.groupe.add(sol);
      const point = new THREE.Mesh(new THREE.CircleGeometry(.12, 24),
        new THREE.MeshBasicMaterial({ color: 0x1f7a3a, transparent: true, opacity: .5 }));
      point.rotation.x = -Math.PI / 2; point.position.y = sol.position.y;
      this.groupe.add(point);

      // Afficher l'anneau avant de mesurer sa taille
      hote.classList.add('is-on');
      hote.closest('.strip').classList.add('is-3d');
      this.redimensionne();
      addEventListener('resize', () => this.redimensionne());
      this.glisser();
      surveille(this, hote);
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    }).catch(() => hote.remove());
  }

  glisser() {
    let x0 = null, r0 = 0;
    const el = this.rendu3d.domElement;
    el.addEventListener('pointerdown', (e) => { x0 = e.clientX; r0 = this.glisse; el.setPointerCapture(e.pointerId); this.hote.classList.add('is-drag'); });
    el.addEventListener('pointermove', (e) => { if (x0 !== null) this.glisse = r0 + (e.clientX - x0) * .006; });
    const fin = () => { x0 = null; this.hote.classList.remove('is-drag'); };
    el.addEventListener('pointerup', fin); el.addEventListener('pointercancel', fin);
  }

  redimensionne() {
    const w = this.hote.clientWidth, h = this.hote.clientHeight;
    this.rendu3d.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < 700 ? 75 : 58;
    this.camera.updateProjectionMatrix();
  }

  rendu(t) {
    const p = progression(this.hote, 'traverse');
    this.cible = -p * Math.PI * 1.6 + this.glisse;
    this.rot = lerp(this.rot, this.cible, .08);
    this.groupe.rotation.y = this.rot + t * .02;
    this.camera.position.set(0, .3 - souris.y * .35, 2.2);
    this.camera.lookAt(souris.x * .8, -souris.y * .25, -10);
    this.rendu3d.render(this.scene, this.camera);
  }
}

/* =====================================================================
   3. Cartes inclinées en 3D (photos des rôles et pastilles de l'organigramme)
   ===================================================================== */
const inclinaison = (sel, force) => {
  document.querySelectorAll(sel).forEach((el) => {
    el.classList.add('tilt');
    el.addEventListener('pointermove', (e) => {
      const b = el.getBoundingClientRect();
      const x = (e.clientX - b.left) / b.width - .5, y = (e.clientY - b.top) / b.height - .5;
      el.style.setProperty('--ry', `${x * force}deg`);
      el.style.setProperty('--rx', `${-y * force}deg`);
      el.style.setProperty('--gx', `${(x + .5) * 100}%`);
      el.style.setProperty('--gy', `${(y + .5) * 100}%`);
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg');
    });
  });
};

/* ---------- Démarrage ---------- */
const S = window.STATIC_URL || '/static/';
if (!reduit) {
  if (!tactile) { inclinaison('.role-media', 12); inclinaison('.org-card', 18); }
  if (webglOK()) {
    const hero = document.getElementById('hero-3d');
    if (hero) new Relief(hero, hero.dataset.src, {
      creux: .55, toit: .75, cote: .5, relief: 14, marge: 1.32, amplitude: .9,
      travelling: 3.2, monte: 1.2, intro: true, suivi: 'top',
      particules: 260, taille: .07, opacite: .45, teinte: 0xfff6dc,
    });
    const fin = document.getElementById('cta-3d');
    if (fin) new Relief(fin, fin.dataset.src, {
      creux: .5, toit: .9, cote: -.3, relief: 13, marge: 1.32, amplitude: .8,
      travelling: 2.4, monte: -.6, intro: false, suivi: 'traverse',
      particules: 420, taille: .09, opacite: .8, teinte: 0xdff3ff,
    });
    const anneau = document.getElementById('ring');
    if (anneau) new Anneau(anneau, JSON.parse(anneau.dataset.photos));
    requestAnimationFrame(boucle);
  }
}
