/* Yalla • Choix des exercices 3D dans la popup (filtrés selon l'objectif) */
(function () {
  const form = document.getElementById("form-planif");
  const liste = document.getElementById("ex-list");
  const dataEl = document.getElementById("exercices-data");
  if (!form || !liste || !dataEl) return;
  const exercices = JSON.parse(dataEl.textContent);
  const compteur = document.getElementById("ex-count");
  let choisis = new Set();

  const objectifCourant = () => (form.querySelector('input[name="objectif"]:checked') || {}).value;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function rendre() {
    const obj = objectifCourant();
    const dispo = exercices.filter(e => e.objectif === obj);
    // Un exercice d'un autre objectif ne peut pas rester sélectionné
    choisis = new Set([...choisis].filter(id => dispo.some(e => e.id === id)));

    liste.innerHTML = dispo.length ? dispo.map(e => `
      <div class="ex-card o-${e.objectif.toLowerCase()}${choisis.has(e.id) ? " on" : ""}" data-id="${esc(e.id)}">
        <label class="ex-pick">
          <input type="checkbox" name="exercices" value="${esc(e.id)}"${choisis.has(e.id) ? " checked" : ""}>
          <span class="ex-check"><i data-lucide="check"></i></span>
          <span class="ex-txt">
            <strong>${esc(e.nom)}</strong>
            <em>${e.duree} min · ${e.joueurs} joueurs</em>
          </span>
        </label>
        <button type="button" class="ex-voir" data-voir3d="${esc(e.id)}" title="Voir l'animation 3D">
          <i data-lucide="play"></i>3D
        </button>
      </div>`).join("")
      : '<p class="ex-vide">Aucun exercice pour cet objectif.</p>';
    if (window.lucide) lucide.createIcons();
    majCompteur();
  }

  function majCompteur() {
    const n = choisis.size;
    compteur.textContent = n + (n > 1 ? " choisis" : " choisi");
    compteur.classList.toggle("on", n > 0);
  }

  liste.addEventListener("change", e => {
    const cb = e.target.closest('input[name="exercices"]');
    if (!cb) return;
    cb.checked ? choisis.add(cb.value) : choisis.delete(cb.value);
    cb.closest(".ex-card").classList.toggle("on", cb.checked);
    majCompteur();
  });

  // Aperçu 3D d'un exercice depuis la popup
  liste.addEventListener("click", e => {
    const btn = e.target.closest("[data-voir3d]");
    if (!btn) return;
    e.preventDefault();
    const ids = [...liste.querySelectorAll(".ex-card")].map(c => c.dataset.id);
    if (window.Yalla3D) window.Yalla3D.open(ids, btn.dataset.voir3d);
  });

  form.querySelectorAll('input[name="objectif"]').forEach(r => r.addEventListener("change", rendre));

  window.YallaExercices = {
    set(ids) { choisis = new Set(ids || []); rendre(); },
    filtrer: rendre,
  };
  rendre();
})();
