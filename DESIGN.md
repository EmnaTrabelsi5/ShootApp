# DESIGN.md · YALLA FootLab Pro, page d'accueil « Radès »

Unique source de valeurs pour `templates/accueil.html`, `static/css/rades.css` et les scripts associés.
Aucune couleur, taille ou espacement en dehors de ce fichier.

Direction : clair, sportif, éditorial. Les vraies photos du stade de Radès portent l'émotion. L'interface reste sobre autour : un vert profond, un citron vif réservé à l'action principale et le rouge tunisien comme seul accent chaud.

---

## 1. Couleurs

Contrastes calculés avec la formule WCAG 2.x. Minimum 4,5:1 pour le texte courant et 3:1 pour le gros texte (≥ 24px, ou ≥ 19px gras).

| Jeton | Valeur | Rôle | Contraste vérifié |
|---|---|---|---|
| `--bg` | `#f4f6f1` | fond de page | — |
| `--surface` | `#ffffff` | cartes, navigation pleine, pied de page | — |
| `--ink` | `#0f2118` | texte principal, titres | 15,4:1 sur `--bg` |
| `--ink-2` | `#3d5447` | texte courant secondaire, intros | 7,5:1 sur `--bg`, 8,2:1 sur `--surface` |
| `--muted` | `#566b5f` | légendes, métadonnées | 5,3:1 sur `--bg`, 5,7:1 sur `--surface` |
| `--line` | `rgba(16,48,30,.10)` | bordures, séparateurs | décoratif |
| `--green` | `#1f7a3a` | boutons primaires, sur-titres, liens | blanc dessus 5,4:1 ; sur `--surface` 5,4:1 ; sur `--bg` 4,9:1 |
| `--green-hover` | `#186330` | survol des boutons primaires | blanc dessus 7,3:1 |
| `--lime` | `#d4ff3a` | action principale (CTA navigation), accent sur fond sombre | `--ink` dessus 14,5:1 ; sur `--night` 14,5:1. **Jamais en texte sur fond clair (1,1:1)** |
| `--red` | `#c8102e` | rouge Tunisie : président, pastille « en direct » | blanc dessus 5,9:1 |
| `--night` | `#0f2118` | sections sombres (circuit, CTA) | — |
| `--on-night` | `#ffffff` | titres sur `--night` | 15,4:1 |
| `--on-night-2` | `rgba(255,255,255,.78)` ≈ `#cacecc` | texte courant sur `--night` | 10,6:1 |

### Couleurs des rôles

Chaque pastille porte une icône. La couleur de l'icône est choisie pour être lisible sur la pastille.

| Rôle | Pastille | Icône / texte dessus | Contraste |
|---|---|---|---|
| Président | `#c8102e` | blanc | 5,9:1 |
| Entraîneur | `#1f7a3a` | blanc | 5,4:1 |
| Joueurs | `#f5b800` | `--ink` | 9,4:1 |
| Scouts | `#2563eb` | blanc | 5,2:1 |
| Staff | `#7c3aed` | blanc | 5,7:1 |

---

## 2. Typographie

Deux familles, déjà présentes dans `static/fonts` :
- **Barlow Condensed 800**, en majuscules : tous les titres et les chiffres.
- **Inter 400 / 500 / 600** : tout le reste.

Échelle à ratio d'au moins ×1,33 entre deux niveaux d'affichage, pour qu'ils se distinguent nettement.

| Jeton | Taille | Interligne | Graisse | Usage |
|---|---|---|---|---|
| `--t-display` | `clamp(56px, 10vw, 144px)` | 0,88 | 800 | titre du hero |
| `--t-h1` | `clamp(48px, 7vw, 104px)` | 0,9 | 800 | titre du CTA final |
| `--t-h2` | `clamp(40px, 5.5vw, 72px)` | 0,95 | 800 | titres de section |
| `--t-h3` | `40px` | 1 | 800 | chiffres clés |
| `--t-h4` | `24px` | 1 | 800 | noms des rôles, numéros d'étapes |
| `--t-lead` | `20px` (18px mobile) | 1,6 | 400 | intros de section, sous-titre du hero |
| `--t-body` | `16px` | 1,6 | 400 | texte courant, boutons (600) |
| `--t-small` | `14px` | 1,5 | 500 | légendes, liens de navigation, pied de page |
| `--t-micro` | `12px` | 1,4 | 700, majuscules, espacement 0,14em | sur-titres, badges de rôle |

