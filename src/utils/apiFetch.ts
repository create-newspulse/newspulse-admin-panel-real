// src/utils/apiFetch.ts

type ApiOptions = RequestInit & { headers?: Record<string, string> };

export async function apiFetch<T = any>(url: string, options: ApiOptions = {}): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error('Invalid server response');
  }
  if (!res.ok) throw new Error(data?.message || 'Unknown error');
  return data;
}
