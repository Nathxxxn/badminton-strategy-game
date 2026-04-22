# Git Architecture — Badminton Doubles Strategy Game

## Current Baseline

Etat reel apres remise a plat du 2026-04-22 :

- branches locales actives : `develop`, `main`
- branche de travail par defaut : `develop`
- point d'entree produit : `index.html`
- prototypes de reference : `move-test.html`, `shot-test.html`, `rally-test.html`

Les anciennes branches locales de prototypage ont ete nettoyees. A partir d'ici, toute nouvelle branche doit repartir de `develop` et rester jetable apres merge.

## Branch Structure

```
main                                ← Releases only
│
├── develop                         ← Main integration branch
│   │
│   ├── feature/ui-home-hub         ← Example: hub, menu, navigation
│   ├── feature/shot-evaluation     ← Example: drag + scoring integration
│   ├── feature/match-engine        ← Example: rally chaining
│   ├── feature/content-data        ← Example: JSON exercises and balancing
│   │
│   ├── fix/click-detection         ← Bug fix
│   ├── fix/drag-sensitivity        ← Bug fix
│   │
│   ├── docs/repo-baseline          ← Documentation update
│   └── style/css-cleanup           ← Visual polish
│
└── release/v1.0.0                  ← Release preparation branch
```

---

## Branch Rules

### main
- Prefer merges from `release/*` via Pull Request.
- If protections are enabled, require 1 approval + all checks passing.
- Each merge to main = a tagged version (v0.1, v0.2, v1.0...).
- Should always be deployable and playable.

### develop
- Preferred flow: merge `feature/*`, `fix/*`, etc. via Pull Request.
- Short maintenance commits directly on `develop` are acceptable when cleaning the baseline solo, but should stay exceptional.
- If protections are enabled, require 1 approval.
- Must always compile and run (no broken builds).
- This is your daily integration point.

### feature/* branches
- Created from `develop`, merged back into `develop`.
- One feature = one branch. Keep it focused.
- Name format: `feature/{short-description}` (kebab-case).
- Delete after merge. No long-lived local museum of old branches.

### fix/* branches
- Same as feature but for bug fixes.
- Created from `develop`, merged back into `develop`.

### release/* branches
- Created from `develop` when ready to ship a milestone.
- Only bug fixes allowed on release branches (no new features).
- Merged into both `main` AND back into `develop`.
- Tagged on main after merge (e.g., `v0.1.0`).

---

## Commit Conventions (Conventional Commits)

Format: `type(scope): short description`

### Types
```
feat     → New feature or functionality
fix      → Bug fix
docs     → Documentation only (README, CLAUDE.md, comments)
style    → CSS changes, formatting, no logic change
refactor → Code restructure without changing behavior
data     → Exercise/scenario data changes (JSON files)
test     → Adding or updating tests
chore    → Config, gitignore, tooling, no production code
```

### Scopes (optional but recommended)
```
court     → Court rendering (court.js)
renderer  → Player/shuttlecock rendering (renderer.js)
zones     → Zone system (zones.js)
drag      → Drag mechanic (drag.js)
anim      → Animations (animations.js)
hud       → HUD display (hud.js)
screens   → Screen management (screens.js)
exercise  → Exercise engine (exercises.js)
evaluate  → Evaluation logic (evaluate.js)
match     → Match mode (match.js)
progress  → Progression system (progression.js)
difficulty→ Difficulty scaling (difficulty.js)
boss      → Boss logic (boss.js)
css       → Stylesheets
data      → JSON data files
```

### Examples
```
feat(court): draw doubles court with all regulation lines
feat(drag): implement drag-to-shoot with power gradient
feat(evaluate): score shot exercises with zone + power + spin
fix(zones): correct zone boundary overlap at net line
data(positioning): add 10 level-2 attack positioning exercises
style(css): improve feedback panel slide-up animation
refactor(renderer): extract player drawing into separate methods
docs: update CLAUDE.md with match mode data format
chore: add .gitignore entry for .vscode folder
```

---

## Workflow — Day to Day

### Starting a new feature

