import { mockFounderApi } from './mockFounderApi';
import type { Ok } from '@/types/founder';

const USE_MOCK = (import.meta as any).env?.VITE_USE_MOCK === 'true';

async function apiFetch(path: string, init?: RequestInit) {
	const res = await fetch(`/api/founder${path}`, {
		credentials: 'include',
		headers: {
			'content-type': 'application/json',
			// Helpful for local testing when requireFounder checks this header
			'x-role': 'founder',
			'x-csrf': 'dev',
		},
		...init,
	});
	return res.json();
}

export const founderApi = USE_MOCK ? mockFounderApi : {
	async getProfile(): Promise<Ok<any>> { return apiFetch('/profile'); },
	async getSystemSummary(): Promise<Ok<any>> { return fetch('/api/system/summary', { headers: { 'x-role': 'founder' } } as any).then(r => r.json()); },
	async systemStatus(): Promise<Ok<any>> { return apiFetch('/system/status'); },
	async setAuthorityLock(enabled: boolean): Promise<Ok<any>> { return apiFetch('/authority-lock', { method: 'POST', body: JSON.stringify({ enabled }) }); },
	async aiToggles(toggles: any): Promise<Ok> { return apiFetch('/ai/toggles', { method: 'POST', body: JSON.stringify(toggles) }); },
	async aiCommand(command: string): Promise<Ok<any>> { return apiFetch('/ai/command', { method: 'POST', headers: { 'x-reauth': 'true' } as any, body: JSON.stringify({ command }) }); },
	async getAiLogs(cursor?: string): Promise<Ok<any>> { return apiFetch(`/ai/logs${cursor ? `?cursor=${cursor}` : ''}`); },
	async systemLockdown(): Promise<Ok<any>> { return apiFetch('/system/lockdown', { method: 'POST', headers: { 'x-confirm': 'true', 'x-reauth': 'true' } as any }); },
	async systemReactivate(code: string): Promise<Ok<any>> { return apiFetch('/system/reactivate', { method: 'POST', headers: { 'x-reauth': 'true' } as any, body: JSON.stringify({ code }) }); },
	async backupTrigger(): Promise<Ok<any>> { return apiFetch('/backup/trigger', { method: 'POST' }); },
	async backupDownload(): Promise<Ok<any>> { return apiFetch('/backup/download', { method: 'POST' }); },
	async monetizationSummary(): Promise<Ok<any>> { return apiFetch('/monetization/summary'); },
	async monetizationEarnings(range = 'monthly'): Promise<Ok<any>> { return apiFetch(`/monetization/earnings?range=${range}`); },
	async monetizationLock(enabled: boolean): Promise<Ok<any>> { return apiFetch('/monetization/lock', { method: 'POST', body: JSON.stringify({ enabled }) }); },
	async monetizationExport(): Promise<Ok<any>> { return apiFetch('/monetization/export'); },
	async analyticsTrafficGrowth(): Promise<Ok<any>> { return apiFetch('/analytics/traffic-growth'); },
	async analyticsHealth(): Promise<Ok<any>> { return apiFetch('/analytics/health-summary'); },
	async analyticsHeatmap(): Promise<Ok<any>> { return apiFetch('/analytics/heatmap'); },
	async insights(): Promise<Ok<any>> { return apiFetch('/analytics/insights'); },
	async securityEmergency(code: string): Promise<Ok<any>> { return apiFetch('/security/emergency', { method: 'POST', headers: { 'x-confirm': 'true', 'x-reauth': 'true' } as any, body: JSON.stringify({ code }) }); },
	async securityLogs(): Promise<Ok<any>> { return apiFetch('/security/logs'); },
	async securityAutoprotection(toggles: any): Promise<Ok> { return apiFetch('/security/autoprotection', { method: 'POST', body: JSON.stringify(toggles) }); },
};

export type FounderApi = typeof founderApi;
