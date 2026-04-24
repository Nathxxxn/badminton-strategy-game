async function requestBackend(path, options = {}) {
  try {
    const response = await fetch(path, {
      headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
      ...options,
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

export function saveBackendProfile(profilePatch) {
  return requestBackend('/api/player/profile', jsonOptions('PUT', profilePatch));
}

export function saveBackendPreferences(preferencesPatch) {
  return requestBackend('/api/player/preferences', jsonOptions('PUT', preferencesPatch));
}

export function recordBackendDrillStart(drillId) {
  return requestBackend(`/api/player/drills/${encodeURIComponent(drillId)}/start`, { method: 'POST' });
}

export function resetBackendControls() {
  return requestBackend('/api/player/controls/reset', { method: 'POST' });
}