Longueur de ligne maximale : 60 caractères pour `--t-lead` et `--t-body` (`max-width: 36rem`).

---

## 3. Espacements (grille 4/8px)

| Jeton | Valeur |
|---|---|
| `--s-1` | 4px |
| `--s-2` | 8px |
| `--s-3` | 12px |
| `--s-4` | 16px |
| `--s-5` | 24px |
| `--s-6` | 32px |
| `--s-7` | 48px |
| `--s-8` | 64px |
| `--s-9` | 96px |
| `--s-10` | 128px |

- Marges intérieures des sections : `--s-10` en haut et en bas sur ordinateur, `--s-9` sur mobile.
- Largeur de contenu : `min(1184px, 100% - 48px)`, soit 24px de marge sur mobile.
- Écart entre cartes : `--s-4` ; entre colonnes : `--s-8`.

## 4. Rayons et ombres

| Jeton | Valeur | Usage |
|---|---|---|
| `--r-sm` | 8px | badges, petites étiquettes |
| `--r-md` | 16px | cartes (chiffres, étapes) |
| `--r-lg` | 24px | grands médias (anneau 360°) |
| `--r-pill` | 999px | boutons, navigation, sur-titre du hero |
| — | 50 % | pastilles des rôles |

| Jeton | Valeur |
|---|---|
| `--shadow-sm` | `0 8px 24px -12px rgba(16,48,30,.25)` |
| `--shadow-lg` | `0 24px 48px -24px rgba(16,48,30,.45)` |

## 5. Mouvement

| Jeton | Valeur | Usage |
|---|---|---|
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | survols, apparitions |
| `--ease-in-out` | `cubic-bezier(.65,0,.35,1)` | révélations d'images |
| `--d-fast` | 200ms | survol, focus, couleur |
| `--d-base` | 400ms | inclinaison 3D, menu mobile |
| `--d-slow` | 800ms | apparitions au défilement (GSAP `expo.out`) |

- Apparitions : translation de 24px et fondu, décalage de 60ms entre éléments. Jamais plus de 1,2s.
- Survol des boutons : translation de −2px et changement de couleur. Pas de rebond.
- Avec `prefers-reduced-motion: reduce` : pas de Lenis, pas de 3D, pas d'animation au défilement. Les photos fixes restent.

## 6. Focus et accessibilité

- Focus clavier visible partout : `outline: 2px solid var(--green); outline-offset: 3px`, et `--lime` sur les fonds sombres et les photos.
- Lien d'évitement « Aller au contenu » en tout premier, visible au focus.
- Cibles tactiles d'au moins 44 × 44px.
- Toute image qui porte du sens a un texte alternatif ; les photos décoratives ont `alt=""`.

---

## 7. Composants

### Navigation
- Pilule flottante : 16px du bord (8px sur mobile), hauteur 64px, `--r-pill`.
- Au-dessus de la photo : verre (`rgba(255,255,255,.14)` + flou 14px), texte blanc.
- Après le hero : `--surface` à 92 %, texte `--ink`, `--shadow-sm`.
- Liens en `--t-small` 500 ; lien actif sur fond `rgba(31,122,58,.10)` et texte `--green`.
- CTA « Vestiaire » : `--lime` / `--ink`.
- **Mobile (< 960px)** : bouton menu de 44px, qui ouvre un panneau plein écran listant les liens en `--t-h4`. Fermeture par le bouton, par Échap ou par le choix d'un lien. `aria-expanded` sur le bouton.

### Boutons
| Variante | Fond | Texte | Survol |
|---|---|---|---|
| Primaire | `--green` | blanc | `--green-hover`, −2px |
| Clair (sur photo) | blanc 92 % | `--ink` | blanc 100 %, −2px |
| Action (CTA) | `--lime` | `--ink` | −2px, `--shadow-sm` |

