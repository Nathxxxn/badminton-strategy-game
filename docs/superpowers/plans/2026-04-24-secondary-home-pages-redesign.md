# Secondary Home Pages Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reproduce the Drills, Leaderboard, and Settings pages from `design-inspiration/Home Screen.html` inside the current vanilla Rally home overlay.

**Architecture:** Continue the existing `ScreenManager` approach from `feature/home-screen-redesign`: the home overlay remains vanilla DOM templates plus CSS classes, and gameplay starts only through existing `workshop:select` events for `attack` and `defense`. Add data arrays and render helpers for the three secondary pages, then replace the current simple `info-grid` sections with the full inspired layouts.

**Tech Stack:** Vanilla HTML/CSS/JavaScript ES modules, current `ScreenManager`, existing static server via `python3 -m http.server`, Chrome headless/CDP for smoke verification.

---

## File Structure

- Modify `src/js/screens.js`: add Drills, Leaderboard, and Settings data; add template helpers; replace the current Drills/Leaderboard/Settings sections; wire filter tabs, period tabs, avatar swatches, and safe page-only controls.
- Modify `src/css/style.css`: add page-specific styles for the Drills featured banner and cards, Leaderboard podium/table, and Settings profile/account/keybind panels; extend responsive behavior.
- Do not modify `src/js/main.js`, `src/js/hud.js`, `src/js/court.js`, `src/js/renderer.js`, `src/js/drag.js`, `src/js/animations.js`, or gameplay data.
- Do not add React, Babel, JSX, package files, or runtime dependencies.
- Keep `design-inspiration/Home Screen.html` as read-only reference material.

## Behavioral Boundaries

- The Home page already matches the desired direction and should remain visually stable except shared CSS needed by the new pages.
- Drills page should match the inspiration: category filter buttons, green daily featured drill banner, grid of drill cards, locked cards, best score/new states.
- Leaderboard page should match the inspiration: weekly/all-time buttons, top-three podium, standings table, highlighted player row, season note.
- Settings page should match the inspiration: profile card with avatar color swatches, display name input, country select, account card, controls/keybind grid.
- Clicking available Attack or Defense drill cards may start the existing corresponding workshop. Strategy-only drill cards must not create a new in-game interface.
- Once `screens.show('exercise')` runs, the current ingame HUD/canvas experience remains unchanged.

---

### Task 1: Add Secondary Page Data

**Files:**
- Modify: `src/js/screens.js`

- [ ] **Step 1: Add leaderboard and drill data after `MODES`**

Insert this code after the `MODES` constant:

```js
const DRILLS_LIST = Object.freeze([
  { id: 'd1', title: 'Cross-court smash', category: 'Attack', difficulty: 2, duration: '8 min', xp: 80, best: 82, attempts: 14, locked: false, color: '#e85d3c', workshop: 'attack' },
  { id: 'd2', title: 'Drop shot deception', category: 'Attack', difficulty: 3, duration: '10 min', xp: 100, best: 68, attempts: 9, locked: false, color: '#e85d3c', workshop: 'attack' },
  { id: 'd3', title: 'Straight net kill', category: 'Attack', difficulty: 2, duration: '6 min', xp: 60, best: 91, attempts: 22, locked: false, color: '#e85d3c', workshop: 'attack' },
  { id: 'd4', title: 'Jumping smash power', category: 'Attack', difficulty: 4, duration: '12 min', xp: 140, best: null, attempts: 0, locked: true, color: '#e85d3c', workshop: 'attack' },
  { id: 'd5', title: 'Baseline clear defense', category: 'Defense', difficulty: 2, duration: '8 min', xp: 80, best: 74, attempts: 12, locked: false, color: '#1f8a4c', workshop: 'defense' },
  { id: 'd6', title: 'Smash block timing', category: 'Defense', difficulty: 3, duration: '10 min', xp: 100, best: 65, attempts: 7, locked: false, color: '#1f8a4c', workshop: 'defense' },
  { id: 'd7', title: 'Counter-attack lifts', category: 'Defense', difficulty: 3, duration: '9 min', xp: 90, best: 71, attempts: 11, locked: false, color: '#1f8a4c', workshop: 'defense' },
  { id: 'd8', title: 'Deceptive block to net', category: 'Defense', difficulty: 4, duration: '11 min', xp: 130, best: null, attempts: 0, locked: true, color: '#1f8a4c', workshop: 'defense' },
  { id: 'd9', title: 'Rally pattern recognition', category: 'Strategy', difficulty: 3, duration: '15 min', xp: 150, best: 59, attempts: 5, locked: false, color: '#2e6fc5', workshop: null },
  { id: 'd10', title: 'Opponent tendency read', category: 'Strategy', difficulty: 4, duration: '18 min', xp: 180, best: null, attempts: 0, locked: true, color: '#2e6fc5', workshop: null },
]);

const LEADERBOARD = Object.freeze([
  { rank: 1, name: 'Taro Sakai', initials: 'TS', rankName: 'Diamond I', wins: 421, wr: 78, xp: 48210, country: 'JP' },
  { rank: 2, name: 'Priya Shetty', initials: 'PS', rankName: 'Diamond II', wins: 398, wr: 74, xp: 44180, country: 'IN' },
  { rank: 3, name: 'Jonas Berg', initials: 'JB', rankName: 'Diamond II', wins: 372, wr: 72, xp: 41200, country: 'SE' },
  { rank: 4, name: 'Amara Okafor', initials: 'AO', rankName: 'Diamond III', wins: 341, wr: 69, xp: 37400, country: 'NG' },
  { rank: 5, name: 'Chen Wei', initials: 'CW', rankName: 'Diamond III', wins: 324, wr: 68, xp: 35200, country: 'CN' },
  { rank: 6, name: 'Sofia Rossi', initials: 'SR', rankName: 'Platinum I', wins: 289, wr: 66, xp: 31800, country: 'IT' },
  { rank: 7, name: 'Diego Marquez', initials: 'DM', rankName: 'Platinum I', wins: 271, wr: 65, xp: 29900, country: 'MX' },
  { rank: 8, name: 'Hana Park', initials: 'HP', rankName: 'Platinum II', wins: 258, wr: 64, xp: 28100, country: 'KR' },
  { rank: 9, name: 'Leo Dubois', initials: 'LD', rankName: 'Platinum II', wins: 244, wr: 62, xp: 26500, country: 'FR' },
  { rank: 10, name: 'Aisha Khan', initials: 'AK', rankName: 'Platinum III', wins: 231, wr: 61, xp: 24700, country: 'PK' },
]);

const SETTINGS_AVATAR_COLORS = Object.freeze(['#ffd23f', '#e85d3c', '#1f8a4c', '#2e6fc5', '#0f1a14']);

const SETTINGS_KEYBINDS = Object.freeze([
  { action: 'Select Smash', key: '1' },
  { action: 'Select Drop', key: '2' },
  { action: 'Select Clear', key: '3' },
  { action: 'Select Drive', key: '4' },
  { action: 'Target Left', key: 'A / ←' },
  { action: 'Target Center', key: 'S / ↓' },
  { action: 'Target Right', key: 'D / →' },
  { action: 'Confirm Shot', key: 'Space' },
  { action: 'Pause', key: 'Esc' },
]);
```

