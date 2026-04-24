/**
 * screens.js — Screen management via DOM overlays
 * Developer A · Rendering & UI
 *
 * Responsibilities:
 *  - Create and manage menu/workshop overlays over the canvas
 *  - Handle transitions via CSS opacity
 *  - Emit simple events so main.js can wire navigation logic
 *
 * The active exercise screen intentionally has no overlay element. Once a
 * workshop starts, the existing canvas, HUD, and instruction UI keep control.
 */

const INK = '#0f1a14';

const PLAYER = Object.freeze({
  name: 'Alex Kim',
  initials: 'AK',
  country: 'KR',
  level: 12,
  xp: 1240,
  xpMax: 2000,
  rank: 'Silver III',
  wins: 47,
  winRate: 61,
  streak: 5,
  bestStreak: 9,
  trained: '18h 22m',
});

const HOME_STATS = Object.freeze([
  { label: 'LEVEL', value: String(PLAYER.level), hint: `${PLAYER.xp.toLocaleString()} / ${PLAYER.xpMax.toLocaleString()} XP`, bar: PLAYER.xp / PLAYER.xpMax },
  { label: 'RANK', value: PLAYER.rank, hint: '+42 pts this week' },
  { label: 'WINS', value: String(PLAYER.wins), hint: `${PLAYER.winRate}% win rate` },
  { label: 'STREAK', value: String(PLAYER.streak), hint: `personal best: ${PLAYER.bestStreak}` },
  { label: 'TRAINED', value: PLAYER.trained, hint: 'this month' },
]);

const MODES = Object.freeze([
  {
    id: 'attack',
    title: 'Attack Training',
    tagline: 'Level up your offense',
    blurb: 'Master smashes, drops, and clears. Learn to read openings and finish rallies with precision aggression.',
    color: '#e85d3c',
    difficulty: 2,
    duration: '10-15 min',
    rewards: '+120 XP',
    drills: ['Smash placement', 'Drop-shot deception', 'Net kill reflex', 'Attack combinations'],
    statLabel: 'Smash accuracy',
    statValue: '78%',
    available: true,
  },
  {
    id: 'defense',
    title: 'Defense Training',
    tagline: 'Become a wall at the back',
    blurb: 'Read your opponent, block smashes, and counter-attack from the baseline. Turn defense into your offense.',
    color: '#1f8a4c',
    difficulty: 2,
    duration: '10-15 min',
    rewards: '+120 XP',
    drills: ['Smash blocks', 'Lift placement', 'Court recovery', 'Counter-attack timing'],
    statLabel: 'Blocks landed',
    statValue: '64%',
    available: true,
  },
  {
    id: 'match',
    title: 'Match Mode',
    tagline: 'Put it all on the line',
    blurb: 'Full ranked match flow is not wired into this prototype yet. The current game interface stays focused on attack and defense workshops.',
    color: '#2e6fc5',
    difficulty: 3,
    duration: '20-30 min',
    rewards: '+250 XP',
    drills: ['Ranked flow preview', 'Opponent analysis', 'Shot-clock concept', 'Post-match summary'],
    statLabel: 'Win rate',
    statValue: '61%',
    available: false,
  },
]);

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
  { action: 'Select Smash', key: '1' }, { action: 'Select Drop', key: '2' }, { action: 'Select Clear', key: '3' }, { action: 'Select Drive', key: '4' }, { action: 'Target Left', key: 'A / ←' }, { action: 'Target Center', key: 'S / ↓' }, { action: 'Target Right', key: 'D / →' }, { action: 'Confirm Shot', key: 'Space' }, { action: 'Pause', key: 'Esc' },
]);

const SVG_SHUTTLE = `
<svg viewBox="0 0 100 100" aria-hidden="true">
  <g stroke="${INK}" stroke-width="3" stroke-linejoin="round">
    <path d="M50 55 L18 15 L28 8 Z" fill="#fff8e1"/>
    <path d="M50 55 L35 6 L52 4 Z" fill="#ffffff"/>
    <path d="M50 55 L58 4 L75 10 Z" fill="#fff8e1"/>
    <path d="M50 55 L82 15 L90 28 Z" fill="#ffffff"/>
    <ellipse cx="50" cy="62" rx="16" ry="11" fill="#e85d3c"/>
    <ellipse cx="50" cy="58" rx="16" ry="4" fill="#ffd23f"/>
  </g>
</svg>`;

