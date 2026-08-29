import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const legacyHubName = ['KiranOS', 'Command', 'Hub'].join('');
const legacyChatName = ['KiranOS', 'Chat'].join('');
const founderBrowserKey = ['VITE', 'FOUNDER', 'API', 'KEY'].join('_');
const founderServerKey = ['FOUNDER', 'API', 'KEY'].join('_');
const kiranosApiBase = ['VITE', 'KIRANOS', 'API', 'BASE'].join('_');

function walkFiles(relativeRoot: string): string[] {
  const absoluteRoot = path.join(repoRoot, relativeRoot);
  if (!existsSync(absoluteRoot)) return [];

  const entries = readdirSync(absoluteRoot);
  return entries.flatMap((entry) => {
    const absolutePath = path.join(absoluteRoot, entry);
    const relativePath = path.relative(repoRoot, absolutePath);

    if (relativePath.includes(`${path.sep}tests${path.sep}`)) return [];
    if (['node_modules', 'dist', 'build', '.git', 'coverage', '.vite'].includes(entry)) return [];

    if (statSync(absolutePath).isDirectory()) return walkFiles(relativePath);
    if (!/\.(cjs|js|jsx|mjs|ts|tsx)$/.test(entry)) return [];
    return [relativePath];
  });
}

describe('KiranOS legacy security cleanup', () => {
  it('does not keep the unreachable command hub or legacy chat component files', () => {
    expect(existsSync(path.join(repoRoot, 'src', 'pages', 'admin', `${legacyHubName}.tsx`))).toBe(false);
    expect(existsSync(path.join(repoRoot, 'src', 'components', `${legacyChatName}.tsx`))).toBe(false);
  });

  it('does not import the removed command hub from the active admin router', () => {
    const appSource = readFileSync(path.join(repoRoot, 'src', 'App.tsx'), 'utf8');

    expect(appSource).not.toContain(legacyHubName);
    expect(appSource).not.toContain(`${legacyHubName}.tsx`);
  });

  it('does not keep the standalone KiranOS backend or unused client helper', () => {
    expect(existsSync(path.join(repoRoot, 'kiranos', 'backend', 'package.json'))).toBe(false);
    expect(existsSync(path.join(repoRoot, 'kiranos', 'backend', 'src', 'server.ts'))).toBe(false);
    expect(existsSync(path.join(repoRoot, 'src', 'lib', 'kiranosClient.ts'))).toBe(false);
  });

  it('does not require the browser-exposed founder API key in runtime source', () => {
    const runtimeFiles = ['src', 'components', 'pages', 'lib'].flatMap(walkFiles);
    const matches = runtimeFiles.filter((file) => readFileSync(path.join(repoRoot, file), 'utf8').includes(founderBrowserKey));

    expect(matches).toEqual([]);
  });

  it('does not keep obsolete standalone KiranOS env configuration in root env examples', () => {
    const rootEnvExample = readFileSync(path.join(repoRoot, '.env.example'), 'utf8');

    expect(rootEnvExample).not.toContain(founderBrowserKey);
    expect(rootEnvExample).not.toContain(founderServerKey);
    expect(rootEnvExample).not.toContain(kiranosApiBase);
  });

  it('leaves unrelated KiranOS components in place', () => {
    expect(existsSync(path.join(repoRoot, 'src', 'pages', 'admin', `${legacyChatName}Panel.jsx`))).toBe(true);
    expect(existsSync(path.join(repoRoot, 'src', 'components', ['KiranOS', 'Command', 'Center'].join('') + '.tsx'))).toBe(true);
    expect(existsSync(path.join(repoRoot, 'src', 'components', ['KiranOS', 'Command', 'Reference'].join('') + '.tsx'))).toBe(true);
  });
});