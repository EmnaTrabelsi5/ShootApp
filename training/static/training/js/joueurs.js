/* FootLab Pro • Sélecteur visuel des joueurs (terrain + photos) */
(function () {
  const dataEl = document.getElementById("joueurs-data");
  const overlay = document.getElementById("modal-joueurs");
  if (!dataEl || !overlay) return;

  const joueurs = JSON.parse(dataEl.textContent);
  const parId = new Map(joueurs.map(j => [j.id, j]));
  const form = document.getElementById("form-planif");
  const inputs = document.getElementById("pk-inputs");
  const trigger = document.getElementById("pk-trigger");
  const stack = document.getElementById("pk-stack");
  const triggerTxt = document.getElementById("pk-trigger-txt");
  const search = document.getElementById("pk-search");
  const tabs = document.getElementById("pk-tabs");
  const tray = document.getElementById("pk-tray");
  const count = document.getElementById("pk-count");
  const empty = document.getElementById("pk-empty");

  let selection = new Set();     // sélection validée (dans le formulaire)
  let brouillon = new Set();     // sélection en cours dans le terrain
  let poste = "";
  let statut = "";
  const statutsEl = document.getElementById("pk-statuts");
  const toast = document.getElementById("pk-toast");
  const LIB_STATUT = { BLESSE: "Blessé", DISPENSE: "Dispensé", DISPONIBLE: "Disponible" };
  const estBlesse = id => (parId.get(id) || {}).statut === "BLESSE";

  const initiales = j => (j.prenom[0] || "") + (j.nom[0] || "");
  const nomCourt = j => `${j.prenom} ${j.nom.split(" ").map(x => x[0]).join("")}.`;

  function avatar(j, cls) {
    const el = document.createElement("span");
    el.className = `pk-photo p-${j.poste.toLowerCase()} ${cls || ""}`;
    if (j.photo) el.style.backgroundImage = `url("${j.photo}")`;
    else el.textContent = initiales(j);
    return el;
  }

  // ----- Construction du terrain -----
  overlay.querySelectorAll(".pk-zone").forEach(zone => {
    const grid = zone.querySelector(".pk-grid");
    const liste = joueurs.filter(j => j.poste === zone.dataset.zone);
    zone.querySelector(".pk-zone-n").textContent = liste.length;
    liste.forEach(j => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pk-player";
      b.dataset.id = j.id;
      b.dataset.search = `${j.prenom} ${j.nom} ${j.numero}`.toLowerCase();
      b.dataset.statut = j.statut || "DISPONIBLE";
      b.classList.add(`st-${(j.statut || "DISPONIBLE").toLowerCase()}`);
      b.title = `#${j.numero} ${j.prenom} ${j.nom}` +
        (j.statut && j.statut !== "DISPONIBLE" ? ` — ${LIB_STATUT[j.statut]}${j.motif ? " : " + j.motif : ""}` : "");
      b.appendChild(avatar(j));
      const num = document.createElement("span"); num.className = "pk-num"; num.textContent = j.numero;
      const nom = document.createElement("span"); nom.className = "pk-name"; nom.textContent = nomCourt(j);
      const check = document.createElement("span"); check.className = "pk-check"; check.textContent = "✓";
      b.append(num, nom, check);
      if (j.statut === "BLESSE" || j.statut === "DISPENSE") {
        const st = document.createElement("span");
        st.className = "pk-statut";
        st.textContent = j.statut === "BLESSE" ? "+" : "D";
        const lbl = document.createElement("span");
        lbl.className = "pk-statut-lbl";
        lbl.textContent = LIB_STATUT[j.statut];
        b.append(st, lbl);
      }
      b.addEventListener("click", () => basculer(j.id));
      grid.appendChild(b);
    });
  });
  empty.hidden = joueurs.length > 0;
  // compteurs par statut
  ["DISPONIBLE", "DISPENSE", "BLESSE"].forEach(s => {
    const n = joueurs.filter(j => (j.statut || "DISPONIBLE") === s).length;
    const btn = statutsEl.querySelector(`[data-statut="${s}"] b`);
    if (btn) btn.textContent = n;
  });
  statutsEl.addEventListener("click", e => {
    const t = e.target.closest("button"); if (!t) return;
    statut = t.dataset.statut; filtrer();
  });

  let toastTimer;
  function afficherToast(msg) {
    toast.textContent = msg; toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
  }

  function basculer(id) {
    if (!brouillon.has(id) && estBlesse(id)) {
      const j = parId.get(id);
      afficherToast(`${j.prenom} ${j.nom} est blessé${j.motif ? " (" + j.motif + ")" : ""} : impossible de le convoquer.`);
      const b = overlay.querySelector(`.pk-player[data-id="${id}"]`);
      if (b) { b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake"); }
      return;
    }
    brouillon.has(id) ? brouillon.delete(id) : brouillon.add(id);
    rafraichir();
  }

  function visibles() {
    return [...overlay.querySelectorAll(".pk-player")].filter(b => !b.hidden && !b.closest(".pk-zone").hidden);
  }

  function filtrer() {
    const q = search.value.trim().toLowerCase();
    overlay.querySelectorAll(".pk-zone").forEach(zone => {
      zone.hidden = poste !== "" && zone.dataset.zone !== poste;
      zone.querySelectorAll(".pk-player").forEach(b => {
        b.hidden = (q !== "" && !b.dataset.search.includes(q)) || (statut !== "" && b.dataset.statut !== statut);
      });
    });
    overlay.querySelector(".pk-pitch").classList.toggle("single", poste !== "");
    tabs.querySelectorAll("button").forEach(t => t.classList.toggle("active", t.dataset.poste === poste));
    statutsEl.querySelectorAll("button").forEach(t => t.classList.toggle("active", t.dataset.statut === statut));
  }

  function rafraichir() {
    overlay.querySelectorAll(".pk-player").forEach(b => b.classList.toggle("on", brouillon.has(Number(b.dataset.id))));
    count.textContent = brouillon.size;
    count.parentElement.classList.toggle("onze", brouillon.size === 11);
    tray.innerHTML = "";
    if (!brouillon.size) {
      tray.innerHTML = '<span class="pk-tray-empty">Aucun joueur sélectionné</span>';
      return;
    }
    [...brouillon].map(id => parId.get(id)).filter(Boolean)
      .sort((a, b) => a.poste.localeCompare(b.poste) || a.numero - b.numero)
      .forEach(j => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "pk-tray-item"; b.title = `Retirer ${j.prenom} ${j.nom}`;
        b.appendChild(avatar(j, "sm"));
        if (j.statut === "DISPENSE") b.classList.add("st-dispense");
        const n = document.createElement("span"); n.textContent = j.numero;
        b.appendChild(n);
        b.addEventListener("click", () => basculer(j.id));
        tray.appendChild(b);
      });
  }

  // ----- Résumé dans le formulaire + champs cachés -----
  function majFormulaire() {
    inputs.innerHTML = "";
    selection.forEach(id => {
      const i = document.createElement("input");
      i.type = "hidden"; i.name = "joueurs"; i.value = id;
      inputs.appendChild(i);
    });
    stack.innerHTML = "";
    [...selection].slice(0, 5).map(id => parId.get(id)).filter(Boolean)
      .forEach(j => stack.appendChild(avatar(j, "xs")));
    triggerTxt.textContent = selection.size
      ? `${selection.size} joueur${selection.size > 1 ? "s" : ""} convoqué${selection.size > 1 ? "s" : ""}`
      : "Choisir les joueurs";
    trigger.classList.toggle("filled", selection.size > 0);
  }

  // ----- Ouverture / fermeture -----

  function ouvrir() {
    brouillon = new Set(selection);
    poste = "";   // tous les postes affichés
    search.value = "";
    statut = "";
    // un joueur blessé depuis sa convocation est retiré de la sélection
    [...brouillon].forEach(id => { if (estBlesse(id)) brouillon.delete(id); });
    filtrer(); rafraichir();
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("open"));
    setTimeout(() => search.focus(), 150);
  }
  function fermer() {
    overlay.classList.remove("open");
    setTimeout(() => { overlay.hidden = true; }, 200);
  }

  trigger.addEventListener("click", ouvrir);
  overlay.querySelectorAll("[data-pk-fermer]").forEach(b => b.addEventListener("click", fermer));
  overlay.addEventListener("click", e => { if (e.target === overlay) fermer(); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !overlay.hidden) { e.stopImmediatePropagation(); fermer(); }
  }, true);

  search.addEventListener("input", filtrer);
  tabs.addEventListener("click", e => {
    const t = e.target.closest("button"); if (!t) return;
    poste = t.dataset.poste; filtrer();
  });
  document.getElementById("pk-all").addEventListener("click", () => {
    visibles().filter(b => b.dataset.statut !== "BLESSE").forEach(b => brouillon.add(Number(b.dataset.id)));
    rafraichir();
  });
  document.getElementById("pk-clear").addEventListener("click", () => { brouillon.clear(); rafraichir(); });
  document.getElementById("pk-valider").addEventListener("click", () => {
    selection = new Set(brouillon); majFormulaire(); fermer();
  });

  // API utilisée par la popup Planifier / Modifier
  window.FootlabJoueurs = {
    set(ids) { selection = new Set((ids || []).map(Number).filter(id => parId.has(id))); majFormulaire(); },
  };
  majFormulaire();
})();
