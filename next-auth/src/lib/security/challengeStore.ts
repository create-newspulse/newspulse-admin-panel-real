import { kvSet, kvGet, kvDel } from './kv';

export async function saveChallenge(key: string, value: string, ttlMs = 5 * 60 * 1000) {
	await kvSet(`webauthn:${key}`, value, ttlMs);
}

export async function readChallenge(key: string): Promise<string | null> {
	return kvGet<string>(`webauthn:${key}`);
}

export async function deleteChallenge(key: string) {
	await kvDel(`webauthn:${key}`);
}
