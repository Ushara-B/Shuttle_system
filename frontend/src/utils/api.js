import { auth } from '../firebase';

const DEFAULT_BASE_URL = 'http://localhost:5000';

export function getApiBaseUrl() {
  // Central place to decide where the frontend calls the backend.
  // In production, set `VITE_API_BASE_URL` so we never rely on localhost.
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL;
}

export async function apiFetch(path, { auth: withAuth = false, headers, ...init } = {}) {
  // Wrapper around fetch:
  // - resolves base URL
  // - optionally attaches Firebase ID token as Bearer auth header
  const baseUrl = getApiBaseUrl().replace(/\/$/, '');
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const finalHeaders = { ...(headers || {}) };

  if (withAuth) {
    // Token is short-lived; Firebase SDK refreshes it automatically when needed.
    const token = await auth.currentUser?.getIdToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  return fetch(url, { ...init, headers: finalHeaders });
}