function modeIcon(modeId) {
  if (modeId === 'defense') {
    return `
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <g stroke="${INK}" stroke-width="3" stroke-linejoin="round">
          <path d="M50 10 L18 22 L18 52 Q18 78 50 92 Q82 78 82 52 L82 22 Z" fill="#1f8a4c"/>
          <path d="M50 10 L18 22 L18 52 Q18 78 50 92 Z" fill="#156b3a"/>
          <path d="M38 48 L46 58 L64 38" fill="none" stroke="#fff8e1" stroke-width="5" stroke-linecap="round"/>
        </g>
      </svg>`;
  }

  if (modeId === 'match') {
    return `
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <g stroke="${INK}" stroke-width="3" stroke-linejoin="round">
          <path d="M28 18 L72 18 L70 46 Q68 62 50 62 Q32 62 30 46 Z" fill="#ffd23f"/>
          <path d="M28 22 Q14 22 14 34 Q14 44 28 44" fill="none"/>
          <path d="M72 22 Q86 22 86 34 Q86 44 72 44" fill="none"/>
          <rect x="40" y="62" width="20" height="10" fill="#e85d3c"/>
          <rect x="30" y="72" width="40" height="10" rx="2" fill="${INK}"/>
        </g>
      </svg>`;
  }

  return `
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <ellipse cx="38" cy="38" rx="26" ry="30" fill="#ffd23f" transform="rotate(-35 38 38)"/>
        <g stroke="${INK}" stroke-width="1.5" fill="none" transform="rotate(-35 38 38)">
          <line x1="12" y1="38" x2="64" y2="38"/>
          <line x1="38" y1="8" x2="38" y2="68"/>
          <line x1="18" y1="20" x2="58" y2="56"/>
          <line x1="58" y1="20" x2="18" y2="56"/>
        </g>
        <rect x="58" y="58" width="38" height="10" rx="2" fill="#e85d3c" transform="rotate(45 58 58)"/>
        <rect x="86" y="82" width="10" height="14" rx="2" fill="${INK}" transform="rotate(45 86 82)"/>
      </g>
    </svg>`;
}

function difficultyDots(count, total = 4) {
  return `
    <span class="difficulty" aria-label="Difficulty ${count} of ${total}">
      ${Array.from({ length: total }, (_, index) => `<span class="${index < count ? 'filled' : ''}"></span>`).join('')}
    </span>`;
}

function flagBadge(country) {
  return `<span class="flag-badge" aria-label="${country}">${country}</span>`;
}

function pageTitleMarkup({ eyebrow, title, right = '' }) {
  return `
    <div class="page-title-row">
      <div>
        <p class="page-eyebrow">▸ ${eyebrow}</p>
        <h1>${title}</h1>
      </div>
      ${right}
    </div>`;
}

function drillCardMarkup(drill) {
  const playable = !drill.locked && (drill.workshop === 'attack' || drill.workshop === 'defense');

  return `
    <article
      class="drill-card ${drill.locked ? 'locked' : ''}"
      data-drill="${drill.id}"
      data-category="${drill.category}"
      data-workshop="${drill.workshop ?? ''}"
      data-playable="${playable ? 'true' : 'false'}"
      style="--drill-color:${drill.color}"
    >
      <div class="drill-stripe"></div>
      <div class="drill-body">
        <div class="drill-card-head">
          <span class="chip drill-chip">${drill.category}</span>
          ${difficultyDots(drill.difficulty).replace('class="difficulty"', 'class="difficulty compact"')}
        </div>
        <h2>${drill.title}</h2>
        <div class="drill-meta">
          <span>${drill.duration}</span>
          <span>+${drill.xp} XP</span>
          <span>${drill.attempts} runs</span>
        </div>
        ${drill.best === null ? '<p class="new-drill">New drill</p>' : `<p class="best-score"><span>BEST</span><strong>${drill.best}%</strong></p>`}
        ${drill.locked ? '<p class="drill-lock">Locked</p>' : ''}
      </div>
    </article>`;
}

