async function requestBackend(path, options = {}) {
  try {
    const response = await fetch(path, {
      ...options,
      credentials: 'include',
      headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
    });

    if (!response.ok) {
      console.warn(`Backend request failed: ${response.status} ${path}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn(`Backend unavailable: ${path}`, error);
    return null;
  }
}

function jsonOptions(method, body) {
  return {
    method,
    body: JSON.stringify(body),
  };
}

export function fetchBackendState() {
  return requestBackend('/api/player/state');
}

export function fetchBackendSession() {
  return requestBackend('/api/auth/me');
}

export function signupBackend(credentials) {
  return requestBackend('/api/auth/signup', jsonOptions('POST', credentials));
}

export function loginBackend(credentials) {
  return requestBackend('/api/auth/login', jsonOptions('POST', credentials));
}

export async function logoutBackend() {
  const result = await requestBackend('/api/auth/logout', { method: 'POST' });
  return result?.ok === true;
}

export async function changeBackendPassword(passwordPatch) {
  const result = await requestBackend('/api/auth/password', jsonOptions('PUT', passwordPatch));
  return result?.ok === true;
}

export function saveBackendProfile(profilePatch) {
  return requestBackend('/api/player/profile', jsonOptions('PUT', profilePatch));
}

export function saveBackendPreferences(preferencesPatch) {
  return requestBackend('/api/player/preferences', jsonOptions('PUT', preferencesPatch));
}

export function saveBackendControls(controls) {
  return requestBackend('/api/player/controls', jsonOptions('PUT', { controls }));
}

export function recordBackendDrillStart(drillId) {
  return requestBackend(`/api/player/drills/${encodeURIComponent(drillId)}/start`, { method: 'POST' });
}

export function resetBackendControls() {
  return requestBackend('/api/player/controls/reset', { method: 'POST' });
}

export function resetBackendProgression() {
  return requestBackend('/api/player/reset-progression', { method: 'POST' });
}

export function recordBackendGameSession(sessionSummary) {
  return requestBackend('/api/game-sessions', jsonOptions('POST', sessionSummary));
}

export function fetchBackendLeaderboard(period) {
  const query = period ? `?period=${encodeURIComponent(period)}` : '';
  return requestBackend(`/api/player/leaderboard${query}`);
}
