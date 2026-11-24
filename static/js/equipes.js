/* =========================================================
   YALLA • Modules Équipes & Présidents
   - Recherche dynamique en temps réel (par nom d'équipe ou président)
   - Validation automatique et réactive à la saisie (disparition immédiate des erreurs)
   - Données géographiques réelles (contrôle strict pays et villes du monde)
   - Gestion avancée des médias (logo et photo : aperçu, remplacement, suppression)
   - Sélecteurs interactifs multi-choix (joueurs, staff, scouts)
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

  function calculerAge(dateNaissance, dateRef) {
    if (!dateNaissance) return 0;
    var ref = dateRef ? new Date(dateRef) : new Date();
    var naiss = new Date(dateNaissance);
    var age = ref.getFullYear() - naiss.getFullYear();
    var m = ref.getMonth() - naiss.getMonth();
    if (m < 0 || (m === 0 && ref.getDate() < naiss.getDate())) {
      age--;
    }
    return age;
  }

  // ───────────── Gestion des erreurs dans le DOM ─────────────
  function setChampEtat(champ, valide, message) {
    if (!champ) return;
    var conteneur = champ.closest(".input-wrap") || champ.parentElement;
    if (!conteneur) return;

    var parentGroupe = conteneur.parentElement;
    var erreurEl = parentGroupe.querySelector(".form-error[data-for='" + champ.id + "']");
    if (!erreurEl) {
      // Chercher un message d'erreur Django existant
      erreurEl = parentGroupe.querySelector(".form-error:not([data-for])");
      if (erreurEl) {
        erreurEl.setAttribute("data-for", champ.id);
      }
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
        erreurEl.setAttribute("data-for", champ.id);
        conteneur.insertAdjacentElement("afterend", erreurEl);
      }
      erreurEl.textContent = message || "Ce champ est invalide.";
      erreurEl.style.display = "block";
    }
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
          if (window.gsap) {
            gsap.from(cible.querySelectorAll(".coach-card"), { y: 14, opacity: 0, duration: 0.3, stagger: 0.03 });
          }
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

        // Valider l'obligation du média
        var estCreation = preview.dataset.creation === "true";
        if (estCreation) {
          setChampEtat(fileInput, false, "L'image est obligatoire lors de la création.");
        } else {
          setChampEtat(fileInput, false, "L'image est obligatoire. Veuillez sélectionner un fichier.");
        }
      });
    }
  }

  // ───────────── Multi-Pickers interactifs ─────────────
  function initMultiPickers() {
    document.querySelectorAll(".multi-picker").forEach(function (picker) {
      var searchInput = picker.querySelector(".multi-picker-search input");
      var items = picker.querySelectorAll(".multi-picker-item");
      var countEl = picker.querySelector(".multi-picker-count");

      function updateCount() {
        var n = picker.querySelectorAll("input[type='checkbox']:checked").length;
        if (countEl) {
          countEl.textContent = n + " sélectionné" + (n > 1 ? "s" : "");
        }
      }

      items.forEach(function (item) {
        var cb = item.querySelector("input[type='checkbox']");
        item.addEventListener("click", function (e) {
          if (e.target !== cb) {
            cb.checked = !cb.checked;
          }
          item.classList.toggle("is-selected", cb.checked);
          updateCount();
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
    var pays = document.getElementById("id_pays");
    var ville = document.getElementById("id_ville");
    var dateCreation = document.getElementById("id_date_creation");
    var entraineur = document.getElementById("id_entraineur");
    var president = document.getElementById("id_president");
    var siteWeb = document.getElementById("id_site_web");
    var description = document.getElementById("id_description");
    var logo = document.getElementById("id_logo");
    var preview = document.getElementById("top-media-preview");
    var charCount = document.getElementById("char-count");
    var villesDatalist = document.getElementById("villes_list");

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
    if (nom) nom.addEventListener("input", validerNom);

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

      // Mettre à jour la liste des villes valides pour ce pays
      if (villesDatalist) {
        villesDatalist.innerHTML = "";
        var villes = paysVillesData[paysTrouve] || [];
        villes.forEach(function (v) {
          var opt = document.createElement("option");
          opt.value = v;
          villesDatalist.appendChild(opt);
        });
      }

      // Re-valider la ville saisie si présente
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
      var d = new Date(val);
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
    if (entraineur) {
      entraineur.addEventListener("change", validerEntraineur);
    }

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
    if (president) {
      president.addEventListener("change", validerPresident);
    }

    // 6. Site web
    function validerSiteWeb() {
      if (!siteWeb) return true;
      var val = siteWeb.value.trim();
      if (val && !val.match(/^https?:\/\/.+/i)) {
        setChampEtat(siteWeb, false, "L'URL du site doit débuter par http:// ou https://");
        return false;
      }
      setChampEtat(siteWeb, true);
      return true;
    }
    if (siteWeb) {
      siteWeb.addEventListener("input", validerSiteWeb);
    }

    // 7. Description et compteur
    function validerDescription() {
      if (!description) return true;
      var len = description.value.length;
      if (charCount) charCount.textContent = "(" + len + " / 500)";
      if (len > 500) {
        setChampEtat(description, false, "La description ne peut pas dépasser 500 caractères.");
        return false;
      }
      setChampEtat(description, true);
      return true;
    }
    if (description) {
      description.addEventListener("input", validerDescription);
      validerDescription();
    }

    // 8. Logo obligatoire
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
      var v2 = validerPays();
      var v3 = validerVille();
      var v4 = validerDateCreation();
      var v5 = validerEntraineur();
      var v6 = validerPresident();
      var v7 = validerLogo();
      var v8 = validerSiteWeb();
      var v9 = validerDescription();

      if (!(v1 && v2 && v3 && v4 && v5 && v6 && v7 && v8 && v9)) {
        e.preventDefault();
        var premierInvalide = form.querySelector(".is-invalid");
        if (premierInvalide) {
          premierInvalide.scrollIntoView({ behavior: "smooth", block: "center" });
          premierInvalide.focus();
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
    var telephone = document.getElementById("id_telephone");
    var nationalite = document.getElementById("id_nationalite");
    var dateNaissance = document.getElementById("id_date_naissance");
    var dateDebut = document.getElementById("id_date_debut_presidence");
    var pwd1 = document.getElementById("id_password1");
    var pwd2 = document.getElementById("id_password2");
    var photo = document.getElementById("id_photo");
    var preview = document.getElementById("top-media-preview");
    var jauge = document.getElementById("pwd-strength");
    var txtForce = document.getElementById("pwd-strength-txt");

    var nationalitesSuggestions = window.NATIONALITES_DATA || [];

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
    if (nom) nom.addEventListener("input", function () { validerIdentite(nom, "nom"); });
    if (prenom) prenom.addEventListener("input", function () { validerIdentite(prenom, "prénom"); });

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
    if (email) email.addEventListener("input", validerEmail);

    // 3. Téléphone (+216 par défaut, modifiable, accepte l'international)
    function validerTelephone() {
      if (!telephone) return true;
      var v = telephone.value.trim();
      if (!v) {
        setChampEtat(telephone, true);
        return true;
      }
      var chiffres = v.replace(/[\s().-]/g, "");
      if (!chiffres.match(/^\+?\d{8,15}$/)) {
        setChampEtat(telephone, false, "Numéro invalide (ex: +216 20 123 456 ou +33 6 12 34 56 78).");
        return false;
      }
      setChampEtat(telephone, true);
      return true;
    }
    if (telephone) telephone.addEventListener("input", validerTelephone);

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
    }

    // 5. Date de naissance (18 ans minimum, erreur SOUS le champ)
    function validerDateNaissance() {
      if (!dateNaissance) return true;
      var val = dateNaissance.value;
      if (!val) {
        setChampEtat(dateNaissance, false, "La date de naissance est obligatoire.");
        return false;
      }
      var d = new Date(val);
      var aujourdhui = new Date();
      if (d > aujourdhui) {
        setChampEtat(dateNaissance, false, "La date de naissance ne peut pas être dans le futur.");
        return false;
      }
      var age = calculerAge(val);
      if (age < 18) {
        setChampEtat(dateNaissance, false, "Le président doit avoir au moins 18 ans (âge actuel : " + age + " an" + (age > 1 ? "s" : "") + ").");
        return false;
      }
      setChampEtat(dateNaissance, true);
      if (dateDebut && dateDebut.value) validerDateDebut();
      return true;
    }
    if (dateNaissance) {
      dateNaissance.addEventListener("input", validerDateNaissance);
      dateNaissance.addEventListener("change", validerDateNaissance);
    }

    // 6. Date de début de présidence
    function validerDateDebut() {
      if (!dateDebut) return true;
      var val = dateDebut.value;
      if (!val) {
        setChampEtat(dateDebut, false, "La date de début de présidence est obligatoire.");
        return false;
      }
      var d = new Date(val);
      var aujourdhui = new Date();
      aujourdhui.setHours(23, 59, 59, 999);
      if (d > aujourdhui) {
        setChampEtat(dateDebut, false, "La date de début de présidence ne peut pas être dans le futur.");
        return false;
      }
      if (dateNaissance && dateNaissance.value) {
        var ageAuDebut = calculerAge(dateNaissance.value, val);
        if (ageAuDebut < 18) {
          setChampEtat(dateDebut, false, "Le président devait avoir au moins 18 ans au début de sa présidence.");
          return false;
        }
      }
      setChampEtat(dateDebut, true);
      return true;
    }
    if (dateDebut) {
      dateDebut.addEventListener("input", validerDateDebut);
      dateDebut.addEventListener("change", validerDateDebut);
    }

    // 7. Photo obligatoire
    function validerPhoto() {
      if (!photo) return true;
      var estCreation = preview && preview.dataset.creation === "true";
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

    // 8. Mots de passe
    function validerMotsDePasse() {
      if (!pwd1) return true;
      var estCreation = preview && preview.dataset.creation === "true";
      var p1 = pwd1.value;
      var p2 = pwd2 ? pwd2.value : "";

      if (estCreation && !p1) {
        setChampEtat(pwd1, false, "Le mot de passe est obligatoire.");
        return false;
      }

      if (p1) {
        var niveau = 0;
        if (p1.length >= 8) niveau++;
        if (/[A-Z]/.test(p1)) niveau++;
        if (/\d/.test(p1)) niveau++;
        if (/[^A-Za-z0-9\s]/.test(p1)) niveau++;

        if (jauge) {
          jauge.hidden = false;
          jauge.dataset.level = niveau;
          var noms = ["", "Faible", "Moyen", "Bon", "Excellent"];
          if (txtForce) txtForce.textContent = noms[niveau] || "Trop court";
        }

        if (niveau < 4) {
          setChampEtat(pwd1, false, "Requis : 8 caractères min, 1 majuscule, 1 chiffre, 1 caractère spécial.");
          return false;
        }
        setChampEtat(pwd1, true);

        if (pwd2) {
          if (p1 !== p2) {
            setChampEtat(pwd2, false, "Les mots de passe ne correspondent pas.");
            return false;
          }
          setChampEtat(pwd2, true);
        }
      } else {
        if (jauge) jauge.hidden = true;
        setChampEtat(pwd1, true);
        if (pwd2) setChampEtat(pwd2, true);
      }
      return true;
    }

    if (pwd1) pwd1.addEventListener("input", validerMotsDePasse);
    if (pwd2) pwd2.addEventListener("input", validerMotsDePasse);

    // Soumission du formulaire
    form.addEventListener("submit", function (e) {
      var v1 = validerIdentite(nom, "nom");
      var v2 = validerIdentite(prenom, "prénom");
      var v3 = validerEmail();
      var v4 = validerTelephone();
      var v5 = validerNationalite();
      var v6 = validerDateNaissance();
      var v7 = validerDateDebut();
      var v8 = validerPhoto();
      var v9 = validerMotsDePasse();

      if (!(v1 && v2 && v3 && v4 && v5 && v6 && v7 && v8 && v9)) {
        e.preventDefault();
        var premierInvalide = form.querySelector(".is-invalid");
        if (premierInvalide) {
          premierInvalide.scrollIntoView({ behavior: "smooth", block: "center" });
          premierInvalide.focus();
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
    initRecherche();
    initTopMediaUploader();
    initMultiPickers();
    initValidationEquipe();
    initValidationPresident();
  });
})();
