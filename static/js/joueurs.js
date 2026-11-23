/* =========================================================
   YALLA • Vestiaire & Effectif
   Popups ajout / modification / suppression (sans rechargement
   pour l'ouverture ; les liens marchent aussi sans JavaScript).
   ========================================================= */
(function () {
  "use strict";

  const modalJoueur = document.getElementById("modal-joueur");
  const modalSuppr = document.getElementById("modal-suppr");
  const form = document.getElementById("form-joueur");
  const preview = document.getElementById("photo-preview");
  const POSTE_CSS = { GB: "gardien", DEF: "defense", MIL: "milieu", ATT: "attaque" };

  function ouvrir(overlay) {
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("open"));
    const champ = overlay.querySelector("input:not([type=hidden]):not([type=radio]):not([type=file]), button");
    if (champ) setTimeout(() => champ.focus(), 120);
  }

  function fermer(overlay) {
    overlay.classList.remove("open");
    setTimeout(() => { overlay.hidden = true; }, 200);
  }

  // Le formulaire de modification vient du serveur : en le fermant on revient à la liste.
  function fermerOuRevenir(overlay, href) {
    if (overlay === modalJoueur && overlay.dataset.mode === "edit") {
      window.location.href = href;
      return;
    }
    fermer(overlay);
    if (window.location.search.includes("nouveau=1") || /\/(ajouter|supprimer)\/$/.test(window.location.pathname)) {
      history.replaceState(null, "", href);
    }
  }

  // ---------- Ajout ----------
  document.querySelectorAll("[data-open-form]").forEach((lien) => {
    lien.addEventListener("click", (e) => {
      if (modalJoueur.dataset.mode === "edit") return; // laisse le lien charger un formulaire vide
      e.preventDefault();
      const poste = lien.dataset.poste;
      if (poste) {
        const radio = form.querySelector(`input[name="poste"][value="${poste}"]`);
        if (radio) { radio.checked = true; majCouleur(); }
      }
      ouvrir(modalJoueur);
    });
  });

  // ---------- Fermeture ----------
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      fermerOuRevenir(btn.closest(".modal-overlay"), btn.getAttribute("href"));
    });
  });
  [modalJoueur, modalSuppr].forEach((overlay) => {
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) {
        const lien = overlay.querySelector("[data-close]");
        fermerOuRevenir(overlay, lien.getAttribute("href"));
      }
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const ouverte = [modalSuppr, modalJoueur].find((o) => !o.hidden);
    if (ouverte) fermerOuRevenir(ouverte, ouverte.querySelector("[data-close]").getAttribute("href"));
  });

  // ---------- Suppression ----------
  const formSuppr = document.getElementById("form-suppr");
  document.querySelectorAll("[data-suppr]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      formSuppr.action = btn.dataset.action;
      modalSuppr.querySelector("[data-nom]").textContent = btn.dataset.nom;
      ouvrir(modalSuppr);
    });
  });

  // ---------- Aperçu photo + initiales ----------
  const inputPhoto = form.querySelector('input[type="file"][name="photo"]');
  const prenom = form.querySelector('[name="prenom"]');
  const nom = form.querySelector('[name="nom"]');

  function majInitiales() {
    if (preview.style.backgroundImage) return;
    const ini = ((prenom.value.trim()[0] || "") + (nom.value.trim()[0] || "")).toUpperCase();
    preview.textContent = ini || "+";
  }
  function majCouleur() {
    const choisi = form.querySelector('input[name="poste"]:checked');
    preview.className = "pk-photo p-" + (choisi ? POSTE_CSS[choisi.value] : "milieu");
  }

  if (inputPhoto) {
    inputPhoto.addEventListener("change", () => {
      const fichier = inputPhoto.files[0];
      if (!fichier) return;
      const lecteur = new FileReader();
      lecteur.onload = () => {
        preview.style.backgroundImage = `url("${lecteur.result}")`;
      };
      lecteur.readAsDataURL(fichier);
    });
  }
  [prenom, nom].forEach((c) => c && c.addEventListener("input", majInitiales));
  form.querySelectorAll('input[name="poste"]').forEach((r) => r.addEventListener("change", majCouleur));
  majInitiales();

  // ---------- Notifications ----------
  document.querySelectorAll(".toast").forEach((t, i) => {
    setTimeout(() => {
      t.classList.add("out");
      setTimeout(() => t.remove(), 300);
    }, 4000 + i * 400);
  });
})();
