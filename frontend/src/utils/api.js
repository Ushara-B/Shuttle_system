import { auth } from '../firebase';

const DEFAULT_BASE_URL = 'http://localhost:5000';

export function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL;
}

export async function apiFetch(path, { auth: withAuth = false, headers, ...init } = {}) {
  const baseUrl = getApiBaseUrl().replace(/\/$/, '');
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const finalHeaders = { ...(headers || {}) };

  if (withAuth) {
    const token = await auth.currentUser?.getIdToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  return fetch(url, { ...init, headers: finalHeaders });
}

