/**
 * mock-data.js — Hardcoded exercise data for prototype demo
 * Developer A · Rendering & UI
 *
 * Provides local fallback exercises matching the runtime loader contract.
 * The main app now prefers data/*.json via exercises.js and only falls back
 * to these in-memory scenarios if the JSON catalog is unavailable.
 */

// ─── Attack — Positioning ─────────────────────────────────────────────────────

const POS_ATK_001 = {
  id: 'POS_ATK_001',
  type: 'positioning',
  workshop: 'attack',
  scenario: { playedShotType: 'NET_DROP', isHitter: true },
  label: 'Positioning',
  text: 'Your partner (A2) just cross-smashed from the back-right court. Where should you position yourself to cover the return?',
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
  explanation: "Move toward the net to intercept B1's weak return. Your partner slides back toward the center.",
};

const POS_ATK_002 = {
  id: 'POS_ATK_002',
  type: 'positioning',
  workshop: 'attack',
  scenario: { playedShotType: 'SMASH', isHitter: false },
  label: 'Positioning',
  text: 'Opponent B2 cleared high to the back court. Your partner will hit from the back. Where do you position yourself?',
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
  explanation: 'Stay in mid-court to cover your half while your partner attacks from the back.',
};

const POS_ATK_003 = {
  id: 'POS_ATK_003',
  type: 'positioning',
  workshop: 'attack',
  scenario: { playedShotType: 'NET_DROP', isHitter: true },
  label: 'Positioning',
  text: 'Your partner just played a cross drive. You are in the middle of the court. Move up to the net to attack!',
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
  explanation: "Move up to the right side of the net to intercept B1's cross-court counterattack.",
};

const POS_ATK_004 = {
  id: 'POS_ATK_004',
  type: 'positioning',
  workshop: 'attack',
  scenario: { playedShotType: 'DROP', isHitter: false },
  label: 'Positioning',
  text: 'Your partner played a net drop. B1 is under pressure. Position yourself to finish the point!',
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
  explanation: "Stay slightly offset in mid-court, ready to smash B1's lifted return. Your partner holds the net.",
};

// ─── Attack — Shot ────────────────────────────────────────────────────────────

const SHOT_ATK_001 = {
  id: 'SHOT_ATK_001',
  type: 'shot',
  workshop: 'attack',
  scenario: { incomingShotType: 'NET_DROP' },
  label: 'Shot',
  text: 'The shuttle floats high in front of you at the net. B1 and B2 are defending side by side. Hit the gap!',
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
  explanation:  'The central gap between B1 and B2 is the optimal target. Neither player knows who should take the shuttle.',
};

const SHOT_ATK_002 = {
  id: 'SHOT_ATK_002',
  type: 'shot',
  workshop: 'attack',
  scenario: { incomingShotType: 'DRIVE' },
  passingScore: 55,
  label: 'Shot',
  text: 'B1 returned a straight drive. The shuttle is coming fast to your right. Counterattack deep!',
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
  explanation:  'Counter deep to the left to force B1 back and break their attacking shape.',
};

const SHOT_ATK_003 = {
  id: 'SHOT_ATK_003',
  type: 'shot',
  workshop: 'attack',
  scenario: { incomingShotType: 'CLEAR' },
  label: 'Shot',
  text: 'You are in the back-left court with a high shuttle. B2 is alone on the right. Smash into the open corner!',
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
  explanation:  'Cross smash deep to the right. B2 is too central and B1 is on the opposite side, so the right corner is open.',
};

// ─── Defense — Positioning ────────────────────────────────────────────────────

const POS_DEF_001 = {
  id: 'POS_DEF_001',
  type: 'positioning',
  workshop: 'defense',
  scenario: { playedShotType: 'SMASH', isHitter: false },
  label: 'Positioning',
  text: "B1 smashes from the opponent's back-left court. You are in mid-court. Move into a side-by-side defensive shape!",
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
  explanation: 'Side-by-side formation: drop back and cover your right half. Your partner takes the left.',
};

const POS_DEF_002 = {
  id: 'POS_DEF_002',
  type: 'positioning',
  workshop: 'defense',
  scenario: { playedShotType: 'CLEAR', isHitter: false },
  label: 'Positioning',
  text: 'After your defensive lift to the back-left court, B1 is about to attack. Reposition to defend your half!',
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
  explanation: "Slide toward the left mid-court to intercept B1's cross smash. Your partner covers the right.",
};

const POS_DEF_003 = {
  id: 'POS_DEF_003',
  type: 'positioning',
  workshop: 'defense',
  scenario: { playedShotType: 'KILL', isHitter: true },
  label: 'Positioning',
  text: 'B2 is at the net and plays a drop. You are too far forward. Drop back into a defensive position!',
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
  explanation: "Drop back toward mid-court so you have time to read the opponent's lift and defend properly.",
};

// ─── Defense — Shot ───────────────────────────────────────────────────────────

const SHOT_DEF_001 = {
  id: 'SHOT_DEF_001',
  type: 'shot',
  workshop: 'defense',
  scenario: { incomingShotType: 'SMASH' },
  label: 'Shot',
  text: 'B1 smashes hard at you. You are defending side by side. Clear deep to buy time!',
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
  explanation:  'Clear high and deep into the back court to escape pressure and reposition.',
};

const SHOT_DEF_002 = {
  id: 'SHOT_DEF_002',
  type: 'shot',
  workshop: 'defense',
  scenario: { incomingShotType: 'DRIVE' },
  passingScore: 60,
  label: 'Shot',
  text: 'B2 attacks from mid-court. The shuttle is coming to your left. Drive straight to counterattack!',
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
  explanation:  "Drive straight toward B1 to force them back and rebalance the opponents' formation.",
};

const SHOT_DEF_003 = {
  id: 'SHOT_DEF_003',
  type: 'shot',
  workshop: 'defense',
  scenario: { incomingShotType: 'KILL' },
  label: 'Shot',
  text: 'B1 is right on top of the net. Block cross-court at the net to escape the pressure!',
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
  explanation:  'A soft cross-court net block drops the shuttle near B2, who is far away, and B1 cannot intercept it.',
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