- [ ] **Step 2: Add `country` to `PLAYER`**

Modify the `PLAYER` object so it includes:

```js
  country: 'KR',
```

Expected local shape:

```js
const PLAYER = Object.freeze({
  name: 'Alex Kim',
  initials: 'AK',
  level: 12,
  xp: 1240,
  xpMax: 2000,
  rank: 'Silver III',
  wins: 47,
  winRate: 61,
  streak: 5,
  bestStreak: 9,
  trained: '18h 22m',
  country: 'KR',
});
```

- [ ] **Step 3: Run syntax check**

Run:

```bash
node --check src/js/screens.js
```

Expected: no output and exit code 0.

- [ ] **Step 4: Commit**

```bash
git add src/js/screens.js
git commit -m "feat: add secondary page data"
```

---

### Task 2: Add Template Helpers

**Files:**
- Modify: `src/js/screens.js`

- [ ] **Step 1: Add shared markup helpers after `modeIcon()`**

Insert this code after the `modeIcon()` function:

```js
function difficultyDots(count, total = 4) {
  return Array.from({ length: total }, (_, index) => `<span class="${index < count ? 'filled' : ''}"></span>`).join('');
}

function flagBadge(code) {
  return `<span class="flag-badge">${code}</span>`;
}

function pageTitleMarkup({ eyebrow, title, right = '' }) {
  return `
    <div class="page-title-row">
      <div>
        <p class="page-eyebrow">▸ ${eyebrow}</p>
        <h1>${title}</h1>
      </div>
      ${right}
    </div>
  `;
}
```

- [ ] **Step 2: Add Drills render helpers**

Insert this code after `pageTitleMarkup()`:

