/* Yalla • Visionneuse 3D des exercices (Three.js, fonctionne hors ligne)
   Les scénarios viennent de training/exercices.py (json "exercices-data"). */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";

const overlay = document.getElementById("modal-3d");
const dataEl = document.getElementById("exercices-data");
if (overlay && dataEl) init();

function init() {
  const EXOS = JSON.parse(dataEl.textContent);
  const PAR_ID = Object.fromEntries(EXOS.map(e => [e.id, e]));
  const NOMS_OBJ = { TACTIQUE: "Tactique", TECHNIQUE: "Technique", PHYSIQUE: "Physique",
                     FINITION: "Finition", RECUPERATION: "Récupération" };
  const $ = id => document.getElementById(id);
  const stage = $("v3d-stage"), canvas = $("v3d-canvas");
  const playBtn = $("v3d-play"), timeRange = $("v3d-time"), clock = $("v3d-clock");
  const fade = $("v3d-fade"), goalTxt = $("v3d-goal");

  const BUT_X = 22, BALL_R = 0.16;
  const COULEURS = {
    A:  { maillot: 0x16a34a, short: 0xf8fafc, chaussettes: 0x16a34a },
    B:  { maillot: 0xf97316, short: 0x1e293b, chaussettes: 0x1e293b },
    GK: { maillot: 0xfacc15, short: 0x111827, chaussettes: 0x111827 },
  };
  const PEAUX = [0xf1c27d, 0xc68642, 0x8d5524, 0xe0ac69, 0x5c3a21];

  // ------------------------------------------------------------ scène
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = ciel();
  scene.fog = new THREE.Fog(0xdcebe1, 60, 120);

  // Ciel clair dégradé (mêmes tons que la page)
  function ciel() {
    const c = document.createElement("canvas");
    c.width = 4; c.height = 256;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#f4f8f5");
    g.addColorStop(0.6, "#e7f4ec");
    g.addColorStop(1, "#dcebe1");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 300);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.minDistance = 5;
  controls.maxDistance = 70;

  scene.add(new THREE.HemisphereLight(0xdbeafe, 0x14532d, 1.1));
  const soleil = new THREE.DirectionalLight(0xffffff, 2.2);
  soleil.position.set(-14, 30, 18);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(2048, 2048);
  Object.assign(soleil.shadow.camera, { left: -35, right: 35, top: 30, bottom: -30, near: 1, far: 90 });
  soleil.shadow.bias = -0.0005;
  scene.add(soleil);

  scene.add(creerTerrain());
  const but = creerBut();
  scene.add(but);

  // Groupe qui contient les éléments de l'exercice courant
  let groupeExo = new THREE.Group();
  scene.add(groupeExo);

  // ------------------------------------------------------------ terrain
  function creerTerrain() {
    const g = new THREE.Group();
    const L = 84, W = 58, X0 = -46, PX = 20;          // zone dessinée : x de -46 à 38
    const c = document.createElement("canvas");
    c.width = L * PX; c.height = W * PX;
    const ctx = c.getContext("2d");
    const X = x => (x - X0) * PX, Z = z => (z + W / 2) * PX;
    // bandes de tonte
    for (let i = 0; i * 5 < L; i++) {
      ctx.fillStyle = i % 2 ? "#2f8f46" : "#2a823f";
      ctx.fillRect(i * 5 * PX, 0, 5 * PX + 1, c.height);
    }
    // léger grain
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2);
    }
    ctx.strokeStyle = "rgba(255,255,255,.92)";
    ctx.lineWidth = 0.12 * PX;
    const rect = (x1, z1, x2, z2) => ctx.strokeRect(X(x1), Z(z1), X(x2) - X(x1), Z(z2) - Z(z1));
    rect(-44, -25, BUT_X, 25);                                // limites
    rect(BUT_X - 16.5, -20.16, BUT_X, 20.16);                 // surface de réparation
    rect(BUT_X - 5.5, -9.16, BUT_X, 9.16);                    // surface de but
    ctx.beginPath(); ctx.arc(X(BUT_X - 11), Z(0), 0.25 * PX, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();                       // point de penalty
    ctx.beginPath();                                          // arc de cercle
    const a = Math.acos(5.5 / 9.15);
    ctx.arc(X(BUT_X - 11), Z(0), 9.15 * PX, Math.PI - a, Math.PI + a);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const sol = new THREE.Mesh(new THREE.PlaneGeometry(L, W),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    sol.rotation.x = -Math.PI / 2;
    sol.position.set(X0 + L / 2, 0, 0);
    sol.receiveShadow = true;
    g.add(sol);

    const autour = new THREE.Mesh(new THREE.PlaneGeometry(260, 220),
      new THREE.MeshStandardMaterial({ color: 0x3f8f55, roughness: 1 }));
    autour.rotation.x = -Math.PI / 2;
    autour.position.y = -0.02;
    autour.receiveShadow = true;
    g.add(autour);
    return g;
  }

  function creerBut() {
    const g = new THREE.Group();
    const blanc = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const r = 0.06, H = 2.44, Wb = 3.66, P = 1.8;
    const poteau = h => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), blanc);
    [-Wb, Wb].forEach(z => {
      const p = poteau(H); p.position.set(BUT_X, H / 2, z); p.castShadow = true; g.add(p);
    });
    const barre = poteau(Wb * 2 + r * 2); barre.rotation.x = Math.PI / 2; barre.position.set(BUT_X, H, 0);
    barre.castShadow = true; g.add(barre);
    const filetMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0, wireframe: true, transparent: true, opacity: 0.45 });
    const fond = new THREE.Mesh(new THREE.PlaneGeometry(Wb * 2, H, 24, 10), filetMat);
    fond.position.set(BUT_X + P, H / 2, 0); fond.rotation.y = Math.PI / 2; g.add(fond);
    const toit = new THREE.Mesh(new THREE.PlaneGeometry(P, Wb * 2, 8, 24), filetMat);
    toit.rotation.x = -Math.PI / 2; toit.position.set(BUT_X + P / 2, H, 0); g.add(toit);
    [-Wb, Wb].forEach(z => {
      const cote = new THREE.Mesh(new THREE.PlaneGeometry(P, H, 8, 10), filetMat);
      cote.position.set(BUT_X + P / 2, H / 2, z); g.add(cote);
    });
    return g;
  }

  // ------------------------------------------------------------ éléments
  function creerPlot(x, z) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.5 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.42, 16), mat);
    cone.position.y = 0.23; cone.castShadow = true;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 16), mat);
    base.position.y = 0.015;
    const bande = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.125, 0.07, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff }));
    bande.position.y = 0.3;
    g.add(cone, base, bande);
    g.position.set(x, 0, z);
    return g;
  }

  function texBallon() {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fafafa"; ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = "#111827";
    const taches = [[32, 30], [96, 30], [160, 30], [224, 30], [0, 92], [64, 92], [128, 92], [192, 92], [256, 92]];
    taches.forEach(([x, y]) => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
        ctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 18);
      }
      ctx.fill();
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const BALLON_TEX = texBallon();

  function creerBallon() {
    const m = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 24, 16),
      new THREE.MeshStandardMaterial({ map: BALLON_TEX, roughness: 0.45 }));
    m.castShadow = true;
    return m;
  }

  function creerJoueur(equipe, indice) {
    const c = COULEURS[equipe] || COULEURS.A;
    const mat = col => new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 });
    const maillot = mat(c.maillot), short = mat(c.short), chaus = mat(c.chaussettes);
    const peau = mat(PEAUX[indice % PEAUX.length]), noir = mat(0x111111);
    const g = new THREE.Group();
    const cap = (r, l, m) => { const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 4, 10), m); o.castShadow = true; return o; };

    // Jambes (pivot à la hanche)
    const jambes = [-0.11, 0.11].map(dx => {
      const pivot = new THREE.Group();
      pivot.position.set(dx, 0.92, 0);
      const cuisse = cap(0.085, 0.3, short); cuisse.position.y = -0.2;
      const mollet = cap(0.07, 0.34, chaus); mollet.position.y = -0.58;
      const pied = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.24), noir);
      pied.position.set(0, -0.86, 0.05); pied.castShadow = true;
      pivot.add(cuisse, mollet, pied);
      g.add(pivot);
      return pivot;
    });
    const torse = cap(0.2, 0.42, maillot); torse.position.y = 1.27; torse.scale.set(1.15, 1, 0.8);
    g.add(torse);
    const bras = [-0.29, 0.29].map(dx => {
      const pivot = new THREE.Group();
      pivot.position.set(dx, 1.52, 0);
      const haut = cap(0.065, 0.24, maillot); haut.position.y = -0.17;
      const avant = cap(0.055, 0.24, equipe === "GK" ? noir : peau); avant.position.y = -0.45;
      pivot.add(haut, avant);
      pivot.rotation.z = dx < 0 ? -0.12 : 0.12;
      g.add(pivot);
      return pivot;
    });
    const cou = cap(0.06, 0.06, peau); cou.position.y = 1.62; g.add(cou);
    const tete = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), peau);
    tete.position.y = 1.8; tete.castShadow = true; g.add(tete);
    const cheveux = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.1), noir);
    cheveux.position.y = 1.82; cheveux.rotation.x = -0.25; g.add(cheveux);

    g.scale.setScalar(1.15);
    g.userData = { jambes, bras, phase: Math.random() * 6, angle: null, frappe: -1 };
    return g;
  }

  // ------------------------------------------------------------ interpolation
  function surChemin(chemin, t) {
    if (t <= chemin[0][0]) return { x: chemin[0][1], z: chemin[0][2], vx: 0, vz: 0 };
    for (let i = 0; i < chemin.length - 1; i++) {
      const [t0, x0, z0] = chemin[i], [t1, x1, z1] = chemin[i + 1];
      if (t <= t1) {
        const d = Math.max(t1 - t0, 1e-6), u = (t - t0) / d;
        return { x: x0 + (x1 - x0) * u, z: z0 + (z1 - z0) * u, vx: (x1 - x0) / d, vz: (z1 - z0) / d };
      }
    }
    const f = chemin[chemin.length - 1];
    return { x: f[1], z: f[2], vx: 0, vz: 0 };
  }

  function surBallon(cles, t) {
    if (t <= cles[0][0]) { const k = cles[0]; return { x: k[1], z: k[2], y: k[3], vx: 0, vz: 0 }; }
    for (let i = 0; i < cles.length - 1; i++) {
      const [t0, x0, z0, h0, lob] = cles[i], [t1, x1, z1, h1] = cles[i + 1];
      if (t <= t1) {
        const d = Math.max(t1 - t0, 1e-6), u = (t - t0) / d;
        return { x: x0 + (x1 - x0) * u, z: z0 + (z1 - z0) * u,
                 y: h0 + (h1 - h0) * u + (lob || 0) * 4 * u * (1 - u),
                 vx: (x1 - x0) / d, vz: (z1 - z0) / d };
      }
    }
    const k = cles[cles.length - 1];
    return { x: k[1], z: k[2], y: k[3], vx: 0, vz: 0 };
  }

  // Moments où le ballon part (pour l'animation de frappe)
  function departsBallon(cles) {
    const out = [];
    for (let i = 0; i < cles.length - 1; i++) {
      const [t0, x0, z0] = cles[i], [, x1, z1] = cles[i + 1];
      if (Math.hypot(x1 - x0, z1 - z0) > 1.2) out.push({ t: t0, x: x0, z: z0 });
    }
    return out;
  }

  // ------------------------------------------------------------ exercice courant
  let exo = null, acteurs = [], ballons = [], departs = [];
  let temps = 0, vitesse = 1, enPause = false, pauseFin = 0, butAffiche = false;
  let liste = [], cible = new THREE.Vector3();

  function viderGroupe() {
    scene.remove(groupeExo);
    groupeExo.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    groupeExo = new THREE.Group();
    scene.add(groupeExo);
  }

  function charger(id) {
    exo = PAR_ID[id];
    if (!exo) return;
    const sc = exo.scenario;
    viderGroupe();
    but.visible = !!sc.but;
    (sc.plots || []).forEach(([x, z]) => groupeExo.add(creerPlot(x, z)));
    acteurs = sc.acteurs.map((a, i) => {
      const j = creerJoueur(a.equipe, i);
      groupeExo.add(j);
      return { def: a, obj: j };
    });
    ballons = sc.ballons.map(cles => {
      const b = creerBallon();
      groupeExo.add(b);
      return { cles, obj: b, prec: null };
    });
    departs = ballons.map(b => departsBallon(b.cles));

    // Centre et taille de la zone de jeu (pour les caméras)
    const pts = [];
    sc.acteurs.forEach(a => a.chemin.forEach(p => pts.push([p[1], p[2]])));
    sc.ballons.forEach(c => c.forEach(k => pts.push([k[1], k[2]])));
    (sc.plots || []).forEach(p => pts.push(p));
    if (sc.but) pts.push([BUT_X + 1, 0]);
    const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    cible.set((minX + maxX) / 2, 0.8, (minZ + maxZ) / 2);
    exo.taille = Math.max(maxX - minX, (maxZ - minZ) * 1.5, 10);

    // Infos à droite
    $("v3d-obj").textContent = NOMS_OBJ[exo.objectif] || exo.objectif;
    $("v3d-obj").className = "v3d-kicker o-" + exo.objectif.toLowerCase();
    $("v3d-titre").querySelector(".marker").textContent = exo.nom.toUpperCase();
    $("v3d-desc").textContent = exo.description;
    $("v3d-duree").textContent = exo.duree + " min";
    $("v3d-joueurs").textContent = exo.joueurs + " joueurs";
    $("v3d-materiel").textContent = exo.materiel || "—";
    $("v3d-consignes").innerHTML = "";
    (exo.consignes || []).forEach(c => {
      const li = document.createElement("li"); li.textContent = c; $("v3d-consignes").appendChild(li);
    });
    document.querySelectorAll("#v3d-tabs button").forEach(b => b.classList.toggle("active", b.dataset.id === id));

    temps = 0; pauseFin = 0;
    acteurs.forEach(a => { a.obj.userData.angle = null; });
    ballons.forEach(b => { b.prec = null; });
    camera_(document.querySelector("#v3d-cams .active")?.dataset.cam || "tv", true);
    goalTxt.classList.remove("show"); butAffiche = false;
    poser(0, 0);
  }

  function camera_(nom, immediat) {
    document.querySelectorAll("#v3d-cams button").forEach(b => b.classList.toggle("active", b.dataset.cam === nom));
    const d = exo ? exo.taille : 20;
    const c = cible;
    const pos = {
      tv: new THREE.Vector3(c.x - d * 0.1, d * 0.5 + 3.5, c.z + d * 0.78 + 3.5),
      dessus: new THREE.Vector3(c.x, d * 1.15 + 6, c.z + 0.01),
      coach: new THREE.Vector3(c.x - d * 0.75 - 3, 4.5 + d * 0.12, c.z + d * 0.12),
    }[nom];
    camAnim = { de: camera.position.clone(), vers: pos, deC: controls.target.clone(), versC: c.clone(), u: immediat ? 1 : 0 };
    if (immediat) { camera.position.copy(pos); controls.target.copy(c); }
  }
  let camAnim = null;

  // Place tout le monde à l'instant t (dt = temps écoulé, pour les animations de course)
  function poser(t, dt) {
    const sc = exo.scenario;
    // ballons
    const posBallons = ballons.map(b => {
      const p = surBallon(b.cles, t);
      b.obj.position.set(p.x, BALL_R + p.y, p.z);
      if (b.prec) {
        const dx = p.x - b.prec.x, dz = p.z - b.prec.z, dist = Math.hypot(dx, dz);
        if (dist > 1e-4 && dist < 3) {
          const axe = new THREE.Vector3(dz, 0, -dx).normalize();
          b.obj.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axe, dist / BALL_R));
        }
      }
      b.prec = { x: p.x, z: p.z };
      return p;
    });
    // frappes : le joueur le plus proche du ballon au moment du départ frappe
    if (dt > 0) {
      departs.forEach(liste => liste.forEach(dep => {
        if (dep.t > t - dt && dep.t <= t) {
          let best = null, bd = 1.8;
          acteurs.forEach(a => {
            const d = Math.hypot(a.obj.position.x - dep.x, a.obj.position.z - dep.z);
            if (d < bd) { bd = d; best = a; }
          });
          if (best) best.obj.userData.frappe = 0;
        }
      }));
    }
    // joueurs
    acteurs.forEach(a => {
      const p = surChemin(a.def.chemin, t);
      const o = a.obj, ud = o.userData;
      o.position.set(p.x, 0, p.z);
      const v = Math.hypot(p.vx, p.vz);
      let angleVise;
      if (v > 0.3) angleVise = Math.atan2(p.vx, p.vz);
      else {
        let pb = posBallons[0], bd = Infinity;
        posBallons.forEach(b => { const d = Math.hypot(b.x - p.x, b.z - p.z); if (d < bd) { bd = d; pb = b; } });
        angleVise = pb && bd > 0.05 ? Math.atan2(pb.x - p.x, pb.z - p.z) : (ud.angle ?? 0);
      }
      if (ud.angle === null || dt === 0) ud.angle = angleVise;
      else {
        let diff = angleVise - ud.angle;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        ud.angle += diff * Math.min(1, dt * 8);
      }
      o.rotation.y = ud.angle;

      // course : balancier des bras et des jambes
      const amp = Math.min(v / 6, 1) * 0.85;
      ud.phase += dt * (5 + v * 1.6);
      const s = Math.sin(ud.phase) * amp;
      ud.jambes[0].rotation.x = s;
      ud.jambes[1].rotation.x = -s;
      ud.bras[0].rotation.x = -s * 0.9;
      ud.bras[1].rotation.x = s * 0.9;
      o.position.y = Math.abs(Math.cos(ud.phase)) * amp * 0.09;
      // frappe du pied droit
      if (ud.frappe >= 0) {
        ud.frappe += dt / 0.38;
        if (ud.frappe >= 1) ud.frappe = -1;
        else ud.jambes[1].rotation.x = -1.3 * Math.sin(Math.PI * ud.frappe) + 0.35 * Math.sin(Math.PI * ud.frappe * 2);
      }
      // gardien : bras écartés
      if (a.def.equipe === "GK") { ud.bras[0].rotation.z = -0.6; ud.bras[1].rotation.z = 0.6; }
    });
    // "BUT !" quand le ballon entre dans le but
    if (sc.but) {
      const dedans = posBallons.some(b => b.x > BUT_X + 0.2 && Math.abs(b.z) < 3.66 && b.y < 2.44);
      if (dedans && !butAffiche) goalTxt.classList.add("show");
      if (!dedans && butAffiche) goalTxt.classList.remove("show");
      butAffiche = dedans;
    }
  }

  // ------------------------------------------------------------ boucle de rendu
  let ouvert = false, dernier = 0, raf = 0;
  function boucle(now) {
    if (!ouvert) return;
    raf = requestAnimationFrame(boucle);
    const dt = Math.min((now - (dernier || now)) / 1000, 0.05);
    dernier = now;
    redimensionner();
    if (exo) {
      const sc = exo.scenario;
      if (!enPause) {
        const pas = dt * vitesse;
        if (pauseFin > 0) {                     // fin d'un exercice non bouclé : fondu puis on recommence
          pauseFin -= dt;
          fade.classList.toggle("on", pauseFin < 0.45);
          if (pauseFin <= 0) {
            temps = 0; acteurs.forEach(a => { a.obj.userData.angle = null; });
            ballons.forEach(b => { b.prec = null; });
            poser(0, 0);
            setTimeout(() => fade.classList.remove("on"), 60);
          }
        } else {
          temps += pas;
          if (temps >= sc.duree) {
            if (sc.boucle) temps %= sc.duree;
            else { temps = sc.duree; pauseFin = 1.3; }
          }
          poser(temps, pas);
        }
      }
      timeRange.value = Math.round(temps / sc.duree * 1000);
      clock.textContent = `${temps.toFixed(1)} / ${sc.duree.toFixed(1)} s`;
    }
    if (camAnim && camAnim.u < 1) {
      camAnim.u = Math.min(1, camAnim.u + dt * 1.6);
      const k = 1 - Math.pow(1 - camAnim.u, 3);
      camera.position.lerpVectors(camAnim.de, camAnim.vers, k);
      controls.target.lerpVectors(camAnim.deC, camAnim.versC, k);
    }
    controls.update();
    renderer.render(scene, camera);
  }

  function redimensionner() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  // ------------------------------------------------------------ interface
  function setPause(p) {
    enPause = p;
    playBtn.classList.toggle("paused", p);
  }

  function open(ids, depart) {
    liste = (ids || []).filter(id => PAR_ID[id]);
    if (!liste.length) return;
    const tabs = $("v3d-tabs");
    tabs.innerHTML = "";
    tabs.hidden = liste.length < 2;
    liste.forEach((id, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.dataset.id = id;
      b.innerHTML = `<b>${i + 1}</b>`;
      b.append(document.createTextNode(PAR_ID[id].nom));
      b.addEventListener("click", () => { charger(id); setPause(false); });
      tabs.appendChild(b);
    });
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("open"));
    document.body.style.overflow = "hidden";
    ouvert = true; dernier = 0;
    redimensionner();
    document.querySelectorAll("#v3d-cams button").forEach(b => b.classList.toggle("active", b.dataset.cam === "tv"));
    charger(liste.includes(depart) ? depart : liste[0]);
    setPause(false);
    $("v3d-loading").hidden = true;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(boucle);
  }

  function fermer() {
    ouvert = false;
    cancelAnimationFrame(raf);
    overlay.classList.remove("open");
    goalTxt.classList.remove("show");
    // la popup de planification peut rester ouverte derrière
    const planif = document.getElementById("modal-planif");
    if (!planif || planif.hidden) document.body.style.overflow = "";
    setTimeout(() => { overlay.hidden = true; }, 200);
  }

  playBtn.addEventListener("click", () => setPause(!enPause));
  $("v3d-replay").addEventListener("click", () => {
    temps = 0; pauseFin = 0; fade.classList.remove("on");
    acteurs.forEach(a => { a.obj.userData.angle = null; });
    ballons.forEach(b => { b.prec = null; });
    poser(0, 0); setPause(false);
  });
  timeRange.addEventListener("input", () => {
    if (!exo) return;
    setPause(true);
    pauseFin = 0; fade.classList.remove("on");
    const t = timeRange.value / 1000 * exo.scenario.duree;
    ballons.forEach(b => { b.prec = null; });
    poser(t, 0); temps = t;
  });
  $("v3d-speed").addEventListener("click", e => {
    const b = e.target.closest("[data-speed]");
    if (!b) return;
    vitesse = Number(b.dataset.speed);
    document.querySelectorAll("#v3d-speed button").forEach(x => x.classList.toggle("active", x === b));
  });
  $("v3d-cams").addEventListener("click", e => {
    const b = e.target.closest("[data-cam]");
    if (b) camera_(b.dataset.cam, false);
  });
  overlay.querySelectorAll("[data-v3d-fermer]").forEach(el => el.addEventListener("click", fermer));
  overlay.addEventListener("click", e => { if (e.target === overlay) fermer(); });
  document.addEventListener("keydown", e => {
    if (!ouvert) return;
    if (e.key === "Escape") fermer();
    if (e.key === " " && e.target === document.body) { e.preventDefault(); setPause(!enPause); }
  });

  // Boutons « Voir en 3D » des cartes du calendrier
  document.addEventListener("click", e => {
    const b = e.target.closest(".btn-3d[data-voir3d]");
    if (!b) return;
    e.preventDefault();
    const ids = b.dataset.voir3d.split(",").filter(Boolean);
    open(ids, ids[0]);
  });

  window.Yalla3D = { open, fermer };
}
