export const mockFounderApi = {
    async getProfile() {
        return { ok: true, profile: { name: 'Kiran', founderId: 'FOUND-001', accessLevel: 'founder', lastLogin: new Date().toISOString(), devices: ['Chrome@Win', 'iPhone@iOS'], twoFA: { email: process.env.FOUNDER_EMAIL || '', enabled: true } } }; // removed founder@example.com
    },
    async getSystemSummary() {
        return { ok: true, updatedAt: new Date().toISOString(), systems: { system: 'online', ai: 'active', backup: 'ok', security: 'shielded' } };
    },
    async systemStatus() {
        return { ok: true, frontend: 'online', backend: 'online', db: 'ok', queue: 'idle' };
    },
    async setAuthorityLock(enabled) { return { ok: true, locked: enabled }; },
    async aiToggles(t) { return { ok: true }; },
    async aiCommand(command) { return { ok: true, output: 'ack: ' + command }; },
    async getAiLogs() { return { ok: true, logs: [], nextCursor: null }; },
    async systemLockdown() { return { ok: true, state: 'locked' }; },
    async systemReactivate(code) { return { ok: true, state: 'online' }; },
    async backupTrigger() { return { ok: true, jobId: 'job_1' }; },
    async backupDownload() { return { ok: true, url: '#' }; },
    async monetizationSummary() { return { ok: true, adsense: 'active', affiliate: 'ok', sponsor: 'ok' }; },
    async monetizationEarnings(range) { return { ok: true, daily: 10, monthly: 200, range }; },
    async monetizationLock(enabled) { return { ok: true, locked: enabled }; },
    async monetizationExport() { return { ok: true, url: '#' }; },
    async analyticsTrafficGrowth() { return { ok: true, points: [1, 2, 3, 4, 5] }; },
    async analyticsHealth() { return { ok: true, uptime: 99.95, incidents: 0 }; },
    async analyticsHeatmap() { return { ok: true, matrix: [[1, 0], [0, 1]] }; },
    async insights() { return { ok: true, items: ['Use CDNs', 'Tighten CORS'] }; },
    async securityEmergency(code) { return { ok: true, executed: true }; },
    async securityLogs() { return { ok: true, items: [] }; },
    async securityAutoprotection(t) { return { ok: true }; },
};