function renderDrillsPage() {
  const dailyDrill = DRILLS_LIST[0];
  const categories = ['All', 'Attack', 'Defense', 'Strategy'];

  return `
    ${pageTitleMarkup({
      eyebrow: 'TRAINING LIBRARY',
      title: 'Drills',
      right: `
        <div class="filter-tabs" role="tablist" aria-label="Drill filters">
          ${categories.map(category => `
            <button class="filter-tab ${category === 'All' ? 'active' : ''}" type="button" data-drill-filter="${category}">${category}</button>
          `).join('')}
        </div>`,
    })}
    <section class="daily-drill" style="--drill-color:${dailyDrill.color}">
      <div class="daily-shuttle">${SVG_SHUTTLE}</div>
      <div class="daily-copy">
        <p class="page-eyebrow">▸ TODAY'S FOCUS</p>
        <h2>${dailyDrill.title}</h2>
        <span class="daily-chip">${dailyDrill.category}</span>
        <p class="daily-meta">${dailyDrill.duration} · +${dailyDrill.xp} XP · Best ${dailyDrill.best}%</p>
      </div>
      <button class="btn primary daily-start" type="button" disabled>Start ▸</button>
    </section>
    <div class="drill-grid">
      ${DRILLS_LIST.map(drillCardMarkup).join('')}
    </div>`;
}

function renderLeaderboardPage() {
  const podium = LEADERBOARD.slice(0, 3);
  const standings = LEADERBOARD.slice(3);

  return `
    ${pageTitleMarkup({
      eyebrow: 'GLOBAL STANDINGS',
      title: 'Leaderboard',
      right: `
      <div class="period-tabs" role="tablist" aria-label="Leaderboard period">
        <button class="btn period-tab active" type="button" data-period="weekly">Weekly</button>
        <button class="btn period-tab" type="button" data-period="all-time">All-time</button>
      </div>
    `})}
    <div class="podium-grid">
      ${podium.map(player => `
        <article class="podium-player place-${player.rank}">
          <div class="podium-medal">#${player.rank}</div>
          <div class="podium-block">
            <span class="podium-place">Place ${player.rank}</span>
            <span class="podium-avatar">${player.initials}</span>
            <h2>${player.name}</h2>
            <p class="podium-rank">${flagBadge(player.country)} ${player.rankName}</p>
            <div class="podium-stats">
              <span><strong>${player.wins}</strong><small>Wins</small></span>
              <span><strong>${player.wr}%</strong><small>WR</small></span>
              <span><strong>${player.xp.toLocaleString()}</strong><small>XP</small></span>
            </div>
          </div>
        </article>
      `).join('')}
    </div>
    <div class="standings-wrap card">
      <div class="standings-row standings-head">
        <span class="rank-cell">RANK</span>
        <span class="player-cell">PLAYER</span>
        <span class="tier">TIER</span>
        <span class="wins">WINS</span>
        <span class="wr">WR</span>
        <span class="xp">XP</span>
      </div>
      ${standings.map(player => `
        <article class="standings-row">
          <span class="rank-cell">#${player.rank}</span>
          <span class="player-cell">
            <span class="player-avatar">${player.initials}</span>
            <span><strong>${player.name}</strong><small>${flagBadge(player.country)} ${player.country}</small></span>
          </span>
          <span class="tier">${player.rankName}</span>
          <span class="wins"><strong>${player.wins}</strong><small>Wins</small></span>
          <span class="wr"><strong>${player.wr}%</strong><small>WR</small></span>
          <span class="xp"><strong>${player.xp.toLocaleString()}</strong><small>XP</small></span>
        </article>
      `).join('')}
      <article class="standings-row player-standing">
        <span class="rank-cell">#287</span>
        <span class="player-cell">
          <span class="player-avatar">${PLAYER.initials}</span>
          <span><strong>${PLAYER.name}</strong><small>${flagBadge(PLAYER.country)} ${PLAYER.country}</small></span>
        </span>
        <span class="tier">${PLAYER.rank}</span>
        <span class="wins"><strong>${PLAYER.wins}</strong><small>Wins</small></span>
        <span class="wr"><strong>${PLAYER.winRate}%</strong><small>WR</small></span>
        <span class="xp"><strong>${PLAYER.xp.toLocaleString()}</strong><small>XP</small></span>
      </article>
      <p class="season-note">Season ranking updates after completed training sets and ranked matches.</p>
    </div>`;
}

