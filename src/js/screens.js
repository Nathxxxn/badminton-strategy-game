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
            <div class="page-title-row"><div><p class="page-eyebrow">▸ TRAINING LIBRARY</p><h1>Drills</h1></div></div>
            <div class="info-grid">
              <article class="card"><h2>Attack drills</h2><p>Smash placement, deception and net kill routines start from Attack Training.</p></article>
              <article class="card"><h2>Defense drills</h2><p>Blocks, lifts and recovery routines start from Defense Training.</p></article>
            </div>
          </section>

          <section class="rally-page" data-panel="leaderboard">
            <div class="page-title-row"><div><p class="page-eyebrow">▸ GLOBAL STANDINGS</p><h1>Leaderboard</h1></div></div>
            <div class="leaderboard-card card"><strong>#287</strong><span>${PLAYER.name}</span><span>${PLAYER.rank}</span><span>${PLAYER.wins} W</span><span>${PLAYER.winRate}% WR</span></div>
          </section>

          <section class="rally-page" data-panel="settings">
            <div class="page-title-row"><div><p class="page-eyebrow">▸ YOUR PREFERENCES</p><h1>Settings</h1></div></div>
            <div class="info-grid">
              <article class="card"><h2>Profile</h2><p>Display name, country and avatar controls are presentation-only on this prototype screen.</p></article>
              <article class="card"><h2>Controls</h2><p>The current in-game controls remain handled by the existing canvas runtime.</p></article>
            </div>
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
      endScreen.classList.add('screen-overlay', 'screen-overlay--end');
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
