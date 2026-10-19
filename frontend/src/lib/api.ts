import { getToken, clearSession } from './auth';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function errorMessage(body: any, status: number): string {
  if (typeof body?.detail === 'string' && body.detail.trim()) return body.detail;
  if (Array.isArray(body?.detail) && body.detail.length) {
    return body.detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join('; ');
  }
  if (typeof body?.message === 'string' && body.message.trim()) return body.message;
  return `HTTP ${status}`;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 && !path.includes('/auth/login')) {
    clearSession();
    window.location.href = '/login';
    throw new Error('Your session has expired. Please sign in again.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = errorMessage(body, res.status);
    if (res.status === 401 && path.includes('/auth/login')) {
      throw new Error(message === 'Invalid credentials' ? 'Incorrect username or password.' : message);
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export const api = {
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  postForm<T>(path: string, formData: FormData): Promise<T> {
    return request<T>(path, { method: 'POST', body: formData });
  },

  get<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'GET' });
  },

  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' });
  },
};
