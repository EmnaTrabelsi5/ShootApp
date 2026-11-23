/* Yalla • Popup de séance en 6 étapes : on termine une partie, puis on passe à la suivante. */
(function () {
  const form = document.getElementById("form-planif");
  if (!form || !document.getElementById("wz-steps")) return;
  const etapes = [...form.querySelectorAll(".wz-step")];
  const puces = [...document.querySelectorAll("#wz-steps li")];
  const N = etapes.length;
  const bar = document.getElementById("wz-bar");
  const btnPrec = document.getElementById("wz-prec"), btnSuiv = document.getElementById("wz-suiv");
  const btnSave = document.getElementById("wz-save"), btnAnnuler = document.getElementById("wz-annuler");
  const compte = document.getElementById("wz-count");
  const recap = document.getElementById("wz-recap");
  const modal = form.closest(".modal");
  const lire = id => { const el = document.getElementById(id); return el ? JSON.parse(el.textContent) : []; };
  const JOUEURS = Object.fromEntries(lire("joueurs-data").map(j => [String(j.id), j]));
  const EXOS = Object.fromEntries(lire("exercices-data").map(e => [e.id, e]));
  const MAT = Object.fromEntries(lire("materiel-data").map(m => [m.id, m]));
  const TYPES = { ENTRAINEMENT: "Entraînement", DECRASSAGE: "Décrassage", REPOS: "Repos actif" };
  const OBJ = { TACTIQUE: "Tactique", TECHNIQUE: "Technique", PHYSIQUE: "Physique", FINITION: "Finition", RECUPERATION: "Récupération" };

  let courante = 1, maxAtteinte = 1;
  const V = () => window.YallaValidation;
  const champs = n => (etapes[n - 1].dataset.champs || "").split(" ").filter(Boolean);
  const erreursEtape = n => { const err = V() ? V().erreurs() : {}; return champs(n).filter(k => err[k]); };
  const etapeValide = n => erreursEtape(n).length === 0;

  function afficher() {
    etapes.forEach((e, i) => { e.hidden = i + 1 !== courante; });
    puces.forEach((p, i) => {
      const n = i + 1;
      p.classList.toggle("active", n === courante);
      p.classList.toggle("done", n < courante || (n <= maxAtteinte && n !== courante && etapeValide(n)));
      p.classList.toggle("ko", n !== courante && n <= maxAtteinte && n < N && !etapeValide(n));
      p.classList.toggle("open", n <= maxAtteinte);
    });
    bar.style.width = `${((courante - 1) / (N - 1)) * 100}%`;
    btnPrec.hidden = courante === 1;
    btnAnnuler.hidden = courante !== 1;
    btnSuiv.hidden = courante === N;
    btnSave.hidden = courante !== N;
    compte.textContent = `Étape ${courante} / ${N}`;
    majSuivant();
    if (courante === N) construireRecap();
    if (window.lucide) lucide.createIcons();
  }

  function majSuivant() { btnSuiv.classList.toggle("off", courante < N && !etapeValide(courante)); }

  function aller(n, sansScroll) {
    courante = Math.max(1, Math.min(N, n));
    maxAtteinte = Math.max(maxAtteinte, courante);
    afficher();
    if (!sansScroll && modal) modal.scrollTo({ top: 0, behavior: "smooth" });
    const premier = etapes[courante - 1].querySelector("input:not([type=hidden]):not([type=radio]), textarea");
    if (premier && courante === 2) setTimeout(() => premier.focus(), 120);
  }

  function secouer() { if (V()) V().secouer(); }

  function suivant() {
    const ko = erreursEtape(courante);
    if (ko.length) {
      if (V()) V().montrer(champs(courante));
      secouer();
      const f = etapes[courante - 1].querySelector(".field.has-error");
      if (f) f.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (V()) V().montrer(champs(courante));
    aller(courante + 1);
  }

  // Une étape plus loin n'est accessible que si toutes les précédentes sont valides
  function peutAller(n) {
    for (let i = 1; i < n; i++) if (i < N && !etapeValide(i) && i >= courante) return i;
    return null;
  }

  btnSuiv.addEventListener("click", suivant);
  btnPrec.addEventListener("click", () => aller(courante - 1));
  puces.forEach((p, i) => p.addEventListener("click", () => {
    const n = i + 1;
    if (n === courante) return;
    if (n < courante || n <= maxAtteinte) { aller(n); return; }
    const bloque = peutAller(n);
    if (bloque) { aller(bloque); suivant(); return; }
    aller(n);
  }));
  // Entrée dans un champ texte = étape suivante (pas d'envoi prématuré)
  form.addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target.matches("input:not([type=checkbox])") && courante < N) { e.preventDefault(); suivant(); }
  });
  ["input", "change"].forEach(t => form.addEventListener(t, () => setTimeout(() => { majSuivant(); afficherPuces(); }, 0)));
  document.addEventListener("mat-change", () => setTimeout(majSuivant, 0));
  const pkInputs = document.getElementById("pk-inputs");
  if (pkInputs) new MutationObserver(() => setTimeout(majSuivant, 0)).observe(pkInputs, { childList: true });
  function afficherPuces() {
    puces.forEach((p, i) => {
      const n = i + 1;
      if (n === courante || n > maxAtteinte || n === N) return;
      const ok = etapeValide(n);
      p.classList.toggle("done", ok); p.classList.toggle("ko", !ok);
    });
  }

  // ------------------------------------------------------------ récapitulatif
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const hm = m => m === null ? "—" : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const duree = m => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}` : `${m} min`;

  function bloc(n, icone, titre, contenu) {
    const ok = n === null || etapeValide(n);
    return `<div class="wz-card${ok ? "" : " ko"}">
      <div class="wz-card-head"><span><i data-lucide="${icone}"></i>${titre}</span>
        ${n ? `<button type="button" data-edit="${n}"><i data-lucide="pencil"></i>Modifier</button>` : ""}</div>
      <div class="wz-card-body">${contenu}</div></div>`;
  }

  function construireRecap() {
    if (!V()) return;
    const s = V().etat();
    const dateTxt = s.date ? new Date(s.date + "T00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "—";
    const d = s.debut !== null && s.fin !== null && s.fin > s.debut ? s.fin - s.debut : null;
    const joueurs = s.joueurs.map(id => JOUEURS[id]).filter(Boolean);
    const exos = s.exercices.map(id => EXOS[id]).filter(Boolean);
    const mats = Object.entries(s.materiel || {}).filter(([k]) => MAT[k]);
    const err = V().erreurs();
    const nbErr = Object.keys(err).length;
    recap.innerHTML =
      (nbErr ? `<div class="wz-alerte"><i data-lucide="shield-alert"></i>${nbErr} point${nbErr > 1 ? "s" : ""} à corriger : clique sur « Modifier » dans la carte en rouge.</div>`
             : `<div class="wz-ok"><i data-lucide="shield-check"></i>Tout est valide, tu peux enregistrer la séance.</div>`) +
      `<div class="wz-hero o-${(s.objectif || "").toLowerCase()}">
        <span class="wz-tags"><b>${esc(TYPES[s.type] || s.type)}</b><i class="g-dot"></i>${esc(OBJ[s.objectif] || "")}</span>
        <strong>${esc(s.titre || "Sans titre")}</strong>
        <span>${esc(dateTxt)} • ${hm(s.debut)} → ${hm(s.fin)}${d ? ` (${duree(d)})` : ""} • ${esc(s.terrain || "—")} • RPE ${isNaN(s.rpe) ? "—" : s.rpe}</span>
        <button type="button" data-edit="2"><i data-lucide="pencil"></i></button>
      </div>
      <div class="wz-grid">` +
      bloc(3, "users", `Joueurs <em>${joueurs.length}</em>`,
        joueurs.length ? `<div class="wz-avatars">${joueurs.slice(0, 14).map(j =>
          `<span class="wz-av${j.statut === "DISPENSE" ? " disp" : ""}" title="${esc(j.prenom + " " + j.nom)}">${esc((j.prenom || "")[0] || "")}${esc((j.nom || "")[0] || "")}</span>`).join("")}${joueurs.length > 14 ? `<span class="wz-av plus">+${joueurs.length - 14}</span>` : ""}</div>` : "<p class='wz-vide'>Aucun joueur</p>") +
      bloc(4, "box", `Exercices <em>${exos.reduce((t, e) => t + e.duree, 0)} min</em>`,
        exos.length ? `<ul>${exos.map(e => `<li>${esc(e.nom)}<em>${e.duree} min</em></li>`).join("")}</ul>` : "<p class='wz-vide'>Aucun exercice</p>") +
      bloc(5, "package", `Matériel <em>${mats.length}</em>`,
        mats.length ? `<div class="wz-mats">${mats.map(([k, q]) => `<span><b>${q}</b>${esc(MAT[k].nom)}</span>`).join("")}</div>` : "<p class='wz-vide'>Aucun matériel</p>") +
      bloc(2, "align-left", "Description", s.description.trim() ? `<p class="wz-desc">${esc(s.description.trim())}</p>` : "<p class='wz-vide'>Pas de description</p>") +
      `</div>`;
    if (window.lucide) lucide.createIcons();
  }
  recap.addEventListener("click", e => { const b = e.target.closest("[data-edit]"); if (b) { aller(+b.dataset.edit); if (V()) V().montrer(champs(+b.dataset.edit)); } });

  // ------------------------------------------------------------ API pour planifier.js
  window.YallaWizard = {
    reset(modification) {
      courante = 1;
      maxAtteinte = modification ? N : 1;   // en modification, toutes les étapes sont accessibles
      afficher();
    },
    /** Appelé avant l'envoi : renvoie true seulement à la dernière étape et si tout est valide. */
    avantEnvoi() {
      if (courante < N) { suivant(); return false; }
      const err = V() ? V().erreurs() : {};
      for (let n = 1; n < N; n++) {
        if (champs(n).some(k => err[k])) {
          aller(n); if (V()) V().montrer(champs(n)); secouer(); return false;
        }
      }
      return true;
    },
    /** Après une réponse du serveur avec erreurs : aller à l'étape du premier champ en erreur. */
    allerErreur() {
      const f = form.querySelector(".field.has-error");
      const etape = f && f.closest(".wz-step");
      if (etape) aller(+etape.dataset.step);
    },
  };
  afficher();
})();
