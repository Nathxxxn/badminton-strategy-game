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
import { RATING_THRESHOLDS } from './logic/RatingEngine.js';

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

function recentWinRate(sessions, n = 5) {
  const matchSessions = sessions.filter(s => s.workshop === 'match');
  const slice = matchSessions.slice(0, n);
  if (slice.length === 0) return null;
  const wins = slice.filter(s => (s.result ?? '').toLowerCase() === 'win').length;
  return Math.round((wins / slice.length) * 100);
}

function computeModeStat(modeId, sessions) {
  const isAttack  = modeId === 'attack';
  const isDefense = modeId === 'defense';
  if (!isAttack && !isDefense) return null;

  const relevant = sessions.filter(s =>
    isAttack
      ? (s.workshop === 'attack'  || s.workshop === 'tactic')
      : (s.workshop === 'defense' || s.workshop === 'placement')
  );
  const field = isAttack ? 'tacticalAverage' : 'placementAverage';
  const values = relevant.map(s => s[field]).filter(v => typeof v === 'number');
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function homeStats(profile, state = null) {
  const rating = profile.rating ?? 600;
  const peakRating = profile.peakRating ?? rating;
  const wins = profile.wins ?? 0;
  const losses = profile.losses ?? 0;
  const winRate = profile.winRate ?? 0;
  const xpRatio = profile.xpMax > 0 ? profile.xp / profile.xpMax : 0;
  const sessions = state?.leaderboard?.sessions ?? [];
  const recent5 = recentWinRate(sessions, 5);

  return [
    { label: 'RANK', value: profile.rank, hint: `${rating.toLocaleString()} pts · PEAK ${peakRating.toLocaleString()}` },
    { label: 'LEVEL', value: String(profile.level), hint: `${profile.xp.toLocaleString()} / ${profile.xpMax.toLocaleString()} XP`, bar: xpRatio },
    { label: 'RECORD', value: `${wins}-${losses}`, hint: `lifetime ${winRate}% WR` },
    { label: 'LAST 5', value: recent5 !== null ? `${recent5}%` : '—', hint: `lifetime ${winRate}%` },
    { label: 'STREAK', value: String(profile.streak), hint: `best: ${profile.bestStreak}` },
  ];
}

const MODES = Object.freeze([
  {
    id: 'attack',
    title: 'Tactic Training',
    tagline: 'Build your tactical eye',
    blurb: 'Choose the right shot at the right time. Read gaps, exploit weaknesses, and control rally tempo with intent and precision.',
    color: '#e85d3c',
    difficulty: 2,
    duration: '10-15 min',
    rewards: '+120 XP',
    drills: ['Gap identification', 'Smash & drop decisions', 'Shot deception', 'Tempo control'],
    statLabel: 'Shot accuracy',
    statValue: '78%',
    available: true,
  },
  {
    id: 'defense',
    title: 'Placement Training',
    tagline: 'Be in the right place',
    blurb: 'Master court positioning for doubles. Anticipate returns, rotate with your partner, and cover every corner without overreaching.',
    color: '#1f8a4c',
    difficulty: 2,
    duration: '10-15 min',
    rewards: '+120 XP',
    drills: ['Return coverage', 'Partner rotation', 'Court recovery', 'Anticipation drills'],
    statLabel: 'Positioning score',
    statValue: '64%',
    available: true,
  },
  {
    id: 'match',
    title: 'Match Mode',
    tagline: 'Put it all on the line',
    blurb: 'Play a compact ranked match loop with live sets, points, fatigue, and a dynamic shot clock.',
    color: '#2e6fc5',
    difficulty: 3,
    duration: '20-30 min',
    rewards: '+250 XP',
    drills: ['Ranked flow preview', 'Opponent analysis', 'Shot-clock concept', 'Post-match summary'],
    statLabel: 'Win rate',
    statValue: '61%',
    available: false,
    wip: true,
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
]);

const SETTINGS_AVATAR_COLORS = Object.freeze(['#ffd23f', '#e85d3c', '#1f8a4c', '#2e6fc5', '#0f1a14']);

const COUNTRY_CODES = Object.freeze(`
  AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
  CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO
  FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE
  JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO
  MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW
  PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM
  TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW
`.trim().split(/\s+/));

const COUNTRY_NAME_FORMATTER = typeof Intl !== 'undefined' && Intl.DisplayNames
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null;

const COUNTRY_OPTIONS = Object.freeze(COUNTRY_CODES.map(code => [code, COUNTRY_NAME_FORMATTER?.of(code) ?? code]));

function countryOptionsMarkup(selected = PLAYER.country) {
  const selectedCountry = String(selected || PLAYER.country).toUpperCase();
  return COUNTRY_OPTIONS.map(([code, label]) => `
    <option value="${code}" ${code === selectedCountry ? 'selected' : ''}>${label} · ${code}</option>
  `).join('');
}

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

// ─── FFBAD rank color system ──────────────────────────────────────────────────
// Gris (NC) · Jaune (P) · Vert (D) · Bleu (R) · Rouge (N)
function rankColor(rank) {
  if (!rank) return '#9ca3af';
  const letter = String(rank)[0].toUpperCase();
  if (letter === 'P') return '#facc15';
  if (letter === 'D') return '#4ade80';
  if (letter === 'R') return '#60a5fa';
  if (letter === 'N') return '#f87171';
  return '#9ca3af'; // NC / unknown
}

function rankBadge(rank) {
  const color = rankColor(rank);
  return `<span class="rank-badge" style="--rank-color:${color}">${escapeHtml(String(rank ?? 'NC').toUpperCase())}</span>`;
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
  const lastResult = drill.lastResult ? `Last ${drill.lastResult}` : 'No result yet';

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
        ${drill.best === null ? `<p class="new-drill">${lastResult}</p>` : `<p class="best-score"><span>BEST · ${lastResult}</span><strong>${drill.best}</strong></p>`}
        ${drill.locked ? '<p class="drill-lock">Locked</p>' : ''}
      </div>
    </article>`;
}

function renderDrillsPage(state) {
  const tutorialDone = !!localStorage.getItem('rally.tutorialDone');
  const dailyDrill = DRILLS_LIST[0];
  const categories = ['All', 'Attack', 'Defense'];
  const activeFilter = categories.includes(state.preferences.drillFilter) ? state.preferences.drillFilter : 'All';
  const progressById = new Map((state.drills ?? []).map(drill => [drill.id, drill]));
  const drills = DRILLS_LIST.map(drill => {
    const progress = progressById.get(drill.id);
    return {
      ...drill,
      attempts: progress?.attempts ?? drill.attempts,
      best: progress?.bestScore ?? drill.best,
      started: progress?.started ?? false,
      completed: progress?.completed ?? false,
      lastResult: progress?.lastResult ?? null,
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
    <div class="card tutorial-cta-card">
      <div class="tutorial-cta-body">
        <strong>${tutorialDone ? 'Interactive Tutorial' : 'New here?'}</strong>
        <span>${tutorialDone ? 'Replay the 3-min interactive tutorial anytime.' : 'Learn attack &amp; defense in 3 minutes.'}</span>
      </div>
      <button class="btn ${tutorialDone ? '' : 'primary'}" type="button" data-action="tutorial">
        ${tutorialDone ? 'Replay Tutorial' : '▶ Play Tutorial'}
      </button>
    </div>
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

function dailyBonusMarkup(state) {
  const dailyBonus = state.dailyBonus ?? DEFAULT_APP_STATE.dailyBonus;
  const bonusAvail = dailyBonus.available !== false;

  const today = new Date().toDateString();
  const interclubAvail = (state.interclubLastDate ?? '') !== today;

  return `
    <div class="daily-actions-group">
      <div class="daily-bonus ${bonusAvail ? 'available' : 'used'}" data-daily-bonus-status="${bonusAvail ? 'available' : 'used'}">
        <span></span> Daily Bonus · ${bonusAvail ? `${dailyBonus.multiplier ?? 2}× XP ready` : 'used today'}
      </div>
      <button
        class="btn interclub-btn ${interclubAvail ? 'available' : 'used'}"
        type="button"
        data-interclub
        ${!interclubAvail ? 'disabled' : ''}
        title="1 match par jour contre un duo de classement supérieur. Peu à perdre, beaucoup à gagner !"
      >
        ${interclubAvail ? '⚡ Interclubs' : '✓ Interclubs joué'}
      </button>
    </div>`;
}

function leaderboardSessionRow(session, index, profile) {
  const delta = session.ratingDelta ?? 0;
  const acc = session.accuracy ?? (session.totalTurns > 0 ? Math.round((session.correct / session.totalTurns) * 100) : 0);
  const weekDelta = session.weekDelta ?? null;
  return `
    <article class="standings-row">
      <span class="rank-cell">#${index + 1}</span>
      <span class="player-cell">
        <span class="player-avatar">${playerInitials(profile.name)}</span>
        <span>
          <strong>${escapeHtml(session.matchId ?? 'Training rally')}</strong>
          <small>${escapeHtml(session.workshop ?? '')} · ${new Date(session.completedAt).toLocaleDateString()}</small>
        </span>
      </span>
      <span class="tier">${session.result ?? '—'}</span>
      <span class="wins">${session.score}</span>
      <span class="wr">${acc}%</span>
      <span class="xp ${delta > 0 ? 'positive' : delta < 0 ? 'negative' : ''}">${delta > 0 ? '+' : ''}${delta}</span>
      <span class="weekly-delta ${weekDelta === null ? 'na' : weekDelta > 0 ? 'positive' : weekDelta < 0 ? 'negative' : ''}">${weekDelta === null ? '—' : (weekDelta > 0 ? '+' : '') + weekDelta}</span>
    </article>`;
}

function renderLeaderboardPage(state) {
  const activeTab = state.preferences.leaderboardTab ?? 'rating';
  const profile = getProfile(state);
  const leaderboard = state.leaderboard ?? { summary: { sessionsPlayed: 0, bestScore: 0, averageScore: 0 }, sessions: [] };
  const allSessions = leaderboard.sessions ?? [];
  const summary = leaderboard.summary ?? {};

  const placementSessions = allSessions.filter(s => s.workshop === 'defense' || s.workshop === 'placement');
  const tacticalSessions  = allSessions.filter(s => s.workshop === 'attack'  || s.workshop === 'tactic');

  const sessions =
    activeTab === 'placement' ? placementSessions :
    activeTab === 'tactical'  ? tacticalSessions  :
    allSessions;

  const headLabel =
    activeTab === 'placement' ? 'PLACEMENT' :
    activeTab === 'tactical'  ? 'TACTICAL'  :
    'RATING Δ';

  return `
    ${pageTitleMarkup({
      eyebrow: 'PERSONAL STANDINGS',
      title: 'Leaderboard',
    })}
    <div class="lb-tabs" role="tablist" aria-label="Leaderboard type">
      <button class="lb-tab ${activeTab === 'rating'    ? 'active' : ''}" type="button" data-lb-tab="rating">⭐ Rating FFBAD</button>
      <button class="lb-tab ${activeTab === 'placement' ? 'active' : ''}" type="button" data-lb-tab="placement">📍 Placement</button>
      <button class="lb-tab ${activeTab === 'tactical'  ? 'active' : ''}" type="button" data-lb-tab="tactical">🎯 Tactic</button>
    </div>
    <div class="personal-rank-grid">
      <article class="personal-rank-card card">
        <span class="stat-label">PLAYER</span>
        <strong>${escapeHtml(profile.name)}</strong>
        <span class="stat-hint">${flagBadge(profile.country)} ${rankBadge(profile.rank)} · ${profile.rating ?? 600} pts</span>
      </article>
      <article class="personal-rank-card card">
        <span class="stat-label">RECORD</span>
        <strong>${profile.wins ?? 0}-${profile.losses ?? 0}</strong>
        <span class="stat-hint">${profile.winRate ?? 0}% win rate</span>
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
        <span class="tier">RESULT</span>
        <span class="wins">SCORE</span>
        <span class="wr">PREV.</span>
        <span class="xp">${headLabel}</span>
        <span class="weekly-delta">WEEKLY</span>
      </div>
      ${sessions.length
        ? sessions.map((s, i) => leaderboardSessionRow(s, i, profile)).join('')
        : '<p class="season-note">NO SESSIONS · PLAY A DRILL TO FILL THIS TABLE</p>'}
    </div>`;
}

function renderSettingsPage(state) {
  const profile = getProfile(state);
  const initials = playerInitials(profile.name);
  const isLeftHanded = (profile.racketHand ?? 'right') === 'left';
  const email = escapeHtml(state.account?.email ?? state.user?.email ?? 'local player');

  return `
    ${pageTitleMarkup({ eyebrow: 'YOUR PREFERENCES', title: 'Settings' })}
    <div class="settings-grid">

      <!-- ── Profile ──────────────────────────────────────────────────── -->
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
              <select class="settings-input country-select" name="country">
                ${countryOptionsMarkup(profile.country)}
              </select>
            </label>
            <div class="rank-display-row">
              <span class="rank-display-label">Classement</span>
              <span class="rank-display-value">
                ${rankBadge(profile.rank)}
                <span class="rank-display-pts">${profile.rating ?? 600} pts FFBAD</span>
              </span>
            </div>
            <label class="toggle-label">
              <span>I am left-handed</span>
              <button
                class="hand-toggle ${isLeftHanded ? 'active' : ''}"
                type="button"
                data-hand-toggle
                aria-pressed="${isLeftHanded}"
                title="Ta raquette sera affichée du bon côté sur le terrain"
              >
                <span class="hand-toggle-knob"></span>
              </button>
            </label>
            <button class="btn primary save-profile" type="button" disabled>Save profile</button>
          </div>
        </div>
      </section>

      <!-- ── Account ──────────────────────────────────────────────────── -->
      <section class="settings-card card account-card">
        <div class="settings-card-head">
          <span class="settings-accent blue"></span>
          <h2>Account</h2>
        </div>
        <div class="account-list">
          <div><span>Email</span><strong>${email}</strong></div>
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

      <!-- ── Performance Stats ─────────────────────────────────────────── -->
      <section class="settings-card card perf-card">
        <div class="settings-card-head">
          <span class="settings-accent amber"></span>
          <h2>Performance</h2>
        </div>
        <div class="account-list">
          <div><span>Level</span><strong>Level ${profile.level} · ${profile.xp.toLocaleString()} / ${profile.xpMax.toLocaleString()} XP</strong></div>
          <div><span>Peak rating</span><strong>${profile.peakRating ?? profile.rating ?? 600} pts</strong></div>
          <div><span>Record</span><strong>${profile.wins ?? 0}W · ${profile.losses ?? 0}L · ${profile.winRate ?? 0}% WR</strong></div>
          <div><span>Training</span><strong>${profile.trained} total</strong></div>
          <div><span>Win streak</span><strong>${profile.streak} · best ${profile.bestStreak}</strong></div>
        </div>
      </section>

      <!-- ── Controls ──────────────────────────────────────────────────── -->
      <section class="settings-card card keybind-card">
        <div class="settings-card-head">
          <span class="settings-accent red"></span>
          <h2>Controls</h2>
        </div>
        <div class="keybind-grid">
          ${state.controls.map(bind => `
            <div class="keybind-row">
              <span>${escapeHtml(bind.action)}</span>
              <kbd class="rebindable" data-action="${escapeHtml(bind.action)}" tabindex="0">${escapeHtml(bind.key)}</kbd>
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
          <select class="settings-input country-select" name="country">
            ${countryOptionsMarkup('FR')}
          </select>
        </label>
        <button class="btn primary block" type="submit">Create</button>
      </form>
    </div>`;
}

// ─── Rating history modal ─────────────────────────────────────────────────────

const RATING_RANKS = Object.entries(RATING_THRESHOLDS)
  .sort((a, b) => a[1] - b[1]); // [ ['P12', 0], ['P11', 660], … ]

const RATING_MIN = 0;
const RATING_MAX = RATING_RANKS[RATING_RANKS.length - 1][1] + 120; // a bit above N1

function ratingHistoryModalMarkup(state) {
  const profile = getProfile(state);
  const sessions = (state.leaderboard?.sessions ?? []).slice().reverse(); // oldest first
  const baseRating = profile.rating ?? 600;

  // Build cumulative rating history from deltas (sessions are newest-first, we reversed)
  const history = [];
  let running = baseRating;
  // Walk backwards to reconstruct the start rating
  const reversedDeltas = sessions.map(s => s.ratingDelta ?? 0);
  const startRating = Math.max(RATING_MIN, reversedDeltas.reduce((acc, d) => acc - d, running));
  running = startRating;
  history.push({ label: 'Start', rating: running });
  for (const session of sessions) {
    running = Math.max(RATING_MIN, Math.min(RATING_MAX, running + (session.ratingDelta ?? 0)));
    history.push({ label: new Date(session.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), rating: running });
  }

  // Compute next rank / fallback rank
  const currentRating = profile.rating ?? 600;
  const sortedRanks = RATING_RANKS;
  let nextRankEntry = null;
  let prevRankEntry = null;
  for (let i = 0; i < sortedRanks.length; i++) {
    if (sortedRanks[i][1] > currentRating) { nextRankEntry = sortedRanks[i]; break; }
    prevRankEntry = sortedRanks[i];
  }
  const ptsToNext  = nextRankEntry  ? nextRankEntry[1]  - currentRating : null;
  const ptsAbovePrev = prevRankEntry ? currentRating - prevRankEntry[1] : null;

  // SVG chart dimensions
  const W = 560, H = 200, padL = 44, padR = 16, padT = 12, padB = 24;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const n = history.length;
  const xScale = n > 1 ? chartW / (n - 1) : chartW;
  const yScale = (v) => padT + chartH - ((Math.min(v, RATING_MAX) - RATING_MIN) / (RATING_MAX - RATING_MIN)) * chartH;

  const points = history.map((p, i) => `${padL + i * xScale},${yScale(p.rating)}`).join(' ');

  // Threshold lines
  const thresholdLines = RATING_RANKS.map(([rank, pts]) => {
    const y = yScale(pts);
    if (y < padT - 2 || y > padT + chartH + 2) return '';
    const color = rankColor(rank);
    return `
      <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${color}" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>
      <text x="${padL - 4}" y="${y + 4}" text-anchor="end" font-size="9" fill="${color}" font-family="JetBrains Mono, monospace">${rank}</text>`;
  }).join('');

  // Data path
  const pathD = history.length > 1
    ? `M ${history.map((p, i) => `${padL + i * xScale} ${yScale(p.rating)}`).join(' L ')}`
    : '';

  return `
    <div class="rating-modal-overlay" id="rating-modal">
      <div class="rating-modal-card card">
        <div class="rating-modal-head">
          <span>
            ${rankBadge(profile.rank)}
            <strong>${currentRating} pts FFBAD</strong>
          </span>
          <button class="rating-modal-close" type="button" aria-label="Close">✕</button>
        </div>

        <svg class="rating-chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
          ${thresholdLines}
          ${pathD ? `<polyline points="${points}" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linejoin="round"/>` : ''}
          ${history.map((p, i) => `<circle cx="${padL + i * xScale}" cy="${yScale(p.rating)}" r="3" fill="#60a5fa"/>`).join('')}
        </svg>

        <div class="rating-delta-row">
          ${nextRankEntry ? `
            <div class="rating-delta-card positive">
              <span class="delta-label">Until ${nextRankEntry[0]}</span>
              <strong>+${ptsToNext} pts</strong>
            </div>` : `
            <div class="rating-delta-card positive">
              <span class="delta-label">Top rank</span>
              <strong>N1 ★</strong>
            </div>`}
          ${prevRankEntry ? `
            <div class="rating-delta-card negative">
              <span class="delta-label">Above${prevRankEntry[0]}</span>
              <strong>+${ptsAbovePrev} pts</strong>
            </div>` : `
            <div class="rating-delta-card negative">
              <span class="delta-label">Lowest rank</span>
              <strong>P12</strong>
            </div>`}
        </div>
      </div>
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
          <div class="player-pill" data-player-pill aria-label="Profil joueur" style="--avatar-color:${profile.avatarColor}">
            <span class="player-avatar" data-player-initials>${initials}</span>
            <span class="player-rank-group">
              <span class="player-rank" data-player-rank style="color:${rankColor(profile.rank)}">${escapeHtml(profile.rank.toUpperCase())} · ${profile.rating ?? 600} pts</span>
              <span class="player-name" data-player-name>${escapeHtml(profile.name)}</span>
            </span>
            <span class="player-level-group">
              <span class="level-tag">LVL</span>
              <strong data-player-level>${profile.level}</strong>
            </span>
          </div>
        </header>
        <div class="rally-credits">
          <span>Di FRAJA Nathan &amp; Axel PREMIER</span>
          <span class="rally-credits-sep">·</span>
          <span>GameLab CS 2025 – 2026</span>
        </div>

        <main class="rally-main">
          <section class="rally-page active" data-panel="home">
            <div class="stats-strip">
              ${this._homeStatsMarkup(profile, this._state)}
            </div>
            <div class="page-title-row">
              <div>
                <p class="page-eyebrow">▸ CHOOSE YOUR COURT</p>
                <h1 data-home-greeting>Ready to play, ${escapeHtml(firstName)}?</h1>
              </div>
              ${dailyBonusMarkup(this._state)}
            </div>
            <div class="mode-grid">
              ${MODES.map(mode => `
                <article class="mode-card${mode.wip ? ' mode--wip' : ''}" data-mode="${mode.id}" style="--mode-color:${mode.color}">
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
                      ${mode.wip ? '<span class="mode-wip-badge">In development</span>' : ''}
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
                        <span><small>YOUR ${mode.statLabel.toUpperCase()}</small><strong data-mode-stat="${mode.id}">—</strong></span>
                        <span><small>REWARDS</small><strong>${mode.rewards}</strong></span>
                      </div>
                      <div class="mode-actions">
                        <button class="btn block mode-back" type="button">← Back</button>
                        <button class="btn primary mode-start" type="button" data-available="${mode.available ? 'true' : 'false'}">${mode.available ? 'Start ▸' : 'Preview'}</button>
                      </div>
                    </div>
                    <div class="mode-footer">
                      <span>${mode.rewards}</span>
                      <span>${mode.wip ? 'Coming soon' : mode.available ? 'Tap to view' : 'Preview'} <b>→</b></span>
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

    // Delegated listener catches the tutorial button wherever it lives (Drills panel)
    menu.addEventListener('click', e => {
      if (e.target.closest('[data-action="tutorial"]')) {
        this._emit('tutorial:start');
      }
    });

    menu.querySelectorAll('.mode-card').forEach(card => {
      card.addEventListener('click', event => {
        if (card.classList.contains('mode--wip')) return;
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
          this._showFeedback(menu, 'This mode is locked for now.');
          return;
        }
        if (mode === 'attack' || mode === 'defense' || mode === 'match') {
          this._emit('workshop:select', { workshop: mode });
        }
      });
    });

    menu.querySelector('[data-player-rank]')?.addEventListener('click', () => {
      this._showRatingHistory();
    });

    this._wireDrills(menu);

    this._wireInterclub(menu);

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
              <span class="workshop-title">${escapeHtml(mode.title)}</span>
              <span class="workshop-desc">${escapeHtml(mode.tagline)}</span>
            </button>
          `).join('')}
        </div>
        <button id="btn-back-menu" class="btn" type="button">← Back</button>
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
        menuBtn.className = 'btn-rally';
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
    this._renderModeStats(menu, this._state);
    this._renderDrillsPanel(menu);
    this._wireDrills(menu);
    this._renderLeaderboardPanel(menu);
    this._wireLeaderboard(menu);
    this._renderSettingsPanel(menu);
    this._wireSettingsAfterRender(menu);
    if (this._currentScreen === 'auth') this.show('menu');
    setTimeout(() => this._showWelcomeModal(), 500);
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
      this._showFeedback(auth, 'Login failed. Check your email and password.', 'error');
      return;
    }
    await this._acceptAuthPayload(payload);
  }

  async _submitSignup(auth, form) {
    const formData = new FormData(form);
    if (formData.get('password') !== formData.get('confirmPassword')) {
      this._showFeedback(auth, 'Passwords do not match.', 'error');
      return;
    }
    const payload = await signupAsync({
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
      country: formData.get('country'),
    });
    if (!payload?.state) {
      this._showFeedback(auth, 'Account creation failed. Use a unique email and a password of at least 6 characters.', 'error');
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
    this._renderModeStats(menu, this._state);
    this._renderDrillsPanel(menu);
    this._wireDrills(menu);
    this._renderLeaderboardPanel(menu);
    this._wireLeaderboard(menu);
    this._renderSettingsPanel(menu);
    this._wireSettingsAfterRender(menu);
    this.show('menu');
    setTimeout(() => this._showWelcomeModal(), 500);
  }

  _homeStatsMarkup(profile, state) {
    return homeStats(profile, state).map(stat => `
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
    if (stats) stats.innerHTML = this._homeStatsMarkup(getProfile(this._state), this._state);
  }

  _renderModeStats(menu, state) {
    const sessions = state?.leaderboard?.sessions ?? [];
    menu.querySelectorAll('[data-mode-stat]').forEach(el => {
      const val = computeModeStat(el.dataset.modeStat, sessions);
      el.textContent = val !== null ? `${val}%` : '—';
    });
  }

  refreshStats(state) {
    if (state) this._state = state;
    const menu = this._screens.menu;
    if (menu) {
      this._renderHomeStats(menu);
      this._renderModeStats(menu, this._state);
    }
  }

  _applyDrillFilter(menu, category) {
    menu.querySelectorAll('.drill-card').forEach(card => {
      card.hidden = category !== 'All' && card.dataset.category !== category;
    });
  }

  _showWelcomeModal() {
    if (localStorage.getItem('rally.tutorialDone')) return;
    if (document.getElementById('welcome-modal-overlay')) return; // already open

    const overlay = document.createElement('div');
    overlay.id = 'welcome-modal-overlay';
    overlay.className = 'pause-overlay';
    overlay.style.zIndex = '200';

    overlay.innerHTML = `
      <div class="pause-card" style="text-align:left">
        <p class="pause-eyebrow">WELCOME TO RALLY</p>
        <h2 class="pause-title">First time here?</h2>
        <p class="pause-hint">The interactive tutorial walks you through the two core mechanics — attack and defense — in about 3 minutes.</p>
        <div class="pause-actions">
          <button class="btn-rally btn-rally-primary" type="button" id="welcome-play-tut">Play Tutorial ▸</button>
          <button class="btn-rally" type="button" id="welcome-skip-tut">Not now</button>
        </div>
      </div>
    `;

    overlay.querySelector('#welcome-play-tut').addEventListener('click', () => {
      overlay.remove();
      this._emit('tutorial:start');
    });
    overlay.querySelector('#welcome-skip-tut').addEventListener('click', () => {
      overlay.remove();
    });

    document.getElementById('app').appendChild(overlay);
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
          this._showFeedback(menu, `${drill?.title ?? 'This drill'} is locked for now. Keep playing the available workshops to unlock it.`);
          return;
        }
        if (card.dataset.playable === 'true' && (workshop === 'attack' || workshop === 'defense')) {
          this._state = await recordDrillStartAsync(card.dataset.drill);
          this._emit('workshop:select', { workshop });
          return;
        }
        this._showFeedback(menu, 'This drill is not playable yet.');
      });
    });
  }

  _showRatingHistory() {
    document.getElementById('rating-modal')?.remove();
    const div = document.createElement('div');
    div.innerHTML = ratingHistoryModalMarkup(this._state);
    const modal = div.firstElementChild;
    document.body.appendChild(modal);
    modal.querySelector('.rating-modal-close')?.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  _wireInterclub(menu) {
    menu.querySelector('[data-interclub]')?.addEventListener('click', async () => {
      const today = new Date().toDateString();
      if ((this._state.interclubLastDate ?? '') === today) return;
      this._state = await saveAppStateAsync({ interclubLastDate: today });
      // Re-render the daily bonus section so the button becomes "used"
      const dailyBonus = menu.querySelector('.daily-actions-group');
      if (dailyBonus) dailyBonus.outerHTML = dailyBonusMarkup(this._state);
      this._wireInterclub(menu);
      // Launch interclub match (higher-ranked opponent, asymmetric ELO)
      this._emit('workshop:select', { workshop: 'match', interclub: true });
    });
  }

  _renderLeaderboardPanel(menu) {
    const panel = menu.querySelector('[data-panel="leaderboard"]');
    if (panel) panel.innerHTML = renderLeaderboardPage(this._state);
  }

  _wireLeaderboard(menu) {
    menu.querySelectorAll('.lb-tab').forEach(button => {
      button.addEventListener('click', async () => {
        this._state = await saveAppStateAsync({ preferences: { leaderboardTab: button.dataset.lbTab } });
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
        this._applyAvatarColor(menu, button.dataset.avatarColor);
        menu.querySelectorAll('.avatar-swatch').forEach(swatch => swatch.classList.toggle('active', swatch === button));
        menu.querySelector('.profile-card')?.setAttribute('data-avatar-color', button.dataset.avatarColor);
        this._markProfileDirty(menu);
      });
    });

    menu.querySelectorAll('.profile-fields input[name], .profile-fields select[name]').forEach(input => {
      input.addEventListener('input', () => this._markProfileDirty(menu));
      input.addEventListener('change', () => this._markProfileDirty(menu));
    });

    menu.querySelector('[data-hand-toggle]')?.addEventListener('click', async button => {
      const el = button.currentTarget;
      const nowLeft = el.getAttribute('aria-pressed') !== 'true';
      el.setAttribute('aria-pressed', String(nowLeft));
      el.classList.toggle('active', nowLeft);
      this._state = await saveAppStateAsync({ profile: { racketHand: nowLeft ? 'left' : 'right' } });
    });

    // ── Key rebinding ──────────────────────────────────────────────────
    let rebindTarget = null;
    menu.querySelectorAll('.rebindable').forEach(kbd => {
      kbd.addEventListener('click', () => {
        if (rebindTarget) rebindTarget.classList.remove('rebinding');
        rebindTarget = kbd;
        kbd.classList.add('rebinding');
        kbd.textContent = '…';
      });
      kbd.addEventListener('keydown', e => {
        e.preventDefault();
        if (rebindTarget === kbd && e.key !== 'Escape') {
          kbd.textContent = e.key;
          kbd.classList.remove('rebinding');
          rebindTarget = null;
          const action = kbd.dataset.action;
          const updated = (this._state.controls ?? []).map(b =>
            b.action === action ? { ...b, key: e.key } : b
          );
          void saveAppStateAsync({ controls: updated }).then(s => { this._state = s; });
        } else if (e.key === 'Escape') {
          const action = kbd.dataset.action;
          kbd.textContent = (this._state.controls ?? []).find(b => b.action === action)?.key ?? '?';
          kbd.classList.remove('rebinding');
          rebindTarget = null;
        }
      });
    });

    document.addEventListener('keydown', e => {
      if (!rebindTarget) return;
      if (e.key === 'Escape') {
        const action = rebindTarget.dataset.action;
        rebindTarget.textContent = (this._state.controls ?? []).find(b => b.action === action)?.key ?? '?';
        rebindTarget.classList.remove('rebinding');
        rebindTarget = null;
        return;
      }
      rebindTarget.textContent = e.key;
      rebindTarget.classList.remove('rebinding');
      const action = rebindTarget.dataset.action;
      rebindTarget = null;
      const updated = (this._state.controls ?? []).map(b =>
        b.action === action ? { ...b, key: e.key } : b
      );
      void saveAppStateAsync({ controls: updated }).then(s => { this._state = s; });
    }, { once: false });

    menu.querySelector('.save-profile')?.addEventListener('click', () => {
      void this._saveProfileFromDom(menu);
    });

    menu.querySelector('.change-password')?.addEventListener('click', async () => {
      const currentPassword = menu.querySelector('input[name="currentPassword"]')?.value ?? '';
      const newPassword = menu.querySelector('input[name="newPassword"]')?.value ?? '';
      const ok = await changePasswordAsync({ currentPassword, newPassword });
      this._showFeedback(menu, ok ? 'Password updated.' : 'Current password is invalid or the new password is too short.', ok ? 'success' : 'error');
    });

    menu.querySelector('.signout-account')?.addEventListener('click', async () => {
      const ok = await logoutAsync();
      if (!ok) {
        this._showFeedback(menu, 'Sign out is unavailable right now.', 'error');
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
      this._showFeedback(menu, 'Progression reset.', 'success');
    });

    menu.querySelector('.reset-controls')?.addEventListener('click', async () => {
      this._state = await resetControlsAsync();
      this._renderSettingsPanel(menu);
      this._wireSettingsAfterRender(menu);
      this._showFeedback(menu, 'Controls restored.', 'success');
    });
  }

  async _saveProfileFromDom(menu) {
    const nameInput = menu.querySelector('.profile-fields input[name="name"]');
    const countryInput = menu.querySelector('.profile-fields select[name="country"]');
    const nextName = nameInput?.value.trim() || PLAYER.name;
    const nextCountry = (countryInput?.value || PLAYER.country).slice(0, 2).toUpperCase();
    const avatarColor = menu.querySelector('.profile-card')?.getAttribute('data-avatar-color') ?? this._state.profile.avatarColor;
    this._state = await saveAppStateAsync({ profile: { name: nextName, country: nextCountry, avatarColor } });
    this._syncProfileDom(menu);
    this._renderHomeStats(menu);
    this._renderLeaderboardPanel(menu);
    this._wireLeaderboard(menu);
    this._markProfileDirty(menu, false);
    this._showFeedback(menu, 'Profile saved.', 'success');
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
    const playerRank = menu.querySelector('[data-player-rank]');
    if (playerRank) {
      playerRank.textContent = `${profile.rank.toUpperCase()} · ${profile.rating ?? 600} pts`;
      playerRank.style.color = rankColor(profile.rank);
    }
    const playerLevel = menu.querySelector('[data-player-level]');
    if (playerLevel) playerLevel.textContent = profile.level;
    const greeting = menu.querySelector('[data-home-greeting]');
    if (greeting) greeting.textContent = `Ready to play, ${firstName}?`;
    this._applyAvatarColor(menu, profile.avatarColor);
    const dailyBonus = menu.querySelector('.daily-actions-group');
    if (dailyBonus) dailyBonus.outerHTML = dailyBonusMarkup(this._state);
  }

  _applyAvatarColor(menu, color) {
    menu.querySelectorAll('[data-player-pill], .settings-avatar').forEach(el => {
      el.style.setProperty('--avatar-color', color);
    });
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

    // Refresh drills panel when returning from exercise so the tutorial
    // button label (Play vs Replay) reflects the current localStorage state.
    if (screenId === 'menu' && this._currentScreen === 'exercise') {
      const menu = this._screens.menu;
      if (menu) {
        this._renderDrillsPanel(menu);
        this._wireDrills(menu);
      }
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
    document.getElementById('game-canvas')?.style.setProperty('visibility', 'hidden');
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
    setTimeout(() => {
      el.style.display = 'none';
      document.getElementById('game-canvas')?.style.setProperty('visibility', 'visible');
    }, 400);
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
