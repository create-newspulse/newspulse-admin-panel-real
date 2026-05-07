import { execFile, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const passthrough = [];
const args = process.argv.slice(2);
let requestedPort = 5173;

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (/^\d+$/.test(arg)) {
    requestedPort = Number(arg);
    passthrough.push('--port', arg);
    continue;
  }
  if (arg === '--port' && /^\d+$/.test(args[index + 1] || '')) {
    requestedPort = Number(args[index + 1]);
  } else if (arg.startsWith('--port=')) {
    const value = arg.slice('--port='.length);
    if (/^\d+$/.test(value)) requestedPort = Number(value);
  }
  passthrough.push(arg);
}

function canBindPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '0.0.0.0');
  });
}

function parseWindowsListeningPids(netstatOutput, port) {
  const pids = new Set();
  const lines = String(netstatOutput || '').split(/\r?\n/);
  const portPattern = new RegExp(`(?:^|[\\[\\]:.])${port}\\s+`);
  for (const line of lines) {
    if (!/\bLISTENING\b/i.test(line)) continue;
    if (!portPattern.test(line)) continue;
    const parts = line.trim().split(/\s+/);
    const pid = Number(parts[parts.length - 1]);
    if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
      pids.add(pid);
    }
  }
  return Array.from(pids);
}

async function findWindowsListeningPids(port) {
  const { stdout } = await execFileAsync('netstat', ['-ano', '-p', 'tcp'], { cwd: repoRoot, windowsHide: true });
  return parseWindowsListeningPids(stdout, port);
}

async function killWindowsPid(pid) {
  await execFileAsync('taskkill', ['/PID', String(pid), '/F', '/T'], { cwd: repoRoot, windowsHide: true });
}

async function waitForPortToClear(port) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await canBindPort(port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return false;
}

async function ensurePortIsFree(port) {
  if (await canBindPort(port)) return;

  if (process.platform !== 'win32') {
    console.warn(`[dev] Port ${port} is already in use. Stop the existing process or run npx kill-port ${port}.`);
    return;
  }

  const pids = await findWindowsListeningPids(port);
  if (pids.length === 0) {
    console.warn(`[dev] Port ${port} is already in use, but no listening PID was found.`);
    return;
  }

  console.log(`[dev] Port ${port} is already in use; stopping PID${pids.length > 1 ? 's' : ''} ${pids.join(', ')} before starting Vite.`);
  for (const pid of pids) {
    try {
      await killWindowsPid(pid);
    } catch (error) {
      console.warn(`[dev] Failed to stop PID ${pid}: ${error?.message || error}`);
    }
  }

  if (!(await waitForPortToClear(port))) {
    console.warn(`[dev] Port ${port} is still busy after cleanup; Vite may still report it as in use.`);
  }
}

await ensurePortIsFree(requestedPort);

const viteEntry = path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const child = spawn(process.execPath, [viteEntry, '--host', '0.0.0.0', ...passthrough], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