```js
function drillCardMarkup(drill) {
  const playable = !drill.locked && (drill.workshop === 'attack' || drill.workshop === 'defense');
  return `
    <article class="drill-card ${drill.locked ? 'locked' : ''}" data-category="${drill.category}" data-workshop="${drill.workshop ?? ''}" data-playable="${playable ? 'true' : 'false'}" style="--drill-color:${drill.color}">
      <div class="drill-stripe"></div>
      <div class="drill-body">
        <div class="drill-card-head">
          <span class="chip drill-chip">${drill.category.toUpperCase()}</span>
          <span class="difficulty compact">${difficultyDots(drill.difficulty, 4)}</span>
        </div>
        <h3>${drill.title}</h3>
        ${drill.locked ? `
          <p class="drill-lock">LOCKED · UNLOCK AT LVL ${10 + drill.difficulty * 2}</p>
        ` : `
          <div class="drill-meta">
            <span>${drill.duration}</span>
            <span>+${drill.xp} XP</span>
          </div>
          ${drill.best !== null ? `
            <div class="best-score"><span>BEST SCORE</span><strong>${drill.best}%</strong></div>
          ` : `
            <p class="new-drill">▸ NEW · Never attempted</p>
          `}
        `}
      </div>
    </article>
  `;
}

function renderDrillsPage() {
  const categories = ['All', 'Attack', 'Defense', 'Strategy'];
  return `
    ${pageTitleMarkup({
      eyebrow: 'TRAINING LIBRARY',
      title: 'Drills',
      right: `
        <div class="filter-tabs" role="tablist" aria-label="Training categories">
          ${categories.map(category => `<button class="btn filter-tab ${category === 'All' ? 'active' : ''}" type="button" data-drill-filter="${category}">${category}</button>`).join('')}
        </div>
      `,
    })}
    <div class="daily-drill">
      <div class="daily-shuttle" aria-hidden="true">${SVG_SHUTTLE}</div>
      <div class="daily-copy">
        <span class="chip daily-chip">DAILY FEATURED · 2× XP</span>
        <h2>Opponent tendency read</h2>
        <p>Study three AI opponents' rally patterns and predict their next shot. Sharpens your in-match reads.</p>
        <div class="daily-meta">
          <span>18 min</span>
          <span>+360 XP</span>
          <span>Strategy</span>
        </div>
      </div>
      <button class="btn primary daily-start" type="button" disabled>Start daily ▸</button>
    </div>
    <div class="drill-grid">
      ${DRILLS_LIST.map(drillCardMarkup).join('')}
    </div>
  `;
}
```

- [ ] **Step 3: Add Leaderboard render helper**

Insert this code after `renderDrillsPage()`:

```js
function renderLeaderboardPage() {
  const top3 = LEADERBOARD.slice(0, 3);
  const podiumOrder = [top3[1], top3[0], top3[2]];
  const rest = LEADERBOARD.slice(3);
  const playerRow = { rank: 287, name: PLAYER.name, initials: PLAYER.initials, rankName: PLAYER.rank, wins: PLAYER.wins, wr: PLAYER.winRate, xp: PLAYER.xp + 8420, country: PLAYER.country };

  return `
    ${pageTitleMarkup({
      eyebrow: 'GLOBAL STANDINGS',
      title: 'Leaderboard',
      right: `
        <div class="period-tabs" role="tablist" aria-label="Leaderboard period">
          <button class="btn period-tab active" type="button" data-period="weekly">weekly</button>
          <button class="btn period-tab" type="button" data-period="all-time">all-time</button>
        </div>
      `,
    })}
    <div class="podium-grid">
      ${podiumOrder.map((player, index) => {
        const place = index === 1 ? 1 : (index === 0 ? 2 : 3);
        return `
          <article class="podium-player place-${place}">
            <div class="podium-medal">${place === 1 ? '1' : place === 2 ? '2' : '3'}</div>
            <div class="podium-block">
              <span class="podium-place">${place}</span>
              <span class="podium-avatar">${player.initials}</span>
              <strong>${player.name}</strong>
              <span class="podium-rank">${flagBadge(player.country)} ${player.rankName.toUpperCase()}</span>
              <span class="podium-stats"><b>${player.wins} W</b><b>${player.wr}%</b></span>
            </div>
          </article>
        `;
      }).join('')}
    </div>
    <div class="standings-wrap card">
      <div class="standings-row standings-head">
        <span>RANK</span><span>PLAYER</span><span>TIER</span><span>WINS</span><span>WR</span><span>XP</span>
      </div>
      ${rest.map(player => `
        <div class="standings-row">
          <span class="rank-cell">#${player.rank}</span>
          <span class="player-cell"><b>${player.initials}</b><span><strong>${player.name}</strong>${flagBadge(player.country)}</span></span>
          <span>${player.rankName.toUpperCase()}</span>
          <span>${player.wins}</span>
          <span>${player.wr}%</span>
          <span>${player.xp.toLocaleString()}</span>
        </div>
      `).join('')}
      <div class="standings-row player-standing">
        <span class="rank-cell">#${playerRow.rank}</span>
        <span class="player-cell"><b>${playerRow.initials}</b><span><strong>${playerRow.name} <em>YOU</em></strong>${flagBadge(playerRow.country)}</span></span>
        <span>${playerRow.rankName.toUpperCase()}</span>
        <span>${playerRow.wins}</span>
        <span>${playerRow.wr}%</span>
        <span>${playerRow.xp.toLocaleString()}</span>
      </div>
    </div>
    <p class="season-note">WIN 4 MORE MATCHES TO BREAK TOP 200 · SEASON ENDS IN 12 DAYS</p>
  `;
}
```

- [ ] **Step 4: Add Settings render helper**

Insert this code after `renderLeaderboardPage()`:

