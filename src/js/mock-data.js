/**
 * mock-data.js — Hardcoded exercise data for prototype demo
 * Developer A · Rendering & UI
 *
 * Provides mock exercises imitating the JSON format that Developer B will
 * eventually load from data/positioning.json and data/shots.json.
 *
 * ── INTEGRATION POINT ────────────────────────────────────────────────────────
 * When Developer B's exercises.js is ready, replace the imports in main.js:
 *   import { MOCK_RALLIES } from './mock-data.js';
 * with the real exercise loader.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Attack — Positioning ─────────────────────────────────────────────────────

const POS_ATK_001 = {
  id: 'POS_ATK_001',
  type: 'positioning',
  workshop: 'attack',
  label: 'Placement',
  text: 'Ton partenaire (A2) vient de smasher en cross depuis le fond droit. Où dois-tu te positionner pour couvrir le retour ?',
  players: {
    ally1:     { x: 0.50, y: 0.65, label: 'YOU' },
    ally2:     { x: 0.70, y: 0.85, movingTo: { x: 0.60, y: 0.78 } },
    opponent1: { x: 0.25, y: 0.20, movingTo: { x: 0.30, y: 0.32 } },
    opponent2: { x: 0.70, y: 0.30, movingTo: { x: 0.65, y: 0.28 } },
  },
  shuttlecock: {
    position:   { x: 0.25, y: 0.15 },
    trajectory: [{ x: 0.70, y: 0.85 }, { x: 0.25, y: 0.15 }],
    speed: 'fast', height: 'low',
  },
  correctZones:    ['ally-front-center', 'ally-front-left'],
  optimalPosition: { x: 0.40, y: 0.56 },
  explanation: 'Avance vers le filet pour intercepter le retour faible de B1. Ton partenaire glisse vers le centre-arrière.',
};

const POS_ATK_002 = {
  id: 'POS_ATK_002',
  type: 'positioning',
  workshop: 'attack',
  label: 'Placement',
  text: "L'adversaire B2 a dégagé haut en fond de court. Ton partenaire va frapper depuis le fond. Où te places-tu ?",
  players: {
    ally1:     { x: 0.45, y: 0.55, label: 'YOU' },
    ally2:     { x: 0.50, y: 0.88, movingTo: { x: 0.50, y: 0.82 } },
    opponent1: { x: 0.35, y: 0.25, movingTo: { x: 0.30, y: 0.30 } },
    opponent2: { x: 0.65, y: 0.10, movingTo: { x: 0.60, y: 0.18 } },
  },
  shuttlecock: {
    position:   { x: 0.55, y: 0.10 },
    trajectory: [{ x: 0.65, y: 0.10 }, { x: 0.55, y: 0.10 }],
    speed: 'slow', height: 'high',
  },
  correctZones:    ['ally-mid-center', 'ally-mid-left', 'ally-mid-right'],
  optimalPosition: { x: 0.50, y: 0.70 },
  explanation: 'Reste en mi-terrain pour couvrir la moitié du court pendant que ton partenaire attaque depuis le fond.',
};

const POS_ATK_003 = {
  id: 'POS_ATK_003',
  type: 'positioning',
  workshop: 'attack',
  label: 'Placement',
  text: "Ton partenaire vient de driver en cross. Tu es au milieu du terrain. Monte vers le filet pour attaquer !",
  players: {
    ally1:     { x: 0.50, y: 0.72, label: 'YOU' },
    ally2:     { x: 0.30, y: 0.80, movingTo: { x: 0.35, y: 0.75 } },
    opponent1: { x: 0.70, y: 0.30 },
    opponent2: { x: 0.30, y: 0.22, movingTo: { x: 0.40, y: 0.28 } },
  },
  shuttlecock: {
    position:   { x: 0.70, y: 0.30 },
    trajectory: [{ x: 0.30, y: 0.80 }, { x: 0.70, y: 0.30 }],
    speed: 'fast', height: 'low',
  },
  correctZones:    ['ally-front-right', 'ally-front-center'],
  optimalPosition: { x: 0.65, y: 0.58 },
  explanation: 'Monte vers le filet côté droit pour intercepter la contre-attaque de B1 en cross.',
};

const POS_ATK_004 = {
  id: 'POS_ATK_004',
  type: 'positioning',
  workshop: 'attack',
  label: 'Placement',
  text: "Ton partenaire a joué un amorti au filet. B1 est en difficulté. Positionne-toi pour finir le point !",
  players: {
    ally1:     { x: 0.50, y: 0.68, label: 'YOU' },
    ally2:     { x: 0.50, y: 0.55, movingTo: { x: 0.45, y: 0.52 } },
    opponent1: { x: 0.45, y: 0.42, movingTo: { x: 0.45, y: 0.36 } },
    opponent2: { x: 0.55, y: 0.28 },
  },
  shuttlecock: {
    position:   { x: 0.45, y: 0.42 },
    trajectory: [{ x: 0.50, y: 0.55 }, { x: 0.45, y: 0.42 }],
    speed: 'slow', height: 'low',
  },
  correctZones:    ['ally-mid-center', 'ally-mid-left', 'ally-mid-right'],
  optimalPosition: { x: 0.55, y: 0.68 },
  explanation: "Reste en mi-terrain légèrement décalé, prêt à smasher le retour lift de B1. Ton partenaire garde le filet.",
};

// ─── Attack — Shot ────────────────────────────────────────────────────────────

const SHOT_ATK_001 = {
  id: 'SHOT_ATK_001',
  type: 'shot',
  workshop: 'attack',
  label: 'Tir',
  text: 'Le volant flotte haut devant toi au filet. B1 et B2 sont en défense côte à côte. Frappe dans le trou !',
  players: {
    ally1:     { x: 0.50, y: 0.55, label: 'YOU' },
    ally2:     { x: 0.50, y: 0.82 },
    opponent1: { x: 0.30, y: 0.25 },
    opponent2: { x: 0.70, y: 0.25 },
  },
  shuttlecock: {
    from:       { x: 0.50, y: 0.35 },
    position:   { x: 0.50, y: 0.52 },
    trajectory: [{ x: 0.50, y: 0.35 }, { x: 0.50, y: 0.52 }],
    speed: 'slow', height: 'high',
  },
  correctZones: ['opponent-front-center'],
  explanation:  'Le trou central entre B1 et B2 est la cible optimale — ni l\'un ni l\'autre ne sait qui prend le volant.',
};

const SHOT_ATK_002 = {
  id: 'SHOT_ATK_002',
  type: 'shot',
  workshop: 'attack',
  label: 'Tir',
  text: "B1 a renvoyé un drive en ligne. Le volant arrive vite sur ta droite. Contre-attaque en fond de court !",
  players: {
    ally1:     { x: 0.70, y: 0.60, label: 'YOU' },
    ally2:     { x: 0.30, y: 0.75 },
    opponent1: { x: 0.25, y: 0.25 },
    opponent2: { x: 0.65, y: 0.30 },
  },
  shuttlecock: {
    from:       { x: 0.65, y: 0.30 },
    position:   { x: 0.68, y: 0.58 },
    trajectory: [{ x: 0.65, y: 0.30 }, { x: 0.68, y: 0.58 }],
    speed: 'fast', height: 'normal',
  },
  correctZones: ['opponent-back-left', 'opponent-back-center'],
  explanation:  'Contre en fond de court à gauche pour forcer B1 à reculer et briser leur position offensive.',
};

const SHOT_ATK_003 = {
  id: 'SHOT_ATK_003',
  type: 'shot',
  workshop: 'attack',
  label: 'Tir',
  text: "Tu es en fond de court gauche avec le volant haut. B2 est seul côté droit. Smash vers le coin libre !",
  players: {
    ally1:     { x: 0.20, y: 0.82, label: 'YOU' },
    ally2:     { x: 0.55, y: 0.60 },
    opponent1: { x: 0.35, y: 0.18 },
    opponent2: { x: 0.65, y: 0.35 },
  },
  shuttlecock: {
    from:       { x: 0.35, y: 0.18 },
    position:   { x: 0.20, y: 0.82 },
    trajectory: [{ x: 0.35, y: 0.18 }, { x: 0.20, y: 0.82 }],
    speed: 'slow', height: 'high',
  },
  correctZones: ['opponent-back-right', 'opponent-mid-right'],
  explanation:  'Smash croisé vers le fond droit — B2 est trop centré et B1 est à l\'opposé, le coin droit est ouvert.',
};

// ─── Defense — Positioning ────────────────────────────────────────────────────

const POS_DEF_001 = {
  id: 'POS_DEF_001',
  type: 'positioning',
  workshop: 'defense',
  label: 'Placement',
  text: "B1 smash depuis le fond gauche adverse. Tu es au mi-terrain. Adopte la formation défensive côte à côte !",
  players: {
    ally1:     { x: 0.60, y: 0.68, label: 'YOU' },
    ally2:     { x: 0.40, y: 0.65, movingTo: { x: 0.30, y: 0.72 } },
    opponent1: { x: 0.25, y: 0.12, movingTo: { x: 0.30, y: 0.18 } },
    opponent2: { x: 0.60, y: 0.30 },
  },
  shuttlecock: {
    position:   { x: 0.60, y: 0.65 },
    trajectory: [{ x: 0.25, y: 0.12 }, { x: 0.60, y: 0.65 }],
    speed: 'fast', height: 'low',
  },
  correctZones:    ['ally-mid-right', 'ally-back-right'],
  optimalPosition: { x: 0.65, y: 0.72 },
  explanation: 'Formation côte à côte : recule vers le fond et couvre ta moitié droite. Ton partenaire prend la gauche.',
};

const POS_DEF_002 = {
  id: 'POS_DEF_002',
  type: 'positioning',
  workshop: 'defense',
  label: 'Placement',
  text: "Après ton lift défensif en fond gauche, B1 va attaquer. Repositionne-toi pour défendre ta moitié !",
  players: {
    ally1:     { x: 0.20, y: 0.88, label: 'YOU' },
    ally2:     { x: 0.70, y: 0.72, movingTo: { x: 0.65, y: 0.78 } },
    opponent1: { x: 0.40, y: 0.20, movingTo: { x: 0.35, y: 0.15 } },
    opponent2: { x: 0.70, y: 0.32 },
  },
  shuttlecock: {
    position:   { x: 0.40, y: 0.20 },
    trajectory: [{ x: 0.20, y: 0.88 }, { x: 0.40, y: 0.20 }],
    speed: 'medium', height: 'high',
  },
  correctZones:    ['ally-mid-left', 'ally-back-left'],
  optimalPosition: { x: 0.30, y: 0.75 },
  explanation: 'Glisse vers le mi-terrain gauche pour intercepter le smash croisé de B1. Ton partenaire couvre la droite.',
};

const POS_DEF_003 = {
  id: 'POS_DEF_003',
  type: 'positioning',
  workshop: 'defense',
  label: 'Placement',
  text: "B2 est au filet et joue un amorti. Tu es trop loin. Recule pour te repositionner défensivement !",
  players: {
    ally1:     { x: 0.50, y: 0.55, label: 'YOU' },
    ally2:     { x: 0.50, y: 0.80, movingTo: { x: 0.45, y: 0.78 } },
    opponent1: { x: 0.40, y: 0.38 },
    opponent2: { x: 0.55, y: 0.48, movingTo: { x: 0.50, y: 0.42 } },
  },
  shuttlecock: {
    position:   { x: 0.55, y: 0.52 },
    trajectory: [{ x: 0.55, y: 0.48 }, { x: 0.55, y: 0.52 }],
    speed: 'slow', height: 'low',
  },
  correctZones:    ['ally-mid-center', 'ally-mid-left', 'ally-mid-right'],
  optimalPosition: { x: 0.50, y: 0.68 },
  explanation: 'Recule vers le mi-terrain pour avoir le temps de voir le lift adverse et défendre correctement.',
};

// ─── Defense — Shot ───────────────────────────────────────────────────────────

const SHOT_DEF_001 = {
  id: 'SHOT_DEF_001',
  type: 'shot',
  workshop: 'defense',
  label: 'Tir',
  text: "B1 smash fort sur toi. Tu es en défense côte à côte. Dégage en fond de court pour reprendre le temps !",
  players: {
    ally1:     { x: 0.65, y: 0.75, label: 'YOU' },
    ally2:     { x: 0.30, y: 0.75 },
    opponent1: { x: 0.30, y: 0.15 },
    opponent2: { x: 0.65, y: 0.32 },
  },
  shuttlecock: {
    from:       { x: 0.30, y: 0.15 },
    position:   { x: 0.62, y: 0.72 },
    trajectory: [{ x: 0.30, y: 0.15 }, { x: 0.62, y: 0.72 }],
    speed: 'fast', height: 'low',
  },
  correctZones: ['opponent-back-left', 'opponent-back-center', 'opponent-back-right'],
  explanation:  'Dégage haut et profond dans le fond adverse pour sortir de la pression et te repositionner.',
};

const SHOT_DEF_002 = {
  id: 'SHOT_DEF_002',
  type: 'shot',
  workshop: 'defense',
  label: 'Tir',
  text: "B2 attaque depuis le mi-terrain. Le volant arrive sur ta gauche. Drive en ligne pour contre-attaquer !",
  players: {
    ally1:     { x: 0.25, y: 0.70, label: 'YOU' },
    ally2:     { x: 0.70, y: 0.70 },
    opponent1: { x: 0.25, y: 0.28 },
    opponent2: { x: 0.65, y: 0.38 },
  },
  shuttlecock: {
    from:       { x: 0.65, y: 0.38 },
    position:   { x: 0.28, y: 0.68 },
    trajectory: [{ x: 0.65, y: 0.38 }, { x: 0.28, y: 0.68 }],
    speed: 'medium', height: 'normal',
  },
  correctZones: ['opponent-mid-left', 'opponent-back-left'],
  explanation:  'Drive en ligne vers B1 pour le forcer à reculer et rééquilibrer la formation adverse.',
};

const SHOT_DEF_003 = {
  id: 'SHOT_DEF_003',
  type: 'shot',
  workshop: 'defense',
  label: 'Tir',
  text: "B1 est au filet à bout portant. Bloque au filet en cross pour contourner sa pression !",
  players: {
    ally1:     { x: 0.45, y: 0.58, label: 'YOU' },
    ally2:     { x: 0.60, y: 0.80 },
    opponent1: { x: 0.55, y: 0.42 },
    opponent2: { x: 0.30, y: 0.30 },
  },
  shuttlecock: {
    from:       { x: 0.55, y: 0.42 },
    position:   { x: 0.47, y: 0.55 },
    trajectory: [{ x: 0.55, y: 0.42 }, { x: 0.47, y: 0.55 }],
    speed: 'slow', height: 'low',
  },
  correctZones: ['opponent-front-left', 'opponent-front-center'],
  explanation:  'Bloc doux en cross au filet : le volant tombe côté B2 qui est loin, B1 ne peut pas intercepter.',
};

// ─── Rally sequences ──────────────────────────────────────────────────────────

/**
 * Each rally is an ordered array of turn objects ready for main.js to consume.
 * Format mirrors the former RALLY constant in index.html.
 */
export const MOCK_RALLIES = {
  attack: [
    POS_ATK_001,   // placement après smash partenaire
    SHOT_ATK_001,  // net kill dans le trou
    POS_ATK_002,   // placement après dégagement adverse
    SHOT_ATK_002,  // contre-attaque drive
  ],
  defense: [
    POS_DEF_001,   // formation côte à côte après smash
    SHOT_DEF_001,  // dégagement défensif
    POS_DEF_002,   // repositionnement après lift
    SHOT_DEF_002,  // drive en ligne
  ],
};

// All exercises flat, for future use by Developer B's exercise loader
export const MOCK_EXERCISES = [
  POS_ATK_001, POS_ATK_002, POS_ATK_003, POS_ATK_004,
  SHOT_ATK_001, SHOT_ATK_002, SHOT_ATK_003,
  POS_DEF_001, POS_DEF_002, POS_DEF_003,
  SHOT_DEF_001, SHOT_DEF_002, SHOT_DEF_003,
];
