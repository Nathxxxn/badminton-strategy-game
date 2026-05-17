import { KinematicEngine }   from './logic/KinematicEngine.js';
import { PlacementEngine }   from './logic/PlacementEngine.js';
import { TacticalEngine }    from './logic/TacticalEngine.js';
import { ExecutionEngine }   from './logic/ExecutionEngine.js';
import { RatingEngine }      from './logic/RatingEngine.js';
import { AISpawnEngine }     from './logic/AISpawnEngine.js';
import { ScenarioGenerator } from './logic/ScenarioGenerator.js';
import { FeedbackEngine }    from './logic/FeedbackEngine.js';
import { MatchEngine }       from './logic/MatchEngine.js';

// Singleton engines — instantiated once, reused across matches.
// Order is required by Developer B; do not reorder.
const kinematic   = new KinematicEngine();
const placement   = new PlacementEngine(kinematic);
const tactical    = new TacticalEngine();
const execution   = new ExecutionEngine();
const rating      = new RatingEngine();
const aiSpawn     = new AISpawnEngine(tactical, placement, kinematic);
const scenarioGen = new ScenarioGenerator(tactical, placement, aiSpawn, kinematic);
const feedback    = new FeedbackEngine();
const engine      = new MatchEngine(tactical, placement, kinematic, execution, aiSpawn, rating);

export class MatchAdapter {
  /** Call before startRally(). profile = { rank, rating, racketHand } */
  initMatch(profile) {
    const player = { rank: profile.rank, rating: profile.rating, hand: profile.racketHand ?? 'right' };
    const partner = { ...player, hand: 'left' }; // default partner hand for v1
    engine.initMatch([player, partner], 'QUICK_MATCH', 21);
  }

  /** Returns translated scenario or { scenarios: [...] } or { rallyOver: true }. */
  startRally() {
    return this._process(engine.startRally());
  }

  /**
   * Call after player fires a shot.
   * @param {{ type: string, startPos: {x,y}, endPos: {x,y}, hasSpin: boolean }} shot
   * @param {object} incoming  — the raw incoming field from the current TACTICAL scenario
   */
  onShotPlayed(shot, incoming) {
    return this._process(engine.nextScenarioPostShot(shot, incoming));
  }

  /**
   * Call after player clicks a position.
   * @param {{ x: number, y: number }} pos  — normalized court position
   * @param {object} shotContext  — the raw shotPlayed field from the current PLACEMENT scenario
   */
  onPositionPlayed(pos, shotContext) {
    return this._process(engine.nextScenarioPostMovement(pos, shotContext, 1));
  }

  /**
   * Translate a raw MatchEngine scenario into the turn format expected by
   * startShotTurn / startPositioningTurn.
   */
  translate(scen) {
    if (scen?.mode === 'TACTICAL')  return this._tacticalToTurn(scen);
    if (scen?.mode === 'PLACEMENT') return this._placementToTurn(scen);
    return scen;
  }

  /**
   * Returns a state object shaped for hud.setMatchState().
   * hud expects: { points:{player,opponent}, sets:{player,opponent}, fatigue:{player,partner,opponent1,opponent2} }
   * MatchEngine uses: { score:{teamA,teamB}, setsP1, setsP2, players:{1,2,3,4}.fatigue (0–1) }
   */
  getMatchState() {
    const ms = engine.matchState;
    if (!ms) return null;
    return {
      points: {
        player:   ms.score?.teamA ?? 0,
        opponent: ms.score?.teamB ?? 0,
      },
      sets: {
        player:   ms.setsP1 ?? 0,
        opponent: ms.setsP2 ?? 0,
      },
      winner: ms.matchOver
        ? ((ms.setsP1 ?? 0) > (ms.setsP2 ?? 0) ? 'player' : 'opponent')
        : null,
      ratingDelta: ms.matchReport?.finalStats?.pointsGained ?? null,
      fatigue: {
        player:    this._hudFatigue(1),
        partner:   this._hudFatigue(2),
        opponent1: this._hudFatigue(3),
        opponent2: this._hudFatigue(4),
      },
    };
  }

  isMatchOver() {
    return !!engine.matchState?.matchOver;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /** MatchEngine fatigue: 0.0 = fresh → 1.0 = exhausted. HUD wants 0–100 fresh = 100. */
  _hudFatigue(id) {
    const f = engine.players?.[id]?.fatigue ?? 0;
    return Math.round((1 - Math.min(1, Math.max(0, f))) * 100);
  }

  /**
   * Normalise any result from nextScenarioPost* / startRally:
   * - pass rallyOver through unchanged
   * - wrap scenarios array sub-items (no mutation)
   * - attach the raw MatchEngine scenario as ._raw for use in intercepts
   */
  _process(result) {
    if (!result) return { rallyOver: true, winnerId: null, reason: 'ENGINE_NULL' };
    if (result.rallyOver) return result;
    if (result.scenarios) {
      // Callers are responsible for calling translate() on each scenario in this array.
      return { scenarios: result.scenarios };
    }
    // Normal single scenario — attach raw reference for intercepts
    return Object.assign(Object.create(null), result, { _raw: result });
  }

  _tacticalToTurn(scen) {
    const inc = scen.incoming ?? {};
    return {
      type: 'shot',
      label: scen.isServe ? 'Service' : 'Attack',
      text: scen.isServe
        ? 'Service — play a NET_CLEAR to open the rally.'
        : 'Choose your shot and aim precisely.',
      players: {
        ally1:     scen.players?.user?.pos            ?? { x: 0.50, y: 0.80 },
        ally2:     scen.players?.partner?.pos         ?? { x: 0.30, y: 0.70 },
        opponent1: scen.players?.opponents?.[0]?.posEnd ?? { x: 0.40, y: 0.20 },
        opponent2: scen.players?.opponents?.[1]?.posEnd ?? { x: 0.65, y: 0.20 },
      },
      shuttlecock: {
        from:     inc.startPos ?? { x: 0.50, y: 0.10 },
        position: inc.endPos   ?? { x: 0.50, y: 0.65 },
        type:     inc.type     ?? 'CLEAR',
        speed:    'medium',
      },
      timeLimitMs:  scen.reflectionTime ?? 8000,
      passingScore: 0,
    };
  }

  _placementToTurn(scen) {
    return {
      type: 'positioning',
      label: 'Recovery',
      text: 'Move to recover your court position.',
      players: {
        ally1:     scen.playerStart              ?? { x: 0.50, y: 0.90 },
        ally2:     scen.partnerStart             ?? { x: 0.70, y: 0.80 },
        opponent1: scen.opponents?.[0]?.posEnd   ?? { x: 0.40, y: 0.20 },
        opponent2: scen.opponents?.[1]?.posEnd   ?? { x: 0.65, y: 0.20 },
      },
      playedShuttle: {
        position: scen.shotPlayed?.endPos ?? { x: 0.50, y: 0.20 },
      },
      moveRadius:   2.5,
      playerReach:  1.8,
      timeLimitMs:  scen.reflectionTime ?? 8000,
      passingScore: 0,
    };
  }
}
