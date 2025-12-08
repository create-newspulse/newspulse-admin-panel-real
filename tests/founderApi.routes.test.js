import { describe, it, expect } from 'vitest';
// Import the serverless handler directly
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Node ESM resolution for test context
import handler from '../api/founder/[...path]';
// Minimal mocks for VercelRequest/Response
function mockReqRes(url, method, body, headers = {}) {
    const req = {
        method,
        url,
        query: { path: url.replace(/^\/api\/founder\//, '').split('/') },
        headers: { 'x-role': 'founder', ...headers },
        body,
        socket: { remoteAddress: '127.0.0.1' },
    };
    const res = {
        statusCode: 200,
        _json: null,
        status(code) { this.statusCode = code; return this; },
        json(obj) { this._json = obj; return this; },
        setHeader() { },
    };
    return { req, res };
}
describe('Founder API security stubs', () => {
    it('requires confirm header for lockdown', async () => {
        const { req, res } = mockReqRes('/api/founder/system/lockdown', 'POST');
        await handler(req, res);
        expect(res.statusCode).toBe(400);
        expect(res._json?.ok).toBe(false);
    });
    it('accepts lockdown with confirm + reauth', async () => {
        const { req, res } = mockReqRes('/api/founder/system/lockdown', 'POST', {}, { 'x-confirm': '1', 'x-reauth': '1', 'x-csrf': 'dev' });
        await handler(req, res);
        expect(res.statusCode).toBe(200);
        expect(res._json?.ok).toBe(true);
        expect(res._json?.state).toBe('locked');
    });
});