```js
function renderSettingsPage() {
  return `
    ${pageTitleMarkup({ eyebrow: 'YOUR PREFERENCES', title: 'Settings' })}
    <div class="settings-grid">
      <section class="settings-card card profile-card">
        <div class="settings-card-head"><span class="settings-accent green"></span><h2>Profile</h2></div>
        <div class="profile-layout">
          <div class="avatar-editor">
            <div class="settings-avatar" style="--avatar-color:${SETTINGS_AVATAR_COLORS[0]}">${PLAYER.initials}</div>
            <div class="avatar-swatches" aria-label="Avatar colors">
              ${SETTINGS_AVATAR_COLORS.map((color, index) => `<button class="avatar-swatch ${index === 0 ? 'active' : ''}" type="button" data-avatar-color="${color}" style="--swatch-color:${color}" aria-label="Avatar color ${index + 1}"></button>`).join('')}
            </div>
          </div>
          <div class="profile-fields">
            <label>DISPLAY NAME<input class="settings-input" value="${PLAYER.name}" type="text"></label>
            <label>COUNTRY<select class="settings-input"><option>Korea</option><option>Japan</option><option>China</option><option>India</option><option>Indonesia</option><option>Denmark</option><option>United States</option></select></label>
            <button class="btn primary save-profile" type="button">Save profile</button>
          </div>
        </div>
      </section>
      <section class="settings-card card account-card">
        <div class="settings-card-head"><span class="settings-accent blue"></span><h2>Account</h2></div>
        <div class="account-list">
          <div><span>EMAIL</span><strong>alex.kim@rally.game</strong></div>
          <div><span>JOINED</span><strong>Feb 14, 2026</strong></div>
          <div><span>PLAYER ID</span><strong>RLY-8F3A-29K</strong></div>
        </div>
        <div class="account-actions">
          <button class="btn" type="button">Change password</button>
          <button class="btn danger" type="button">Sign out</button>
        </div>
      </section>
      <section class="settings-card card keybind-card">
        <div class="settings-card-head"><span class="settings-accent red"></span><h2>Controls & keybinds</h2></div>
        <div class="keybind-grid">
          ${SETTINGS_KEYBINDS.map(binding => `<div class="keybind-row"><span>${binding.action}</span><kbd>${binding.key}</kbd></div>`).join('')}
        </div>
        <button class="btn reset-controls" type="button">Reset to defaults</button>
      </section>
    </div>
  `;
}
```

- [ ] **Step 5: Run syntax check**

Run:

```bash
node --check src/js/screens.js
```

Expected: no output and exit code 0.

- [ ] **Step 6: Commit**

```bash
git add src/js/screens.js
git commit -m "refactor: add secondary page templates"
```

---

### Task 3: Replace Current Secondary Sections And Wire Interactions

**Files:**
- Modify: `src/js/screens.js`

- [ ] **Step 1: Replace current Drills section**

Inside the main menu template, replace:

```js
          <section class="rally-page" data-panel="drills">
            <div class="page-title-row"><div><p class="page-eyebrow">▸ TRAINING LIBRARY</p><h1>Drills</h1></div></div>
            <div class="info-grid">
              <article class="card"><h2>Attack drills</h2><p>Smash placement, deception and net kill routines start from Attack Training.</p></article>
              <article class="card"><h2>Defense drills</h2><p>Blocks, lifts and recovery routines start from Defense Training.</p></article>
            </div>
          </section>
```

with:

```js
          <section class="rally-page" data-panel="drills">
            ${renderDrillsPage()}
          </section>
```

- [ ] **Step 2: Replace current Leaderboard section**

Replace:

```js
          <section class="rally-page" data-panel="leaderboard">
            <div class="page-title-row"><div><p class="page-eyebrow">▸ GLOBAL STANDINGS</p><h1>Leaderboard</h1></div></div>
            <div class="leaderboard-card card"><strong>#287</strong><span>${PLAYER.name}</span><span>${PLAYER.rank}</span><span>${PLAYER.wins} W</span><span>${PLAYER.winRate}% WR</span></div>
          </section>
```

with:

```js
          <section class="rally-page" data-panel="leaderboard">
            ${renderLeaderboardPage()}
          </section>
```

- [ ] **Step 3: Replace current Settings section**

Replace:

```js
          <section class="rally-page" data-panel="settings">
            <div class="page-title-row"><div><p class="page-eyebrow">▸ YOUR PREFERENCES</p><h1>Settings</h1></div></div>
            <div class="info-grid">
              <article class="card"><h2>Profile</h2><p>Display name, country and avatar controls are presentation-only on this prototype screen.</p></article>
              <article class="card"><h2>Controls</h2><p>The current in-game controls remain handled by the existing canvas runtime.</p></article>
            </div>
          </section>
```

with:

```js
          <section class="rally-page" data-panel="settings">
            ${renderSettingsPage()}
          </section>
```

- [ ] **Step 4: Add page interaction wiring after mode start listeners**

After the existing `menu.querySelectorAll('.mode-start').forEach(...)` block, add:

```js
    menu.querySelectorAll('.filter-tab').forEach(button => {
      button.addEventListener('click', () => {
        const filter = button.dataset.drillFilter;
        menu.querySelectorAll('.filter-tab').forEach(tab => tab.classList.toggle('active', tab === button));
        menu.querySelectorAll('.drill-card').forEach(card => {
          card.hidden = filter !== 'All' && card.dataset.category !== filter;
        });
      });
    });

    menu.querySelectorAll('.drill-card').forEach(card => {
      card.addEventListener('click', () => {
        if (card.dataset.playable !== 'true') return;
        const workshop = card.dataset.workshop;
        if (workshop === 'attack' || workshop === 'defense') {
          this._emit('workshop:select', { workshop });
        }
      });
    });

    menu.querySelectorAll('.period-tab').forEach(button => {
      button.addEventListener('click', () => {
        menu.querySelectorAll('.period-tab').forEach(tab => tab.classList.toggle('active', tab === button));
      });
    });

    menu.querySelectorAll('.avatar-swatch').forEach(button => {
      button.addEventListener('click', () => {
        const avatar = menu.querySelector('.settings-avatar');
        if (avatar) avatar.style.setProperty('--avatar-color', button.dataset.avatarColor);
        menu.querySelectorAll('.avatar-swatch').forEach(swatch => swatch.classList.toggle('active', swatch === button));
      });
    });
```

- [ ] **Step 5: Run syntax check**

Run:

```bash
node --check src/js/screens.js
```

Expected: no output and exit code 0.

- [ ] **Step 6: Commit**

```bash
git add src/js/screens.js
git commit -m "feat: render inspired secondary pages"
```

---

### Task 4: Add Drills Page CSS

**Files:**
- Modify: `src/css/style.css`

- [ ] **Step 1: Replace the old `info-grid` block**

Find and remove this block:

```css
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  padding: 0 36px 40px;
}

.info-grid .card {
  padding: 24px;
}

.info-grid h2 {
  font-size: 24px;
}

.info-grid p {
  margin-top: 10px;
  color: var(--rally-ink-soft);
  line-height: 1.55;
}
```

- [ ] **Step 2: Insert Drills styles before `.leaderboard-card`**

Add:

```css
.filter-tabs,
.period-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-tab,
.period-tab {
  min-height: 38px;
  padding: 8px 14px;
  font-size: 13px;
}

.filter-tab.active,
.period-tab.active {
  background: var(--rally-ink);
  color: var(--rally-feather);
}

.daily-drill {
  margin: 0 36px 20px;
  padding: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  position: relative;
  overflow: hidden;
  border: 4px solid var(--rally-ink);
  border-radius: 20px;
  background: linear-gradient(135deg, #1f8a4c 0%, #0d4424 100%);
  color: var(--rally-feather);
  box-shadow: 8px 8px 0 0 var(--rally-ink);
}

.daily-shuttle {
  position: absolute;
  right: -20px;
  top: -20px;
  width: 200px;
  height: 200px;
  opacity: 0.15;
}

.daily-copy {
  position: relative;
  max-width: 560px;
}

.daily-chip {
  margin-bottom: 10px;
  background: var(--rally-accent);
  color: var(--rally-ink);
}

.daily-drill h2 {
  font-size: 36px;
  font-weight: 800;
  line-height: 1.05;
}

.daily-drill p {
  margin-top: 8px;
  line-height: 1.5;
  opacity: 0.9;
}

.daily-meta {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 14px;
  font: 700 11px/1 var(--font-rally-mono);
  opacity: 0.82;
}

.daily-start {
  position: relative;
  white-space: nowrap;
}

.drill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  padding: 0 36px 40px;
}

.drill-card {
  overflow: hidden;
  border: 3px solid var(--rally-ink);
  border-radius: 16px;
  background: var(--rally-cream);
  box-shadow: 5px 5px 0 0 var(--rally-ink);
  cursor: pointer;
  transition: transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease;
}

.drill-card:hover {
  transform: translate(-3px, -3px);
  box-shadow: 8px 8px 0 0 var(--rally-ink);
}

.drill-card.locked,
.drill-card[data-playable="false"] {
  cursor: default;
}

.drill-card.locked {
  opacity: 0.55;
}

.drill-card.locked:hover,
.drill-card[data-playable="false"]:hover {
  transform: none;
  box-shadow: 5px 5px 0 0 var(--rally-ink);
}

.drill-stripe {
  height: 8px;
  background: var(--drill-color);
  border-bottom: 3px solid var(--rally-ink);
}

.drill-body {
  padding: 16px 18px 18px;
}

.drill-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.drill-chip {
  background: var(--drill-color);
}

.difficulty.compact span {
  width: 8px;
  height: 8px;
  border-width: 1.5px;
  border-radius: 2px;
}

.drill-card h3 {
  margin-bottom: 12px;
  font-size: 20px;
  font-weight: 800;
  line-height: 1.15;
}

.drill-meta {
  display: flex;
  gap: 14px;
  margin-bottom: 10px;
  color: var(--rally-ink-soft);
  font: 700 12px/1 var(--font-rally-mono);
}

.best-score {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border: 2px solid var(--rally-ink);
  border-radius: 8px;
  background: var(--rally-cream-2);
}

.best-score span {
  font: 700 10px/1 var(--font-rally-mono);
  letter-spacing: 1px;
}

.best-score strong {
  font-size: 14px;
  font-weight: 800;
}

.new-drill,
.drill-lock {
  color: var(--drill-color);
  font: 700 12px/1.2 var(--font-rally-mono);
}

.drill-lock {
  color: var(--rally-ink-soft);
}
```

