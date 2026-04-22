# Restart Baseline

Etat du depot apres nettoyage du 2026-04-22.

## Source of Truth

- `develop` est la branche d'integration locale actuelle.
- `develop` est en avance de 10 commits sur `origin/develop`.
- seules branches locales restantes : `develop`, `main`
- `index.html` est maintenant le hub principal.
- `move-test.html`, `shot-test.html` et `rally-test.html` restent des labos standalone utiles pour valider rapidement une mecanique.

## Audit Des Branches

| Branche | Statut observe le 2026-04-22 | Action recommandee |
| --- | --- | --- |
| `feature/animations` | supprimee localement | deja absorbee par `develop` |
| `feature/drag-mechanic` | supprimee localement | deja absorbee par `develop` |
| `feature/test-rally` | supprimee localement | deja absorbee par `develop` |
| `feature/zone-highlight` | supprimee localement | deja absorbee par `develop` |
| `nathan/suspicious-proskuriakova` | worktree et branche locale supprimes | commit deja absorbe |
| `feature/court-rendering` | supprimee localement | branche trop ancienne pour etre mergee utilement |
| `feature/player-renderer` | supprimee localement | branche trop ancienne pour etre mergee utilement |

Le depot local ne garde plus de branches legacy actives. La baseline repart de `develop`.

## Artefacts Locaux

Les elements suivants etaient presents localement et n'ont pas vocation a polluer `git status` :

- `.agents/`
- `skills-lock.json`

Ils sont maintenant ignores par `.gitignore`.

## Nettoyage Execute

Actions deja effectuees :

```bash
git checkout develop
git fetch --prune origin
git branch -d feature/animations feature/drag-mechanic feature/test-rally feature/zone-highlight
git worktree remove .claude/worktrees/suspicious-proskuriakova
git branch -d nathan/suspicious-proskuriakova
git branch -D feature/court-rendering feature/player-renderer
```

## Regle Simple Pour La Suite

- tout nouveau dev part de `develop`
- `index.html` reste le hub principal
- les fichiers `*-test.html` servent de labs de reference tant qu'une mecanique n'est pas proprement portee dans `src/js/*`
