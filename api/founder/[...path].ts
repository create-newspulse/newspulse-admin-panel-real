import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFounder, logFounderAction, setAuthorityLock } from '../_lib/auth';
import { checkCsrf, rateLimit, requireReauth, signUrl } from '../_lib/security';

function ok(res: VercelResponse, data: any = {}) { return res.status(200).json({ ok: true, ...data }); }
function bad(res: VercelResponse, message = 'Bad Request', code = 400) { return res.status(code).json({ ok: false, error: message }); }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = await requireFounder(req, res);
  if (!ctx) return; // already handled

  const segs = (req.query.path as string[]) || [];
  const path = ['founder', ...segs].join('/');
  const method = req.method || 'GET';

  try {
    // CSRF check for POSTs (bypass in mock handled inside function)
    if (req.method === 'POST' && !checkCsrf(req, res)) return;

    switch (segs[0]) {
      case 'profile':
        if (method !== 'GET') return bad(res, 'Method Not Allowed', 405);
        return ok(res, { profile: { name: 'Kiran', founderId: 'FOUND-001', accessLevel: 'founder', lastLogin: new Date().toISOString(), devices: ['Chrome on Windows', 'iPhone'], twoFA: { email: process.env.FOUNDER_EMAIL || 'founder@example.com', enabled: true } } });

      case '2fa':
        if (segs[1] === 'enable' && method === 'POST') { logFounderAction(ctx, '2FA_ENABLE', req.body); return ok(res); }
        if (segs[1] === 'disable' && method === 'POST') { logFounderAction(ctx, '2FA_DISABLE'); return ok(res); }
        return bad(res, 'Not Found', 404);

      case 'authority-lock':
        if (method === 'POST') {
          const enabled = !!req.body?.enabled;
          setAuthorityLock(enabled);
          logFounderAction(ctx, 'AUTHORITY_LOCK', { enabled });
          return ok(res, { locked: enabled });
        }
        return bad(res, 'Method Not Allowed', 405);

      case 'ai':
        // Throttle sensitive AI endpoints
        if (!rateLimit(`${ctx.ip}:ai:${segs[1] || 'root'}`, 10, 60_000)) return bad(res, 'Too Many Requests', 429);
        if (segs[1] === 'logs' && method === 'GET') {
          return ok(res, { logs: [{ id: '1', time: new Date().toISOString(), action: 'moderate', subject: 'post/123', result: 'flagged' }], nextCursor: null });
        }
        if (segs[1] === 'toggles' && method === 'POST') { logFounderAction(ctx, 'AI_TOGGLES', req.body); return ok(res); }
        if (segs[1] === 'command' && method === 'POST') {
          if (!requireReauth(req, res)) return; // require re-auth for commands
          logFounderAction(ctx, 'AI_COMMAND', req.body);
          return ok(res, { output: 'Command accepted' });
        }
        return bad(res, 'Not Found', 404);

      case 'system':
        if (segs[1] === 'lockdown' && method === 'POST') {
          // Minimal confirm header check to avoid accidental trigger
          const confirm = (req.headers['x-confirm'] as string) || '';
          if (!confirm) return bad(res, 'Confirmation required', 400);
          if (!requireReauth(req, res)) return;
          if (!rateLimit(`${ctx.ip}:lockdown`, 3, 60_000)) return bad(res, 'Too Many Requests', 429);
          logFounderAction(ctx, 'SYSTEM_LOCKDOWN', req.body);
          return ok(res, { state: 'locked' });
        }
        if (segs[1] === 'reactivate' && method === 'POST') {
          if (!requireReauth(req, res)) return;
          if (!rateLimit(`${ctx.ip}:reactivate`, 3, 60_000)) return bad(res, 'Too Many Requests', 429);
          const mockOn = String(process.env.VITE_USE_MOCK || process.env.USE_MOCK || '').toLowerCase() === 'true';
          if (!mockOn) {
            const expected = process.env.REACTIVATION_PHRASE;
            if (!expected || req.body?.code !== expected) return bad(res, 'Invalid code', 400);
          }
          logFounderAction(ctx, 'SYSTEM_REACTIVATE', req.body);
          return ok(res, { state: 'online' });
        }
        if (segs[1] === 'status' && method === 'GET') { return ok(res, { frontend: 'online', backend: 'online', db: 'ok', queue: 'idle' }); }
        return bad(res, 'Not Found', 404);

      case 'backup':
        if (segs[1] === 'download' && method === 'POST') {
          const secret = process.env.BACKUP_SIGNING_SECRET || process.env.ADMIN_JWT_SECRET || 'dev-secret';
          const url = signUrl(`https://downloads.example.com/${process.env.BACKUP_BUCKET || 'newspulse'}/backup.zip`, secret, 600);
          logFounderAction(ctx, 'BACKUP_DOWNLOAD');
          return ok(res, { url });
        }
        if (segs[1] === 'trigger' && method === 'POST') { logFounderAction(ctx, 'BACKUP_TRIGGER'); return ok(res, { jobId: 'job_123' }); }
        return bad(res, 'Not Found', 404);

      case 'legal':
        if (segs[1] === 'certificates' && method === 'GET') { return ok(res, { items: [{ id: 'cert-1', name: 'Ownership Certificate', url: '/docs/cert.pdf' }] }); }
        if (segs[1] === 'pti-settings' && method === 'POST') { logFounderAction(ctx, 'PTI_SETTINGS', req.body); return ok(res); }
        if (segs[1] === 'successor' && method === 'POST') { logFounderAction(ctx, 'SUCCESSOR_SET', req.body); return ok(res); }
        return bad(res, 'Not Found', 404);

      case 'monetization':
        if (segs[1] === 'summary' && method === 'GET') { return ok(res, { adsense: 'active', affiliate: 'ok', sponsor: 'ok' }); }
        if (segs[1] === 'earnings' && method === 'GET') { return ok(res, { daily: 42.7, monthly: 1234.5, range: req.query.range || 'monthly' }); }
        if (segs[1] === 'lock' && method === 'POST') { logFounderAction(ctx, 'REVENUE_LOCK', req.body); return ok(res, { locked: !!req.body?.enabled }); }
        if (segs[1] === 'export' && method === 'GET') { return ok(res, { url: 'https://example.com/revenue.csv' }); }
        return bad(res, 'Not Found', 404);

      case 'analytics':
        if (segs[1] === 'traffic-growth' && method === 'GET') { return ok(res, { points: [10, 20, 30, 25, 40] }); }
        if (segs[1] === 'health-summary' && method === 'GET') { return ok(res, { uptime: 99.95, incidents: 0 }); }
        if (segs[1] === 'heatmap' && method === 'GET') { return ok(res, { matrix: [[1,2,3],[3,2,1]] }); }
        if (segs[1] === 'insights' && method === 'GET') { return ok(res, { items: ['Boost homepage speed', 'Increase AI fact-check threshold'] }); }
        return bad(res, 'Not Found', 404);

      case 'insights':
        if (method === 'GET') { return ok(res, { items: ['Boost homepage speed', 'Increase AI fact-check threshold'] }); }
        return bad(res, 'Not Found', 404);

      case 'security':
        if (segs[1] === 'emergency' && method === 'POST') {
          const confirm = (req.headers['x-confirm'] as string) || '';
          if (!confirm) return bad(res, 'Confirmation required', 400);
          if (!requireReauth(req, res)) return;
          if (!rateLimit(`${ctx.ip}:emergency`, 2, 60_000)) return bad(res, 'Too Many Requests', 429);
          const mockOn = String(process.env.VITE_USE_MOCK || process.env.USE_MOCK || '').toLowerCase() === 'true';
          if (!mockOn) {
            const expected = process.env.EMERGENCY_CODE;
            if (!expected || req.body?.code !== expected) return bad(res, 'Invalid code', 400);
          }
          logFounderAction(ctx, 'EMERGENCY', { hasCode: Boolean(req.body?.code) });
          return ok(res, { executed: true });
        }
        if (segs[1] === 'logs' && method === 'GET') { return ok(res, { items: [{ ts: new Date().toISOString(), level: 'warn', message: 'Suspicious login blocked' }] }); }
        if (segs[1] === 'autoprotection' && method === 'POST') { logFounderAction(ctx, 'AUTOPROTECTION', req.body); return ok(res); }
        return bad(res, 'Not Found', 404);

      default:
        return bad(res, 'Not Found', 404);
    }
  } catch (err) {
    console.error('Founder API error', path, err);
    return res.status(500).json({ ok: false, error: 'Internal Error' });
  }
}
