/* Yalla • Validation en direct de la popup « Planifier / Modifier une séance »
   Les mêmes règles sont revérifiées par le serveur (training/forms.py + training/regles.py). */
(function () {
  const form = document.getElementById("form-planif");
  const dataEl = document.getElementById("validation-data");
  if (!form || !dataEl) return;
  const V = JSON.parse(dataEl.textContent);
  const R = V.regles;
  const lire = id => { const el = document.getElementById(id); return el ? JSON.parse(el.textContent) : []; };
  const JOUEURS = Object.fromEntries(lire("joueurs-data").map(j => [String(j.id), j]));
  const EXOS = Object.fromEntries(lire("exercices-data").map(e => [e.id, e]));
  const MAT = Object.fromEntries(lire("materiel-data").map(m => [m.id, m]));
  const regles = lire("regles-type");
  const modal = form.closest(".modal");
  const summary = document.getElementById("val-summary");

  const NOMS = { titre: "Titre", date: "Date", heure_debut: "Horaire", rpe: "RPE", joueurs: "Joueurs",
                 terrain: "Terrain", description: "Description", exercices: "Exercices",
                 materiel: "Matériel", objectif: "Objectif" };

  let touches = new Set(), soumis = false;

  // ------------------------------------------------------------ lecture du formulaire
  const val = n => (form.elements[n] && form.elements[n].value || "").trim();
  const coche = n => (form.querySelector(`input[name="${n}"]:checked`) || {}).value;
  const minutes = h => { const m = /^(\d{1,2}):(\d{2})/.exec(h || ""); return m ? +m[1] * 60 + +m[2] : null; };
  const hm = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const duree = m => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}` : `${m} min`;
  const pkCourant = () => { const m = /\/seance\/(\d+)\//.exec(form.action); return m ? +m[1] : null; };

  function etat() {
    let materiel = {};
    try { materiel = JSON.parse(val("materiel") || "{}"); } catch (e) { materiel = null; }
    return {
      type: coche("type_seance"), objectif: coche("objectif"),
      titre: val("titre").replace(/\s+/g, " "), date: val("date"),
      debut: minutes(val("heure_debut")), fin: minutes(val("heure_fin")),
      rpe: parseFloat(val("rpe")), terrain: val("terrain").replace(/\s+/g, " "),
      description: (form.elements.description || {}).value || "",
      joueurs: [...form.querySelectorAll('input[name="joueurs"]')].map(i => i.value),
      exercices: [...form.querySelectorAll('input[name="exercices"]:checked')].map(i => i.value),
      materiel,
    };
  }

  // ------------------------------------------------------------ règles
  function verifierTout() {
    const s = etat(), err = {}, warn = {}, ok = {};
    const E = (k, m) => (err[k] = err[k] || []).push(m);
    const W = (k, m) => (warn[k] = warn[k] || []).push(m);

    // Titre
    if (s.titre.length < R.titre[0]) E("titre", `Au moins ${R.titre[0]} caractères.`);
    else if (s.titre.length > R.titre[1]) E("titre", `Maximum ${R.titre[1]} caractères.`);
    else if ((s.titre.match(/[A-Za-zÀ-ÿ]/g) || []).length < 3) E("titre", "Au moins 3 lettres (pas seulement des chiffres ou symboles).");

    // Date
    if (!s.date) E("date", "Choisis une date.");
    else {
      const j = new Date(s.date + "T00:00"), auj = new Date(V.aujourdhui + "T00:00");
      const ecart = Math.round((j - auj) / 864e5);
      if (ecart < 0) E("date", "La date ne peut pas être dans le passé.");
      else if (ecart > R.jours_max) E("date", "Pas plus d'un an à l'avance.");
      else if (V.matchs[s.date]) E("date", `Jour de match (${V.matchs[s.date]}) : impossible.`);
      else ok.date = ecart === 0 ? "Aujourd'hui" : ecart === 1 ? "Demain" : `Dans ${ecart} jours`;
    }

    // Horaires
    const hMin = minutes(R.heures[0]), hMax = minutes(R.heures[1]);
    let d = null;
    if (s.debut === null || s.fin === null) E("heure_debut", "Indique le début et la fin.");
    else if (s.fin <= s.debut) E("heure_debut", "La fin doit être après le début.");
    else {
      d = s.fin - s.debut;
      if (s.debut < hMin || s.fin > hMax) E("heure_debut", `Entre ${R.heures[0]} et ${R.heures[1]} uniquement.`);
      if (d < R.duree[0] || d > R.duree[1]) E("heure_debut", `Durée ${duree(d)} : entre ${R.duree[0]} min et ${duree(R.duree[1])}.`);
      if (!err.heure_debut) ok.heure_debut = `Durée ${duree(d)}`;
    }

    // Doublon / chevauchement le même jour
    const pk = pkCourant();
    const memeJour = V.seances.filter(x => x.date === s.date && x.id !== pk);
    if (s.titre && memeJour.some(x => x.titre.trim().toLowerCase() === s.titre.toLowerCase()))
      E("titre", "Une séance porte déjà ce titre ce jour-là.");
    if (d) {
      const c = memeJour.find(x => x.debut && x.fin && s.debut < minutes(x.fin) && minutes(x.debut) < s.fin);
      if (c) E("heure_debut", `Chevauche « ${c.titre} » (${c.debut}-${c.fin}).`);
    }

    // RPE
    const limType = (regles.rpe || {})[s.type];
    if (isNaN(s.rpe) || s.rpe < 1 || s.rpe > 10) E("rpe", "RPE entre 1 et 10.");
    else if (limType && s.rpe > limType.max) E("rpe", `Maximum ${limType.max} pour ce type de séance.`);
    const limObj = R.rpe_objectif[s.objectif] || {};
    if (limObj.max !== undefined && s.rpe > limObj.max) E("rpe", `Objectif récupération : maximum ${limObj.max}.`);
    if (limObj.min !== undefined && s.type === "ENTRAINEMENT" && s.rpe < limObj.min) E("rpe", `Objectif physique : minimum ${limObj.min}.`);

    // Joueurs
    const mini = R.joueurs_min[s.type] || 0;
    const blesses = s.joueurs.filter(id => (JOUEURS[id] || {}).statut === "BLESSE");
    const dispenses = s.joueurs.filter(id => (JOUEURS[id] || {}).statut === "DISPENSE");
    if (blesses.length) E("joueurs", `${blesses.length} joueur(s) blessé(s) : impossible de les convoquer.`);
    if (s.joueurs.length < mini) E("joueurs", `Au moins ${mini} joueurs (actuellement ${s.joueurs.length}).`);
    if (s.joueurs.length > R.joueurs_max) E("joueurs", `Maximum ${R.joueurs_max} joueurs.`);
    if (dispenses.length) W("joueurs", `${dispenses.length} joueur(s) dispensé(s) : séance adaptée à prévoir.`);
    if (!err.joueurs && s.joueurs.length) ok.joueurs = `${s.joueurs.length} convoqués`;

    // Exercices
    const exos = s.exercices.map(i => EXOS[i]).filter(Boolean);
    if (R.exercice_obligatoire.includes(s.type) && !exos.length) E("exercices", "Choisis au moins un exercice.");
    const total = exos.reduce((t, e) => t + e.duree, 0);
    if (d && total > d) E("exercices", `Exercices : ${total} min, plus que la séance (${duree(d)}).`);
    const trop = exos.filter(e => s.joueurs.length && e.joueurs > s.joueurs.length).map(e => e.nom);
    if (trop.length) E("exercices", `Pas assez de joueurs pour : ${trop.join(", ")}.`);
    if (!err.exercices && exos.length) ok.exercices = `${exos.length} exercice${exos.length > 1 ? "s" : ""} • ${total} min`;

    // Matériel
    if (s.materiel === null) E("materiel", "Matériel invalide.");
    else {
      const manque = [];
      exos.forEach(e => Object.entries(e.besoins || {}).forEach(([k, q]) => {
        if ((s.materiel[k] || 0) < q) manque.push(`${q} ${(MAT[k] || { nom: k }).nom.toLowerCase()}`);
      }));
      if (manque.length) E("materiel", `Il manque pour les exercices : ${[...new Set(manque)].join(", ")}.`);
      Object.entries(s.materiel).forEach(([k, q]) => { if (MAT[k] && q > MAT[k].max) E("materiel", `${MAT[k].nom} : maximum ${MAT[k].max}.`); });
      const n = Object.keys(s.materiel).length;
      if (!err.materiel && n) ok.materiel = `${n} type${n > 1 ? "s" : ""} prêt${n > 1 ? "s" : ""}`;
    }

    // Terrain / description
    if (!s.terrain) E("terrain", "Indique le terrain.");
    else if (s.terrain.length < R.terrain[0] || s.terrain.length > R.terrain[1]) E("terrain", `Entre ${R.terrain[0]} et ${R.terrain[1]} caractères.`);
    if (s.description.trim().length > R.description_max) E("description", `Trop long (${s.description.trim().length}/${R.description_max}).`);

    return { err, warn, ok };
  }

  // ------------------------------------------------------------ affichage
  function cleDe(field) { return field.dataset.field.split(" ")[0]; }
  function messages(obj, field) { return field.dataset.field.split(" ").flatMap(k => obj[k] || []); }

  function hint(field) {
    let h = field.querySelector(":scope > .val-hint");
    if (!h) {
      h = document.createElement("small"); h.className = "val-hint";
      field.querySelector(":scope > .err").after(h);
    }
    return h;
  }

  function compteurs() {
    [["titre", R.titre[1]], ["description", R.description_max]].forEach(([n, max]) => {
      const f = form.querySelector(`.field[data-field~="${n}"]`); if (!f) return;
      let c = f.querySelector(".val-count");
      if (!c) { c = document.createElement("span"); c.className = "val-count"; f.querySelector("label").appendChild(c); }
      const l = (form.elements[n].value || "").length;
      c.textContent = `${l}/${max}`;
      c.classList.toggle("over", l > max);
    });
  }

  function afficher() {
    const { err, warn, ok } = verifierTout();
    compteurs();
    const liste = [];
    form.querySelectorAll(".field[data-field]").forEach(field => {
      const cle = cleDe(field);
      const visible = soumis || field.dataset.field.split(" ").some(k => touches.has(k));
      const e = messages(err, field), w = messages(warn, field);
      if (e.length) liste.push([cle, e[0], field]);
      if (!visible) { field.classList.remove("has-error", "is-valid", "has-warn"); hint(field).textContent = ""; return; }
      field.querySelector(".err").textContent = e.join(" ");
      field.classList.toggle("has-error", e.length > 0);
      field.classList.toggle("has-warn", !e.length && w.length > 0);
      field.classList.toggle("is-valid", !e.length);
      hint(field).textContent = !e.length ? (w.join(" ") || ok[cle] || "") : "";
    });
    if (summary) {
      if (soumis && liste.length) {
        summary.hidden = false;
        summary.innerHTML = `<strong><i data-lucide="shield-alert"></i>${liste.length} point${liste.length > 1 ? "s" : ""} à corriger avant d'enregistrer</strong><ul>` +
          liste.map(([c, m]) => `<li><button type="button" data-aller="${c}"><b>${NOMS[c] || c}</b> ${m.replace(/</g, "&lt;")}</button></li>`).join("") + "</ul>";
        if (window.lucide) lucide.createIcons();
      } else if (soumis) {
        summary.hidden = false;
        summary.className = "val-summary ok";
        summary.innerHTML = '<strong><i data-lucide="shield-check"></i>Tout est valide, prêt à enregistrer</strong>';
        if (window.lucide) lucide.createIcons();
        return liste;
      } else summary.hidden = true;
      summary.className = "val-summary";
    }
    return liste;
  }

  // ------------------------------------------------------------ événements
  function toucher(e) {
    const f = e.target.closest && e.target.closest(".field[data-field]");
    if (f) f.dataset.field.split(" ").forEach(k => touches.add(k));
    afficher();
  }
  form.addEventListener("input", toucher);
  form.addEventListener("change", e => {
    // type ou objectif : ça change les règles des autres champs
    if (e.target.name === "type_seance" || e.target.name === "objectif") { afficher(); return; }
    toucher(e);
  });
  form.addEventListener("focusout", e => { if (e.target.matches("input[type=text], input[type=date], input[type=time], textarea")) toucher(e); });
  document.addEventListener("mat-change", () => { touches.add("materiel"); afficher(); });
  const pkValider = document.getElementById("pk-valider");
  if (pkValider) pkValider.addEventListener("click", () => setTimeout(() => { touches.add("joueurs"); afficher(); }, 50));
  const pkInputs = document.getElementById("pk-inputs");
  if (pkInputs) new MutationObserver(() => afficher()).observe(pkInputs, { childList: true });
  if (summary) summary.addEventListener("click", e => {
    const b = e.target.closest("[data-aller]"); if (!b) return;
    const f = form.querySelector(`.field[data-field~="${b.dataset.aller}"]`);
    if (f) { f.scrollIntoView({ behavior: "smooth", block: "center" }); f.classList.remove("flash"); void f.offsetWidth; f.classList.add("flash"); }
  });

  function secouer() {
    if (!modal) return;
    modal.classList.remove("shake"); void modal.offsetWidth; modal.classList.add("shake");
  }

  window.YallaValidation = {
    reset() {
      touches = new Set(); soumis = false;
      form.querySelectorAll(".field").forEach(f => f.classList.remove("has-error", "is-valid", "has-warn"));
      if (summary) summary.hidden = true;
      setTimeout(afficher, 0);
    },
    /** Appelé avant l'envoi : true si tout est valide. */
    verifier() {
      soumis = true;
      const liste = afficher();
      if (liste.length) {
        secouer();
        (summary && !summary.hidden ? summary : liste[0][2]).scrollIntoView({ behavior: "smooth", block: "start" });
        return false;
      }
      return true;
    },
    secouer,
    /** Erreurs actuelles par champ : { titre: ["..."], ... } */
    erreurs() { return verifierTout().err; },
    /** Affiche les erreurs de ces champs (étape en cours de l'assistant). */
    montrer(cles) { cles.forEach(k => touches.add(k)); afficher(); },
    /** Valeurs lues du formulaire (pour le récapitulatif). */
    etat,
    rafraichir() { afficher(); },
  };
})();
