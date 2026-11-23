/* Yalla • Tableau tactique : glisser-déposer des joueurs et des repères (souris et tactile).
   Les positions (en % du terrain) sont enregistrées automatiquement en base (/tableau/). */
(function () {
  const pitch = document.getElementById("pitch");
  if (!pitch) return;
  const url = pitch.dataset.url;
  const etat = document.getElementById("tac-save");
  const reset = document.getElementById("tac-reset");
  const csrfEl = document.querySelector('input[name="csrfmiddlewaretoken"]');
  const elements = [...pitch.querySelectorAll("[data-drag]")];
  const dataEl = document.getElementById("tableau-data");
  const sauvegarde = dataEl ? JSON.parse(dataEl.textContent) : {};

  // Positions d'origine (celles du gabarit), pour « Réinitialiser »
  const origine = {};
  elements.forEach(el => { origine[el.dataset.drag] = { left: el.style.left, top: el.style.top }; });

  function poser(el, x, y) { el.style.left = x + "%"; el.style.top = y + "%"; }
  Object.entries(sauvegarde).forEach(([id, [x, y]]) => {
    const el = pitch.querySelector(`[data-drag="${id}"]`);
    if (el) poser(el, x, y);
  });

  function pourcent(el) {
    const cs = getComputedStyle(el);
    return [parseFloat(cs.left) / pitch.offsetWidth * 100, parseFloat(cs.top) / pitch.offsetHeight * 100];
  }

  // ---------------------------------------------------------------- détection du dispositif
  // Les 10 joueurs de champ sont regroupés en lignes selon leur profondeur (axe gauche → droite,
  // l'équipe attaque vers la droite). On compare un découpage en 3 lignes et en 4 lignes.
  const badge = document.getElementById("tac-formation");
  function lignes(xs, k) {
    // meilleur découpage de xs (trié) en k groupes consécutifs (somme des écarts au carré minimale)
    const n = xs.length;
    const sse = (a, b) => { const p = xs.slice(a, b), m = p.reduce((t, v) => t + v, 0) / p.length; return p.reduce((t, v) => t + (v - m) ** 2, 0); };
    let best = null;
    (function rec(debut, reste, coupes) {
      if (reste === 1) {
        const bornes = [...coupes, n]; let tot = 0, prev = 0;
        for (const f of bornes) { tot += sse(prev, f); prev = f; }
        if (!best || tot < best.tot) best = { tot, bornes };
        return;
      }
      for (let i = debut + 1; i <= n - reste + 1; i++) rec(i, reste - 1, [...coupes, i]);
    })(0, k, []);
    let prev = 0;
    const groupes = best.bornes.map(f => { const g = xs.slice(prev, f); prev = f; return g; });
    return { tot: best.tot, tailles: groupes.map(g => g.length), centres: groupes.map(g => g.reduce((t, v) => t + v, 0) / g.length) };
  }
  function detecter() {
    const xs = elements.filter(el => /^p\d+$/.test(el.dataset.drag) && el.dataset.drag !== "p1")
      .map(el => pourcent(el)[0]).sort((a, b) => a - b);
    if (xs.length < 4) return;
    const l3 = lignes(xs, 3), l4 = lignes(xs, 4);
    const ecartsOk = l4.centres.every((c, i) => i === 0 || c - l4.centres[i - 1] >= 6);
    const choix = (l4.tot < l3.tot * 0.4 && ecartsOk) ? l4 : l3;
    const txt = choix.tailles.join("-");
    if (badge && badge.textContent !== txt) {
      badge.textContent = txt;
      badge.parentElement.classList.remove("pulse"); void badge.offsetWidth; badge.parentElement.classList.add("pulse");
    }
  }

  // ---------------------------------------------------------------- enregistrement
  let minuterie = null;
  function message(txt, cls) { if (etat) { etat.textContent = txt; etat.className = "tac-save " + (cls || ""); } }
  function enregistrer(positions) {
    clearTimeout(minuterie);
    message("Enregistrement…", "wait");
    minuterie = setTimeout(async () => {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRFToken": csrfEl ? csrfEl.value : "", "X-Requested-With": "XMLHttpRequest" },
          body: JSON.stringify({ positions }),
        });
        const d = await r.json();
        message(d.ok ? "✓ Positions enregistrées" : (d.erreur || "Erreur"), d.ok ? "ok" : "ko");
      } catch (e) { message("Serveur injoignable", "ko"); }
      setTimeout(() => { if (etat && etat.classList.contains("ok")) message("", ""); }, 2500);
    }, 400);
  }
  function toutes() {
    const pos = {};
    elements.forEach(el => {
      if (el.dataset.bouge) { const [x, y] = pourcent(el); pos[el.dataset.drag] = [+x.toFixed(2), +y.toFixed(2)]; }
    });
    return pos;
  }
  Object.keys(sauvegarde).forEach(id => { const el = pitch.querySelector(`[data-drag="${id}"]`); if (el) el.dataset.bouge = "1"; });

  // ---------------------------------------------------------------- glisser-déposer
  let drag = null;
  elements.forEach(el => {
    el.setAttribute("title", "Glisse pour déplacer");
    el.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      e.preventDefault();
      const r = pitch.getBoundingClientRect();
      const [x, y] = pourcent(el);
      drag = { el, x0: e.clientX, y0: e.clientY, x, y, w: r.width, h: r.height };
      el.setPointerCapture(e.pointerId);
      el.classList.add("dragging");
      pitch.classList.add("is-dragging");
    });
    el.addEventListener("pointermove", e => {
      if (!drag || drag.el !== el) return;
      const nx = Math.min(98, Math.max(2, drag.x + (e.clientX - drag.x0) / drag.w * 100));
      const ny = Math.min(96, Math.max(4, drag.y + (e.clientY - drag.y0) / drag.h * 100));
      poser(el, nx, ny);
      detecter();
    });
    const fin = e => {
      if (!drag || drag.el !== el) return;
      const bouge = Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) > 2;
      el.classList.remove("dragging");
      pitch.classList.remove("is-dragging");
      drag = null;
      if (bouge) { el.dataset.bouge = "1"; enregistrer(toutes()); }
    };
    el.addEventListener("pointerup", fin);
    el.addEventListener("pointercancel", fin);
    // clavier : flèches pour ajuster finement
    el.tabIndex = 0;
    el.addEventListener("keydown", e => {
      const pas = e.shiftKey ? 5 : 1;
      const d = { ArrowLeft: [-pas, 0], ArrowRight: [pas, 0], ArrowUp: [0, -pas], ArrowDown: [0, pas] }[e.key];
      if (!d) return;
      e.preventDefault();
      const [x, y] = pourcent(el);
      poser(el, Math.min(98, Math.max(2, x + d[0])), Math.min(96, Math.max(4, y + d[1])));
      el.dataset.bouge = "1";
      detecter();
      enregistrer(toutes());
    });
  });

  if (reset) reset.addEventListener("click", () => {
    elements.forEach(el => {
      el.style.left = origine[el.dataset.drag].left; el.style.top = origine[el.dataset.drag].top;
      delete el.dataset.bouge;
      el.classList.add("snap"); setTimeout(() => el.classList.remove("snap"), 400);
    });
    enregistrer({});
    setTimeout(detecter, 420);
  });
  detecter();
})();