- [ ] **Step 3: Run selector smoke check**

Run:

```bash
rg -n "daily-drill|drill-card|filter-tab|drill-grid" src/css/style.css
```

Expected: all four selector names appear.

- [ ] **Step 4: Commit**

```bash
git add src/css/style.css
git commit -m "style: add inspired drills page"
```

---

### Task 5: Add Leaderboard Page CSS

**Files:**
- Modify: `src/css/style.css`

- [ ] **Step 1: Replace the old `.leaderboard-card` block**

Find and remove:

```css
.leaderboard-card {
  margin: 0 36px 40px;
  padding: 18px 20px;
  display: grid;
  grid-template-columns: 80px 1fr 140px 80px 100px;
  gap: 12px;
  align-items: center;
  font-weight: 700;
}
```

- [ ] **Step 2: Insert Leaderboard styles before `#screen-workshop`**

Add:

```css
.flag-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--rally-ink);
  color: var(--rally-feather);
  font: 700 9px/1 var(--font-rally-mono);
}

.podium-grid {
  display: grid;
  grid-template-columns: 1fr 1.15fr 1fr;
  align-items: end;
  gap: 14px;
  padding: 0 36px 24px;
}

.podium-player {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.podium-medal {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  margin-bottom: 6px;
  border: 3px solid var(--rally-ink);
  border-radius: 50%;
  background: var(--rally-feather);
  font-size: 26px;
  font-weight: 800;
  box-shadow: 4px 4px 0 0 var(--rally-ink);
}

.podium-block {
  width: 100%;
  min-height: 180px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  padding: 18px 16px;
  border: 4px solid var(--rally-ink);
  border-radius: 18px 18px 0 0;
  box-shadow: 6px 6px 0 0 var(--rally-ink);
}

.place-1 .podium-block {
  min-height: 240px;
  background: var(--rally-accent);
}

.place-2 .podium-block {
  min-height: 200px;
  background: #d4d4d4;
}

.place-3 .podium-block {
  min-height: 180px;
  background: #cd7f32;
}

.podium-place {
  position: absolute;
  top: 10px;
  right: 12px;
  color: var(--rally-ink);
  font-size: 60px;
  font-weight: 800;
  line-height: 0.9;
  opacity: 0.2;
}

.podium-avatar {
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  border: 3px solid var(--rally-ink);
  border-radius: 14px;
  background: var(--rally-ink);
  color: var(--rally-feather);
  font-size: 22px;
  font-weight: 800;
}

.podium-block strong {
  font-size: 18px;
  line-height: 1.1;
}

.podium-rank {
  display: flex;
  align-items: center;
  gap: 6px;
  font: 700 10px/1 var(--font-rally-mono);
}

.podium-stats {
  margin-top: auto;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.standings-wrap {
  margin: 0 36px 20px;
  overflow: hidden;
}

.standings-row {
  display: grid;
  grid-template-columns: 80px 1fr 140px 80px 80px 120px;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 2px dashed var(--rally-cream-2);
  font-size: 14px;
}

.standings-row > span:nth-child(n+4) {
  text-align: right;
  font-weight: 700;
}

.standings-head {
  padding: 14px 20px;
  border-bottom: 3px solid var(--rally-ink);
  background: var(--rally-ink);
  color: var(--rally-feather);
  font: 700 11px/1 var(--font-rally-mono);
  letter-spacing: 1.5px;
}

.rank-cell {
  font-size: 16px;
  font-weight: 800;
}

.player-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.player-cell > b {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--rally-ink);
  color: var(--rally-feather);
  font-size: 13px;
}

.player-cell span {
  display: grid;
  gap: 4px;
}

.player-standing {
  border-top: 3px solid var(--rally-ink);
  border-bottom: 0;
  background: var(--rally-accent);
}

.player-standing .player-cell > b {
  color: var(--rally-accent);
}

.player-standing em {
  margin-left: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--rally-ink);
  color: var(--rally-accent);
  font: 700 10px/1 var(--font-rally-mono);
  font-style: normal;
}

.season-note {
  margin: 14px 36px 24px;
  color: var(--rally-ink-soft);
  text-align: center;
  font: 700 11px/1.4 var(--font-rally-mono);
}
```

- [ ] **Step 3: Run selector smoke check**

Run:

```bash
rg -n "podium-grid|standings-row|player-standing|period-tab|season-note" src/css/style.css
```

Expected: all five selector names appear.

- [ ] **Step 4: Commit**

```bash
git add src/css/style.css
git commit -m "style: add inspired leaderboard page"
```

---

### Task 6: Add Settings Page CSS

**Files:**
- Modify: `src/css/style.css`

- [ ] **Step 1: Insert Settings styles before `#screen-workshop`**

Add:

