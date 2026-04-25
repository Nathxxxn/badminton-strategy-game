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

import {
  changePasswordAsync,
  DEFAULT_APP_STATE,
  loadAppState,
  loadSessionAsync,
  loginAsync,
  logoutAsync,
  recordDrillStartAsync,
  resetControlsAsync,
  resetProgressionAsync,
  saveAppStateAsync,
  signupAsync,
} from './app-state.js';
import { showToast } from './ui-feedback.js';

const INK = '#0f1a14';

const PLAYER = DEFAULT_APP_STATE.profile;

function playerInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('') || PLAYER.initials;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function getProfile(state) {
  return state?.profile ?? PLAYER;
}

function homeStats(profile) {
  return [
    { label: 'LEVEL', value: String(profile.level), hint: `${profile.xp.toLocaleString()} / ${profile.xpMax.toLocaleString()} XP`, bar: profile.xp / profile.xpMax },
    { label: 'RANK', value: profile.rank, hint: '+42 pts this week' },
    { label: 'WINS', value: String(profile.wins), hint: `${profile.winRate}% win rate` },
    { label: 'STREAK', value: String(profile.streak), hint: `personal best: ${profile.bestStreak}` },
    { label: 'TRAINED', value: profile.trained, hint: 'this month' },
  ];
}

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

const ALL_TIME_LEADERBOARD = Object.freeze([
  { rank: 1, name: 'Taro Sakai', initials: 'TS', rankName: 'Legend', wins: 1842, wr: 81, xp: 221400, country: 'JP' },
  { rank: 2, name: 'Chen Wei', initials: 'CW', rankName: 'Legend', wins: 1730, wr: 79, xp: 207900, country: 'CN' },
  { rank: 3, name: 'Priya Shetty', initials: 'PS', rankName: 'Master I', wins: 1698, wr: 77, xp: 198200, country: 'IN' },
  { rank: 4, name: 'Jonas Berg', initials: 'JB', rankName: 'Master I', wins: 1512, wr: 74, xp: 176500, country: 'SE' },
  { rank: 5, name: 'Amara Okafor', initials: 'AO', rankName: 'Master II', wins: 1450, wr: 72, xp: 168100, country: 'NG' },
  { rank: 6, name: 'Sofia Rossi', initials: 'SR', rankName: 'Master II', wins: 1394, wr: 71, xp: 160400, country: 'IT' },
  { rank: 7, name: 'Diego Marquez', initials: 'DM', rankName: 'Diamond I', wins: 1320, wr: 69, xp: 151900, country: 'MX' },
  { rank: 8, name: 'Hana Park', initials: 'HP', rankName: 'Diamond I', wins: 1268, wr: 68, xp: 145700, country: 'KR' },
  { rank: 9, name: 'Leo Dubois', initials: 'LD', rankName: 'Diamond II', wins: 1190, wr: 66, xp: 137200, country: 'FR' },
  { rank: 10, name: 'Aisha Khan', initials: 'AK', rankName: 'Diamond II', wins: 1134, wr: 65, xp: 129800, country: 'PK' },
]);

const SETTINGS_AVATAR_COLORS = Object.freeze(['#ffd23f', '#e85d3c', '#1f8a4c', '#2e6fc5', '#0f1a14']);

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

