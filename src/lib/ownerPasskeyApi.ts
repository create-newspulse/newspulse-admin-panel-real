import { api } from '@/lib/http';

type Json = Record<string, any>;

export type PasskeyStatus = { hasPasskey?: boolean } & Json;

export const ownerPasskeyApi = {
  status: () => api<PasskeyStatus>('/owner/passkey/status'),

  registerOptions: () => api<Json>('/owner/passkey/register/options', { method: 'POST', json: {} }),
  registerVerify: (attestation: any) => api<Json>('/owner/passkey/register/verify', { method: 'POST', json: attestation }),

  authOptions: () => api<Json>('/owner/passkey/auth/options', { method: 'POST', json: {} }),
  authVerify: (assertion: any) => api<Json>('/owner/passkey/auth/verify', { method: 'POST', json: assertion }),
};

export default ownerPasskeyApi;
