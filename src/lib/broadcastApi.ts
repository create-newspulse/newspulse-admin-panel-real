import { api } from '@/lib/http';

export type BroadcastType = 'breaking' | 'live';
export type BroadcastMode = 'manual' | 'auto';

export type BroadcastSettings = {
  breakingEnabled: boolean;
  breakingMode: BroadcastMode;
  liveEnabled: boolean;
  liveMode: BroadcastMode;
};

export type BroadcastItem = {
  _id: string;
  type: BroadcastType;
  text: string;
  isLive: boolean;
  createdAt: string;
  expiresAt: string;
  language?: string;
  authorId?: string;
  updatedAt?: string;
};

export function getBroadcastSettings(opts?: { signal?: AbortSignal }): Promise<BroadcastSettings>;
export async function getBroadcastSettings(opts?: { signal?: AbortSignal }): Promise<BroadcastSettings> {
  return api<BroadcastSettings>('/broadcast/settings', { method: 'GET', signal: opts?.signal });
}

export async function updateBroadcastSettings(settings: BroadcastSettings): Promise<BroadcastSettings> {
  return api<BroadcastSettings>('/broadcast/settings', { method: 'PUT', json: settings });
}

export async function listBroadcastItems(type: BroadcastType, opts?: { signal?: AbortSignal }): Promise<BroadcastItem[]> {
  const qs = new URLSearchParams({ type });
  return api<BroadcastItem[]>(`/broadcast/items?${qs.toString()}`, { method: 'GET', signal: opts?.signal });
}

export async function createBroadcastItem(args: {
  type: BroadcastType;
  text: string;
  language?: string;
}): Promise<BroadcastItem> {
  return api<BroadcastItem>('/broadcast/items', { method: 'POST', json: args });
}

export async function patchBroadcastItem(args: {
  id: string;
  text?: string;
  isLive?: boolean;
}): Promise<BroadcastItem> {
  return api<BroadcastItem>(`/broadcast/items/${encodeURIComponent(args.id)}`, {
    method: 'PATCH',
    json: { text: args.text, isLive: args.isLive },
  });
}

export async function deleteBroadcastItem(id: string): Promise<{ ok: true } | unknown> {
  return api(`/broadcast/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