function renderDrillsPage(state) {
  const dailyDrill = DRILLS_LIST[0];
  const categories = ['All', 'Attack', 'Defense', 'Strategy'];
  const activeFilter = state.preferences.drillFilter;
  const progressById = new Map((state.drills ?? []).map(drill => [drill.id, drill]));
  const drills = DRILLS_LIST.map(drill => {
    const progress = progressById.get(drill.id);
    return {
      ...drill,
      attempts: progress?.attempts ?? drill.attempts,
      best: progress?.bestScore ?? drill.best,
      started: progress?.started ?? false,
      completed: progress?.completed ?? false,
    };
  });

  return `
    ${pageTitleMarkup({
      eyebrow: 'TRAINING LIBRARY',
      title: 'Drills',
      right: `
        <div class="filter-tabs" role="tablist" aria-label="Drill filters">
          ${categories.map(category => `
            <button class="filter-tab ${category === activeFilter ? 'active' : ''}" type="button" data-drill-filter="${category}">${category}</button>
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
      <button class="btn primary daily-start" type="button" data-drill="${dailyDrill.id}" data-workshop="${dailyDrill.workshop}">Start ▸</button>
    </section>
    <div class="drill-grid">
      ${drills.map(drillCardMarkup).join('')}
    </div>`;
}

function renderLeaderboardPage(state) {
  const period = state.preferences.leaderboardPeriod;
  const profile = getProfile(state);
  const leaderboard = state.leaderboard ?? { summary: { sessionsPlayed: 0, bestScore: 0, averageScore: 0 }, sessions: [] };
  const sessions = leaderboard.sessions ?? [];
  const summary = leaderboard.summary ?? {};

  return `
    ${pageTitleMarkup({
      eyebrow: 'PERSONAL STANDINGS',
      title: 'Leaderboard',
      right: `
      <div class="period-tabs" role="tablist" aria-label="Leaderboard period">
        <button class="btn period-tab ${period === 'weekly' ? 'active' : ''}" type="button" data-period="weekly">Weekly</button>
        <button class="btn period-tab ${period === 'all-time' ? 'active' : ''}" type="button" data-period="all-time">All-time</button>
      </div>
    `})}
    <div class="personal-rank-grid">
      <article class="personal-rank-card card">
        <span class="stat-label">PLAYER</span>
        <strong>${escapeHtml(profile.name)}</strong>
        <span class="stat-hint">${flagBadge(profile.country)} ${profile.rank}</span>
      </article>
      <article class="personal-rank-card card">
        <span class="stat-label">SESSIONS</span>
        <strong>${summary.sessionsPlayed ?? 0}</strong>
        <span class="stat-hint">${period === 'weekly' ? 'last 7 days' : 'all time'}</span>
      </article>
      <article class="personal-rank-card card">
        <span class="stat-label">BEST SCORE</span>
        <strong>${summary.bestScore ?? 0}</strong>
        <span class="stat-hint">personal record</span>
      </article>
      <article class="personal-rank-card card">
        <span class="stat-label">AVERAGE</span>
        <strong>${summary.averageScore ?? 0}</strong>
        <span class="stat-hint">per rally</span>
      </article>
    </div>
    <div class="standings-wrap card">
      <div class="standings-row standings-head">
        <span class="rank-cell">#</span>
        <span class="player-cell">SESSION</span>
        <span class="tier">WORKSHOP</span>
        <span class="wins">SCORE</span>
        <span class="wr">ACC</span>
        <span class="xp">DATE</span>
      </div>
      ${sessions.length ? sessions.map((session, index) => `
        <article class="standings-row">
          <span class="rank-cell">#${index + 1}</span>
          <span class="player-cell">
            <span class="player-avatar">${playerInitials(profile.name)}</span>
            <span><strong>${escapeHtml(session.matchId ?? 'Training rally')}</strong><small>${session.correct}/${session.totalTurns} correct</small></span>
          </span>
          <span class="tier">${escapeHtml(session.workshop)}</span>
          <span class="wins">${session.score}</span>
          <span class="wr">${Math.round((session.correct / session.totalTurns) * 100)}%</span>
          <span class="xp">${new Date(session.completedAt).toLocaleDateString()}</span>
        </article>
      `).join('') : '<p class="season-note">NO SESSION RECORDED YET · PLAY A DRILL TO FILL THIS TABLE</p>'}
    </div>`;
}

function renderSettingsPage(state) {
  const profile = getProfile(state);
  const initials = playerInitials(profile.name);

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
            <div class="settings-avatar" style="--avatar-color:${profile.avatarColor}">
              <span class="player-avatar">${initials}</span>
            </div>
            <div class="avatar-swatches" aria-label="Avatar color">
              ${SETTINGS_AVATAR_COLORS.map((color, index) => `
                <button class="avatar-swatch ${color === profile.avatarColor ? 'active' : ''}" type="button" style="--swatch-color:${color}" data-avatar-color="${color}" aria-label="Avatar color ${index + 1}"></button>
              `).join('')}
            </div>
          </div>
          <div class="profile-fields">
            <label>
              <span>Name</span>
              <input class="settings-input" type="text" name="name" value="${escapeHtml(profile.name)}">
            </label>
            <label>
              <span>Region</span>
              <input class="settings-input" type="text" name="country" value="${escapeHtml(profile.country)}" maxlength="2">
            </label>
            <label>
              <span>Rank</span>
              <input class="settings-input" type="text" value="${escapeHtml(profile.rank)}" readonly>
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
          <div><span>Email</span><strong>${escapeHtml(state.account?.email ?? state.user?.email ?? 'local player')}</strong></div>
          <div><span>Level</span><strong>Level ${profile.level}</strong></div>
          <div><span>XP</span><strong>${profile.xp.toLocaleString()} / ${profile.xpMax.toLocaleString()}</strong></div>
          <div><span>Training</span><strong>${profile.trained} this month</strong></div>
          <div><span>Streak</span><strong>${profile.streak} days</strong></div>
        </div>
        <div class="password-fields">
          <input class="settings-input" type="password" name="currentPassword" placeholder="Current password" autocomplete="current-password">
          <input class="settings-input" type="password" name="newPassword" placeholder="New password" autocomplete="new-password">
        </div>
        <div class="account-actions">
          <button class="btn block change-password" type="button">Change password</button>
          <button class="btn danger block signout-account" type="button">Sign out</button>
          <button class="btn danger block reset-progression" type="button">Reset progression</button>
        </div>
      </section>
      <section class="settings-card card keybind-card">
        <div class="settings-card-head">
          <span class="settings-accent red"></span>
          <h2>Controls</h2>
        </div>
        <div class="keybind-grid">
          ${state.controls.map(bind => `
            <div class="keybind-row">
              <span>${bind.action}</span>
              <kbd>${bind.key}</kbd>
            </div>
          `).join('')}
        </div>
        <button class="btn reset-controls" type="button">Reset to defaults</button>
      </section>
    </div>`;
}

function renderAuthScreen() {
  return `
    <div class="court-bg" aria-hidden="true"></div>
    <div class="auth-shell card">
      <span class="brand-mark auth-brand">${SVG_SHUTTLE}</span>
      <p class="page-eyebrow">▸ RALLY ACCOUNT</p>
      <h1>Sign in to train</h1>
      <div class="auth-tabs" role="tablist" aria-label="Authentication mode">
        <button class="auth-tab active" type="button" data-auth-tab="login">Sign in</button>
        <button class="auth-tab" type="button" data-auth-tab="signup">Create</button>
      </div>
      <form class="auth-form active" data-auth-form="login">
        <label>
          <span>Email</span>
          <input class="settings-input" type="email" name="email" placeholder="you@example.com" autocomplete="email" required>
        </label>
        <label>
          <span>Password</span>
          <input class="settings-input" type="password" name="password" placeholder="Your password" autocomplete="current-password" required>
        </label>
        <button class="btn primary block" type="submit">Sign in</button>
      </form>
      <form class="auth-form" data-auth-form="signup" hidden>
        <label>
          <span>Player name</span>
          <input class="settings-input" type="text" name="name" placeholder="Alex Kim" autocomplete="name" required>
        </label>
        <label>
          <span>Email</span>
          <input class="settings-input" type="email" name="email" placeholder="you@example.com" autocomplete="email" required>
        </label>
        <label>
          <span>Password</span>
          <input class="settings-input" type="password" name="password" placeholder="Minimum 6 characters" autocomplete="new-password" required>
        </label>
        <label>
          <span>Confirm password</span>
          <input class="settings-input" type="password" name="confirmPassword" placeholder="Repeat password" autocomplete="new-password" required>
        </label>
        <label>
          <span>Country</span>
          <input class="settings-input" type="text" name="country" placeholder="FR" maxlength="2" value="FR">
        </label>
        <button class="btn primary block" type="submit">Create</button>
      </form>
    </div>`;
}

export class ScreenManager {
  constructor() {
    /** @type {Record<string, HTMLElement>} */
    this._screens = {};

    /** @type {Record<string, Function[]>} */
    this._listeners = {};

    this._currentScreen = null;
    this._state = loadAppState();
    this._authenticated = false;
    this._buildScreens();
    void this._hydrateSession();
  }

  // ─── Build DOM ─────────────────────────────────────────────────────────────

  _buildScreens() {
    const profile = getProfile(this._state);
    const initials = playerInitials(profile.name);
    const firstName = profile.name.split(/\s+/).filter(Boolean)[0] ?? profile.name;

    const auth = this._createElement('screen-auth', renderAuthScreen());
    this._wireAuth(auth);

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
            <span class="player-avatar" data-player-initials>${initials}</span>
            <span>
              <span class="player-name" data-player-name>${escapeHtml(profile.name)}</span>
              <span class="player-rank">LVL ${profile.level} · ${profile.rank.toUpperCase()}</span>
            </span>
          </div>
        </header>

        <main class="rally-main">
          <section class="rally-page active" data-panel="home">
            <div class="stats-strip">
              ${this._homeStatsMarkup(profile)}
            </div>
            <div class="page-title-row">
              <div>
                <p class="page-eyebrow">▸ CHOOSE YOUR COURT</p>
                <h1 data-home-greeting>Ready to play, ${escapeHtml(firstName)}?</h1>
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
                        <button class="btn primary mode-start" type="button" data-available="${mode.available ? 'true' : 'false'}">${mode.available ? 'Start ▸' : 'Preview'}</button>
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
            ${renderDrillsPage(this._state)}
          </section>

          <section class="rally-page" data-panel="leaderboard">
            ${renderLeaderboardPage(this._state)}
          </section>

          <section class="rally-page" data-panel="settings">
            ${renderSettingsPage(this._state)}
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
        if (button.dataset.available !== 'true') {
          this._showFeedback(menu, 'Match Mode arrive bientot. Les ateliers Attaque et Defense restent jouables pour l’instant.');
          return;
        }
        if (mode === 'attack' || mode === 'defense') {
          this._emit('workshop:select', { workshop: mode });
        }
      });
    });

    this._wireDrills(menu);

    this._wireLeaderboard(menu);

    this._wireSettingsAfterRender(menu);

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
    this._screens['auth']            = auth;
    this._screens['workshop-select'] = workshop;

    document.body.appendChild(auth);
    document.body.appendChild(menu);
    document.body.appendChild(workshop);
  }

  _showFeedback(menu, message, variant = 'info') {
    showToast(menu.querySelector('.rally-shell') ?? menu, message, variant);
  }

  async _hydrateSession() {
    const menu = this._screens.menu;
    if (!menu) return;

    const payload = await loadSessionAsync();
    if (!payload?.state) {
      this._authenticated = false;
      this.show('auth');
      return;
    }

    this._authenticated = true;
    this._state = payload.state;
    this._syncProfileDom(menu);
    this._renderHomeStats(menu);
    this._renderDrillsPanel(menu);
    this._wireDrills(menu);
    this._renderLeaderboardPanel(menu);
    this._wireLeaderboard(menu);
    this._renderSettingsPanel(menu);
    this._wireSettingsAfterRender(menu);
    if (this._currentScreen === 'auth') this.show('menu');
  }

  _wireAuth(auth) {
    auth.querySelectorAll('[data-auth-tab]').forEach(button => {
      button.addEventListener('click', () => {
        const mode = button.dataset.authTab;
        auth.querySelectorAll('[data-auth-tab]').forEach(tab => tab.classList.toggle('active', tab === button));
        auth.querySelectorAll('[data-auth-form]').forEach(form => {
          const active = form.dataset.authForm === mode;
          form.hidden = !active;
          form.classList.toggle('active', active);
        });
      });
    });

    auth.querySelector('[data-auth-form="login"]')?.addEventListener('submit', event => {
      event.preventDefault();
      void this._submitLogin(auth, event.currentTarget);
    });

    auth.querySelector('[data-auth-form="signup"]')?.addEventListener('submit', event => {
      event.preventDefault();
      void this._submitSignup(auth, event.currentTarget);
    });
  }

  async _submitLogin(auth, form) {
    const formData = new FormData(form);
    const payload = await loginAsync({
      email: formData.get('email'),
      password: formData.get('password'),
    });
    if (!payload?.state) {
      this._showFeedback(auth, 'Login impossible. Verifie ton email et ton mot de passe.', 'error');
      return;
    }
    await this._acceptAuthPayload(payload);
  }

  async _submitSignup(auth, form) {
    const formData = new FormData(form);
    if (formData.get('password') !== formData.get('confirmPassword')) {
      this._showFeedback(auth, 'Les mots de passe ne correspondent pas.', 'error');
      return;
    }
    const payload = await signupAsync({
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
      country: formData.get('country'),
    });
    if (!payload?.state) {
      this._showFeedback(auth, 'Creation de compte impossible. Utilise un email unique et un mot de passe de 6 caracteres minimum.', 'error');
      return;
    }
    await this._acceptAuthPayload(payload);
  }

  async _acceptAuthPayload(payload) {
    this._authenticated = true;
    this._state = payload.state;
    const menu = this._screens.menu;
    this._syncProfileDom(menu);
    this._renderHomeStats(menu);
    this._renderDrillsPanel(menu);
    this._wireDrills(menu);
    this._renderLeaderboardPanel(menu);
    this._wireLeaderboard(menu);
    this._renderSettingsPanel(menu);
    this._wireSettingsAfterRender(menu);
    this.show('menu');
  }

  _homeStatsMarkup(profile) {
    return homeStats(profile).map(stat => `
      <article class="stat-card">
        <span class="stat-label">${stat.label}</span>
        <strong>${stat.value}</strong>
        <span class="stat-hint">${stat.hint}</span>
        ${typeof stat.bar === 'number' ? `<span class="stat-bar"><span style="width:${Math.round(stat.bar * 100)}%"></span></span>` : ''}
      </article>
    `).join('');
  }

  _renderHomeStats(menu) {
    const stats = menu.querySelector('.stats-strip');
    if (stats) stats.innerHTML = this._homeStatsMarkup(getProfile(this._state));
  }

  _applyDrillFilter(menu, category) {
    menu.querySelectorAll('.drill-card').forEach(card => {
      card.hidden = category !== 'All' && card.dataset.category !== category;
    });
  }

  _renderDrillsPanel(menu) {
    const panel = menu.querySelector('[data-panel="drills"]');
    if (panel) panel.innerHTML = renderDrillsPage(this._state);
  }

  _wireDrills(menu) {
    menu.querySelector('.daily-start')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      const workshop = button.dataset.workshop;
      const drillId = button.dataset.drill;
      if (workshop === 'attack' || workshop === 'defense') {
        this._state = await recordDrillStartAsync(drillId);
        this._emit('workshop:select', { workshop });
      }
    });

    menu.querySelectorAll('.filter-tab').forEach(button => {
      button.addEventListener('click', async () => {
        const category = button.dataset.drillFilter;
        this._state = await saveAppStateAsync({ preferences: { drillFilter: category } });
        menu.querySelectorAll('.filter-tab').forEach(tab => tab.classList.toggle('active', tab === button));
        this._applyDrillFilter(menu, category);
      });
    });

    this._applyDrillFilter(menu, this._state.preferences.drillFilter);

    menu.querySelectorAll('.drill-card').forEach(card => {
      card.addEventListener('click', async () => {
        const workshop = card.dataset.workshop;
        const drill = DRILLS_LIST.find(entry => entry.id === card.dataset.drill);
        if (card.classList.contains('locked')) {
          this._showFeedback(menu, `${drill?.title ?? 'This drill'} est verrouille pour l’instant. Continue les ateliers disponibles pour le debloquer.`);
          return;
        }
        if (card.dataset.playable === 'true' && (workshop === 'attack' || workshop === 'defense')) {
          this._state = await recordDrillStartAsync(card.dataset.drill);
          this._emit('workshop:select', { workshop });
          return;
        }
        this._showFeedback(menu, 'Les drills Strategy sont prevus pour une prochaine passe. Aucun nouvel ingame n’est lance.');
      });
    });
  }

  _renderLeaderboardPanel(menu) {
    const panel = menu.querySelector('[data-panel="leaderboard"]');
    if (panel) panel.innerHTML = renderLeaderboardPage(this._state);
  }

  _wireLeaderboard(menu) {
    menu.querySelectorAll('.period-tab').forEach(button => {
      button.addEventListener('click', async () => {
        this._state = await saveAppStateAsync({ preferences: { leaderboardPeriod: button.dataset.period } });
        this._renderLeaderboardPanel(menu);
        this._wireLeaderboard(menu);
      });
    });
  }

  _renderSettingsPanel(menu) {
    const panel = menu.querySelector('[data-panel="settings"]');
    if (panel) panel.innerHTML = renderSettingsPage(this._state);
  }

  _wireSettingsAfterRender(menu) {
    menu.querySelector('.profile-card')?.setAttribute('data-avatar-color', this._state.profile.avatarColor);
    menu.querySelectorAll('.avatar-swatch').forEach(button => {
      button.addEventListener('click', () => {
        const avatar = menu.querySelector('.settings-avatar');
        if (avatar) avatar.style.setProperty('--avatar-color', button.dataset.avatarColor);
        menu.querySelectorAll('.avatar-swatch').forEach(swatch => swatch.classList.toggle('active', swatch === button));
        menu.querySelector('.profile-card')?.setAttribute('data-avatar-color', button.dataset.avatarColor);
        this._markProfileDirty(menu);
      });
    });

    menu.querySelectorAll('.profile-fields input[name]').forEach(input => {
      input.addEventListener('input', () => this._markProfileDirty(menu));
    });

    menu.querySelector('.save-profile')?.addEventListener('click', () => {
      void this._saveProfileFromDom(menu);
    });

    menu.querySelector('.change-password')?.addEventListener('click', async () => {
      const currentPassword = menu.querySelector('input[name="currentPassword"]')?.value ?? '';
      const newPassword = menu.querySelector('input[name="newPassword"]')?.value ?? '';
      const ok = await changePasswordAsync({ currentPassword, newPassword });
      this._showFeedback(menu, ok ? 'Mot de passe modifie.' : 'Mot de passe actuel invalide ou nouveau mot de passe trop court.', ok ? 'success' : 'error');
    });

    menu.querySelector('.signout-account')?.addEventListener('click', async () => {
      const ok = await logoutAsync();
      if (!ok) {
        this._showFeedback(menu, 'Deconnexion impossible pour le moment.', 'error');
        return;
      }
      this._authenticated = false;
      this.show('auth');
    });

    menu.querySelector('.reset-progression')?.addEventListener('click', async () => {
      this._state = await resetProgressionAsync();
      this._renderHomeStats(menu);
      this._renderDrillsPanel(menu);
      this._wireDrills(menu);
      this._renderLeaderboardPanel(menu);
      this._wireLeaderboard(menu);
      this._renderSettingsPanel(menu);
      this._wireSettingsAfterRender(menu);
      this._showFeedback(menu, 'Progression remise a zero.', 'success');
    });

    menu.querySelector('.reset-controls')?.addEventListener('click', async () => {
      this._state = await resetControlsAsync();
      this._renderSettingsPanel(menu);
      this._wireSettingsAfterRender(menu);
      this._showFeedback(menu, 'Controles restaures.', 'success');
    });
  }

  async _saveProfileFromDom(menu) {
    const nameInput = menu.querySelector('.profile-fields input[name="name"]');
    const countryInput = menu.querySelector('.profile-fields input[name="country"]');
    const nextName = nameInput?.value.trim() || PLAYER.name;
    const nextCountry = (countryInput?.value.trim() || PLAYER.country).slice(0, 2).toUpperCase();
    const avatarColor = menu.querySelector('.profile-card')?.getAttribute('data-avatar-color') ?? this._state.profile.avatarColor;
    this._state = await saveAppStateAsync({ profile: { name: nextName, country: nextCountry, avatarColor } });
    this._syncProfileDom(menu);
    this._renderHomeStats(menu);
    this._renderLeaderboardPanel(menu);
    this._wireLeaderboard(menu);
    this._markProfileDirty(menu, false);
    this._showFeedback(menu, 'Profil sauvegarde.', 'success');
  }

  _markProfileDirty(menu, dirty = true) {
    const button = menu.querySelector('.save-profile');
    if (button) button.disabled = !dirty;
  }

  _syncProfileDom(menu) {
    const profile = getProfile(this._state);
    const initials = playerInitials(profile.name);
    const firstName = profile.name.split(/\s+/).filter(Boolean)[0] ?? profile.name;
    menu.querySelectorAll('[data-player-initials], .settings-avatar .player-avatar').forEach(el => {
      el.textContent = initials;
    });
    const playerName = menu.querySelector('[data-player-name]');
    if (playerName) playerName.textContent = profile.name;
    const greeting = menu.querySelector('[data-home-greeting]');
    if (greeting) greeting.textContent = `Ready to play, ${firstName}?`;
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
   * @param {'auth'|'menu'|'workshop-select'|'exercise'|'end-rally'} screenId
   */
  show(screenId) {
    if (screenId === 'menu' && !this._authenticated) {
      screenId = 'auth';
    }

    if (this._currentScreen === screenId) {
      const current = this._screens[screenId];
      if (current) this._showEl(current);
      return;
    }

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