```css
.settings-grid {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 20px;
  padding: 0 36px 40px;
}

.settings-card {
  padding: 28px;
}

.settings-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}

.settings-accent {
  width: 8px;
  height: 28px;
  border-radius: 2px;
}

.settings-accent.green { background: var(--rally-court); }
.settings-accent.blue { background: #2e6fc5; }
.settings-accent.red { background: var(--rally-danger); }

.settings-card h2 {
  font-size: 26px;
  font-weight: 800;
}

.profile-layout {
  display: flex;
  align-items: flex-start;
  gap: 24px;
}

.avatar-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.settings-avatar {
  width: 120px;
  height: 120px;
  display: grid;
  place-items: center;
  border: 3px solid var(--rally-ink);
  border-radius: 20px;
  background: var(--avatar-color);
  color: var(--rally-ink);
  box-shadow: 4px 4px 0 0 var(--rally-ink);
  font-size: 42px;
  font-weight: 800;
}

.avatar-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  width: 120px;
}

.avatar-swatch {
  width: 22px;
  height: 22px;
  border: 2px solid var(--rally-ink);
  border-radius: 5px;
  background: var(--swatch-color);
  cursor: pointer;
}

.avatar-swatch.active {
  outline: 2px solid var(--rally-accent);
  outline-offset: 2px;
}

.profile-fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.profile-fields label {
  display: grid;
  gap: 6px;
  font: 700 11px/1 var(--font-rally-mono);
  letter-spacing: 1.5px;
}

.settings-input {
  width: 100%;
  padding: 10px 12px;
  border: 3px solid var(--rally-ink);
  border-radius: 10px;
  background: var(--rally-feather);
  color: var(--rally-ink);
  font: 600 16px/1.2 var(--font-rally);
}

.save-profile {
  align-self: flex-start;
  margin-top: 4px;
}

.account-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.account-list div {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px;
  border: 2px solid var(--rally-ink);
  border-radius: 10px;
  background: var(--rally-cream-2);
}

.account-list span {
  font: 700 12px/1 var(--font-rally-mono);
  letter-spacing: 1px;
}

.account-list strong {
  text-align: right;
  font-weight: 700;
}

.account-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.account-actions .btn {
  flex: 1;
}

.btn.danger {
  background: var(--rally-danger);
  color: var(--rally-feather);
}

.keybind-card {
  grid-column: 1 / -1;
}

.keybind-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.keybind-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 2px solid var(--rally-ink);
  border-radius: 10px;
  background: var(--rally-cream-2);
}

.keybind-row span {
  font-size: 14px;
  font-weight: 700;
}

.keybind-row kbd {
  padding: 4px 10px;
  border: 2px solid var(--rally-ink);
  border-radius: 6px;
  background: var(--rally-ink);
  color: var(--rally-feather);
  box-shadow: 2px 2px 0 0 var(--rally-accent);
  font: 700 12px/1 var(--font-rally-mono);
}

.reset-controls {
  margin-top: 18px;
}
```

- [ ] **Step 2: Run selector smoke check**

Run:

```bash
rg -n "settings-grid|avatar-swatch|account-list|keybind-grid|btn\\.danger" src/css/style.css
```

Expected: all five selector names appear.

- [ ] **Step 3: Commit**

```bash
git add src/css/style.css
git commit -m "style: add inspired settings page"
```

---

### Task 7: Responsive CSS For Secondary Pages

**Files:**
- Modify: `src/css/style.css`

- [ ] **Step 1: Extend the existing `@media (max-width: 900px)` block**

Inside the existing `@media (max-width: 900px)` block, add these rules before the closing brace:

```css
  .daily-drill { margin: 0 18px 20px; flex-direction: column; align-items: flex-start; }
  .daily-start { width: 100%; }
  .drill-grid { padding: 0 18px 32px; }
  .podium-grid { grid-template-columns: 1fr; padding: 0 18px 24px; }
  .podium-player { align-items: stretch; }
  .podium-block,
  .place-1 .podium-block,
  .place-2 .podium-block,
  .place-3 .podium-block { min-height: 0; }
  .standings-wrap { margin: 0 18px 20px; overflow-x: auto; }
  .standings-row { min-width: 760px; }
  .season-note { margin-left: 18px; margin-right: 18px; }
  .settings-grid { grid-template-columns: 1fr; padding: 0 18px 32px; }
  .keybind-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
```

- [ ] **Step 2: Extend the existing `@media (max-width: 560px)` block**

Inside the existing `@media (max-width: 560px)` block, add these rules before the closing brace:

```css
  .filter-tabs,
  .period-tabs { width: 100%; }
  .filter-tab,
  .period-tab { flex: 1; }
  .daily-drill h2 { font-size: 28px; }
  .drill-grid { grid-template-columns: 1fr; }
  .profile-layout { flex-direction: column; }
  .account-list div { flex-direction: column; }
  .account-list strong { text-align: left; }
  .account-actions { flex-direction: column; }
  .keybind-grid { grid-template-columns: 1fr; }
```

- [ ] **Step 3: Run responsive selector check**

Run:

```bash
rg -n "@media \\(max-width: 900px\\)|@media \\(max-width: 560px\\)|daily-drill|keybind-grid|standings-row" src/css/style.css
```

Expected: both media blocks and all listed responsive selectors appear.

- [ ] **Step 4: Commit**

```bash
git add src/css/style.css
git commit -m "style: make secondary pages responsive"
```

---

