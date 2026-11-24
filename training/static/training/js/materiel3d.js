/* Yalla • Matériel de la séance en 3D (Three.js, hors ligne)
   - sélecteur dans la popup : chaque matériel est un modèle 3D qui tourne, avec sa quantité
   - vignettes 3D dans le bloc « Matériel préparé »
   Catalogue : training/materiel.py (json "materiel-data"). */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/RoomEnvironment.js";

const dataEl = document.getElementById("materiel-data");
if (dataEl) init(JSON.parse(dataEl.textContent));

function init(CATALOGUE) {
  const PAR_ID = Object.fromEntries(CATALOGUE.map(m => [m.id, m]));

  // ---------------------------------------------------------------- rendu
  const W = 240, H = 180;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const ENV = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(32, W / H, 0.05, 50);

  function nouvelleScene() {
    const scene = new THREE.Scene();
    scene.environment = ENV;
    const soleil = new THREE.DirectionalLight(0xffffff, 1.6);
    soleil.position.set(2.5, 5, 3);
    soleil.castShadow = true;
    soleil.shadow.mapSize.set(512, 512);
    Object.assign(soleil.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.5, far: 15 });
    soleil.shadow.radius = 4;
    scene.add(soleil);
    // petit carré de gazon sous l'objet
    const sol = new THREE.Mesh(new THREE.CircleGeometry(1.25, 48), new THREE.ShadowMaterial({ opacity: 0.28 }));
    sol.rotation.x = -Math.PI / 2;
    sol.receiveShadow = true;
    scene.add(sol);
    return scene;
  }

  // ---------------------------------------------------------------- matériaux
  const pbr = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, metalness: 0, ...o });
  function texture(w, h, dessin) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    dessin(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }
  const ombre = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

  // ---------------------------------------------------------------- modèles
  const MODELES = {
    ballon() {
      // ballon à panneaux : pentagones noirs sur une sphère blanche (projection équirectangulaire)
      const tex = texture(1024, 512, (ctx, w, h) => {
        ctx.fillStyle = "#f8fafc"; ctx.fillRect(0, 0, w, h);
        const phi = (1 + Math.sqrt(5)) / 2;
        const sommets = [[0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi], [1, phi, 0], [-1, phi, 0],
          [1, -phi, 0], [-1, -phi, 0], [phi, 0, 1], [-phi, 0, 1], [phi, 0, -1], [-phi, 0, -1]];
        // pour chaque pixel : distance angulaire au sommet d'icosaèdre le plus proche
        const img = ctx.getImageData(0, 0, w, h);
        const n = sommets.map(v => { const l = Math.hypot(...v); return v.map(x => x / l); });
        for (let y = 0; y < h; y++) {
          const lat = Math.PI * (y / h);
          for (let x = 0; x < w; x++) {
            const lon = 2 * Math.PI * (x / w);
            const p = [Math.sin(lat) * Math.cos(lon), Math.cos(lat), Math.sin(lat) * Math.sin(lon)];
            let best = -1;
            for (const v of n) best = Math.max(best, p[0] * v[0] + p[1] * v[1] + p[2] * v[2]);
            const i = (y * w + x) * 4;
            if (best > 0.935) { img.data[i] = 17; img.data[i + 1] = 24; img.data[i + 2] = 39; }
            else if (best > 0.925 || (best < 0.86 && best > 0.852)) { img.data[i] = 160; img.data[i + 1] = 170; img.data[i + 2] = 180; }
          }
        }
        ctx.putImageData(img, 0, 0);
      });
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.42, 64, 48),
        pbr(0xffffff, { map: tex, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25 }));
      b.position.y = 0.42;
      return ombre(b);
    },

    plot() {
      const g = new THREE.Group();
      const orange = pbr(0xff6a13, { roughness: 0.42, clearcoat: 0.3 });
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.9), orange);
      base.position.y = 0.03;
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.3, 1.05, 48, 1, true), orange);
      cone.position.y = 0.58;
      const bande = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.19, 0.2, 48, 1, true),
        pbr(0xf1f5f9, { roughness: 0.15, metalness: 0.3 }));
      bande.position.y = 0.66;
      const sommet = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 24), orange);
      sommet.position.y = 1.1;
      g.add(base, cone, bande, sommet);
      return ombre(g);
    },

    coupelle() {
      // coupelle souple : profil tourné (lathe) avec trou au sommet
      const pts = [];
      for (let i = 0; i <= 20; i++) {
        const u = i / 20;
        pts.push(new THREE.Vector2(0.1 + 0.42 * u, 0.2 * Math.cos(u * Math.PI / 2) ** 1.4));
      }
      const g = new THREE.Group();
      const mat = pbr(0xfacc15, { roughness: 0.5, side: THREE.DoubleSide, sheen: 0.4 });
      const c1 = new THREE.Mesh(new THREE.LatheGeometry(pts, 64), mat);
      const c2 = c1.clone(); c2.material = pbr(0xff6a13, { roughness: 0.5, side: THREE.DoubleSide });
      c2.position.set(0.35, 0, -0.45); c2.scale.setScalar(0.85);
      c1.position.set(-0.15, 0, 0.15);
      const c3 = c1.clone(); c3.material = pbr(0x22c55e, { roughness: 0.5, side: THREE.DoubleSide });
      c3.position.set(-0.5, 0, -0.45); c3.scale.setScalar(0.8);
      g.add(c1, c2, c3);
      return ombre(g);
    },

    chasuble() {
      // chasuble en filet fluo : silhouette extrudée très fine, légèrement bombée
      const s = new THREE.Shape();
      s.moveTo(-0.36, -0.55); s.lineTo(0.36, -0.55);
      s.lineTo(0.4, 0.2); s.quadraticCurveTo(0.42, 0.42, 0.24, 0.5);
      s.lineTo(0.13, 0.52); s.quadraticCurveTo(0, 0.28, -0.13, 0.52);
      s.lineTo(-0.24, 0.5); s.quadraticCurveTo(-0.42, 0.42, -0.4, 0.2);
      s.lineTo(-0.36, -0.55);
      const geo = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 24 });
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) - 0.18 * pos.getX(i) ** 2); // bombé
      geo.computeVertexNormals();
      const filet = texture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = "#c6f432"; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "rgba(0,0,0,.18)";
        for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < w; x += 8) ctx.fillRect(x, y, 3, 3);
      });
      filet.wrapS = filet.wrapT = THREE.RepeatWrapping; filet.repeat.set(3, 3);
      const m = new THREE.Mesh(geo, pbr(0xffffff, { map: filet, roughness: 0.85, sheen: 1, sheenColor: new THREE.Color(0xeaff8a) }));
      // numéro imprimé
      const num = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshStandardMaterial({
        map: texture(128, 128, (ctx) => {
          ctx.font = "bold 96px Inter, Arial"; ctx.fillStyle = "#0f1724"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("7", 64, 70);
        }), transparent: true, roughness: 0.8,
      }));
      num.position.set(0, -0.12, 0.035);
      const g = new THREE.Group(); g.add(m, num);
      g.rotation.x = -0.12;
      g.position.y = 0.62;
      return ombre(g);
    },

    piquet() {
      const g = new THREE.Group();
      const rayures = texture(32, 256, (ctx, w, h) => {
        for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? "#111827" : "#facc15"; ctx.fillRect(0, i * h / 8, w, h / 8); }
      });
      const tige = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.6, 24), pbr(0xffffff, { map: rayures, roughness: 0.35, clearcoat: 0.5 }));
      tige.position.y = 0.86;
      const socle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.07, 40), pbr(0x1f2937, { roughness: 0.7 }));
      socle.position.y = 0.035;
      const embout = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), pbr(0xfacc15));
      embout.position.y = 1.67;
      g.add(tige, socle, embout);
      const g2 = g.clone(); g2.position.set(0.55, 0, -0.35); g2.rotation.z = 0.04;
      const t = new THREE.Group(); t.add(g, g2); t.position.x = -0.2;
      return ombre(t);
    },

    mini_but() { return but(1.5, 0.9, 0.7, 0xf97316); },
    grand_but() { return but(2.2, 0.88, 0.75, 0xffffff, true); },

    mannequin() {
      // mannequin de coup franc : silhouette extrudée sur pieds
      const s = new THREE.Shape();
      s.moveTo(-0.28, 0.25); s.lineTo(0.28, 0.25); s.lineTo(0.3, 1.15);
      s.quadraticCurveTo(0.3, 1.3, 0.14, 1.32); s.lineTo(0.1, 1.36);
      s.absarc(0, 1.5, 0.15, -Math.PI / 2 + 0.75, Math.PI * 1.5 - 0.75, false);
      s.lineTo(-0.14, 1.32); s.quadraticCurveTo(-0.3, 1.3, -0.3, 1.15); s.lineTo(-0.28, 0.25);
      const geo = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3, curveSegments: 32 });
      geo.translate(0, 0, -0.025);
      const corps = new THREE.Mesh(geo, pbr(0x2563eb, { roughness: 0.35, clearcoat: 0.6 }));
      const bande = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.09), pbr(0xfacc15, { roughness: 0.4 }));
      bande.position.y = 0.85;
      const g = new THREE.Group(); g.add(corps, bande);
      const metal = pbr(0x9ca3af, { metalness: 0.9, roughness: 0.3 });
      [-0.2, 0.2].forEach(x => {
        const pied = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 12), metal);
        pied.position.set(x, 0.14, 0); g.add(pied);
        const sabot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.32), metal);
        sabot.position.set(x, 0.01, 0); g.add(sabot);
      });
      g.scale.setScalar(0.95);
      return ombre(g);
    },

    echelle() {
      const g = new THREE.Group();
      const sangle = pbr(0xfacc15, { roughness: 0.75, sheen: 0.6 });
      const barreau = pbr(0xef4444, { roughness: 0.4, clearcoat: 0.4 });
      const L = 2.2, l = 0.55, n = 6;
      [-l / 2, l / 2].forEach(x => {
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, L), sangle);
        s.position.set(x, 0.008, 0); g.add(s);
      });
      for (let i = 0; i < n; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(l + 0.04, 0.02, 0.05), barreau);
        b.position.set(0, 0.016, -L / 2 + 0.15 + i * (L - 0.3) / (n - 1)); g.add(b);
      }
      g.rotation.y = 0.9;
      return ombre(g);
    },

    haie() {
      const g = new THREE.Group();
      const mat = pbr(0x22c55e, { roughness: 0.35, clearcoat: 0.6 });
      const blanc = pbr(0xf8fafc, { roughness: 0.35 });
      const W2 = 0.9, Hh = 0.38;
      const barre = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, W2, 20), mat);
      barre.rotation.z = Math.PI / 2; barre.position.y = Hh; g.add(barre);
      [-W2 / 2, W2 / 2].forEach(x => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, Hh, 16), mat);
        m.position.set(x, Hh / 2, 0); g.add(m);
        const pied = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 16), blanc);
        pied.rotation.x = Math.PI / 2; pied.position.set(x, 0.025, 0); g.add(pied);
      });
      const g2 = g.clone(); g2.position.z = -0.7; g2.position.x = 0.15;
      const t = new THREE.Group(); t.add(g, g2); t.position.z = 0.3;
      return ombre(t);
    },

    cerceau() {
      const g = new THREE.Group();
      [[0xef4444, -0.3, 0.1], [0x2563eb, 0.32, -0.15], [0xfacc15, 0, -0.55]].forEach(([c, x, z], i) => {
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.022, 16, 80), pbr(c, { roughness: 0.3, clearcoat: 0.7 }));
        t.rotation.x = Math.PI / 2; t.position.set(x, 0.022 + i * 0.001, z); g.add(t);
      });
      return ombre(g);
    },
  };

  function but(L, Hb, P, couleur, grand) {
    const g = new THREE.Group();
    const r = grand ? 0.035 : 0.025;
    const tube = pbr(couleur, { roughness: 0.3, clearcoat: 0.7, metalness: grand ? 0.2 : 0 });
    const cyl = (len) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 16), tube);
    [-L / 2, L / 2].forEach(x => {
      const p = cyl(Hb); p.position.set(x, Hb / 2, 0); g.add(p);
      const sol = cyl(P); sol.rotation.x = Math.PI / 2; sol.position.set(x, r, -P / 2); g.add(sol);
      const diag = cyl(Math.hypot(Hb, P)); diag.position.set(x, Hb / 2, -P / 2);
      diag.rotation.x = Math.atan2(P, Hb); g.add(diag);
    });
    const barre = cyl(L + 2 * r); barre.rotation.z = Math.PI / 2; barre.position.y = Hb; g.add(barre);
    const arr = cyl(L); arr.rotation.z = Math.PI / 2; arr.position.set(0, r, -P); g.add(arr);
    // filet
    const filet = new THREE.MeshStandardMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.55 });
    const fond = new THREE.Mesh(new THREE.PlaneGeometry(L, Math.hypot(Hb, P), 22, 12), filet);
    fond.position.set(0, Hb / 2, -P / 2); fond.rotation.x = Math.atan2(P, Hb);
    g.add(fond);
    [-L / 2, L / 2].forEach(x => {
      const tri = new THREE.Shape(); tri.moveTo(0, 0); tri.lineTo(0, Hb); tri.lineTo(P, 0); tri.lineTo(0, 0);
      const cote = new THREE.Mesh(new THREE.ShapeGeometry(tri, 1), filet);
      cote.rotation.y = Math.PI / 2; cote.position.set(x, 0, 0); g.add(cote);
    });
    g.position.z = P / 2;
    if (!grand) g.rotation.y = 0.2;
    ombre(g);
    g.traverse(m => { if (m.material === filet) m.castShadow = false; });
    return g;
  }

  // ---------------------------------------------------------------- scènes (une par matériel)
  const SCENES = {};
  function scenePour(id) {
    if (SCENES[id]) return SCENES[id];
    const scene = nouvelleScene();
    const fabrique = MODELES[id] || MODELES.plot;
    const objet = fabrique();
    const pivot = new THREE.Group(); pivot.add(objet); scene.add(pivot);
    // cadrage automatique
    const box = new THREE.Box3().setFromObject(pivot);
    const taille = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
    const rayon = Math.max(taille.x, taille.y, taille.z) * 0.62 + 0.15;
    SCENES[id] = { scene, pivot, centre, rayon, angle: -0.5 };
    return SCENES[id];
  }

  function dessiner(id, canvas2d, angle) {
    const s = scenePour(id);
    s.pivot.rotation.y = angle;
    const d = s.rayon / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.05;
    camera.position.set(s.centre.x, s.centre.y + d * 0.42, s.centre.z + d * 0.92);
    camera.lookAt(s.centre.x, s.centre.y * 0.85, s.centre.z);
    renderer.render(s.scene, camera);
    const ctx = canvas2d.getContext("2d");
    if (canvas2d.width !== renderer.domElement.width) {
      canvas2d.width = renderer.domElement.width; canvas2d.height = renderer.domElement.height;
    }
    ctx.clearRect(0, 0, canvas2d.width, canvas2d.height);
    ctx.drawImage(renderer.domElement, 0, 0);
  }

  // ---------------------------------------------------------------- vignettes (bloc « Matériel préparé »)
  document.querySelectorAll("canvas[data-mat-thumb]").forEach(c => dessiner(c.dataset.matThumb, c, -0.5));

  // ---------------------------------------------------------------- sélecteur dans la popup
  const grille = document.getElementById("mat-grid");
  const champ = document.getElementById("mat-input");
  const compteur = document.getElementById("mat-count");
  const popup = document.getElementById("modal-planif");
  if (!grille || !champ) return;

  let choix = {};
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  grille.innerHTML = CATALOGUE.map(m => `
    <div class="mat-card" data-id="${esc(m.id)}" role="button" tabindex="0" aria-pressed="false">
      <canvas class="mat-3d" aria-hidden="true"></canvas>
      <span class="mat-check"><i data-lucide="check"></i></span>
      <strong>${esc(m.nom)}</strong>
      <div class="mat-step">
        <button type="button" data-moins aria-label="Moins">−</button>
        <input type="number" min="0" max="${m.max}" value="0" aria-label="Quantité ${esc(m.nom)}">
        <button type="button" data-plus aria-label="Plus">+</button>
      </div>
    </div>`).join("");
  if (window.lucide) lucide.createIcons();

  const cartes = [...grille.querySelectorAll(".mat-card")].map(el => ({
    el, id: el.dataset.id, canvas: el.querySelector("canvas"), input: el.querySelector("input"),
    angle: -0.5 + Math.random() * 0.3, survol: false,
  }));

  function maj() {
    cartes.forEach(c => {
      const q = choix[c.id] || 0;
      c.el.classList.toggle("on", q > 0);
      c.el.setAttribute("aria-pressed", q > 0);
      if (document.activeElement !== c.input) c.input.value = q;
    });
    champ.value = JSON.stringify(choix);
    const n = Object.keys(choix).length;
    if (compteur) {
      compteur.textContent = n ? `${n} type${n > 1 ? "s" : ""} choisi${n > 1 ? "s" : ""}` : "Aucun";
      compteur.classList.toggle("on", n > 0);
    }
  }
  function regler(id, q) {
    const max = PAR_ID[id].max;
    q = Math.max(0, Math.min(max, Math.round(Number(q) || 0)));
    if (q) choix[id] = q; else delete choix[id];
    maj();
    champ.dispatchEvent(new CustomEvent("mat-change", { bubbles: true }));
  }

  cartes.forEach(c => {
    c.el.addEventListener("click", e => {
      if (e.target.closest(".mat-step")) return;
      regler(c.id, choix[c.id] ? 0 : PAR_ID[c.id].defaut);
    });
    c.el.addEventListener("keydown", e => {
      if ((e.key === "Enter" || e.key === " ") && e.target === c.el) { e.preventDefault(); c.el.click(); }
    });
    c.el.querySelector("[data-moins]").addEventListener("click", () => regler(c.id, (choix[c.id] || 0) - 1));
    c.el.querySelector("[data-plus]").addEventListener("click", () => regler(c.id, (choix[c.id] || 0) + 1));
    c.input.addEventListener("change", () => regler(c.id, c.input.value));
    c.el.addEventListener("mouseenter", () => { c.survol = true; });
    c.el.addEventListener("mouseleave", () => { c.survol = false; });
  });

  // animation : rotation lente, plus rapide au survol ou si sélectionné
  let dernier = 0;
  function boucle(t) {
    requestAnimationFrame(boucle);
    if (!popup || popup.hidden) { dernier = t; return; }
    const dt = Math.min((t - (dernier || t)) / 1000, 0.05); dernier = t;
    cartes.forEach(c => {
      const r = c.canvas.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight || !r.width) return;   // hors écran
      c.angle += dt * (c.survol ? 1.8 : choix[c.id] ? 0.7 : 0.25);
      dessiner(c.id, c.canvas, c.angle);
    });
  }
  requestAnimationFrame(boucle);

  window.YallaMateriel = {
    set(valeur) { choix = {}; Object.entries(valeur || {}).forEach(([k, v]) => { if (PAR_ID[k] && v > 0) choix[k] = Math.min(v, PAR_ID[k].max); }); maj(); },
  };
  maj();
}
