#!/usr/bin/env node
/**
 * Admin Auth Diagnostics / Optional Seeder
 * Usage:
 *   node scripts/admin-auth-diagnose.mjs --domain https://your-vercel-domain --email newspulse.team@gmail.com --password News@123 --seed --login
 *
 * Flags:
 *   --domain    Required: Vercel deployment base (e.g. https://newspulse-admin-panel-real-xyz.vercel.app)
 *   --email     Founder/admin email to seed/login
 *   --password  Password for seed/login
 *   --seed      Run seed-founder (POST /admin-api/admin/seed-founder)
 *   --login     Attempt login (POST /admin-api/admin/login)
 *   --json      Output machine-readable summary JSON at end
 */
import process from 'node:process';
import https from 'node:https';

const argv = process.argv.slice(2);
const getFlag = (name) => {
  const idx = argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  const next = argv[idx + 1];
  if (!next || next.startsWith('--')) return true; // boolean flag
  return next;
};

let domain = getFlag('domain');
if (!domain || domain === true) {
  console.error('❌ Missing --domain. Example: --domain https://your-project-name.vercel.app');
  process.exit(1);
}
// Normalize and validate domain
domain = String(domain).trim();
if (/YOUR_REAL_DOMAIN|<your-vercel-domain>|<|\s/.test(domain)) {
  console.error('\n❌ Placeholder domain detected. Replace with your actual deployed URL.');
  console.error('   You must use something like: https://newspulse-admin-panel-real-xyz.vercel.app (or your custom domain)');
  process.exit(1);
}
if (!/^https?:\/\//i.test(domain)) {
  domain = 'https://' + domain.replace(/^https?:\/\//i, '');
}
try {
  new URL(domain);
} catch (e) {
  console.error('❌ Invalid domain URL format:', domain);
  process.exit(1);
}
const email = getFlag('email') || 'newspulse.team@gmail.com';
const password = getFlag('password') || 'News@123';
const doSeed = Boolean(getFlag('seed'));
const doLogin = Boolean(getFlag('login'));
const outJson = Boolean(getFlag('json'));

const base = domain.replace(/\/$/, '') + '/admin-api/admin';
const results = { domain, base, email, seed: null, login: null, ping: null };

function fetchJson(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      method: opts.method || 'GET',
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
    }, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : null; } catch {}
        resolve({ status: res.statusCode, data: parsed, raw: data, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (opts.body) req.write(JSON.stringify(opts.body));
    req.end();
  });
}

(async () => {
  // Ping
  const ping = await fetchJson(`${base}/ping`).catch(e => ({ error: e.message }));
  results.ping = ping;
  if (ping?.status === 200) console.log('✅ Ping ok'); else console.warn('⚠️ Ping failed', ping);

  if (doSeed) {
    const seed = await fetchJson(`${base}/seed-founder`, {
      method: 'POST',
      body: { email, password, force: true }
    }).catch(e => ({ error: e.message }));
    results.seed = seed;
    if (seed?.status === 200 && seed?.data?.success) console.log('✅ Seed ok:', seed.data.message);
    else console.warn('⚠️ Seed failed', seed);
  }

  if (doLogin) {
    const login = await fetchJson(`${base}/login`, {
      method: 'POST',
      body: { email, password }
    }).catch(e => ({ error: e.message }));
    results.login = login;
    if (login?.status === 200 && login?.data?.success) console.log('✅ Login success');
    else console.warn('⚠️ Login failed', login);
  }

  if (outJson) {
    console.log('\n--- Summary JSON ---');
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log('\nDone. Use --json for machine output.');
  }
})();
