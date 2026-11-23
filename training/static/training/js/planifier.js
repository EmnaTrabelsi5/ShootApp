/* FootLab Pro • Popup planifier / modifier / supprimer une séance */
(function () {
  const overlay = document.getElementById("modal-planif");
  if (!overlay) return;
  const form = document.getElementById("form-planif");
  const titre = document.getElementById("modal-titre").querySelector(".marker");
  const sousTitre = document.getElementById("modal-sous-titre");
  const submitBtn = form.querySelector('button[type="submit"]');
  const submitTxt = submitBtn.querySelector(".submit-txt");
  const globalErr = form.querySelector(".form-error-global");
  const rpe = form.querySelector('input[name="rpe"]');
  const rpeVal = form.querySelector(".rpe-val");
  const csrf = form.querySelector('input[name="csrfmiddlewaretoken"]').value;
  const urlCreer = form.dataset.urlCreer;
  const urlBase = form.dataset.urlBase || "/";   // racine du module (ex : /seances/)
  const defauts = { titre: "", heure_debut: "", heure_fin: "", description: "", terrain: "Honneur" };

  function clearErrors() {
    globalErr.hidden = true;
    globalErr.textContent = "";
    form.querySelectorAll(".field").forEach(f => {
      f.classList.remove("has-error");
      f.querySelector(".err").textContent = "";
    });
  }

  function setRpe(v) { rpe.value = v; rpeVal.textContent = v; }

  function setObjectif(v) {
    const radio = form.querySelector(`input[name="objectif"][value="${v || "TACTIQUE"}"]`);
    if (radio) radio.checked = true;
    if (window.YallaExercices) window.YallaExercices.filtrer();
  }

  // --- Coordination type ↔ objectif ↔ RPE ---
  const reglesEl = document.getElementById("regles-type");
  const regles = reglesEl ? JSON.parse(reglesEl.textContent) : { objectifs: {}, rpe: {} };
  const typeCourant = () => (form.querySelector('input[name="type_seance"]:checked') || {}).value;

  function appliquerRegles(resetRpe) {
    const type = typeCourant();
    const autorises = regles.objectifs[type] || [];
    form.querySelectorAll('input[name="objectif"]').forEach(r => {
      const ok = !autorises.length || autorises.includes(r.value);
      r.disabled = !ok;
      r.closest(".groupe-pill").classList.toggle("off", !ok);
    });
    const coche = form.querySelector('input[name="objectif"]:checked');
    if (autorises.length && (!coche || !autorises.includes(coche.value))) setObjectif(autorises[0]);
    const lim = regles.rpe[type];
    if (lim) {
      rpe.max = lim.max;
      if (resetRpe || Number(rpe.value) > lim.max) setRpe(resetRpe ? lim.defaut : lim.max);
    }
  }

  function setType(v) {
    const radio = form.querySelector(`input[name="type_seance"][value="${v}"]`);
    if (radio) radio.checked = true;
    appliquerRegles(false);
  }

  function show(ov) {
    ov.hidden = false;
    requestAnimationFrame(() => ov.classList.add("open"));
    document.body.style.overflow = "hidden";
  }
  function hide(ov) {
    ov.classList.remove("open");
    document.body.style.overflow = "";
    setTimeout(() => { ov.hidden = true; }, 200);
  }

  function ouvrirCreation(date) {
    clearErrors();
    form.action = urlCreer;
    titre.textContent = "PLANIFIER UN ENTRAÎNEMENT";
    sousTitre.textContent = "Ajoute une séance au calendrier de l'effectif pro.";
    submitTxt.textContent = "ENREGISTRER LA SÉANCE";
    Object.entries(defauts).forEach(([k, v]) => { form.elements[k].value = v; });
    if (date) form.elements["date"].value = date;
    setType("ENTRAINEMENT");
    setObjectif("TACTIQUE");
    setRpe(7);
    if (window.FootlabJoueurs) window.FootlabJoueurs.set([]);
    if (window.YallaExercices) window.YallaExercices.set([]);
    if (window.YallaMateriel) window.YallaMateriel.set({});
    if (window.YallaValidation) window.YallaValidation.reset();
    if (window.YallaWizard) window.YallaWizard.reset(false);
    show(overlay);
    setTimeout(() => form.elements["titre"].focus(), 150);
  }

  async function ouvrirModification(pk) {
    clearErrors();
    try {
      const resp = await fetch(`${urlBase}seance/${pk}/`, { headers: { "X-Requested-With": "XMLHttpRequest" } });
      if (!resp.ok) throw new Error();
      const s = await resp.json();
      form.action = `${urlBase}seance/${pk}/`;
      titre.textContent = "MODIFIER LA SÉANCE";
      sousTitre.textContent = "Mets à jour les informations de la séance.";
      submitTxt.textContent = "ENREGISTRER LES MODIFICATIONS";
      ["titre", "date", "heure_debut", "heure_fin", "description", "terrain"]
        .forEach(k => { form.elements[k].value = s[k] ?? ""; });
      setType(s.type_seance);
      setObjectif(s.objectif);
      if (window.FootlabJoueurs) window.FootlabJoueurs.set(s.joueurs);
      if (window.YallaExercices) window.YallaExercices.set(s.exercices || []);
      if (window.YallaMateriel) window.YallaMateriel.set(s.materiel || {});
      if (window.YallaValidation) window.YallaValidation.reset();
      if (window.YallaWizard) window.YallaWizard.reset(true);
      setRpe(s.rpe);
      appliquerRegles(false);
      show(overlay);
      setTimeout(() => form.elements["titre"].focus(), 150);
    } catch (e) {
      alertErreur("Impossible de charger la séance. Vérifie que le serveur tourne.");
    }
  }

  function alertErreur(msg) {
    ouvrirCreation();
    globalErr.hidden = false;
    globalErr.textContent = msg;
  }

  // --- Boutons de la page ---
  document.querySelectorAll("[data-planifier]").forEach(el => {
    el.addEventListener("click", e => { e.preventDefault(); ouvrirCreation(el.dataset.date); });
  });
  document.querySelectorAll("[data-modifier]").forEach(el => {
    el.addEventListener("click", e => { e.preventDefault(); ouvrirModification(el.dataset.modifier); });
  });

  overlay.querySelectorAll("[data-fermer]").forEach(el => el.addEventListener("click", () => hide(overlay)));
  overlay.addEventListener("click", e => { if (e.target === overlay) hide(overlay); });

  rpe.addEventListener("input", () => { rpeVal.textContent = rpe.value; });
  form.querySelectorAll('input[name="type_seance"]').forEach(radio => {
    radio.addEventListener("change", () => appliquerRegles(true));
  });

  // --- Enregistrement (création ou modification) ---
  form.addEventListener("submit", async e => {
    e.preventDefault();
    clearErrors();
    if (window.YallaWizard) { if (!window.YallaWizard.avantEnvoi()) return; }
    else if (window.YallaValidation && !window.YallaValidation.verifier()) return;
    submitBtn.disabled = true;
    submitBtn.classList.add("loading");
    try {
      const resp = await fetch(form.action, {
        method: "POST", body: new FormData(form),
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      const data = await resp.json();
      if (data.ok) { window.location.href = "?semaine=" + data.semaine; return; }
      if (window.YallaValidation) window.YallaValidation.secouer();
      Object.entries(data.errors || {}).forEach(([name, list]) => {
        const msg = list.map(x => x.message).join(" ");
        const field = form.querySelector(`.field[data-field~="${name}"]`);
        if (field) {
          field.classList.add("has-error");
          const small = field.querySelector(".err");
          small.textContent = (small.textContent ? small.textContent + " " : "") + msg;
        } else {
          globalErr.hidden = false;
          globalErr.textContent += (globalErr.textContent ? " " : "") + msg;
        }
      });
      if (window.YallaWizard) window.YallaWizard.allerErreur();
    } catch (err) {
      globalErr.hidden = false;
      globalErr.textContent = "Impossible d'enregistrer la séance. Vérifie que le serveur tourne.";
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove("loading");
    }
  });

  // --- Suppression avec confirmation ---
  const supprOverlay = document.getElementById("modal-suppr");
  const confirmBtn = document.getElementById("btn-confirm-suppr");
  let aSupprimer = null;
  document.querySelectorAll("[data-supprimer]").forEach(el => {
    el.addEventListener("click", e => {
      e.preventDefault();
      aSupprimer = el.dataset.supprimer;
      supprOverlay.querySelector(".confirm-titre").textContent = el.dataset.titre || "La séance";
      show(supprOverlay);
    });
  });
  supprOverlay.querySelectorAll("[data-fermer]").forEach(el => el.addEventListener("click", () => hide(supprOverlay)));
  supprOverlay.addEventListener("click", e => { if (e.target === supprOverlay) hide(supprOverlay); });
  confirmBtn.addEventListener("click", async () => {
    if (!aSupprimer) return;
    confirmBtn.disabled = true;
    try {
      const resp = await fetch(`${urlBase}seance/${aSupprimer}/supprimer/`, {
        method: "POST", headers: { "X-CSRFToken": csrf, "X-Requested-With": "XMLHttpRequest" },
      });
      const data = await resp.json();
      if (data.ok) { window.location.href = "?semaine=" + data.semaine; return; }
    } catch (e) { /* rien */ }
    confirmBtn.disabled = false;
    hide(supprOverlay);
  });

  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    const pk = document.getElementById("modal-joueurs");
    if (pk && !pk.hidden) return;
    const v3d = document.getElementById("modal-3d");
    if (v3d && !v3d.hidden) return;
    if (!overlay.hidden) hide(overlay);
    if (!supprOverlay.hidden) hide(supprOverlay);
  });
})();