function renderSettingsPage() {
  return `
    ${pageTitleMarkup({ eyebrow: 'YOUR PREFERENCES', title: 'Settings' })}
    <div class="settings-grid">
      <section class="settings-card card profile-card">
        <div class="settings-card-head">
          <span class="settings-accent green"></span>
          <h2>Profile</h2>
        </div>
        <div class="profile-layout">
          <div class="avatar-editor">
            <div class="settings-avatar" style="--avatar-color:${SETTINGS_AVATAR_COLORS[0]}">
              <span class="player-avatar">${PLAYER.initials}</span>
            </div>
            <div class="avatar-swatches" aria-label="Avatar color">
              ${SETTINGS_AVATAR_COLORS.map((color, index) => `
                <button class="avatar-swatch ${index === 0 ? 'active' : ''}" type="button" style="--swatch-color:${color}" data-avatar-color="${color}" aria-label="Avatar color ${index + 1}"></button>
              `).join('')}
            </div>
          </div>
          <div class="profile-fields">
            <label>
              <span>Name</span>
              <input class="settings-input" type="text" value="${PLAYER.name}" readonly>
            </label>
            <label>
              <span>Region</span>
              <input class="settings-input" type="text" value="${PLAYER.country}" readonly>
            </label>
            <label>
              <span>Rank</span>
              <input class="settings-input" type="text" value="${PLAYER.rank}" readonly>
            </label>
            <button class="btn primary save-profile" type="button" disabled>Save profile</button>
          </div>
        </div>
      </section>
      <section class="settings-card card account-card">
        <div class="settings-card-head">
          <span class="settings-accent blue"></span>
          <h2>Account</h2>
        </div>
        <div class="account-list">
          <div><span>Email</span><strong>alex.kim@example.com</strong></div>
          <div><span>Level</span><strong>Level ${PLAYER.level}</strong></div>
          <div><span>XP</span><strong>${PLAYER.xp.toLocaleString()} / ${PLAYER.xpMax.toLocaleString()}</strong></div>
          <div><span>Training</span><strong>${PLAYER.trained} this month</strong></div>
          <div><span>Streak</span><strong>${PLAYER.streak} days</strong></div>
        </div>
        <div class="account-actions">
          <button class="btn block" type="button" disabled>Change password</button>
          <button class="btn danger block" type="button" disabled>Sign out</button>
        </div>
      </section>
      <section class="settings-card card keybind-card">
        <div class="settings-card-head">
          <span class="settings-accent red"></span>
          <h2>Controls</h2>
        </div>
        <div class="keybind-grid">
          ${SETTINGS_KEYBINDS.map(bind => `
            <div class="keybind-row">
              <span>${bind.action}</span>
              <kbd>${bind.key}</kbd>
            </div>
          `).join('')}
        </div>
        <button class="btn reset-controls" type="button" disabled>Reset to defaults</button>
      </section>
    </div>`;
}

export class ScreenManager {
  constructor() {
    /** @type {Record<string, HTMLElement>} */
    this._screens = {};

    /** @type {Record<string, Function[]>} */
    this._listeners = {};

    this._currentScreen = null;
    this._buildScreens();
  }

  // ─── Build DOM ─────────────────────────────────────────────────────────────

