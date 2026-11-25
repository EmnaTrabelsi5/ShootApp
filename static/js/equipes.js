/* =========================================================
   YALLA • Modules Équipes & Présidents
   - Recherche dynamique en temps réel (par nom d'équipe ou président)
   - Modal de confirmation de suppression sur arrière-plan flou
   - Validation automatique et réactive à la saisie
   - Données géographiques réelles (contrôle strict pays et villes du monde)
   - Gestion avancée des médias (logo et photo : aperçu, remplacement, suppression)
   - Sélecteurs multi-choix (dropdown staff/scouts, multi-picker joueurs/équipes)
   ========================================================= */

(function () {
  "use strict";

  // ───────────── Utilitaires ─────────────
  function normaliser(texte) {
    if (!texte) return "";
    return texte
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function parseDateYMD(val) {
    if (!val) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val.trim());
    if (!m) return null;
    var y = parseInt(m[1], 10);
    var mo = parseInt(m[2], 10);
    var d = parseInt(m[3], 10);
    var dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
      return null;
    }
    return dt;
  }

  function calculerAge(dateNaissanceStr, dateRefStr) {
    var naiss = parseDateYMD(dateNaissanceStr);
    if (!naiss) return null;
    var ref = dateRefStr ? parseDateYMD(dateRefStr) : new Date();
    if (!ref) return null;
    var age = ref.getFullYear() - naiss.getFullYear();
    var m = ref.getMonth() - naiss.getMonth();
    if (m < 0 || (m === 0 && ref.getDate() < naiss.getDate())) {
      age--;
    }
    return age;
  }

  // ───────────── Gestion des erreurs dans le DOM ─────────────
  function setChampEtat(champ, valide, message, neutre) {
    if (!champ) return;
    var conteneur =
      champ.closest(".phone-combo") ||
      champ.closest(".eq-dropdown") ||
      (champ.classList.contains("multi-picker") ? champ : null) ||
      champ.closest(".input-wrap") ||
      champ.parentElement;
    if (!conteneur) return;

    var parentGroupe = conteneur.parentElement;
    var targetId = champ.id || conteneur.id || "";
    var erreurEl = targetId
      ? parentGroupe.querySelector(".form-error[data-for='" + targetId + "']")
      : null;
    if (!erreurEl) {
      erreurEl = parentGroupe.querySelector(".form-error:not([data-for])");
      if (erreurEl && targetId) {
        erreurEl.setAttribute("data-for", targetId);
      }
    }

    if (neutre) {
      champ.classList.remove("is-invalid", "is-valid");
      if (erreurEl) {
        erreurEl.textContent = "";
        erreurEl.style.display = "none";
      }
      return;
    }

    if (valide) {
      champ.classList.remove("is-invalid");
      champ.classList.add("is-valid");
      if (erreurEl) {
        erreurEl.textContent = "";
        erreurEl.style.display = "none";
      }
    } else {
      champ.classList.remove("is-valid");
      champ.classList.add("is-invalid");
      if (!erreurEl) {
        erreurEl = document.createElement("span");
        erreurEl.className = "form-error";
        if (targetId) erreurEl.setAttribute("data-for", targetId);
        conteneur.insertAdjacentElement("afterend", erreurEl);
      }
      erreurEl.textContent = message || "Ce champ est invalide.";
      erreurEl.style.display = "block";
    }
  }

  // ───────────── Modal de suppression avec arrière-plan flou ─────────────
  function initDeleteModal() {
    var modal = document.getElementById("eq-delete-modal");
    var pageContent = document.getElementById("eq-page-content");
    if (!modal || !pageContent) return;

    var titleEl = document.getElementById("eq-delete-title");
    var msgEl = document.getElementById("eq-delete-message");
    var subEl = document.getElementById("eq-delete-sub");
    var formEl = document.getElementById("eq-delete-form");

    function fermerModal() {
      modal.hidden = true;
      pageContent.classList.remove("is-blurred");
      document.body.style.overflow = "";
    }

    function ouvrirModal(trigger) {
      if (titleEl && trigger.dataset.deleteTitle) {
        titleEl.textContent = trigger.dataset.deleteTitle;
      }
      if (msgEl) {
        msgEl.innerHTML = trigger.dataset.deleteMessage || "";
      }
      if (subEl) {
        subEl.textContent = trigger.dataset.deleteSub || "";
      }
      if (formEl) {
        formEl.setAttribute("action", trigger.dataset.deleteUrl || trigger.getAttribute("href"));
      }
      pageContent.classList.add("is-blurred");
      modal.hidden = false;
      document.body.style.overflow = "hidden";
    }

    document.addEventListener("click", function (e) {
      var trigger = e.target.closest("[data-delete-trigger]");
      if (trigger) {
        e.preventDefault();
        ouvrirModal(trigger);
        return;
      }
      if (e.target.closest("[data-delete-cancel]") || e.target === modal) {
        fermerModal();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) {
        fermerModal();
      }
    });
  }

  // ───────────── Recherche dynamique (Liste) ─────────────
  function initRecherche() {
    var form = document.querySelector("[data-live-search]");
    if (!form) return;
    var cible = document.querySelector(form.dataset.target);
    if (!cible) return;
    var minuteur = null;
    var requete = 0;

    function charger(url, pousser) {
      var ticket = ++requete;
      cible.classList.add("is-loading");
      fetch(url, { headers: { "X-Requested-With": "XMLHttpRequest" }, credentials: "same-origin" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(function (html) {
          if (ticket !== requete) return;
          cible.innerHTML = html;
          if (pousser) history.replaceState(null, "", url);
        })
        .catch(function () { window.location.href = url; })
        .finally(function () { if (ticket === requete) cible.classList.remove("is-loading"); });
    }

    function urlCourante() {
      var params = new URLSearchParams(new FormData(form));
      var propres = new URLSearchParams();
      params.forEach(function (v, k) { if (v) propres.set(k, v); });
      var qs = propres.toString();
      return form.getAttribute("action") + (qs ? "?" + qs : "");
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      charger(urlCourante(), true);
    });

    form.addEventListener("input", function (e) {
      if (e.target.type === "text" || e.target.type === "search") {
        clearTimeout(minuteur);
        minuteur = setTimeout(function () { charger(urlCourante(), true); }, 200);
      }
    });

    cible.addEventListener("click", function (e) {
      var lien = e.target.closest("a[data-page]");
      if (!lien) return;
      e.preventDefault();
      var params = new URL(lien.href, window.location.href).searchParams;
      charger(form.getAttribute("action") + "?" + params.toString(), true);
      cible.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // ───────────── Gestion Upload Top (Logo & Photo) ─────────────
  function initTopMediaUploader() {
    var fileInput = document.getElementById("id_logo") || document.getElementById("id_photo");
    var preview = document.getElementById("top-media-preview");
    var btnRemove = document.getElementById("btn-remove-media");
    var hiddenSupprimer = document.getElementById("id_supprimer_logo") || document.getElementById("id_supprimer_photo");

    if (!fileInput || !preview) return;

    fileInput.addEventListener("change", function () {
      if (fileInput.files && fileInput.files[0]) {
        var file = fileInput.files[0];
        if (!file.type.match(/^image\/(jpeg|png|jpg)$/i)) {
          setChampEtat(fileInput, false, "Format invalide. Utilisez un fichier JPG ou PNG.");
          return;
        }
        if (file.size > 2 * 1024 * 1024) {
          setChampEtat(fileInput, false, "Le fichier est trop lourd (2 Mo maximum).");
          return;
        }
        var lecteur = new FileReader();
        lecteur.onload = function (e) {
          preview.style.backgroundImage = "url('" + e.target.result + "')";
          if (hiddenSupprimer) hiddenSupprimer.value = "false";
          setChampEtat(fileInput, true);
        };
        lecteur.readAsDataURL(file);
      }
    });

    if (btnRemove) {
      btnRemove.addEventListener("click", function (e) {
        e.preventDefault();
        fileInput.value = "";
        preview.style.backgroundImage = "none";
        if (hiddenSupprimer) hiddenSupprimer.value = "true";

        var estCreation = preview.dataset.creation === "true";
        if (estCreation) {
          setChampEtat(fileInput, false, "L'image est obligatoire lors de la création.");
        } else {
          setChampEtat(fileInput, false, "L'image est obligatoire. Veuillez sélectionner un fichier.");
        }
      });
    }
  }

  // ───────────── Dropdown Multi-Choix (Staff & Scouts) ─────────────
  function initDropdownPickers() {
    var dropdowns = document.querySelectorAll(".eq-dropdown");
    if (!dropdowns.length) return;

    function fermerTous(sauf) {
      dropdowns.forEach(function (dd) {
        if (dd !== sauf) {
          var t = dd.querySelector(".eq-dropdown-trigger");
          var m = dd.querySelector(".eq-dropdown-menu");
          if (t) t.setAttribute("aria-expanded", "false");
          if (m) m.hidden = true;
        }
      });
    }

    dropdowns.forEach(function (dd) {
      var trigger = dd.querySelector(".eq-dropdown-trigger");
      var menu = dd.querySelector(".eq-dropdown-menu");
      var labelEl = dd.querySelector(".eq-dropdown-label");
      var placeholder = dd.dataset.placeholder || "— Sélectionner —";
      if (!trigger || !menu) return;

      function majLabel() {
        var checked = Array.prototype.slice.call(menu.querySelectorAll("input[type='checkbox']:checked"));
        if (!labelEl) return;
        if (checked.length === 0) {
          labelEl.textContent = placeholder;
          labelEl.classList.add("is-placeholder");
        } else {
          var noms = checked.map(function (cb) {
            var sp = cb.parentElement.querySelector("span");
            return sp ? sp.textContent.trim() : "";
          }).filter(Boolean);
          labelEl.textContent = noms.length <= 2
            ? noms.join(", ")
            : noms.slice(0, 2).join(", ") + " (+" + (noms.length - 2) + ")";
          labelEl.classList.remove("is-placeholder");
        }
      }

      trigger.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var ouvert = trigger.getAttribute("aria-expanded") === "true";
        fermerTous(dd);
        trigger.setAttribute("aria-expanded", ouvert ? "false" : "true");
        menu.hidden = ouvert;
      });

      menu.addEventListener("change", function () {
        majLabel();
        dd.dispatchEvent(new CustomEvent("dropdown:change", { bubbles: true }));
      });

      majLabel();
    });

    document.addEventListener("click", function (e) {
      if (!e.target.closest(".eq-dropdown")) {
        fermerTous(null);
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") fermerTous(null);
    });
  }

  // ───────────── Multi-Pickers interactifs (Joueurs & Équipes) ─────────────
  function initMultiPickers() {
    document.querySelectorAll(".multi-picker").forEach(function (picker) {
      var searchInput = picker.querySelector(".multi-picker-search input");
      var items = picker.querySelectorAll(".multi-picker-item");
      var countEl = picker.querySelector(".multi-picker-count");
      var isEquipePicker = picker.id === "picker-equipes";

      function updateCount() {
        var n = picker.querySelectorAll("input[type='checkbox']:checked").length;
        if (countEl) {
          if (isEquipePicker) {
            countEl.textContent = n + " sélectionnée" + (n > 1 ? "s" : "");
          } else {
            countEl.textContent = n + " sélectionné" + (n > 1 ? "s" : "");
          }
        }
      }

      items.forEach(function (item) {
        var cb = item.querySelector("input[type='checkbox']");
        if (!cb) return;
        cb.addEventListener("change", function () {
          item.classList.toggle("is-selected", cb.checked);
          updateCount();
          picker.dispatchEvent(new CustomEvent("multipicker:change", { bubbles: true }));
        });
        if (cb.checked) {
          item.classList.add("is-selected");
        }
      });

      if (searchInput) {
        searchInput.addEventListener("input", function () {
          var filtre = normaliser(searchInput.value);
          items.forEach(function (item) {
            var nom = normaliser(item.dataset.name || item.textContent);
            item.style.display = nom.indexOf(filtre) !== -1 ? "flex" : "none";
          });
        });
      }
      updateCount();
    });
  }

  // ───────────── Validation réactive en direct : Équipes ─────────────
  function initValidationEquipe() {
    var form = document.getElementById("equipe-form");
    if (!form) return;

    var nom = document.getElementById("id_nom");
    var niveau = document.getElementById("id_niveau");
    var pays = document.getElementById("id_pays");
    var ville = document.getElementById("id_ville");
    var dateCreation = document.getElementById("id_date_creation");
    var entraineur = document.getElementById("id_entraineur");
    var president = document.getElementById("id_president");
    var description = document.getElementById("id_description");
    var logo = document.getElementById("id_logo");
    var preview = document.getElementById("top-media-preview");
    var charCount = document.getElementById("char-count");
    var villesDatalist = document.getElementById("villes_list");
    var dropdownStaff = document.getElementById("dropdown-staff");
    var dropdownScouts = document.getElementById("dropdown-scouts");
    var pickerJoueurs = document.getElementById("picker-joueurs");

    var paysVillesData = window.PAYS_VILLES_DATA || {};

    // 1. Nom
    function validerNom() {
      if (!nom) return true;
      var v = nom.value.trim();
      if (!v) {
        setChampEtat(nom, false, "Le nom de l'équipe est obligatoire.");
        return false;
      }
      if (v.length < 2) {
        setChampEtat(nom, false, "Le nom doit contenir au moins 2 caractères.");
        return false;
      }
      setChampEtat(nom, true);
      return true;
    }
    if (nom) {
      nom.addEventListener("input", validerNom);
      nom.addEventListener("blur", validerNom);
    }

    // Niveau
    function validerNiveau() {
      if (!niveau) return true;
      if (!niveau.value) {
        setChampEtat(niveau, false, "Veuillez choisir un niveau.");
        return false;
      }
      setChampEtat(niveau, true);
      return true;
    }
    if (niveau) niveau.addEventListener("change", validerNiveau);

    // 2. Pays & Villes réels
    function validerPays(silencieux) {
      if (!pays) return true;
      var pVal = pays.value.trim();
      if (!pVal) {
        if (!silencieux) setChampEtat(pays, false, "Le pays est obligatoire.");
        return false;
      }
      var pNorm = normaliser(pVal);
      var paysTrouve = null;

      for (var p in paysVillesData) {
        if (normaliser(p) === pNorm) {
          paysTrouve = p;
          break;
        }
      }

      if (!paysTrouve) {
        setChampEtat(pays, false, "Le pays « " + pVal + " » n'existe pas ou n'est pas reconnu dans le monde.");
        if (villesDatalist) villesDatalist.innerHTML = "";
        return false;
      }

      setChampEtat(pays, true);

      if (villesDatalist) {
        villesDatalist.innerHTML = "";
        var villes = paysVillesData[paysTrouve] || [];
        villes.forEach(function (v) {
          var opt = document.createElement("option");
          opt.value = v;
          villesDatalist.appendChild(opt);
        });
      }

      if (ville && ville.value.trim()) {
        validerVille();
      }
      return true;
    }

    function validerVille() {
      if (!ville) return true;
      var vVal = ville.value.trim();
      if (!vVal) {
        setChampEtat(ville, false, "La ville est obligatoire.");
        return false;
      }

      var pVal = pays ? pays.value.trim() : "";
      var pNorm = normaliser(pVal);
      var paysTrouve = null;
      for (var p in paysVillesData) {
        if (normaliser(p) === pNorm) {
          paysTrouve = p;
          break;
        }
      }

      if (!paysTrouve) {
        setChampEtat(ville, false, "Veuillez d'abord sélectionner un pays valide existant.");
        return false;
      }

      var villes = paysVillesData[paysTrouve] || [];
      var vNorm = normaliser(vVal);
      var villeTrouvee = false;
      for (var i = 0; i < villes.length; i++) {
        if (normaliser(villes[i]) === vNorm) {
          villeTrouvee = true;
          break;
        }
      }

      if (!villeTrouvee) {
        setChampEtat(ville, false, "La ville « " + vVal + " » n'appartient pas au pays « " + paysTrouve + " » ou n'est pas reconnue.");
        return false;
      }

      setChampEtat(ville, true);
      return true;
    }

    if (pays) {
      pays.addEventListener("input", function () { validerPays(false); });
      pays.addEventListener("change", function () { validerPays(false); });
      if (pays.value.trim()) validerPays(true);
    }
    if (ville) {
      ville.addEventListener("input", validerVille);
      ville.addEventListener("change", validerVille);
    }

    // 3. Date de création
    function validerDateCreation() {
      if (!dateCreation) return true;
      var val = dateCreation.value;
      if (!val) {
        setChampEtat(dateCreation, false, "La date de création est obligatoire.");
        return false;
      }
      var d = parseDateYMD(val);
      if (!d) {
        setChampEtat(dateCreation, false, "Date de création invalide.");
        return false;
      }
      var aujourdhui = new Date();
      aujourdhui.setHours(23, 59, 59, 999);
      if (d > aujourdhui) {
        setChampEtat(dateCreation, false, "La date de création ne peut pas être dans le futur.");
        return false;
      }
      if (d.getFullYear() < 1850) {
        setChampEtat(dateCreation, false, "La date de création est trop ancienne (avant 1850).");
        return false;
      }
      setChampEtat(dateCreation, true);
      return true;
    }
    if (dateCreation) {
      dateCreation.addEventListener("input", validerDateCreation);
      dateCreation.addEventListener("change", validerDateCreation);
      dateCreation.addEventListener("blur", validerDateCreation);
    }

    // 4. Entraîneur (obligatoire)
    function validerEntraineur() {
      if (!entraineur) return true;
      if (!entraineur.value) {
        setChampEtat(entraineur, false, "L'entraîneur est obligatoire pour une équipe.");
        return false;
      }
      setChampEtat(entraineur, true);
      return true;
    }
    if (entraineur) entraineur.addEventListener("change", validerEntraineur);

    // 5. Président (obligatoire)
    function validerPresident() {
      if (!president) return true;
      if (!president.value) {
        setChampEtat(president, false, "Veuillez sélectionner un président pour l'équipe.");
        return false;
      }
      setChampEtat(president, true);
      return true;
    }
    if (president) president.addEventListener("change", validerPresident);

    // 6. Staff & Scouts (au moins 1 chacun)
    function validerDropdown(dd, message) {
      if (!dd) return true;
      var trigger = dd.querySelector(".eq-dropdown-trigger");
      var nb = dd.querySelectorAll("input[type='checkbox']:checked").length;
      if (nb < 1) {
        setChampEtat(trigger, false, message);
        return false;
      }
      setChampEtat(trigger, true);
      return true;
    }
    if (dropdownStaff) {
      dropdownStaff.addEventListener("dropdown:change", function () {
        validerDropdown(dropdownStaff, "Veuillez sélectionner au moins un membre du staff technique.");
      });
    }
    if (dropdownScouts) {
      dropdownScouts.addEventListener("dropdown:change", function () {
        validerDropdown(dropdownScouts, "Veuillez sélectionner au moins un scout.");
      });
    }

    // 7. Joueurs (au moins 1)
    function validerJoueurs() {
      if (!pickerJoueurs) return true;
      var nb = pickerJoueurs.querySelectorAll("input[type='checkbox']:checked").length;
      if (nb < 1) {
        setChampEtat(pickerJoueurs, false, "Veuillez sélectionner au moins un joueur pour l'équipe.");
        return false;
      }
      setChampEtat(pickerJoueurs, true);
      return true;
    }
    if (pickerJoueurs) {
      pickerJoueurs.addEventListener("multipicker:change", validerJoueurs);
    }

    // 8. Description et compteur
    function validerDescription() {
      if (!description) return true;
      var len = description.value.length;
      if (charCount) charCount.textContent = "(" + len + " / 500)";
      if (len > 500) {
        setChampEtat(description, false, "La description ne peut pas dépasser 500 caractères.");
        return false;
      }
      setChampEtat(description, true, "", len === 0);
      return true;
    }
    if (description) {
      description.addEventListener("input", validerDescription);
      validerDescription();
    }

    // 9. Logo obligatoire
    function validerLogo() {
      if (!logo) return true;
      var estCreation = preview && preview.dataset.creation === "true";
      var aFichier = logo.files && logo.files.length > 0;
      var aImageDeja = preview && preview.style.backgroundImage && preview.style.backgroundImage !== "none";
      if (estCreation && !aFichier) {
        setChampEtat(logo, false, "Le logo est obligatoire lors de la création d'une équipe.");
        return false;
      }
      if (!estCreation && !aFichier && !aImageDeja) {
        setChampEtat(logo, false, "Le logo de l'équipe est obligatoire.");
        return false;
      }
      setChampEtat(logo, true);
      return true;
    }

    // Soumission du formulaire
    form.addEventListener("submit", function (e) {
      var v1 = validerNom();
      var v2 = validerNiveau();
      var v3 = validerPays(false);
      var v4 = validerVille();
      var v5 = validerDateCreation();
      var v6 = validerEntraineur();
      var v7 = validerPresident();
      var v8 = validerDropdown(dropdownStaff, "Veuillez sélectionner au moins un membre du staff technique.");
      var v9 = validerDropdown(dropdownScouts, "Veuillez sélectionner au moins un scout.");
      var v10 = validerJoueurs();
      var v11 = validerLogo();
      var v12 = validerDescription();

      if (!(v1 && v2 && v3 && v4 && v5 && v6 && v7 && v8 && v9 && v10 && v11 && v12)) {
        e.preventDefault();
        var premierInvalide = form.querySelector(".is-invalid");
        if (premierInvalide) {
          premierInvalide.scrollIntoView({ behavior: "smooth", block: "center" });
          if (typeof premierInvalide.focus === "function") premierInvalide.focus();
        }
      }
    });
  }

  // ───────────── Validation réactive en direct : Présidents ─────────────
  function initValidationPresident() {
    var form = document.getElementById("president-form");
    if (!form) return;

    var nom = document.getElementById("id_nom");
    var prenom = document.getElementById("id_prenom");
    var email = document.getElementById("id_email");
    var indicatif = document.getElementById("id_indicatif");
    var telNum = document.getElementById("id_telephone_numero");
    var telCache = document.getElementById("id_telephone");
    var nationalite = document.getElementById("id_nationalite");
    var dateNaissance = document.getElementById("id_date_naissance");
    var dateDebut = document.getElementById("id_date_debut_presidence");
    var pwd1 = document.getElementById("id_password1");
    var pwd2 = document.getElementById("id_password2");
    var photo = document.getElementById("id_photo");
    var preview = document.getElementById("top-media-preview");

    var nationalitesSuggestions = window.NATIONALITES_DATA || [];
    var estCreation = preview && preview.dataset.creation === "true";
    var pwd2Touche = false;

    // 1. Nom & Prénom
    function validerIdentite(champ, libelle) {
      if (!champ) return true;
      var v = champ.value.trim();
      if (!v) {
        setChampEtat(champ, false, "Le " + libelle + " est obligatoire.");
        return false;
      }
      if (v.length < 2) {
        setChampEtat(champ, false, "Le " + libelle + " doit contenir au moins 2 caractères.");
        return false;
      }
      setChampEtat(champ, true);
      return true;
    }
    if (nom) {
      nom.addEventListener("input", function () { validerIdentite(nom, "nom"); });
      nom.addEventListener("blur", function () { validerIdentite(nom, "nom"); });
    }
    if (prenom) {
      prenom.addEventListener("input", function () { validerIdentite(prenom, "prénom"); });
      prenom.addEventListener("blur", function () { validerIdentite(prenom, "prénom"); });
    }

    // 2. E-mail
    function validerEmail() {
      if (!email) return true;
      var v = email.value.trim();
      if (!v) {
        setChampEtat(email, false, "L'adresse e-mail est obligatoire.");
        return false;
      }
      if (!v.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        setChampEtat(email, false, "Veuillez saisir une adresse e-mail valide.");
        return false;
      }
      setChampEtat(email, true);
      return true;
    }
    if (email) {
      email.addEventListener("input", validerEmail);
      email.addEventListener("blur", validerEmail);
    }

    // 3. Téléphone (sélecteur indicatif avec triangle ▼ + numéro local)
    function syncEtValiderTelephone() {
      if (!telNum) return true;
      var code = indicatif ? (indicatif.value || "+216").trim() : "+216";
      var local = telNum.value.trim();

      if (!local) {
        if (telCache) telCache.value = "";
        setChampEtat(telNum, true, "", true);
        return true;
      }

      var propre = local.replace(/[\s().-]/g, "");
      var complet = propre;
      if (propre.indexOf("00") === 0) {
        complet = "+" + propre.slice(2);
      } else if (propre.charAt(0) !== "+") {
        complet = code + propre;
      }

      if (telCache) telCache.value = complet;

      if (!complet.match(/^\+\d{8,15}$/) || complet.length - code.length < 6) {
        setChampEtat(telNum, false, "Numéro invalide pour l'indicatif " + code + " (ex : 20 123 456).");
        return false;
      }
      setChampEtat(telNum, true);
      return true;
    }
    if (telNum) {
      telNum.addEventListener("input", syncEtValiderTelephone);
      telNum.addEventListener("blur", syncEtValiderTelephone);
    }
    if (indicatif) {
      indicatif.addEventListener("change", syncEtValiderTelephone);
    }

    // 4. Nationalité réelle du monde
    function validerNationalite() {
      if (!nationalite) return true;
      var v = nationalite.value.trim();
      if (!v) {
        setChampEtat(nationalite, false, "La nationalité est obligatoire.");
        return false;
      }
      var vNorm = normaliser(v);
      var trouve = false;
      for (var i = 0; i < nationalitesSuggestions.length; i++) {
        if (normaliser(nationalitesSuggestions[i]) === vNorm) {
          trouve = true;
          break;
        }
      }
      if (!trouve) {
        setChampEtat(nationalite, false, "La nationalité « " + v + " » n'existe pas ou ne correspond à aucun pays reconnu.");
        return false;
      }
      setChampEtat(nationalite, true);
      return true;
    }
    if (nationalite) {
      nationalite.addEventListener("input", validerNationalite);
      nationalite.addEventListener("change", validerNationalite);
      nationalite.addEventListener("blur", validerNationalite);
    }

    // 5. Date de naissance (contrainte >= 18 ans stricte)
    function validerDateNaissance(exigerNonVide) {
      if (!dateNaissance) return true;
      var val = dateNaissance.value;
      if (!val) {
        if (exigerNonVide) {
          setChampEtat(dateNaissance, false, "La date de naissance est obligatoire.");
          return false;
        }
        return true;
      }
      var d = parseDateYMD(val);
      if (!d) {
        setChampEtat(dateNaissance, false, "Date de naissance invalide.");
        return false;
      }
      var aujourdhui = new Date();
      aujourdhui.setHours(23, 59, 59, 999);
      if (d > aujourdhui) {
        setChampEtat(dateNaissance, false, "La date de naissance ne peut pas être dans le futur.");
        return false;
      }
      if (d.getFullYear() < 1900) {
        setChampEtat(dateNaissance, false, "La date de naissance est invalide (avant 1900).");
        return false;
      }
      var age = calculerAge(val);
      if (age === null || age < 18) {
        setChampEtat(dateNaissance, false, "Le président doit avoir au moins 18 ans (âge actuel : " + (age || 0) + " an" + (age > 1 ? "s" : "") + ").");
        return false;
      }
      setChampEtat(dateNaissance, true);
      if (dateDebut && dateDebut.value) validerDateDebut(false);
      return true;
    }
    if (dateNaissance) {
      dateNaissance.addEventListener("input", function () { validerDateNaissance(false); });
      dateNaissance.addEventListener("change", function () { validerDateNaissance(true); });
      dateNaissance.addEventListener("blur", function () { validerDateNaissance(true); });
    }

    // 6. Date de début de présidence
    function validerDateDebut(exigerNonVide) {
      if (!dateDebut) return true;
      var val = dateDebut.value;
      if (!val) {
        if (exigerNonVide) {
          setChampEtat(dateDebut, false, "La date de début de présidence est obligatoire.");
          return false;
        }
        return true;
      }
      var d = parseDateYMD(val);
      if (!d) {
        setChampEtat(dateDebut, false, "Date de début de présidence invalide.");
        return false;
      }
      var aujourdhui = new Date();
      aujourdhui.setHours(23, 59, 59, 999);
      if (d > aujourdhui) {
        setChampEtat(dateDebut, false, "La date de début de présidence ne peut pas être dans le futur.");
        return false;
      }
      if (dateNaissance && dateNaissance.value) {
        var ageAuDebut = calculerAge(dateNaissance.value, val);
        if (ageAuDebut !== null && ageAuDebut < 18) {
          setChampEtat(dateDebut, false, "Le président devait avoir au moins 18 ans au début de sa présidence.");
          return false;
        }
      }
      setChampEtat(dateDebut, true);
      return true;
    }
    if (dateDebut) {
      dateDebut.addEventListener("input", function () { validerDateDebut(false); });
      dateDebut.addEventListener("change", function () { validerDateDebut(true); });
      dateDebut.addEventListener("blur", function () { validerDateDebut(true); });
    }

    // 7. Photo obligatoire
    function validerPhoto() {
      if (!photo) return true;
      var aFichier = photo.files && photo.files.length > 0;
      var aImageDeja = preview && preview.style.backgroundImage && preview.style.backgroundImage !== "none";
      if (estCreation && !aFichier) {
        setChampEtat(photo, false, "La photo est obligatoire lors de la création d'un président.");
        return false;
      }
      if (!estCreation && !aFichier && !aImageDeja) {
        setChampEtat(photo, false, "La photo est obligatoire. Veuillez sélectionner une image.");
        return false;
      }
      setChampEtat(photo, true);
      return true;
    }

    // 8. Mots de passe : validation directe automatique sans faux messages
    function motDePasseValide(p) {
      return p.length >= 8 && /[A-Z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9\s]/.test(p);
    }

    function validerMotsDePasse(surSoumission) {
      if (!pwd1) return true;
      var p1 = pwd1.value;
      var p2 = pwd2 ? pwd2.value : "";
      var ok1 = true;
      var ok2 = true;

      if (estCreation && !p1) {
        if (surSoumission || p2.length > 0 || pwd2Touche) {
          setChampEtat(pwd1, false, "Le mot de passe est obligatoire.");
          ok1 = false;
        } else {
          setChampEtat(pwd1, true, "", true);
          ok1 = false;
        }
      } else if (p1) {
        if (!motDePasseValide(p1)) {
          setChampEtat(pwd1, false, "Requis : 8 caractères min, 1 majuscule, 1 chiffre, 1 caractère spécial.");
          ok1 = false;
        } else {
          setChampEtat(pwd1, true);
        }
      } else {
        setChampEtat(pwd1, true, "", true);
      }

      if (pwd2) {
        var doitValiderP2 = surSoumission || pwd2Touche || p2.length > 0;
        if (doitValiderP2) {
          if ((estCreation || p1.length > 0) && !p2) {
            setChampEtat(pwd2, false, "Veuillez confirmer le mot de passe.");
            ok2 = false;
          } else if (p1 !== p2) {
            setChampEtat(pwd2, false, "Les mots de passe ne correspondent pas.");
            ok2 = false;
          } else if (p1 && p1 === p2) {
            setChampEtat(pwd2, true);
          } else {
            setChampEtat(pwd2, true, "", true);
          }
        } else {
          setChampEtat(pwd2, true, "", true);
        }
      }

      return ok1 && ok2;
    }

    if (pwd1) {
      pwd1.addEventListener("input", function () { validerMotsDePasse(false); });
      pwd1.addEventListener("blur", function () {
        if (estCreation && !pwd1.value) {
          setChampEtat(pwd1, false, "Le mot de passe est obligatoire.");
        } else {
          validerMotsDePasse(false);
        }
      });
    }
    if (pwd2) {
      pwd2.addEventListener("input", function () {
        pwd2Touche = true;
        validerMotsDePasse(false);
      });
      pwd2.addEventListener("blur", function () {
        pwd2Touche = true;
        validerMotsDePasse(false);
      });
    }

    // Soumission du formulaire
    form.addEventListener("submit", function (e) {
      pwd2Touche = true;
      var v1 = validerIdentite(nom, "nom");
      var v2 = validerIdentite(prenom, "prénom");
      var v3 = validerEmail();
      var v4 = syncEtValiderTelephone();
      var v5 = validerNationalite();
      var v6 = validerDateNaissance(true);
      var v7 = validerDateDebut(true);
      var v8 = validerPhoto();
      var v9 = validerMotsDePasse(true);

      if (!(v1 && v2 && v3 && v4 && v5 && v6 && v7 && v8 && v9)) {
        e.preventDefault();
        var premierInvalide = form.querySelector(".is-invalid");
        if (premierInvalide) {
          premierInvalide.scrollIntoView({ behavior: "smooth", block: "center" });
          if (typeof premierInvalide.focus === "function") premierInvalide.focus();
        }
      }
    });

    // Boutons œil pour afficher / masquer les mots de passe
    document.querySelectorAll(".eye-btn[data-toggle]").forEach(function (btn) {
      var input = document.getElementById(btn.getAttribute("data-toggle"));
      if (!input) return;
      btn.addEventListener("click", function () {
        var cache = input.type === "password";
        input.type = cache ? "text" : "password";
        btn.style.color = cache ? "var(--coach-green)" : "var(--muted)";
      });
    });
  }

  // ───────────── Initialisation au chargement ─────────────
  document.addEventListener("DOMContentLoaded", function () {
    initDeleteModal();
    initRecherche();
    initTopMediaUploader();
    initDropdownPickers();
    initMultiPickers();
    initValidationEquipe();
    initValidationPresident();
  });
})();
