import type { Ok } from '@/types/founder';

export const mockFounderApi = {
  async getProfile() {
    return { ok: true, profile: { name: 'Kiran', founderId: 'FOUND-001', accessLevel: 'founder', lastLogin: new Date().toISOString(), devices: ['Chrome@Win', 'iPhone@iOS'], twoFA: { email: process.env.FOUNDER_EMAIL || '', enabled: true } } } as Ok<any>; // removed founder@example.com
  },
  async getSystemSummary() {
    return { ok: true, updatedAt: new Date().toISOString(), systems: { system: 'online', ai: 'active', backup: 'ok', security: 'shielded' } } as Ok<any>;
  },
  async systemStatus() {
    return { ok: true, frontend: 'online', backend: 'online', db: 'ok', queue: 'idle' } as Ok<any>;
  },
  async setAuthorityLock(enabled: boolean) { return { ok: true, locked: enabled } as Ok<any>; },
  async aiToggles(t: any) { return { ok: true } as Ok; },
  async aiCommand(command: string) { return { ok: true, output: 'ack: ' + command } as Ok<any>; },
  async getAiLogs() { return { ok: true, logs: [], nextCursor: null } as Ok<any>; },
  async systemLockdown() { return { ok: true, state: 'locked' } as Ok<any>; },
  async systemReactivate(code: string) { return { ok: true, state: 'online' } as Ok<any>; },
  async backupTrigger() { return { ok: true, jobId: 'job_1' } as Ok<any>; },
  async backupDownload() { return { ok: true, url: '#' } as Ok<any>; },
  async monetizationSummary() { return { ok: true, adsense: 'active', affiliate: 'ok', sponsor: 'ok' } as Ok<any>; },
  async monetizationEarnings(range: string) { return { ok: true, daily: 10, monthly: 200, range } as Ok<any>; },
  async monetizationLock(enabled: boolean) { return { ok: true, locked: enabled } as Ok<any>; },
  async monetizationExport() { return { ok: true, url: '#' } as Ok<any>; },
  async analyticsTrafficGrowth() { return { ok: true, points: [1,2,3,4,5] } as Ok<any>; },
  async analyticsHealth() { return { ok: true, uptime: 99.95, incidents: 0 } as Ok<any>; },
  async analyticsHeatmap() { return { ok: true, matrix: [[1,0],[0,1]] } as Ok<any>; },
  async insights() { return { ok: true, items: ['Use CDNs', 'Tighten CORS'] } as Ok<any>; },
  async securityEmergency(code: string) { return { ok: true, executed: true } as Ok<any>; },
  async securityLogs() { return { ok: true, items: [] } as Ok<any>; },
  async securityAutoprotection(t: any) { return { ok: true } as Ok; },
};
