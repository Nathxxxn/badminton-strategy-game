import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { cloneDefaultState } from './default-state.js';

const DEFAULT_PLAYER_ID = 'default';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function mergeState(base, patch) {
  if (!isPlainObject(patch)) return clone(base);

  const next = clone(base);
  Object.entries(patch).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      next[key] = clone(value);
    } else if (isPlainObject(value) && isPlainObject(next[key])) {
      next[key] = mergeState(next[key], value);
    } else if (value !== undefined) {
      next[key] = value;
    }
  });
  return next;
}

export function createPlayerStore({ dbPath = path.join(process.cwd(), 'server/data/rally.sqlite') } = {}) {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS player_state (
      id TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  const readStatement = db.prepare('SELECT state_json FROM player_state WHERE id = ?');
  const writeStatement = db.prepare(`
    INSERT INTO player_state (id, state_json, updated_at)
    VALUES (@id, @state_json, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      state_json = excluded.state_json,
      updated_at = excluded.updated_at
  `);

  function writeState(state, playerId = DEFAULT_PLAYER_ID) {
    const normalized = mergeState(cloneDefaultState(), state);
    writeStatement.run({
      id: playerId,
      state_json: JSON.stringify(normalized),
      updated_at: new Date().toISOString(),
    });
    return normalized;
  }

  function getState(playerId = DEFAULT_PLAYER_ID) {
    const row = readStatement.get(playerId);
    if (!row) return writeState(cloneDefaultState(), playerId);

    try {
      return mergeState(cloneDefaultState(), JSON.parse(row.state_json));
    } catch {
      return writeState(cloneDefaultState(), playerId);
    }
  }

  function updateState(patch, playerId = DEFAULT_PLAYER_ID) {
    return writeState(mergeState(getState(playerId), patch), playerId);
  }

  return {
    getState,
    updateState,
    close() {
      db.close();
    },
  };
}
