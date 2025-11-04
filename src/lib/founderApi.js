import { mockFounderApi } from './mockFounderApi';
const USE_MOCK = import.meta.env?.VITE_USE_MOCK === 'true';
async function apiFetch(path, init) {
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
    async getProfile() { return apiFetch('/profile'); },
    async getSystemSummary() { return fetch('/api/system/summary', { headers: { 'x-role': 'founder' } }).then(r => r.json()); },
    async systemStatus() { return apiFetch('/system/status'); },
    async setAuthorityLock(enabled) { return apiFetch('/authority-lock', { method: 'POST', body: JSON.stringify({ enabled }) }); },
    async aiToggles(toggles) { return apiFetch('/ai/toggles', { method: 'POST', body: JSON.stringify(toggles) }); },
    async aiCommand(command) { return apiFetch('/ai/command', { method: 'POST', headers: { 'x-reauth': 'true' }, body: JSON.stringify({ command }) }); },
    async getAiLogs(cursor) { return apiFetch(`/ai/logs${cursor ? `?cursor=${cursor}` : ''}`); },
    async systemLockdown() { return apiFetch('/system/lockdown', { method: 'POST', headers: { 'x-confirm': 'true', 'x-reauth': 'true' } }); },
    async systemReactivate(code) { return apiFetch('/system/reactivate', { method: 'POST', headers: { 'x-reauth': 'true' }, body: JSON.stringify({ code }) }); },
    async backupTrigger() { return apiFetch('/backup/trigger', { method: 'POST' }); },
    async backupDownload() { return apiFetch('/backup/download', { method: 'POST' }); },
    async monetizationSummary() { return apiFetch('/monetization/summary'); },
    async monetizationEarnings(range = 'monthly') { return apiFetch(`/monetization/earnings?range=${range}`); },
    async monetizationLock(enabled) { return apiFetch('/monetization/lock', { method: 'POST', body: JSON.stringify({ enabled }) }); },
    async monetizationExport() { return apiFetch('/monetization/export'); },
    async analyticsTrafficGrowth() { return apiFetch('/analytics/traffic-growth'); },
    async analyticsHealth() { return apiFetch('/analytics/health-summary'); },
    async analyticsHeatmap() { return apiFetch('/analytics/heatmap'); },
    async insights() { return apiFetch('/analytics/insights'); },
    async securityEmergency(code) { return apiFetch('/security/emergency', { method: 'POST', headers: { 'x-confirm': 'true', 'x-reauth': 'true' }, body: JSON.stringify({ code }) }); },
    async securityLogs() { return apiFetch('/security/logs'); },
    async securityAutoprotection(toggles) { return apiFetch('/security/autoprotection', { method: 'POST', body: JSON.stringify(toggles) }); },
};
