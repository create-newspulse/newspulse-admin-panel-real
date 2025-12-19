type Json = Record<string, any>;

async function parseJson(res: Response) {
  const text = await res.text().catch(() => '');
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data && (data.error || data.message || data.detail)) ? String(data.error || data.message || data.detail) : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function post<T = any>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body ?? {}),
  });
  return (await parseJson(res)) as T;
}

async function get<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'GET', credentials: 'include' });
  return (await parseJson(res)) as T;
}

export type PasskeyStatus = { hasPasskey?: boolean } & Json;

export const ownerPasskeyApi = {
  status: () => get<PasskeyStatus>('/api/owner/passkey/status'),

  registerOptions: () => post<Json>('/api/owner/passkey/register/options', {}),
  registerVerify: (attestation: any) => post<Json>('/api/owner/passkey/register/verify', attestation),

  authOptions: () => post<Json>('/api/owner/passkey/auth/options', {}),
  authVerify: (assertion: any) => post<Json>('/api/owner/passkey/auth/verify', assertion),
};

export default ownerPasskeyApi;
