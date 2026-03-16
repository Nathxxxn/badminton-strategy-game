# Badminton Doubles Strategy Game

## Project Overview

Interactive web game teaching badminton doubles strategy. Players learn positioning and shot selection through progressive exercises, then apply everything in a match mode with RPG-like progression (XP, levels, rewards, bosses).

Two exercise types:
1. **Positioning exercises**: Choose where to move on the court to receive the next shot.
2. **Shot exercises**: The shuttlecock arrives, choose where and how to hit it (drag mechanic for power/spin).

Then a **Match Mode** chains both types into realistic rally sequences.

---

## Tech Stack

- Vanilla HTML / CSS / JavaScript (no frameworks)
- Canvas 2D API for all court rendering
- JSON files for scenario/exercise data
- No build tools — runs directly in browser via `index.html`
- Mobile-friendly (responsive canvas, touch support for drag)

---

## Team Responsibilities

### Developer A — Rendering & UI (graphics, canvas, interactions)
- Court drawing (proportional badminton doubles court, all lines)
- Player rendering (colored circles with labels, formation indicators)
- Shuttlecock rendering with trajectory trail
- Target zone highlighting (correct zones, click/tap markers)
- Drag mechanic for shot exercises (drag direction = aim, drag length = power)
- Spin/effect visual indicator during drag
- Animations: shuttlecock flight path, player movement arrows, feedback transitions
- HUD: score, level, XP bar, combo counter
- Screens: menu, exercise select, match mode, level complete, rewards, boss intro
- Responsive canvas scaling, device pixel ratio handling
- Touch support for mobile