### Task 8: End-To-End Verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Run static syntax verification**

Run:

```bash
node --check src/js/screens.js
```

Expected: no output and exit code 0.

- [ ] **Step 2: Start or reuse a static server**

Run:

```bash
python3 -m http.server 4174
```

Expected: server logs `Serving HTTP on :: port 4174`. If port 4174 is already used by this worktree server, reuse `http://localhost:4174`.

- [ ] **Step 3: Verify required assets over HTTP**

Run:

```bash
python3 - <<'PY'
from urllib.request import urlopen
for path in ['/', '/src/js/main.js', '/src/js/screens.js', '/src/css/style.css']:
    with urlopen('http://localhost:4174' + path, timeout=3) as r:
        print(path, r.status, r.headers.get('content-type'))
PY
```

Expected:

```text
/ 200 text/html
/src/js/main.js 200 text/javascript
/src/js/screens.js 200 text/javascript
/src/css/style.css 200 text/css
```

- [ ] **Step 4: Verify DOM behavior with Chrome CDP**

Run this from the worktree while a Chrome instance is available:

```bash
node - <<'NODE'
const http = require('node:http');
const getJson = url => new Promise((resolve, reject) => {
  http.get(url, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => resolve(JSON.parse(data)));
  }).on('error', reject);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const send = (ws, method, params = {}) => new Promise((resolve, reject) => {
  const id = ++send.id;
  const onMessage = event => {
    const msg = JSON.parse(event.data);
    if (msg.id === id) {
      ws.removeEventListener('message', onMessage);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  };
  ws.addEventListener('message', onMessage);
  ws.send(JSON.stringify({ id, method, params }));
});
send.id = 0;
(async () => {
  const tabs = await getJson('http://127.0.0.1:9223/json');
  const tab = tabs.find(t => t.url.includes('localhost:4174')) || tabs[0];
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  await send(ws, 'Runtime.enable');
  await send(ws, 'Page.enable');
  await send(ws, 'Page.navigate', { url: 'http://localhost:4174/' });
  await sleep(1200);
  const result = await send(ws, 'Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      document.querySelector('[data-page="drills"]').click();
      const drillsVisible = document.querySelector('[data-panel="drills"]').classList.contains('active');
      const drillCount = document.querySelectorAll('.drill-card').length;
      document.querySelector('[data-drill-filter="Defense"]').click();
      const visibleDefense = [...document.querySelectorAll('.drill-card:not([hidden])')].every(card => card.dataset.category === 'Defense');
      document.querySelector('[data-page="leaderboard"]').click();
      const podiumCount = document.querySelectorAll('.podium-player').length;
      document.querySelector('[data-page="settings"]').click();
      document.querySelectorAll('.avatar-swatch')[2].click();
      const avatarColor = getComputedStyle(document.querySelector('.settings-avatar')).getPropertyValue('--avatar-color').trim();
      return {
        drillsVisible,
        drillCount,
        visibleDefense,
        podiumCount,
        keybindCount: document.querySelectorAll('.keybind-row').length,
        avatarColor,
      };
    })()`
  });
  console.log(JSON.stringify(result.result.value, null, 2));
  ws.close();
})();
NODE
```

Expected JSON:

```json
{
  "drillsVisible": true,
  "drillCount": 10,
  "visibleDefense": true,
  "podiumCount": 3,
  "keybindCount": 9,
  "avatarColor": "#1f8a4c"
}
```

- [ ] **Step 5: Verify gameplay remains unchanged**

In the browser at `http://localhost:4174`:

```text
Click Drills.
Click an available Attack drill.
The menu overlay hides.
The current canvas court appears.
The current HUD bar appears.
The current instruction card appears.
No inspiration ingame UI appears.
Return to menu from the existing end-rally flow still works.
Repeat with an available Defense drill.
```

- [ ] **Step 6: Inspect changed files**

Run:

```bash
git diff --name-only develop...HEAD
```

Expected changed files include only:

```text
index.html
src/css/style.css
src/js/screens.js
```

If the new plan file is committed on the feature branch too, this output may also include:

```text
docs/superpowers/plans/2026-04-24-secondary-home-pages-redesign.md
```

- [ ] **Step 7: Commit plan file if it is intentionally tracked**

Run:

```bash
git add docs/superpowers/plans/2026-04-24-secondary-home-pages-redesign.md
git commit -m "docs: plan secondary home pages redesign"
```

Expected: commit succeeds if the plan file is uncommitted. If it was already committed, Git reports nothing to commit.

---

## Self-Review

**Spec coverage:** Drills, Leaderboard, and Settings each have a task for data, template markup, interactions, CSS, responsive behavior, and verification. The plan preserves the current ingame interface by routing only attack/defense drill starts to existing `workshop:select` and leaving gameplay modules untouched.

**Placeholder scan:** The plan uses concrete file paths, code snippets, commands, and expected outputs. It avoids empty implementation instructions.

**Type consistency:** Data fields are consistently named `rankName`, `wr`, `workshop`, `locked`, `best`, `data-drill-filter`, `data-category`, and `data-playable` across templates, event wiring, and CSS.
