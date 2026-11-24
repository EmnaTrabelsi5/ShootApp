/* YALLA · Accueil « Radès » : animations au défilement (GSAP + ScrollTrigger + Lenis) */
(() => {
  const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nav = document.getElementById('nav');

  // Barre de navigation : opaque dès qu'on quitte la photo d'ouverture
  const majNav = () => nav.classList.toggle('is-solid', window.scrollY > window.innerHeight * 0.75);
  majNav();
  window.addEventListener('scroll', majNav, { passive: true });

  // Menu mobile plein écran
  const bouton = document.getElementById('nav-burger');
  const menu = document.getElementById('menu');
  const ouvrirMenu = (ouvert) => {
    bouton.setAttribute('aria-expanded', String(ouvert));
    bouton.setAttribute('aria-label', ouvert ? 'Fermer le menu' : 'Ouvrir le menu');
    document.body.classList.toggle('menu-open', ouvert);
    nav.classList.toggle('menu-on', ouvert);
    if (window.__lenis) ouvert ? window.__lenis.stop() : window.__lenis.start();
    if (ouvert) {
      menu.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
      menu.querySelector('a').focus({ preventScroll: true });
    } else {
      menu.classList.remove('is-open');
      setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 400);
    }
  };
  if (bouton && menu) {
    bouton.addEventListener('click', () => ouvrirMenu(bouton.getAttribute('aria-expanded') !== 'true'));
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => ouvrirMenu(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && bouton.getAttribute('aria-expanded') === 'true') { ouvrirMenu(false); bouton.focus(); }
    });
    // Garder le focus dans le menu ouvert
    menu.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const liens = [...menu.querySelectorAll('a'), bouton];
      const i = liens.indexOf(document.activeElement);
      e.preventDefault();
      liens[(i + (e.shiftKey ? -1 : 1) + liens.length) % liens.length].focus();
    });
    matchMedia('(min-width: 961px)').addEventListener('change', (m) => { if (m.matches) ouvrirMenu(false); });
  }

  // Titres découpés en mots : le lecteur d'écran lit la phrase entière
  document.querySelectorAll('.reveal-words').forEach((el) => el.setAttribute('aria-label', el.textContent.trim()));

  if (!window.gsap || reduit) return;
  gsap.registerPlugin(ScrollTrigger);

  // Défilement fluide
  if (window.Lenis) {
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    window.__lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]:not(.skip)').forEach((a) => {
      a.addEventListener('click', (e) => {
        const cible = document.querySelector(a.getAttribute('href'));
        if (!cible) return;
        e.preventDefault();
        lenis.scrollTo(cible, { offset: a.getAttribute('href') === '#hero' ? 0 : -24 });
      });
    });
  }

  // Découpe des titres en mots
  document.querySelectorAll('.reveal-words').forEach((el) => {
    el.innerHTML = el.textContent.trim().split(/\s+/)
      .map((m) => `<span class="w" aria-hidden="true"><span>${m}</span></span>`).join(' ');
  });

  // ----- Ouverture -----
  const intro = gsap.timeline({ defaults: { ease: 'expo.out' } });
  intro
    .from('.hero-img', { scale: 1.25, duration: 2.4, ease: 'power3.out' }, 0)
    .from('.hero-title .ln > span', { yPercent: 110, duration: 1.3, stagger: 0.12 }, 0.3)
    .from('.kicker', { y: 20, autoAlpha: 0, duration: 1 }, 0.5)
    .from('.hero-lead', { y: 24, autoAlpha: 0, duration: 1 }, 0.7)
    .from('.nav', { y: -30, autoAlpha: 0, duration: 1 }, 0.6)
    .from('.hero-scroll', { autoAlpha: 0, duration: 1 }, 1.2);

  // Parallaxe de la photo d'ouverture
  gsap.to('.hero-img', {
    yPercent: 14, scale: 1.08, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.to('.hero-inner', {
    y: -80, autoAlpha: 0, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: '35% top', end: '85% top', scrub: true },
  });

  // Titres mot à mot
  document.querySelectorAll('.reveal-words').forEach((el) => {
    gsap.from(el.querySelectorAll('.w > span'), {
      yPercent: 110, duration: 1, ease: 'expo.out', stagger: 0.05,
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
  });
  gsap.utils.toArray('.reveal').forEach((el) => {
    gsap.from(el, { y: 30, autoAlpha: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
  });

  // Compteurs
  document.querySelectorAll('[data-count]').forEach((el) => {
    const fin = +el.dataset.count;
    const annee = fin > 1900 && fin < 2100;
    const o = { v: annee ? fin - 30 : 0 };
    const fmt = (v) => annee ? Math.round(v) : Math.round(v).toLocaleString('fr-FR');
    el.textContent = fmt(o.v);
    gsap.to(o, {
      v: fin, duration: 2, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 90%' },
      onUpdate: () => { el.textContent = fmt(o.v); },
    });
  });

  // Bande de photos qui glisse
  gsap.fromTo('.strip-track', { x: 0 }, {
    x: () => -(document.querySelector('.strip-track').scrollWidth - window.innerWidth + 48),
    ease: 'none',
    scrollTrigger: { trigger: '.strip', start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
  });

  // Organigramme
  gsap.from('.org-node', {
    y: 50, autoAlpha: 0, duration: 1, ease: 'expo.out', stagger: 0.09,
    scrollTrigger: { trigger: '.org-map', start: 'top 82%' },
  });

  // Rôles : photo dévoilée + parallaxe, texte en cascade
  document.querySelectorAll('.role').forEach((role) => {
    const media = role.querySelector('.role-media');
    const img = media.querySelector('img');
    const deGauche = !role.classList.contains('role-flip');
    gsap.fromTo(media,
      { clipPath: deGauche ? 'inset(0 100% 0 0 round 22px)' : 'inset(0 0 0 100% round 22px)' },
      { clipPath: 'inset(0 0% 0 0% round 22px)', duration: 1.4, ease: 'expo.inOut',
        scrollTrigger: { trigger: role, start: 'top 75%' } });
    gsap.fromTo(img, { yPercent: -8 }, {
      yPercent: 0, ease: 'none',
      scrollTrigger: { trigger: role, start: 'top bottom', end: 'bottom top', scrub: true },
    });
    gsap.from(role.querySelectorAll('.role-num, .role-title, .role-lead, .role-list li, .role-foot'), {
      y: 34, autoAlpha: 0, duration: 0.9, ease: 'power3.out', stagger: 0.07,
      scrollTrigger: { trigger: role, start: 'top 70%' },
    });
  });

  // Lien actif dans la navigation
  [['#stade', '#stade'], ['#equipe', '#equipe'], ['#circuit', '#circuit']].forEach(([sel, lien]) => {
    const a = nav.querySelector(`a[href="${lien}"]`);
    ScrollTrigger.create({
      trigger: sel, start: 'top 50%', end: 'bottom 50%',
      onToggle: (s) => a && a.classList.toggle('is-on', s.isActive),
    });
  });

  // Circuit
  gsap.from('.flow li', {
    y: 40, autoAlpha: 0, duration: 0.9, ease: 'expo.out', stagger: 0.1,
    scrollTrigger: { trigger: '.flow', start: 'top 80%' },
  });

  // CTA
  gsap.fromTo('.cta-media', { yPercent: -8 }, {
    yPercent: 8, ease: 'none',
    scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true },
  });

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
