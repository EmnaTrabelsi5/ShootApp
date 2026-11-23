/* =========================================================
   YALLA • Le vestiaire
   - tringle : maillots de profil, ils se tournent au survol, on fait glisser la tringle
   - clic : le maillot est décroché et la fiche du joueur s'ouvre
   - casiers : la porte s'ouvre, puis la fiche
   ========================================================= */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const hasGsap = typeof window.gsap !== "undefined";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animate = hasGsap && !reduce;
  const fiches = JSON.parse($("#fiches-joueurs")?.textContent || "{}");
  const POSTE_CSS = { GB: "gardien", DEF: "defense", MIL: "milieu", ATT: "attaque" };
  const STATUT_CSS = { DISPONIBLE: "disponible", DISPENSE: "dispense", BLESSE: "blesse" };

  /* =================== Filtre par poste (tringle ou casiers) =================== */
  const filtres = $$("[data-rail-poste]");
  const groupes = () => $$(".vr-group, .lk-group");

  /* =================== TRINGLE =================== */
  const rail = $("#lr-rail");
  const track = $("#lr-track");
  const caption = $("#lr-caption");
  let x = 0;
  let tirage = null;

  const bornes = () => {
    const libre = rail.clientWidth - track.scrollWidth;
    return libre >= 0 ? [libre / 2, libre / 2] : [libre, 0]; // centrée si tout tient
  };
  const borne = (v) => { const [min, max] = bornes(); return Math.min(max, Math.max(min, v)); };
  const place = (v, duree = 0) => {
    x = borne(v);
    if (hasGsap) gsap.to(track, { x, duration: reduce ? 0 : duree, ease: "expo.out", overwrite: true });
    else track.style.transform = `translateX(${x}px)`;
  };

  // Le maillot se balance autour de son crochet
  const balance = (el, force = 6) => {
    if (!animate || !el) return;
    gsap.fromTo(el, { rotationZ: force }, { rotationZ: 0, duration: 1.6, ease: "elastic.out(1, .28)", overwrite: "auto" });
  };

  if (rail && track) {
    place(0);
    let resizeT;
    window.addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => place(x), 120); });

    /* --- Légende sous le maillot survolé --- */
    const montre = (s) => {
      $(".cap-num", caption).textContent = s.dataset.num;
      $(".cap-nom", caption).textContent = s.dataset.nom;
      $(".cap-info", caption).textContent = s.dataset.info;
      const pose = () => {
        const r = s.getBoundingClientRect(), rr = rail.getBoundingClientRect();
        caption.style.left = `${r.left - rr.left + r.width / 2}px`;
      };
      pose(); setTimeout(pose, 320); // le maillot s'élargit en se tournant
      caption.classList.add("is-on");
    };
    const cache = () => caption.classList.remove("is-on");
    $$(".shirt", track).forEach((s) => {
      const kit = $(".kit", s);
      s.addEventListener("pointerenter", (e) => {
        if (e.pointerType === "touch" || tirage?.bouge) return;
        montre(s);
        balance(kit, 4);
      });
      s.addEventListener("pointerleave", cache);
      s.addEventListener("focus", () => {
        montre(s);
        const r = s.getBoundingClientRect(), rr = rail.getBoundingClientRect();
        if (r.left < rr.left + 60) place(x + (rr.left + 120 - r.left), 0.5);
        else if (r.right > rr.right - 60) place(x - (r.right - rr.right + 180), 0.5);
      });
      s.addEventListener("blur", cache);
    });

    /* --- Faire glisser la tringle --- */
    let bloqueClic = false;
    rail.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (hasGsap) gsap.killTweensOf(track);
      tirage = { x0: e.clientX, depart: x, dernierX: e.clientX, t: performance.now(), v: 0, bouge: false, id: e.pointerId };
    });
    rail.addEventListener("pointermove", (e) => {
      if (!tirage || e.pointerId !== tirage.id) return;
      const dx = e.clientX - tirage.x0;
      if (!tirage.bouge && Math.abs(dx) < 6) return;
      if (!tirage.bouge) {
        tirage.bouge = true;
        rail.setPointerCapture(e.pointerId);
        rail.classList.add("is-dragging");
        cache();
      }
      const now = performance.now();
      tirage.v = (e.clientX - tirage.dernierX) / Math.max(1, now - tirage.t);
      tirage.dernierX = e.clientX; tirage.t = now;
      const [min, max] = bornes();
      let v = tirage.depart + dx;
      if (v > max) v = max + (v - max) * 0.3; // résistance élastique aux bords
      if (v < min) v = min + (v - min) * 0.3;
      x = v;
      if (hasGsap) gsap.set(track, { x }); else track.style.transform = `translateX(${x}px)`;
      // les maillots penchent dans le sens du mouvement
      if (animate) gsap.to($$(".kit", track), { rotationZ: Math.max(-9, Math.min(9, -tirage.v * 5)), duration: 0.3, overwrite: "auto" });
    });
    const lache = (e) => {
      if (!tirage || e.pointerId !== tirage.id) return;
      if (tirage.bouge) {
        bloqueClic = true;
        setTimeout(() => { bloqueClic = false; }, 0);
        rail.classList.remove("is-dragging");
        place(x + Math.max(-1.5, Math.min(1.5, tirage.v)) * 380, 1.1);
        if (animate) gsap.to($$(".kit", track), { rotationZ: 0, duration: 1.8, ease: "elastic.out(1, .2)", overwrite: "auto" });
      }
      tirage = null;
    };
    rail.addEventListener("pointerup", lache);
    rail.addEventListener("pointercancel", lache);
    rail.addEventListener("click", (e) => { if (bloqueClic) { e.stopPropagation(); e.preventDefault(); } }, true);
    rail.addEventListener("dragstart", (e) => e.preventDefault());
    rail.addEventListener("wheel", (e) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
      const [min, max] = bornes();
      if (!d || min === max) return;
      e.preventDefault();
      place(x - d, 0.4);
    }, { passive: false });

    /* --- Entrée : on accroche les maillots un par un --- */
    if (animate) {
      const kits = $$(".shirt", track);
      gsap.set(kits, { y: -40, opacity: 0 });
      const io = new IntersectionObserver((ents) => {
        if (!ents.some((en) => en.isIntersecting)) return;
        io.disconnect();
        gsap.to(kits, { y: 0, opacity: 1, duration: 0.8, stagger: 0.05, ease: "back.out(1.7)", delay: 0.3, clearProps: "transform,opacity" });
        kits.forEach((k, i) => setTimeout(() => balance($(".kit", k), i % 2 ? -5 : 5), 450 + i * 50));
      }, { threshold: 0.2 });
      io.observe(rail);
    }
  }

  /* --- Filtre (tringle ou casiers) --- */
  filtres.forEach((b) => b.addEventListener("click", () => {
    const poste = b.dataset.railPoste;
    // la tringle et les casiers partagent le même filtre
    filtres.forEach((f) => { const on = f.dataset.railPoste === poste; f.classList.toggle("active", on); f.setAttribute("aria-pressed", String(on)); });
    groupes().forEach((g) => { g.hidden = !!poste && g.dataset.poste !== poste; });
    if (typeof window.yallaFiltrePoste === "function") window.yallaFiltrePoste(poste);
    if (rail && track) { place(0, 0.6); caption.classList.remove("is-on"); }
    if (animate) {
      const els = $$(".vr-group:not([hidden]) .shirt, .lk-group:not([hidden]) .lk");
      gsap.fromTo(els, { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.035, ease: "back.out(1.7)", clearProps: "transform,opacity" });
    }
  }));

  /* --- Casiers : entrée --- */
  const scCasiers = $("#casiers-scene");
  const entreeCasiers = (delai = 0.2) => {
    if (!animate) return;
    gsap.fromTo(".lk-group:not([hidden]) .lk", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.05, ease: "expo.out", delay: delai, clearProps: "transform,opacity" });
  };
  if (scCasiers && !scCasiers.hidden) entreeCasiers();

  /* --- Page Joueurs : la tringle et les casiers dans la même page --- */
  const scTringle = $("#penderie");
  if (scTringle && scCasiers && scCasiers.hidden) {
    const hautBarre = () => ($(".topbar-graff, .topbar")?.getBoundingClientRect().height || 0) + 12;
    const cadre = (sc) => {
      const y = sc.getBoundingClientRect().top + window.scrollY - hautBarre();
      if (Math.abs(window.scrollY - y) > 4) window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
    };
    let bascule = false;
    const montrerVue = (vers, instant = false) => {
      const de = vers === "casiers" ? scTringle : scCasiers;
      const a = vers === "casiers" ? scCasiers : scTringle;
      if (bascule || !a.hidden) return;
      const sens = vers === "casiers" ? 1 : -1;
      try { history.replaceState(null, "", vers === "casiers" ? "#casiers" : location.pathname + location.search); } catch (e) { /* rien */ }
      const fin = () => {
        de.hidden = true;
        a.hidden = false;
        cadre(a);
        if (animate && !instant) {
          gsap.fromTo(a, { x: 70 * sens, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: "expo.out", clearProps: "transform,opacity" });
          if (vers === "casiers") entreeCasiers(0.15);
          else if (track) {
            const ks = $$(".vr-group:not([hidden]) .shirt", track);
            gsap.fromTo(ks, { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.035, ease: "back.out(1.7)", delay: 0.1, clearProps: "transform,opacity" });
          }
        }
        if (vers === "tringle" && rail && track) place(0);
        const cible = vers === "casiers" ? $("[data-vue-tringle]", a) : $("[data-vue-casiers]", a);
        if (cible) cible.focus({ preventScroll: true });
        bascule = false;
      };
      bascule = true;
      if (animate && !instant) gsap.to(de, { x: -70 * sens, opacity: 0, duration: 0.35, ease: "power2.in", onComplete: () => { gsap.set(de, { clearProps: "transform,opacity" }); fin(); } });
      else fin();
    };
    $$("[data-vue-casiers]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); montrerVue("casiers"); }));
    $$("[data-vue-tringle]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); montrerVue("tringle"); }));
    if (location.hash === "#casiers") montrerVue("casiers", true);
    window.addEventListener("hashchange", () => { if (location.hash === "#casiers") montrerVue("casiers"); });
  }

  /* =================== FICHE DU JOUEUR =================== */
  const wrap = $("#casier");
  if (!wrap) return;
  const panneau = $(".fx", wrap);
  const flip = $("#fx-flip");
  const tpl = $("#kit-face-tpl");
  let ordre = [];
  let actuel = null;
  let source = null;   // maillot décroché de la tringle
  let porte = null;    // casier ouvert
  let retourFocus = null;

  const texte = (sel, v) => { const el = $(sel); if (el) el.textContent = v === "" || v == null ? "—" : v; };
  const dateFr = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

  const listeDepuis = (el) => {
    if (el.closest("#lr-track")) return $$(".vr-group:not([hidden]) .shirt", track).map((s) => s.dataset.openLocker);
    if (el.closest(".lk-row")) return $$(".lk-group:not([hidden]) .lk").map((l) => l.dataset.openLocker);
    return Object.keys(fiches);
  };

  function remplir(id) {
    const f = fiches[id];
    if (!f) return;
    actuel = String(id);
    panneau.className = `fx pos-${POSTE_CSS[f.poste] || "milieu"} st-${STATUT_CSS[f.statut] || "disponible"}`;
    texte("#cs-poste", f.poste_label);
    texte("#fx-num", f.numero_maillot || "–");
    $("#cs-prenom").textContent = f.prenom;
    $("#cs-nomfam").textContent = f.nom;
    texte("#cs-equipe", f.equipe_nom);
    texte("#cs-ne", f.date_naissance ? `${dateFr(f.date_naissance)}${f.age != null ? ` · ${f.age} ans` : ""}` : "");
    texte("#cs-taille", f.taille_cm ? `${f.taille_cm} cm` : "");
    texte("#cs-poids", f.poids_kg ? `${String(f.poids_kg).replace(".", ",")} kg` : "");
    texte("#cs-pied", f.pied_label);
    texte("#cs-nat", f.nationalite);
    texte("#cs-statut", f.statut_label);
    const edit = $("#cs-edit");
    if (edit) { edit.dataset.edit = id; edit.href = f.modifier; }

    // Dos : copie du maillot de la page ; face : modèle avec le numéro
    const dos = $(`[data-open-locker="${id}"] .kit`);
    const zoneDos = $("#cs-kit");
    zoneDos.replaceChildren();
    if (dos) { const c = dos.cloneNode(true); c.removeAttribute("style"); zoneDos.appendChild(c); }
    const zoneFace = $("#fx-front");
    zoneFace.replaceChildren();
    if (tpl) {
      const face = tpl.content.firstElementChild.cloneNode(true);
      face.classList.toggle("kit-gk", f.poste === "GB");
      $(".kit-num-small", face).textContent = f.numero_maillot || "";
      zoneFace.appendChild(face);
    }
    flip.classList.remove("is-front");

    const i = ordre.indexOf(actuel);
    texte("#cs-pos", ordre.length && i >= 0 ? `${i + 1} / ${ordre.length}` : "");
    $("#cs-prev").disabled = $("#cs-next").disabled = ordre.length < 2;
  }

  function montrer() {
    wrap.hidden = false;
    document.body.style.overflow = "hidden";
    if (animate) {
      gsap.fromTo($(".fx-backdrop", wrap), { opacity: 0 }, { opacity: 1, duration: 0.4 });
      gsap.fromTo(".fx-stage", { y: -140, opacity: 0, rotationZ: -6 }, { y: 0, opacity: 1, rotationZ: 0, duration: 1, ease: "elastic.out(1, .6)" });
      gsap.fromTo(".fx-sheet", { x: 50, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "expo.out", delay: 0.15 });
      gsap.fromTo(".fx-hint", { opacity: 0 }, { opacity: 1, duration: 0.6, delay: 0.6 });
    }
    $(".fx-back", wrap).focus({ preventScroll: true });
  }

  function ouvrir(id, el) {
    retourFocus = el;
    ordre = listeDepuis(el).map(String);
    source = el.classList.contains("shirt") ? el : null;
    porte = el.classList.contains("lk") ? el : null;
    const retour = $(".fx-back", wrap);
    if (retour) {
      if (!retour.dataset.defaut) retour.dataset.defaut = retour.textContent.trim();
      retour.textContent = porte ? "Retour aux casiers" : retour.dataset.defaut;
    }
    remplir(id);
    if (source && animate) {
      // le maillot monte et quitte la tringle
      const s3 = $(".shirt-3d", source);
      gsap.to(s3, {
        y: -60, opacity: 0, duration: 0.35, ease: "power2.in",
        onComplete: () => { source?.classList.add("is-taken"); gsap.set(s3, { clearProps: "transform,opacity" }); montrer(); },
      });
    } else if (porte) {
      porte.classList.add("is-open");
      setTimeout(montrer, animate ? 650 : 0);
    } else {
      source?.classList.add("is-taken");
      montrer();
    }
  }

  function fermer(focus = true) {
    if (wrap.hidden) return;
    const fin = () => {
      wrap.hidden = true;
      if (!document.querySelector(".drawer-wrap.is-open, .dialog-wrap.is-open")) document.body.style.overflow = "";
    };
    if (source) {
      const s = source;
      s.classList.remove("is-taken");
      if (animate) {
        gsap.fromTo($(".shirt-3d", s), { y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "back.out(1.8)", delay: 0.2, clearProps: "transform,opacity" });
        setTimeout(() => balance($(".kit", s), 7), 600);
      }
    }
    if (porte) { const p = porte; setTimeout(() => p.classList.remove("is-open"), 250); }
    source = porte = null;
    if (focus) retourFocus?.focus?.({ preventScroll: true });
    if (animate) {
      gsap.to(".fx-stage", { y: -60, opacity: 0, duration: 0.3, ease: "power2.in" });
      gsap.to(".fx-sheet", { x: 30, opacity: 0, duration: 0.3, ease: "power2.in" });
      gsap.to($(".fx-backdrop", wrap), { opacity: 0, duration: 0.35, onComplete: fin });
    } else fin();
  }

  function suivant(pas) {
    if (ordre.length < 2) return;
    const i = ordre.indexOf(actuel);
    const id = ordre[(i + pas + ordre.length) % ordre.length];
    if (source) {
      source.classList.remove("is-taken");
      source = $(`.shirt[data-open-locker="${id}"]`);
      source?.classList.add("is-taken");
      retourFocus = source || retourFocus;
    } else if (porte) {
      porte.classList.remove("is-open");
      porte = $(`.lk[data-open-locker="${id}"]`);
      porte?.classList.add("is-open");
      retourFocus = porte || retourFocus;
    }
    if (animate) {
      gsap.fromTo(".fx-stage", { x: pas * 80, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: "expo.out" });
      gsap.fromTo(".fx-sheet > *", { x: pas * 24, opacity: 0 }, { x: 0, opacity: 1, stagger: 0.03, duration: 0.45, ease: "expo.out" });
    }
    remplir(id);
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-open-locker]");
    if (!el || !fiches[el.dataset.openLocker]) return;
    e.preventDefault();
    ouvrir(el.dataset.openLocker, el);
  });
  $$("[data-close-casier]", wrap).forEach((b) => b.addEventListener("click", () => fermer()));
  $("#cs-prev").addEventListener("click", () => suivant(-1));
  $("#cs-next").addEventListener("click", () => suivant(1));
  $("#fx-kit").addEventListener("click", () => flip.classList.toggle("is-front"));
  // « Modifier la fiche » : sur la page Joueurs, le panneau d'édition prend le relais
  $("#cs-edit")?.addEventListener("click", () => {
    if (!$("#drawer")) return; // page Casiers : le lien ouvre la page de modification
    fermer(false);
    wrap.hidden = true;
  });

  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.stopPropagation(); fermer(); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); suivant(-1); return; }
    if (e.key === "ArrowRight") { e.preventDefault(); suivant(1); return; }
    if (e.key !== "Tab") return;
    const f = $$("button:not(:disabled), a[href]", panneau).filter((n) => n.offsetParent !== null);
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  });
})();