  _buildScreens() {
    const menu = this._createElement('screen-menu', `
      <div class="court-bg" aria-hidden="true">
        <svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
          <g stroke="#0d4424" stroke-width="3" fill="none">
            <rect x="260" y="120" width="1400" height="840"/>
            <line x1="260" y1="540" x2="1660" y2="540"/>
            <line x1="960" y1="120" x2="960" y2="960"/>
            <rect x="260" y="240" width="1400" height="300"/>
            <rect x="260" y="540" width="1400" height="300"/>
          </g>
        </svg>
      </div>
      <div class="rally-shell">
        <header class="rally-header">
          <button class="brand-button" type="button" data-page="home">
            <span class="brand-mark">${SVG_SHUTTLE}</span>
            <span class="brand-copy">
              <span class="brand-title">RALLY</span>
              <span class="brand-subtitle">BADMINTON · STRATEGY</span>
            </span>
          </button>
          <nav class="rally-nav" aria-label="Navigation principale">
            <button class="nav-pill active" type="button" data-page="home">Home</button>
            <button class="nav-pill" type="button" data-page="drills">Drills</button>
            <button class="nav-pill" type="button" data-page="leaderboard">Leaderboard</button>
            <button class="nav-pill" type="button" data-page="settings">Settings</button>
          </nav>
          <div class="player-pill" aria-label="Profil joueur">
            <span class="player-avatar">${PLAYER.initials}</span>
            <span>
              <span class="player-name">${PLAYER.name}</span>
              <span class="player-rank">LVL ${PLAYER.level} · ${PLAYER.rank.toUpperCase()}</span>
            </span>
          </div>
        </header>

        <main class="rally-main">
          <section class="rally-page active" data-panel="home">
            <div class="stats-strip">
              ${HOME_STATS.map(stat => `
                <article class="stat-card">
                  <span class="stat-label">${stat.label}</span>
                  <strong>${stat.value}</strong>
                  <span class="stat-hint">${stat.hint}</span>
                  ${typeof stat.bar === 'number' ? `<span class="stat-bar"><span style="width:${Math.round(stat.bar * 100)}%"></span></span>` : ''}
                </article>
              `).join('')}
            </div>
            <div class="page-title-row">
              <div>
                <p class="page-eyebrow">▸ CHOOSE YOUR COURT</p>
                <h1>Ready to play, ${PLAYER.name.split(' ')[0]}?</h1>
              </div>
              <div class="daily-bonus"><span></span> DAILY BONUS · 2× XP</div>
            </div>
            <div class="mode-grid">
              ${MODES.map(mode => `
                <article class="mode-card" data-mode="${mode.id}" style="--mode-color:${mode.color}">
                  <div class="mode-stripe"></div>
                  <div class="mode-body">
                    <div class="mode-top">
                      <span class="mode-icon">${modeIcon(mode.id)}</span>
                      <span class="mode-meta">
                        <span class="chip">${mode.duration}</span>
                        <span class="difficulty" aria-label="Difficulty ${mode.difficulty} of 3">
                          ${[1, 2, 3].map(n => `<span class="${n <= mode.difficulty ? 'filled' : ''}"></span>`).join('')}
                        </span>
                      </span>
                    </div>
                    <p class="mode-tagline">${mode.tagline}</p>
                    <h2>${mode.title}</h2>
                    <p class="mode-blurb">${mode.blurb}</p>
                    <div class="mode-expanded" hidden>
                      <p class="mode-section-label">INCLUDES</p>
                      <div class="drill-list">
                        ${mode.drills.map(drill => `<span><b>✓</b>${drill}</span>`).join('')}
                      </div>
                      <div class="mode-stat-row">
                        <span><small>YOUR ${mode.statLabel.toUpperCase()}</small><strong>${mode.statValue}</strong></span>
                        <span><small>REWARDS</small><strong>${mode.rewards}</strong></span>
                      </div>
                      <div class="mode-actions">
                        <button class="btn block mode-back" type="button">← Back</button>
                        <button class="btn primary mode-start" type="button" ${mode.available ? '' : 'disabled'}>${mode.available ? 'Start ▸' : 'Locked'}</button>
                      </div>
                    </div>
                    <div class="mode-footer">
                      <span>${mode.rewards}</span>
                      <span>${mode.available ? 'Tap to view' : 'Preview'} <b>→</b></span>
                    </div>
                  </div>
                </article>
              `).join('')}
            </div>
          </section>

          <section class="rally-page" data-panel="drills">
            ${renderDrillsPage()}
          </section>

          <section class="rally-page" data-panel="leaderboard">
            ${renderLeaderboardPage()}
          </section>

          <section class="rally-page" data-panel="settings">
            ${renderSettingsPage()}
          </section>
        </main>
      </div>
    `);

    menu.querySelectorAll('[data-page]').forEach(button => {
      button.addEventListener('click', () => {
        const page = button.dataset.page;
        menu.querySelectorAll('.nav-pill').forEach(nav => nav.classList.toggle('active', nav.dataset.page === page));
        menu.querySelectorAll('.rally-page').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === page));
      });
    });

    menu.querySelectorAll('.mode-card').forEach(card => {
      card.addEventListener('click', event => {
        if (event.target.closest('button')) return;
        const shouldExpand = !card.classList.contains('expanded');
        menu.querySelectorAll('.mode-card').forEach(other => {
          const expanded = other === card && shouldExpand;
          other.classList.toggle('expanded', expanded);
          other.classList.toggle('dimmed', card !== other && shouldExpand);
          const expandedRegion = other.querySelector('.mode-expanded');
          if (expandedRegion) expandedRegion.hidden = !expanded;
        });
      });
    });

    menu.querySelectorAll('.mode-back').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        this._collapseModeCards(menu);
      });
    });

    menu.querySelectorAll('.mode-start').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        const mode = button.closest('.mode-card')?.dataset.mode;
        if (mode === 'attack' || mode === 'defense') {
          this._emit('workshop:select', { workshop: mode });
        }
      });
    });

    menu.querySelectorAll('.filter-tab').forEach(button => {
      button.addEventListener('click', () => {
        const category = button.dataset.drillFilter;
        menu.querySelectorAll('.filter-tab').forEach(tab => tab.classList.toggle('active', tab === button));
        menu.querySelectorAll('.drill-card').forEach(card => {
          card.hidden = category !== 'All' && card.dataset.category !== category;
        });
      });
    });

    menu.querySelectorAll('.drill-card').forEach(card => {
      card.addEventListener('click', () => {
        const workshop = card.dataset.workshop;
        if (card.dataset.playable === 'true' && (workshop === 'attack' || workshop === 'defense')) {
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

    const workshop = this._createElement('screen-workshop', `
      <div class="court-bg" aria-hidden="true"></div>
      <div class="workshop-shell card">
        <p class="page-eyebrow">▸ CHOOSE YOUR WORKSHOP</p>
        <h2>Training court</h2>
        <div class="workshop-cards">
          ${MODES.filter(mode => mode.available).map(mode => `
            <button class="workshop-card" type="button" data-workshop="${mode.id}" style="--mode-color:${mode.color}">
              <span class="workshop-icon">${modeIcon(mode.id)}</span>
              <span class="workshop-title">${mode.id === 'attack' ? 'Attaque' : 'Défense'}</span>
              <span class="workshop-desc">${mode.id === 'attack' ? 'Rotation, smash, net kill' : 'Side-by-side, lift, block'}</span>
            </button>
          `).join('')}
        </div>
        <button id="btn-back-menu" class="btn" type="button">← Retour</button>
      </div>
    `);
    workshop.querySelectorAll('.workshop-card').forEach(card => {
      card.addEventListener('click', () => {
        this._emit('workshop:select', { workshop: card.dataset.workshop });
      });
    });
    workshop.querySelector('#btn-back-menu').addEventListener('click', () => {
      this.show('menu');
    });

    const endScreen = document.getElementById('end-screen');
    if (endScreen) {
      endScreen.classList.add('screen-overlay--end');
      const actions = endScreen.querySelector('.end-actions') ?? endScreen;
      if (!endScreen.querySelector('#end-menu-btn')) {
        const menuBtn = document.createElement('button');
        menuBtn.id = 'end-menu-btn';
        menuBtn.textContent = 'Menu';
        menuBtn.className = 'btn-secondary';
        actions.appendChild(menuBtn);
      }
      endScreen.querySelector('#end-btn').addEventListener('click', () => {
        this._emit('end:replay');
      });
      endScreen.querySelector('#end-menu-btn').addEventListener('click', () => {
        this._emit('end:menu');
      });
      this._screens['end-rally'] = endScreen;
    }

    this._screens['menu']            = menu;
    this._screens['workshop-select'] = workshop;

    document.body.appendChild(menu);
    document.body.appendChild(workshop);
  }

  /**
   * @param {HTMLElement} menu
   */
  _collapseModeCards(menu) {
    menu.querySelectorAll('.mode-card').forEach(card => {
      card.classList.remove('expanded', 'dimmed');
      const expandedRegion = card.querySelector('.mode-expanded');
      if (expandedRegion) expandedRegion.hidden = true;
    });
  }

  /**
   * @param {string} id
   * @param {string} innerHTML
   * @returns {HTMLDivElement}
   */
  _createElement(id, innerHTML) {
    const el = document.createElement('div');
    el.id = id;
    el.className = 'screen-overlay';
    el.innerHTML = innerHTML;
    return el;
  }

  /**
   * @param {'menu'|'workshop-select'|'exercise'|'end-rally'} screenId
   */
  show(screenId) {
    if (this._currentScreen && this._currentScreen !== 'exercise') {
      const prev = this._screens[this._currentScreen];
      if (prev) this._hideEl(prev);
    }

    this._currentScreen = screenId;

    if (screenId !== 'exercise') {
      document.getElementById('instruction')?.classList.add('hidden');
    }

    if (screenId === 'exercise') return;

    const el = this._screens[screenId];
    if (!el) {
      console.warn(`ScreenManager: unknown screen "${screenId}"`);
      return;
    }
    this._showEl(el);
  }

  /**
   * @param {HTMLElement} el
   */
  _showEl(el) {
    el.style.display = 'flex';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.add('active'));
    });
  }

  /**
   * @param {HTMLElement} el
   */
  _hideEl(el) {
    el.classList.remove('active');
    const onEnd = () => {
      el.style.display = 'none';
      el.removeEventListener('transitionend', onEnd);
    };
    el.addEventListener('transitionend', onEnd);
    setTimeout(() => { el.style.display = 'none'; }, 400);
  }

  /**
   * @param {string} event
   * @param {Function} callback
   */
  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
  }

  /**
   * @param {string} event
   * @param {*} [data]
   */
  _emit(event, data) {
    const cbs = this._listeners[event];
    if (cbs) cbs.forEach(cb => cb(data));
  }
}
