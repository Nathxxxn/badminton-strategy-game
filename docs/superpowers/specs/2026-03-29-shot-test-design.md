# Shot Test — Design Spec
**Date:** 2026-03-29
**Scope:** Standalone test loop for the drag-to-shoot mechanic (`shot-test.html`)

---

## Objectif

Fichier HTML autonome permettant de tester en boucle le feeling du tir. Lance directement sans passer par le menu. Importe uniquement `src/js/court.js`.

---

## Architecture

Fichier `shot-test.html` à la racine du projet. Un seul `<canvas>` plein écran. Tout le code est inline dans un `<script type="module">`.

### Machine à états

```
READY → DRAGGING → FLYING → LANDING → READY
```

| État | Description |
|------|-------------|
| `ready` | Volant posé à la position joueur, hint visible |
| `dragging` | Geste en cours, preview en temps réel |
| `flying` | Volant en vol sur l'arc figé |
| `landing` | Effet d'impact (~600ms) puis reset automatique |

### État central (objet mutable)

```js
{
  state: 'ready',
  dragOrigin: null,    // {x,y} canvas px — position du volant au moment du press
  dragCurrent: null,   // {x,y} canvas px — position courante du pointeur
  frozenArc: null,     // {fromNorm, toNorm, power, colour} — figé au relâché
  flightT: 0,          // 0→1 progression du vol
  flightStartMs: null,
  landingMs: null,
  shuttleNorm: {x:0.5, y:0.70}  // position normalisée courante du volant
}
```

---

## Geste de tir (swing inversé)

- **Joueur fixe** : `{ x: 0.5, y: 0.70 }` (mi-terrain bas)
- **Activation** : press dans un rayon de 40px CSS autour du volant
- **Direction du tir** = opposé du vecteur de drag : `shotDir = -normalize(drag)`
- **Puissance** = `clamp(length(drag) / 160px, 0, 1)`
- **Contrainte** : `dy > 0` en canvas requis (drag vers le bas) pour activer la preview
- **Landing depth** : smash (p=1.0) → `y≈0.08`, drop (p=0.3) → `y≈0.42`
- **Landing lateral** : `landX = shuttleX - (dragDx / dragDy) * (targetY - shuttleY)` (projection de la droite)

---

## Trajectoire preview (état `dragging`)

### Arc parabolique
- Formule : `py = lerp(from.y, to.y, t) - arcH * sin(π * t)`
- Arc height fraction : `0.35 - power * 0.28` → drop=0.35, drive=0.21, smash=0.07
- Style : pointillés `[6, 5]`, épaisseur 2.2px
- Couleur selon puissance : `#4ade80` (0.0) → `#facc15` (0.5) → `#f97316` (1.0)
- Halo : même couleur, blur 3px, opacity 0.2

### Landing indicator
- Anneau pulsant : `r = 9 + 3 * sin(Date.now() / 200)`
- Croix centrale (+), même couleur, opacity 0.9
- Anneau radar externe : r*1.8, opacity 0.25, non pulsant

### Aim line (pull-back visible)
- Trait `#fb923c` du volant au pointeur, épaisseur 2.5px, lineCap round

---

## Vol du volant (état `flying`)

- L'arc preview **se fige** : épaisseur 2.5px, opacity 0.45, pointillés conservés
- Landing indicator : arrête de pulser, devient fixe
- **Position du volant** : `easeInOut(t)` sur l'arc parabolique
- **Durée** : smash=320ms, drive=550ms, drop=850ms (interpolé depuis puissance)
- **Traînée** : 5 cercles fantômes `#fbbf24`, taille et opacity décroissantes
- **Fondu arc** : opacity arc de 0.45 → 0.15 au fil du vol

---

## Impact (état `landing`)

**Flash radial** : overlay blanc centré sur landing, opacity 0.35 → 0 sur 80ms.

**3 anneaux concentriques** (couleur = couleur de l'arc du tir) :

| Anneau | r départ | r arrivée | Durée | Délai | Opacity |
|--------|----------|-----------|-------|-------|---------|
| 1 | 8px | 20px | 400ms | 0ms | 1.0→0 |
| 2 | 8px | 32px | 500ms | 50ms | 0.6→0 |
| 3 | 8px | 48px | 600ms | 100ms | 0.3→0 |

**Reset** à la fin du dernier anneau :
- Volant revient instantanément à `{ x:0.5, y:0.70 }`
- Arc et indicators effacés
- Hint réapparaît
- État → `ready`

---

## Fichiers touchés

| Fichier | Action |
|---------|--------|
| `shot-test.html` | Créer (racine) |
| `src/js/court.js` | Import only (read-only) |
| Tout le reste | Intouché |

---

## Hors scope

- Pas de snap grid dans ce test (fluidité > précision pour valider le feeling)
- Pas de scoring, pas de zones correctes/incorrectes
- Pas de joueur adverse
- Pas d'animation de retour du volant
