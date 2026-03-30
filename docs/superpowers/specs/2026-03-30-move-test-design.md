# Move Test — Design Spec
**Date:** 2026-03-30
**Scope:** Standalone test loop for the player movement mechanic (`move-test.html`)

---

## Objectif

Fichier HTML autonome permettant de tester en boucle le feeling du déplacement. Lance directement sans passer par le menu. Importe uniquement `src/js/court.js` (inliné pour éviter le blocage file://).

---

## Architecture

Fichier `move-test.html` à la racine du projet. Un seul `<canvas>` plein écran. Tout le code inline dans un `<script>`.

### Machine à états

```
IDLE → HOVERING → MOVING → ARRIVING → IDLE (à la nouvelle position)
```

| État | Description |
|------|-------------|
| `idle` | Joueur immobile à sa position courante, hint visible |
| `hovering` | Souris sur la moitié alliée — fantôme suit le curseur en temps réel |
| `moving` | Destination figée au clic — joueur se déplace avec traîne de fantômes |
| `arriving` | Flash lumineux à l'arrivée (~400ms), puis retour à `idle` |

### État central (objet mutable)

```js
{
  phase:       'idle',
  playerNorm:  { x: 0.5, y: 0.75 },  // position courante du joueur
  cursorNorm:  null,                   // position normalisée du curseur (hover)
  frozenDest:  null,                   // destination figée au clic { x, y }
  moveT:       0,                      // 0→1 progression du déplacement
  moveStartMs: null,
  arrivingMs:  null,
}
```

---

## Hover (état `hovering`)

- **Activation** : souris entre dans la moitié alliée (y > 0.5)
- **Fantôme** : cercle bleu translucide `rgba(37,99,235,0.20)`, contour pointillé `#3b82f6`, label "YOU" à 40% opacité — suit le curseur en temps réel
- **Ligne de chemin** : pointillés `[5, 4]` du joueur au curseur, `#3b82f6`, opacity 0.4, épaisseur 1.5px
- **Désactivation** : souris hors de la moitié alliée → fantôme et ligne disparaissent
- **Clic** → fige `frozenDest = cursorNorm`, passe à `moving`

---

## Déplacement (état `moving`)

- **Interpolation** : `easeInOut(t)` sur la ligne droite from → frozenDest
- **Durée** : `280 + dist * 420` ms — court trajet ≈ 300ms, long trajet ≈ 520ms (dist en unités normalisées, clampé 280–560ms)
- **Traîne de 3 fantômes** : positions à `t - 0.07`, `t - 0.14`, `t - 0.21`, opacités `0.40 / 0.25 / 0.12`
- **Fantôme de départ** : l'origine s'efface progressivement (opacity `(1-t) * 0.25`)
- **Halo** : léger glow bleu autour du joueur pendant le déplacement (`filter blur 6px`, opacity 0.25)
- À `t >= 1` → phase `arriving`, `playerNorm = frozenDest`

---

## Arrivée (état `arriving`)

- **Flash radial** : gradient `#3b82f6` centré sur la destination, r=0→50px sur 150ms, opacity 0.45→0
- **Glow du joueur** : halo bleu qui pulse (éclat fort puis fondu) sur 300ms
- **Durée totale** : 400ms, puis phase → `idle` à la nouvelle position
- **Hint** : réapparaît avec un fondu de 300ms

---

## Fichiers touchés

| Fichier | Action |
|---------|--------|
| `move-test.html` | Créer (racine) |
| `src/js/court.js` | Import only (inliné, read-only) |
| Tout le reste | Intouché |

---

## Hors scope

- Pas de snap de zone dans ce test (fluidité > précision)
- Pas de scoring ni de zones correctes/incorrectes
- Pas de joueur adverse ni partenaire
- Pas de contrainte de déplacement (toute la moitié alliée est valide)