Tailles : `sm` 40px de haut (padding 8/16), `md` 48px (12/24), `lg` 56px (16/32). `--t-body` 600, `--r-pill`.

### Hero
- Photo plein écran (100svh, minimum 640px) en relief 3D. Dégradé sombre en bas et à gauche pour garantir le contraste du texte blanc.
- Sur-titre en pilule `--t-small`, titre `--t-display` sur 2 lignes (la 2e en `--lime`), sous-titre `--t-lead` en blanc 90 %, 2 boutons (primaire et clair).

### Carte chiffre
`--surface`, bordure `--line`, `--r-md`, padding `--s-5`. Chiffre en `--t-h3` `--green`, légende en `--t-small` `--muted`.

### Anneau 360°
Hauteur `min(78vh, 720px)` (62vh sur mobile), `--r-lg`. Indication en pilule `--surface` en bas, badge « 360° » en `--green`.

### Pastille de rôle
Cercle de 88px (72px sur mobile) dans la couleur du rôle, icône SVG de 36px (trait de 1,8). Anneau de 8px couleur `--surface` autour. Nom en `--t-h4`, chiffre réel puis rôle en `--t-small` `--muted`.

### Carte d'étape (circuit)
Fond blanc 5 % sur `--night`, bordure blanc 10 %, `--r-md`, padding `--s-5`. Badge de rôle `--t-micro` en `--r-pill`. Numéro en `--t-h4`, blanc 16 %. Texte `--t-body` `--on-night-2`.

### Pied de page
`--surface`, padding `--s-6`. Crédits photos dans un `<details>` en `--t-small`. Les liens sont en `--green` et soulignés.

---

## 8. Structure de la page

1. **Hero** : photo en relief, « Une équipe, cinq métiers ».
2. **Radès** : texte, 3 chiffres clés, anneau 360°.
3. **L'équipe** : les 5 pastilles de rôle avec les vrais chiffres de la base.
4. **Le circuit** : les 6 étapes du scout jusqu'au match. C'est la seule section qui explique les liens entre rôles, l'organigramme ne fait que les présenter.
5. **CTA** : photo de nuit en relief, « Le vestiaire est ouvert ».
6. **Pied de page** avec crédits.

---

## 9. Corrections apportées par rapport à la page actuelle

| Avant | Après | Raison |
|---|---|---|
| `--muted` `#6b8275` | `#566b5f` | 3,8:1 → 5,3:1 sur le fond |
| Survol du bouton primaire `#2e9d50` (blanc 3,5:1) | `#186330` | 3,5:1 → 7,3:1 |
| Pastille Joueurs `#e0a100` avec icône blanche | `#f5b800` avec icône `--ink` | 2,3:1 → 9,4:1 |
| Badge « Joueur » du circuit en `#f5b800`/`--ink`, pastille en `#e0a100` | Une seule valeur, `#f5b800` | 2 jaunes pour un même rôle |
| Titres 76 / 72 / 120 / 148px, 3 tailles d'affichage voisines | 144 / 104 / 72px | ratio ≥ ×1,33 |
| 44px et 40px (chiffres, numéros) | 40px seulement | trop proches |
| 22, 24 et 30px | 24px seulement | trop proches |
| Texte 13 / 14 / 15 / 17 / 18 / 19px | 12 / 14 / 16 / 20px | niveaux distincts |
| Espacements 5, 6, 7, 10, 14, 18, 22, 26, 34, 90, 110, 130px | grille 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128 | grille 4/8px |
| 7 rayons (2, 12, 16, 18, 20, 22, 28px) | 8 / 16 / 24px + pilule | cohérence |
| Ombre unique non nommée | `--shadow-sm` et `--shadow-lg` | profondeur maîtrisée |
| Aucun style de focus | contour vert (lime sur fond sombre) | navigation au clavier |
| Liens de navigation masqués sous 960px | bouton menu et panneau plein écran | navigation mobile |
| Pas de lien d'évitement | « Aller au contenu » | accessibilité |
| Hauteur minimale du hero 620px | 640px | grille 8px |
