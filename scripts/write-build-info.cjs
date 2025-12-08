// scripts/write-build-info.cjs
// Writes public/build-info.json so we can verify which commit is deployed from the live site.
const { execSync } = require('node:child_process');
const { writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

function safe(cmd) {
  try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return ''; }
}

const commit = safe('git rev-parse --short HEAD');
const branch = safe('git rev-parse --abbrev-ref HEAD');
const date = new Date().toISOString();

const info = { commit, branch, date };
const outDir = join(process.cwd(), 'public');
try { mkdirSync(outDir, { recursive: true }); } catch {}
const outFile = join(outDir, 'build-info.json');
writeFileSync(outFile, JSON.stringify(info, null, 2));
console.log('🧾 build-info.json written:', info);
