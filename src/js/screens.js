/**
 * screens.js — Screen management via DOM overlays
 * Developer A · Rendering & UI
 *
 * Responsibilities:
 *  - Create and manage four game screens as DOM overlays over the canvas
 *  - Handle transitions (fade in/out via CSS opacity)
 *  - Emit simple events so main.js can wire navigation logic
 *
 * Screens:
 *  'menu'            — Title screen with "Commencer" button
 *  'workshop-select' — Choose attack or defense workshop
 *  'exercise'        — Active gameplay (no overlay, canvas is visible)
 *  'end-rally'       — Score summary with Rejouer / Menu buttons
 *
 * The canvas and HUD remain rendered beneath all overlays at all times.
 * Only 'menu' and 'workshop-select' need overlays; 'exercise' simply hides them.
 * 'end-rally' reuses the existing #end-screen element from index.html.
 */

/** SVG shuttlecock logo for the menu screen */
const SVG_LOGO = `
<svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="28" cy="42" r="8" stroke="currentColor" stroke-width="2.5"/>
  <line x1="28" y1="34" x2="28" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="28" y1="18" x2="18" y2="9"  stroke="currentColor" stroke-width="2"   stroke-linecap="round"/>
  <line x1="28" y1="18" x2="23" y2="7"  stroke="currentColor" stroke-width="2"   stroke-linecap="round"/>
  <line x1="28" y1="18" x2="28" y2="6"  stroke="currentColor" stroke-width="2"   stroke-linecap="round"/>
  <line x1="28" y1="18" x2="33" y2="7"  stroke="currentColor" stroke-width="2"   stroke-linecap="round"/>
  <line x1="28" y1="18" x2="38" y2="9"  stroke="currentColor" stroke-width="2"   stroke-linecap="round"/>
</svg>`;

/** SVG crossed-swords for Attack */
const SVG_ATTACK = `
<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M8 32L26 10M26 10H18M26 10V18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M11 25L8 28" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M32 8L14 30M14 30H22M14 30V22" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M29 15L32 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`;

/** SVG shield for Defense */
const SVG_DEFENSE = `
<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M20 6L8 11V21C8 27.6 13 33.4 20 35C27 33.4 32 27.6 32 21V11L20 6Z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M15 20L18 23L25 16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/** SVG back arrow for secondary button */
const SVG_BACK = `
<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

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
    // Menu screen
    const menu = this._createElement('screen-menu', `
      <div class="screen-content" style="display:flex;flex-direction:column;align-items:center;gap:20px;">
        <div class="screen-logo">${SVG_LOGO}</div>
        <h1>Badminton <span>Strategy</span></h1>
        <p class="screen-subtitle">Apprends le double en te positionnant et en frappant comme un pro.</p>
        <button id="btn-start" class="btn-primary">Commencer</button>
      </div>
    `);
    menu.querySelector('#btn-start').addEventListener('click', () => {
      this._emit('menu:start');
    });

    // Workshop select screen
    const workshop = this._createElement('screen-workshop', `
      <div class="screen-content" style="display:flex;flex-direction:column;align-items:center;gap:24px;">
        <h2>Choisis ton atelier</h2>
        <div class="workshop-cards">
          <button class="workshop-card" data-workshop="attack" aria-label="Atelier Attaque">
            <span class="workshop-icon">${SVG_ATTACK}</span>
            <span class="workshop-title">Attaque</span>
            <span class="workshop-desc">Rotation, smash, net kill</span>
          </button>
          <button class="workshop-card" data-workshop="defense" aria-label="Atelier Défense">
            <span class="workshop-icon">${SVG_DEFENSE}</span>
            <span class="workshop-title">Défense</span>
            <span class="workshop-desc">Side-by-side, lift, block</span>
          </button>
        </div>
        <button id="btn-back-menu" class="btn-secondary">${SVG_BACK} Retour</button>
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

    // End-rally: reuse existing #end-screen, add Menu button if missing
    const endScreen = document.getElementById('end-screen');
    if (endScreen) {
      if (!endScreen.querySelector('#end-menu-btn')) {
        const menuBtn = document.createElement('button');
        menuBtn.id = 'end-menu-btn';
        menuBtn.textContent = 'Menu';
        menuBtn.className = 'btn-secondary';
        endScreen.appendChild(menuBtn);
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
    // 'exercise' has no overlay element — handled specially in show()

    document.body.appendChild(menu);
    document.body.appendChild(workshop);
  }

  /**
   * Create a screen overlay div, add class screen-overlay, and return it.
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

  // ─── Screen transitions ────────────────────────────────────────────────────

  /**
   * Show the given screen and hide the current one.
   * @param {'menu'|'workshop-select'|'exercise'|'end-rally'} screenId
   */
  show(screenId) {
    if (this._currentScreen && this._currentScreen !== 'exercise') {
      const prev = this._screens[this._currentScreen];
      if (prev) this._hideEl(prev);
    }

    this._currentScreen = screenId;

    if (screenId === 'exercise') {
      return;
    }

    const el = this._screens[screenId];
    if (!el) {
      console.warn(`ScreenManager: unknown screen "${screenId}"`);
      return;
    }
    this._showEl(el);
  }

  /**
   * Fade-in an overlay element.
   * @param {HTMLElement} el
   */
  _showEl(el) {
    el.style.display = 'flex';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.add('active'));
    });
  }

  /**
   * Fade-out an overlay element, then set display:none after the transition.
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

  // ─── Event emitter ─────────────────────────────────────────────────────────

  /**
   * Register a callback for a named event.
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
