/* =========================================================
   YALLA • Vestiaire — interactions & micro-animations (GSAP)
   ========================================================= */
(() => {
  "use strict";
  const hasGsap = typeof window.gsap !== "undefined";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animate = hasGsap && !reduce;
  if (hasGsap && window.Flip) gsap.registerPlugin(Flip);

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const fiches = JSON.parse($("#fiches-joueurs")?.textContent || "{}");
  const POSTE = { GB: ["gardien", "Gardien"], DEF: ["defense", "Défenseur"], MIL: ["milieu", "Milieu"], ATT: ["attaque", "Attaquant"] };
  const STATUT = { DISPONIBLE: ["disponible", "Disponible"], DISPENSE: ["dispense", "Dispensé"], BLESSE: ["blesse", "Blessé"] };
  const fr = (n, d = 0) => n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: d });

  /* ---------- Indicateur glissant (rail + segments) ---------- */
  function slideIndicator(ind, target, vertical = false, instant = false) {
    if (!ind || !target) return;
    const props = vertical
      ? { y: target.offsetTop, height: target.offsetHeight }
      : { x: target.offsetLeft, width: target.offsetWidth };
    if (hasGsap) gsap.to(ind, { ...props, duration: instant || !animate ? 0 : 0.45, ease: "expo.out" });
    else Object.assign(ind.style, vertical ? { transform: `translateY(${props.y}px)`, height: props.height + "px" } : { transform: `translateX(${props.x}px)`, width: props.width + "px" });
  }
  const railActive = $(".rail-link.active");
  slideIndicator($(".rail-indicator"), railActive, true, true);
  $$(".rail-link:not(.is-soon)").forEach((l) => {
    l.addEventListener("mouseenter", () => slideIndicator($(".rail-indicator"), l, true));
    l.addEventListener("mouseleave", () => slideIndicator($(".rail-indicator"), railActive, true));
  });

  /* ---------- Entrée de page ---------- */
  const title = $("[data-split]");
  if (title) {
    // Découpe le titre en lettres pour l'animation
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          [...n.textContent].forEach((c) => {
            const s = document.createElement("span");
            s.className = "ch"; s.textContent = c === " " ? " " : c;
            frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
      });
    };
    title.setAttribute("aria-label", title.textContent.replace(/\s+/g, " ").trim());
    walk(title);
  }

  function countUp(el) {
    const end = parseFloat(el.dataset.count);
    if (isNaN(end)) return;
    const dec = parseInt(el.dataset.decimals || "0", 10);
    if (!animate) { el.textContent = fr(end, dec); return; }
    const o = { v: 0 };
    gsap.to(o, { v: end, duration: 1.6, ease: "power3.out", onUpdate: () => (el.textContent = fr(o.v, dec)) });
  }

  if (animate) {
    const cards = $$(".pcard:not([hidden])");
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.from(".rail-link, .rail-logo", { x: -30, opacity: 0, stagger: 0.06, duration: 0.8 })
      .from(".topbar > *", { y: -20, opacity: 0, stagger: 0.08, duration: 0.7 }, 0)
      .from(".eyebrow", { y: 16, opacity: 0, duration: 0.6 }, 0.15)
      .from(".hero-title .ch", { yPercent: 110, rotate: 8, opacity: 0, stagger: 0.025, duration: 1 }, 0.2)
      .from(".hero-sub, .hero-actions > *", { y: 20, opacity: 0, stagger: 0.08, duration: 0.8 }, 0.55)
      .from(".vr-scene", { y: 40, opacity: 0, duration: 1 }, 0.45);
    if (cards.length) gsap.from(cards, { y: 60, rotateX: -25, opacity: 0, stagger: 0.05, duration: 1, transformOrigin: "50% 100%", delay: 1 });
    $$("[data-count]").forEach((el) => tl.add(() => countUp(el), 0.6));
  }

  /* ---------- Survol : halo + inclinaison 3D ---------- */
  $$(".stat").forEach((s) => s.addEventListener("pointermove", (e) => {
    const r = s.getBoundingClientRect();
    s.style.setProperty("--mx", `${e.clientX - r.left}px`);
    s.style.setProperty("--my", `${e.clientY - r.top}px`);
  }));

  if (animate && window.matchMedia("(hover: hover)").matches) {
    $$(".pcard:not(.pcard-add)").forEach((card) => {
      const inner = $(".pcard-inner", card);
      const rx = gsap.quickTo(inner, "rotationX", { duration: 0.5, ease: "power3.out" });
      const ry = gsap.quickTo(inner, "rotationY", { duration: 0.5, ease: "power3.out" });
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        ry((px - 0.5) * 16); rx((0.5 - py) * 14);
        inner.style.setProperty("--gx", `${px * 100}%`);
        inner.style.setProperty("--gy", `${py * 100}%`);
      });
      card.addEventListener("pointerleave", () => { rx(0); ry(0); });
    });

    // Boutons « magnétiques »
    $$(".magnetic").forEach((b) => {
      const x = gsap.quickTo(b, "x", { duration: 0.4, ease: "power3.out" });
      const y = gsap.quickTo(b, "y", { duration: 0.4, ease: "power3.out" });
      b.addEventListener("pointermove", (e) => {
        const r = b.getBoundingClientRect();
        x((e.clientX - r.left - r.width / 2) * 0.25); y((e.clientY - r.top - r.height / 2) * 0.35);
      });
      b.addEventListener("pointerleave", () => { x(0); y(0); });
    });
  }

  /* ---------- Filtre par poste (piloté par la tringle) ---------- */
  const grid = $("#grid");
  window.yallaFiltrePoste = (poste) => {
    if (!grid) return;
    const cards = $$(".pcard[data-id]", grid);
    const flipState = animate && window.Flip ? Flip.getState($$(".pcard", grid)) : null;
    cards.forEach((c) => { c.hidden = !!poste && c.dataset.poste !== poste; });
    const add = $(".pcard-add", grid);
    if (add) add.hidden = !!poste;
    if (flipState) {
      Flip.from(flipState, {
        duration: 0.6, ease: "expo.out", absolute: true, scale: true, nested: true,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.85, y: 20 }, { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: "back.out(1.6)" }),
        onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.85, duration: 0.3 }),
      });
    }
  };

  /* ---------- Panneau ajout / modification ---------- */
  const drawerWrap = $("#drawer");
  const drawer = $(".drawer", drawerWrap);
  const form = $("#form-joueur");
  const preview = $("#preview");
  const pvAv = $("#pv-av");
  let lastFocus = null;

  function openLayer(wrap, panel, fromRight) {
    lastFocus = document.activeElement;
    wrap.hidden = false;
    wrap.classList.add("is-open");
    document.body.style.overflow = "hidden";
    if (animate) {
      gsap.fromTo($(".drawer-backdrop", wrap), { opacity: 0 }, { opacity: 1, duration: 0.35 });
      if (fromRight) {
        gsap.fromTo(panel, { xPercent: 105 }, { xPercent: 0, duration: 0.7, ease: "expo.out" });
        gsap.from($$(".preview, .fs, .form-alert", panel), { x: 40, opacity: 0, stagger: 0.06, duration: 0.6, ease: "expo.out", delay: 0.12 });
      } else {
        gsap.fromTo(panel, { scale: 0.85, opacity: 0, y: 20 }, { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: "back.out(1.6)" });
        gsap.fromTo($(".dialog-ic", panel), { rotate: -25 }, { rotate: 0, duration: 0.8, ease: "elastic.out(1, .4)" });
      }
    }
    setTimeout(() => $(fromRight ? "#id_prenom" : ".btn-danger", panel)?.focus({ preventScroll: true }), 120);
  }

  function closeLayer(wrap, panel, fromRight) {
    const done = () => {
      wrap.hidden = true; wrap.classList.remove("is-open"); document.body.style.overflow = "";
      lastFocus?.focus?.({ preventScroll: true });
    };
    // Nettoie l'URL (?nouveau=1, /modifier/, /supprimer/, /ajouter/)
    if (location.pathname !== wrap.dataset.listUrl && wrap.dataset.listUrl) history.replaceState(null, "", wrap.dataset.listUrl);
    else if (location.search.includes("nouveau")) history.replaceState(null, "", location.pathname);
    if (!animate) return done();
    gsap.to($(".drawer-backdrop", wrap), { opacity: 0, duration: 0.3 });
    gsap.to(panel, fromRight ? { xPercent: 105, duration: 0.45, ease: "expo.in", onComplete: done }
                             : { scale: 0.9, opacity: 0, duration: 0.25, onComplete: done });
  }

  function setRadio(name, value) {
    const r = form.querySelector(`input[name="${name}"][value="${value}"]`);
    if (r) r.checked = true;
  }

  function clearErrors() {
    $$(".err, .form-alert", form).forEach((e) => e.remove());
    $$(".has-error", form).forEach((e) => e.classList.remove("has-error"));
  }

  function fillForm(f) {
    clearErrors();
    form.reset();
    ["prenom", "nom", "email", "telephone", "date_naissance", "nationalite", "numero_maillot", "pied_fort", "taille_cm", "poids_kg", "equipe"]
      .forEach((k) => { const el = form.elements[k]; if (el) el.value = f ? (f[k] ?? "") : ""; });
    setRadio("poste", f ? f.poste : (form.dataset.defaultPoste || "MIL"));
    setRadio("statut", f ? f.statut : "DISPONIBLE");
    pvAv.style.backgroundImage = f && f.photo ? `url("${f.photo}")` : "";
    updatePreview();
  }

  function openForm(id, poste) {
    const f = id ? fiches[id] : null;
    drawerWrap.dataset.mode = f ? "edit" : "add";
    form.action = f ? f.modifier : drawerWrap.dataset.addAction;
    $("#drawer-eyebrow").textContent = f ? "Fiche joueur" : "Nouvelle recrue";
    $("#drawer-title").textContent = f ? `Modifier ${f.prenom} ${f.nom}` : "Ajouter un joueur";
    $("#drawer-submit-txt").textContent = f ? "Enregistrer" : "Ajouter au vestiaire";
    fillForm(f);
    if (!f && poste) { setRadio("poste", poste); updatePreview(); }
    openLayer(drawerWrap, drawer, true);
  }

  function updatePreview() {
    const v = (k) => (form.elements[k]?.value || "").trim();
    const poste = form.querySelector('input[name="poste"]:checked')?.value || "MIL";
    const statut = form.querySelector('input[name="statut"]:checked')?.value || "DISPONIBLE";
    preview.className = `preview pos-${POSTE[poste][0]}`;
    $("#pv-pos").textContent = POSTE[poste][1];
    const st = $("#pv-st");
    st.textContent = STATUT[statut][1];
    st.className = `tag-st st-${STATUT[statut][0]}`;
    const nom = `${v("prenom")} ${v("nom")}`.trim();
    $("#pv-name").textContent = nom || "Nom du joueur";
    $("#pv-num").textContent = v("numero_maillot") || "#";
    $("#pv-ini").textContent = ((v("prenom")[0] || "") + (v("nom")[0] || "")).toUpperCase() || "?";
  }

  form.addEventListener("input", updatePreview);
  form.addEventListener("change", (e) => {
    updatePreview();
    if (animate && e.target.type === "radio") gsap.fromTo(pvAv, { scale: 0.85 }, { scale: 1, duration: 0.6, ease: "elastic.out(1, .45)" });
  });
  form.elements.photo?.addEventListener("change", () => {
    const file = form.elements.photo.files[0];
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      pvAv.style.backgroundImage = `url("${rd.result}")`;
      if (animate) gsap.fromTo(pvAv, { rotate: -180, scale: 0.6 }, { rotate: 0, scale: 1, duration: 0.8, ease: "back.out(1.7)" });
    };
    rd.readAsDataURL(file);
  });
  form.addEventListener("submit", () => {
    const b = $("#drawer-submit");
    b.style.pointerEvents = "none";
    if (animate) gsap.to(b, { scale: 0.96, opacity: 0.75, duration: 0.2 });
  });
  updatePreview();

  $$("[data-open-drawer]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); openForm(null, a.dataset.poste); }));
  document.addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit]");
    if (edit && fiches[edit.dataset.edit]) { e.preventDefault(); openForm(edit.dataset.edit); }
  });

  /* ---------- Suppression ---------- */
  const confirmWrap = $("#confirm");
  const dialog = $(".dialog", confirmWrap);
  document.addEventListener("click", (e) => {
    const del = e.target.closest("[data-delete]");
    if (!del) return;
    e.preventDefault();
    const f = fiches[del.dataset.delete];
    $("#form-suppr").action = f.supprimer;
    $("#confirm-nom").textContent = `${f.prenom} ${f.nom}`;
    openLayer(confirmWrap, dialog, false);
  });

  /* ---------- Fermeture ---------- */
  const closeAny = (wrap) => (wrap === drawerWrap ? closeLayer(drawerWrap, drawer, true) : closeLayer(confirmWrap, dialog, false));
  $$("[data-close]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); closeAny(b.closest(".drawer-wrap, .dialog-wrap")); }));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = [confirmWrap, drawerWrap].find((w) => !w.hidden);
    if (open) closeAny(open);
  });

  // Ouverts par le serveur (erreurs de validation, liens sans JS)
  if (!drawerWrap.hidden) { drawerWrap.hidden = true; openLayer(drawerWrap, drawer, true); }
  if (!confirmWrap.hidden) { confirmWrap.hidden = true; openLayer(confirmWrap, dialog, false); }

  /* ---------- Carte mise en avant après ajout / modif ---------- */
  if (location.hash.startsWith("#joueur-")) {
    const c = $(location.hash);
    if (c && animate) {
      c.scrollIntoView({ block: "center" });
      gsap.fromTo($(".pcard-inner", c), { boxShadow: "0 0 0 0 rgba(212,255,58,.9)" },
        { boxShadow: "0 0 0 6px rgba(212,255,58,0)", duration: 1.4, repeat: 2, delay: 1.2 });
    }
  }

  /* ---------- Notifications ---------- */
  $$(".toast").forEach((tst, i) => {
    if (animate) gsap.from(tst, { x: 80, opacity: 0, duration: 0.7, ease: "expo.out", delay: 0.8 + i * 0.1 });
    setTimeout(() => {
      if (animate) gsap.to(tst, { x: 80, opacity: 0, duration: 0.4, onComplete: () => tst.remove() });
      else tst.remove();
    }, 4500 + i * 400);
  });
})();