```bash
# 1. Always start from a fresh develop
git switch develop
git pull origin develop

# 2. Create your feature branch
git switch -c feature/ui-home-hub

# 3. Work, commit often with clear messages
git add index.html src/js/screens.js src/css/style.css
git commit -m "feat(ui): add project hub landing screen"

git add src/js/main.js src/js/mock-data.js
git commit -m "feat(match): wire workshop flow to updated hub"

git add README.md
git commit -m "docs: document local run flow"

# 4. Push your branch
git push -u origin feature/ui-home-hub

# 5. Open a Pull Request on GitHub: feature/ui-home-hub → develop
# Title: "feat(ui): add project hub landing screen"
# Description: what you did, screenshots if visual
```

### Reviewing a Pull Request

```
1. Read the PR description and diff
2. Pull the branch locally if needed:
   git fetch origin
   git switch feature/shot-evaluation
3. Test it runs without breaking
4. Leave comments or approve
5. Squash merge on GitHub (keeps develop history clean)
```

### After PR is merged

```bash
# Clean up
git switch develop
git pull origin develop
git branch -d feature/ui-home-hub
git push origin --delete feature/ui-home-hub
```

### Handling conflicts

```bash
# On your feature branch, pull latest develop
git switch feature/your-feature
git fetch origin
git merge origin/develop

# If conflicts appear:
# 1. Open conflicted files, resolve manually
# 2. Stage resolved files
git add .
git commit -m "merge: resolve conflicts with develop"
git push
```

### Making a release

```bash
# 1. Create release branch from develop
git switch develop
git pull origin develop
git switch -c release/v0.1.0

# 2. Only fix bugs here, no new features
git commit -m "fix(hud): correct XP bar overflow at level 10"

# 3. Merge into main
# → Pull Request: release/v0.1.0 → main
# After merge:
git switch main
git pull origin main
git tag -a v0.1.0 -m "v0.1.0 — Core exercises + court rendering"
git push origin v0.1.0

# 4. Merge back into develop
git switch develop
git merge main
git push origin develop

# 5. Clean up
git branch -d release/v0.1.0
git push origin --delete release/v0.1.0
```

---

## GitHub Settings

### Branch Protection (Settings → Branches → Add rule)

**Rule for `main`:**
- ✅ Require a pull request before merging
- ✅ Require approvals: 1
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Do not allow bypassing the above settings

**Rule for `develop`:**
- ✅ Require a pull request before merging
- ✅ Require approvals: 1

### Merge Strategy
- Use **Squash and merge** for feature/fix → develop (cleaner history)
- Use **Create a merge commit** for release → main (preserve context)

### Local Hygiene
- Keep only `develop` and `main` locally unless a branch is actively in use.
- Remove stale worktrees once a branch is merged or abandoned.
- Ignore local assistant/tooling artifacts in `.gitignore` instead of committing them.

---

## Milestones (suggested)

### v0.1.0 — Foundation
- Court rendering with all lines
- Player + shuttlecock display
- Basic click detection on zones
- 5 positioning exercises (Level 1 attack)
- Simple feedback (correct/wrong + explanation)

### v0.2.0 — Shot Mechanic
- Drag-to-shoot implementation
- Power + spin visual indicators
- Shot evaluation (zone + power + spin scoring)
- 5 shot exercises (Level 1 attack)
- HUD with score display

### v0.3.0 — Progression
- XP system + level-up
- Combo multiplier
- Star rating per exercise set
- Difficulty 1-2 for both workshops
- 20+ total exercises

### v0.4.0 — Match Mode
- Rally chaining engine
- Match UI with turn counter
- 3 match sequences
- Time pressure (optional)

### v1.0.0 — Full Game
- All 4 difficulty tiers for attack + defense
- Boss encounters
- Stat allocation (precision/power)
- Rewards and badges
- Responsive + mobile touch support
- Polish: animations, transitions, sounds

---

## File Ownership (who typically edits what)

```
Developer A (Rendering)         Developer B (Logic)
─────────────────────          ─────────────────────
src/js/court.js                src/js/exercises.js
src/js/renderer.js             src/js/evaluate.js
src/js/zones.js                src/js/match.js
src/js/drag.js                 src/js/progression.js
src/js/animations.js           src/js/difficulty.js
src/js/hud.js                  src/js/boss.js
src/js/screens.js              data/positioning.json
src/css/style.css              data/shots.json
index.html                     data/matches.json
assets/                        data/bosses.json
                               data/rewards.json

Shared (discuss before editing):
─────────────────────
src/js/main.js
CLAUDE.md
README.md
```

When you need to edit a shared file, communicate first to avoid conflicts.