### Developer B — Scenarios, Logic & Progression
- Exercise data model and JSON format
- Positioning exercise logic (evaluate player's chosen position)
- Shot exercise logic (evaluate aim zone, power, spin from drag input)
- Difficulty scaling per exercise type
- Match mode: rally chaining engine, turn sequencing
- XP system: earn XP per correct answer, scaling with difficulty and combo
- Level progression: XP thresholds, stat unlocks (precision, power)
- Reward system: badges, unlockable content
- Boss encounters: special scenarios with stricter evaluation
- Time pressure system for advanced levels
- Star rating per exercise set

---

## Architecture

```
badminton-strategy-game/
├── index.html                  # Entry point
├── CLAUDE.md                   # This file — project context
├── README.md                   # Player-facing documentation
├── .gitignore
│
├── src/
│   ├── css/
│   │   └── style.css           # All styles (dark theme, responsive)
│   │
│   └── js/
│       ├── main.js             # App init, global state, screen routing
│       │
│       ├── # --- RENDERING (Developer A) ---
│       ├── court.js            # Court drawing, proportions, scaling
│       ├── renderer.js         # Player, shuttlecock, trajectory rendering
│       ├── zones.js            # Zone definitions, zone highlighting, click markers
│       ├── drag.js             # Drag-to-shoot mechanic (direction, power, spin)
│       ├── animations.js       # Shuttlecock flight, movement arrows, transitions
│       ├── hud.js              # HUD: XP bar, score, level, combo counter
│       ├── screens.js          # Screen management (menu, exercise, match, rewards)
│       │
│       ├── # --- LOGIC (Developer B) ---
│       ├── exercises.js        # Exercise engine: load, filter, serve exercises
│       ├── evaluate.js         # Evaluate positioning + shot answers
│       ├── match.js            # Match mode: rally chaining, turn sequence
│       ├── progression.js      # XP, levels, stat unlocks, rewards
│       ├── difficulty.js       # Difficulty scaling, time pressure
│       └── boss.js             # Boss encounter logic
│
├── data/
│   ├── positioning.json        # All positioning exercises
│   ├── shots.json              # All shot exercises
│   ├── matches.json            # Match mode rally sequences
│   ├── bosses.json             # Boss encounter definitions
│   └── rewards.json            # Reward/badge definitions
│
└── assets/
    └── images/                 # Icons, badges, backgrounds
```

---

## Exercise Format — Positioning

The player knows:
- What shot their partner (or themselves) just played (smash, clear, drop)
- Where the shuttlecock is going (landing point on opponent's side)
- The speed/trajectory of that shot
- Where both opponents are positioned
- Where their partner is / is moving to

The player must: **click on the court to choose where to move** for optimal positioning to receive the likely return.

### Data format (positioning.json)

```json
{
  "id": "POS_ATK_001",
  "type": "positioning",
  "workshop": "attack",
  "difficulty": 1,
  "title": "Cover the net after partner's smash",
  "description": "Your partner (A2) smashes cross-court from the back-right. The shuttlecock lands deep on the opponent's left side. Opponent B1 is preparing to return. Where should you move?",
  "context": {
    "lastShot": {
      "player": "ally2",
      "type": "smash",
      "from": { "x": 0.7, "y": 0.85 },
      "to": { "x": 0.25, "y": 0.15 },
      "speed": "fast"
    }
  },
  "players": {
    "ally1": { "x": 0.5, "y": 0.65, "label": "YOU" },
    "ally2": { "x": 0.7, "y": 0.85, "movingTo": { "x": 0.6, "y": 0.78 } },
    "opponent1": { "x": 0.25, "y": 0.2 },
    "opponent2": { "x": 0.7, "y": 0.3 }
  },
  "shuttlecock": {
    "position": { "x": 0.25, "y": 0.15 },
    "trajectory": [
      { "x": 0.7, "y": 0.85 },
      { "x": 0.25, "y": 0.15 }
    ]
  },
  "correctZones": ["ally-front-center", "ally-front-left"],
  "optimalPosition": { "x": 0.4, "y": 0.56 },
  "explanation": "After your partner's smash, move toward the net to intercept any weak return. Position slightly to the left to cover the straight return from B1. Your partner slides center-back to cover lobs.",
  "concept": "attack-rotation"
}
```

### Fields explained
- `context.lastShot`: The shot that just happened. `player` is who hit it, `type` is smash/clear/drop/drive/net-shot, `from`/`to` are normalized positions, `speed` is slow/medium/fast.
- `players[].movingTo`: Optional — shows where a player is transitioning (rendered as a movement arrow).
- `shuttlecock.trajectory`: Array of points for the flight path animation.
- `correctZones`: Acceptable zones (generous evaluation).
- `optimalPosition`: The single best position (for scoring precision bonus).
- `concept`: Tag for grouping by strategic concept.

---

## Exercise Format — Shot

The player knows:
- The shuttlecock is arriving at their position
- Where both opponents are
- Where their partner is
- The incoming shot type and speed

The player must: **drag on the court to aim their shot**. Drag direction = where to aim. Drag length = power. Drag curve/angle = spin/effect.

### Data format (shots.json)

```json
{
  "id": "SHOT_ATK_001",
  "type": "shot",
  "workshop": "attack",
  "difficulty": 1,
  "title": "Net kill to the gap",
  "description": "You're at the net. A weak return floats above the net toward you. Both opponents are in side-by-side defense. Where do you hit?",
  "context": {
    "incomingShot": {
      "type": "net-return",
      "from": { "x": 0.5, "y": 0.35 },
      "to": { "x": 0.5, "y": 0.52 },
      "speed": "slow",
      "height": "high"
    }
  },
  "players": {
    "ally1": { "x": 0.5, "y": 0.55, "label": "YOU" },
    "ally2": { "x": 0.5, "y": 0.82 },
    "opponent1": { "x": 0.3, "y": 0.25 },
    "opponent2": { "x": 0.7, "y": 0.25 }
  },
  "shuttlecock": {
    "position": { "x": 0.5, "y": 0.52 },
    "trajectory": [
      { "x": 0.5, "y": 0.35 },
      { "x": 0.5, "y": 0.52 }
    ]
  },
  "correctTargets": [
    {
      "zone": "opponent-front-center",
      "idealPoint": { "x": 0.5, "y": 0.38 },
      "idealPower": "high",
      "idealSpin": "none",
      "points": 100,
      "explanation": "Smash it down the center gap. Neither defender is sure who takes it."
    },
    {
      "zone": "opponent-front-left",
      "idealPoint": { "x": 0.2, "y": 0.38 },
      "idealPower": "medium",
      "idealSpin": "slight",
      "points": 70,
      "explanation": "Angled net kill to the left is good but the straight defender can reach it."
    }
  ],
  "wrongZoneExplanation": "Don't lift the shuttle when you have a high ball at the net. You'd give up your attacking advantage.",
  "concept": "shot-selection-attack"
}
```

### Drag mechanic input model
The drag produces three values that the evaluate module scores:
- `aimPoint: { x, y }` — normalized court position where the shot is aimed (direction of drag from shuttlecock position)
- `power: number` — 0.0 to 1.0, mapped from drag length (short drag = soft touch, long drag = full smash)
- `spin: number` — -1.0 to 1.0, derived from drag curvature (negative = slice left, positive = slice right, 0 = flat)

### Scoring for shot exercises
- Zone match: 50% of points
- Power accuracy (vs idealPower): 30% of points
- Spin accuracy (vs idealSpin): 20% of points
- Precision bonus: extra points if aimPoint is close to idealPoint

---

## Match Mode

Chains positioning and shot exercises into a continuous rally. Each turn the player either positions or shoots based on the game state.

### Data format (matches.json)

```json
{
  "id": "MATCH_001",
  "title": "Friendly Match — Side A",
  "difficulty": 3,
  "isBoss": false,
  "rally": [
    {
      "turn": 1,
      "type": "shot",
      "exerciseRef": "SHOT_ATK_001"
    },
    {
      "turn": 2,
      "type": "positioning",
      "exerciseRef": "POS_ATK_003"
    },
    {
      "turn": 3,
      "type": "shot",
      "exerciseRef": "SHOT_DEF_002"
    }
  ],
  "timePressure": {
    "enabled": false,
    "secondsPerTurn": null
  },
  "passingScore": 60,
  "rewards": {
    "xp": 150,
    "badge": null
  }
}
```

A rally ends when:
- All turns are completed (score evaluated)
- The player makes a critical error (e.g., hitting into the net = auto-fail that turn, rally continues with penalty)
- Time runs out on a turn (in time pressure mode)

---

## Progression System

### XP & Levels
- Every exercise awards XP based on: difficulty multiplier × score × combo bonus
- XP thresholds per level (e.g., Level 1: 0 XP, Level 2: 500 XP, Level 3: 1200 XP, ...)
- Leveling up unlocks new stat points

### Stats (unlocked via leveling)
- **Precision**: Increases the tolerance radius for correct zone detection (easier to score "optimal")
- **Power**: Unlocks more powerful shot types in match mode (allows smash when power is high enough)
- Each stat has a max level (e.g., 10). Player chooses where to allocate points on level-up.

### Combo System
- Consecutive correct answers build a combo (×2, ×3, ×4, max ×5)
- Missing an answer resets the combo
- Combo multiplier applies to XP earned

### Rewards
- Star rating per exercise set (1-3 stars based on % correct)
- Badges for milestones (e.g., "10 perfect scores", "50 combo streak", "Beat Boss 1")
- Unlockable content: new court skins, player colors, harder exercise packs

### Boss Encounters
- Special matches with stricter evaluation (smaller correct zones, tighter timing)
- Boss has a "pattern" the player must learn through the rally
- Defeating a boss unlocks the next workshop tier
- Boss intro screen with name and difficulty indicator

---

## Difficulty Scaling

### Workshop: Attack (exercises tagged `workshop: "attack"`)
- Difficulty 1: Basic formations. Obvious correct zone. Generous tolerance. No time limit.
- Difficulty 2: Read opponent positions. 2 valid zones but 1 optimal. Smaller tolerance.
- Difficulty 3: Partner is moving — account for rotation. Multiple concepts combined.
- Difficulty 4: Time pressure (countdown per exercise). Tight tolerance. Decoy zones.

### Workshop: Defense (exercises tagged `workshop: "defense"`)
- Same 4-tier structure but focused on defensive concepts (returning smashes, lifting to corners, side-by-side coverage, emergency recovery).

### Match Mode
- Difficulty 1-2: Short rallies (3-4 turns), no time pressure, generous scoring.
- Difficulty 3-4: Longer rallies (5-8 turns), optional time pressure, strict scoring.
- Difficulty 5+: Boss matches, full time pressure, very strict, pattern recognition required.

---

## Court & Zone System

### Court proportions
- Official badminton doubles court: 13.4m long × 6.1m wide
- Court displayed vertically on screen (length = canvas height)
- Ally team on the bottom half (y: 0.5 → 1.0), opponents on top (y: 0.0 → 0.5)

### Zone grid (18 zones total, 9 per half)
Each half is divided into a 3×3 grid:

```
           LEFT    CENTER    RIGHT
          (0-0.33) (0.33-0.67) (0.67-1.0)
  BACK   |  BL   |   BC    |   BR   |   (far from net)
  MID    |  ML   |   MC    |   MR   |
  FRONT  |  FL   |   FC    |   FR   |   (near net)
         ================================ NET
  FRONT  |  FL   |   FC    |   FR   |   (near net)
  MID    |  ML   |   MC    |   MR   |
  BACK   |  BL   |   BC    |   BR   |   (far from net)
```

Zone IDs follow the pattern: `{side}-{depth}-{lateral}`
- Side: `opponent` or `ally`
- Depth: `front`, `mid`, `back`
- Lateral: `left`, `center`, `right`

Example: `opponent-front-center`, `ally-back-left`

### Coordinate system
All positions are normalized 0.0 - 1.0
- x: 0.0 (left sideline), 1.0 (right sideline)
- y: 0.0 (top of court, opponents' back), 1.0 (bottom, ally's back)
**- DISCRETIZATION: The real court is 13.4m x 6.1m. The virtual coordinate space MUST be discretized into a grid representing 50x50cm squares (approx. 12 columns x 26 rows).**
**- MOVEMENT & CLICKS: All visual player positions and user click inputs must mathematically "snap" to the nearest intersection of this 50cm grid before being processed or rendered.**


---

## Visual Conventions

### Players
- Allies: blue circles with white label (A1 = "YOU", A2 = partner)
- Opponents: red circles with white label (B1, B2)
- `movingTo` shown as a translucent ghost circle + dashed arrow from current position
- Active player (whose turn it is) has a pulsing glow
- **On movement: ALL players animate simultaneously** to their next positions (Promise.all).
  Each player in the exercise data may carry a `movingTo` field used for animation.

### Zone hover (positioning exercises)
- While the player hovers over the ally half, the zone under the cursor is highlighted with a
  **translucent white rectangle** (`rgba(255,255,255,0.12)`) — frosted-glass effect, terrain visible underneath.
- Implemented via `ZoneOverlay.drawHoverZone(id)` — called every render frame during hover.
- On click: the selected zone briefly pulses before the movement animation starts.

### Shuttlecock
- Yellow circle with a small feather trail
- Trajectory shown as a dotted arc between `from` and `to`
- Speed indicated by trail length (fast = long trail, slow = short)
- Height indicated by size (high = larger, low = smaller)

### Drag mechanic (shot exercises)
- Player presses/touches on the shuttlecock position
- Drags outward: a line extends from the shuttlecock toward the aim point
- Line color changes with power: green (soft) → yellow (medium) → red (full power)
- Curved drag creates a slight arc in the aim line to indicate spin
- **Trajectory preview**: while dragging, a dashed parabolic arc extends from the shuttlecock
  to the predicted landing point on the opponent's half. Arc shape adapts to power:
  flat arc for smash (high power), tall arc for drop (low power).
- **Landing indicator**: a pulsing circle + crosshair shows the predicted landing point.
  Only rendered when the aim is directed toward the opponent's half (y < 0.5).
- Release fires the shot
- Power zones: 0-0.3 = drop/net shot, 0.3-0.6 = drive/push, 0.6-1.0 = smash/clear

### Animation timeline (post-shot)
- After the player fires a shot: shuttlecock flies toward the landing point AND opponent
  players start moving simultaneously (Promise.all) on a coherent time scale.
- Flight speed matches shot power: smash ≈ 280ms, drive ≈ 500ms, drop ≈ 800ms.
- Opponent reactions (movement to cover the landing) start at the same time as the flight.
- After landing: brief pause, then feedback flash + explanation.

### Feedback
- Correct: green highlight on the target zone, checkmark, +XP animation
- Wrong: red crosshair on player's click, green highlight on correct zone, explanation panel
- Near miss: orange highlight, partial points, "Close!" message
- In match mode: quick feedback (1.5s) then auto-advance to next turn

### HUD
- Top bar: Level indicator, XP progress bar, current score
- During exercise: scenario counter (3/10), combo indicator
- During match: rally turn counter, time remaining (if time pressure)

---

## Conventions

- All code and UI in English
- Code comments in English
- Conventional commits: `feat:` / `fix:` / `docs:` / `style:` / `refactor:`
- No external dependencies unless absolutely necessary
- camelCase for variables/functions, PascalCase for classes
- kebab-case for file names
- Modules use ES6 `import`/`export`
- All data files are JSON, loaded with `fetch()`
