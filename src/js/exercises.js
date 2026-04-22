import { MOCK_EXERCISES, MOCK_RALLIES } from './mock-data.js';

const DATA_FILES = {
  positioning: 'data/positioning.json',
  shots: 'data/shots.json',
  matches: 'data/matches.json',
};

let catalogPromise = null;

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Impossible de charger ${path} (${response.status})`);
  }
  return response.json();
}

function normalizeMatches(rawMatches) {
  if (Array.isArray(rawMatches)) return rawMatches;
  if (Array.isArray(rawMatches?.matches)) return rawMatches.matches;
  return [];
}

function buildCatalog(exercises, matches, source) {
  const byId = new Map(exercises.map(exercise => [exercise.id, exercise]));
  const normalizedMatches = normalizeMatches(matches);

  return {
    source,
    exercisesById: byId,
    matches: normalizedMatches,
  };
}

function buildFallbackCatalog() {
  const fallbackExercises = MOCK_EXERCISES.map(exercise => ({ ...exercise }));
  const fallbackMatches = [
    {
      id: 'MATCH_ATTACK_FALLBACK',
      workshop: 'attack',
      title: 'Atelier Attaque',
      rally: MOCK_RALLIES.attack.map((exercise, index) => ({
        turn: index + 1,
        type: exercise.type,
        exerciseRef: exercise.id,
      })),
    },
    {
      id: 'MATCH_DEFENSE_FALLBACK',
      workshop: 'defense',
      title: 'Atelier Defense',
      rally: MOCK_RALLIES.defense.map((exercise, index) => ({
        turn: index + 1,
        type: exercise.type,
        exerciseRef: exercise.id,
      })),
    },
  ];

  return buildCatalog(fallbackExercises, fallbackMatches, 'mock');
}

async function loadCatalogFromDataFiles() {
  const [positioning, shots, matches] = await Promise.all([
    fetchJson(DATA_FILES.positioning),
    fetchJson(DATA_FILES.shots),
    fetchJson(DATA_FILES.matches),
  ]);

  return buildCatalog(
    [...positioning, ...shots],
    matches,
    'data',
  );
}

export async function loadScenarioCatalog({ forceRefresh = false } = {}) {
  if (!catalogPromise || forceRefresh) {
    catalogPromise = loadCatalogFromDataFiles().catch(error => {
      console.warn('exercises.js: fallback sur les mocks locaux', error);
      return buildFallbackCatalog();
    });
  }

  return catalogPromise;
}

export async function warmScenarioCatalog() {
  return loadScenarioCatalog();
}

export async function loadWorkshopRally(workshop) {
  const catalog = await loadScenarioCatalog();
  const match = catalog.matches.find(entry => entry.workshop === workshop);

  if (!match) {
    throw new Error(`Aucun rally defini pour l'atelier "${workshop}"`);
  }

  return match.rally.map(turn => {
    const exercise = catalog.exercisesById.get(turn.exerciseRef);
    if (!exercise) {
      throw new Error(`Scenario introuvable: ${turn.exerciseRef}`);
    }

    return {
      ...exercise,
      type: turn.type ?? exercise.type,
      turn: turn.turn ?? null,
      matchId: match.id,
      matchTitle: match.title ?? null,
      timePressure: match.timePressure ?? null,
    };
  });
}
