import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

export const SITE_FILES = [
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/game.js',
  'js/audio.js',
  'js/main.js',
  'js/theme.js',
  'fonts/press-start-2p-latin.woff2',
  'fonts/orbitron-wght.ttf',
  'fonts/OFL.txt',
  'fonts/OFL-Orbitron.txt',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
};

export function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

export function pagesWorkflowFiles(workflowText) {
  const files = [];
  for (const line of workflowText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('cp ')) continue;
    for (const part of trimmed.slice(3).split(/\s+/)) {
      if (!part.startsWith('_site')) files.push(part);
    }
  }
  return files.sort();
}

export function assertPagesMatch(workflowText) {
  const expected = [...SITE_FILES].sort();
  const actual = pagesWorkflowFiles(workflowText);
  if (expected.join('\n') !== actual.join('\n')) {
    throw new Error(`Pages copy list drifted.\nworkflow: ${actual.join(', ')}\nsuite: ${expected.join(', ')}`);
  }
}

export function assertDistinctCommits(head, base) {
  const sha = /^[0-9a-f]{40}$/i;
  if (!sha.test(head) || !sha.test(base)) {
    throw new Error(`expected full SHAs, got head ${head} and base ${base}`);
  }
  if (/^0{40}$/i.test(base)) {
    throw new Error('base SHA is all zeros');
  }
  if (head.toLowerCase() === base.toLowerCase()) {
    throw new Error(`refusing to compare ${head} to itself`);
  }
}

export function resolveBaseRef() {
  const fromEnv = process.env.VERIFY_BASE_REF?.trim();
  return fromEnv || 'origin/main';
}

export function resolveSha(repoRoot, ref) {
  const read = () => git(repoRoot, ['rev-parse', '--verify', `${ref}^{commit}`]);
  try {
    return read();
  } catch {
    git(repoRoot, ['fetch', '--no-tags', 'origin', 'main']);
    return read();
  }
}

export function buildSite(sourceRoot, destDir) {
  fs.rmSync(destDir, { recursive: true, force: true });
  for (const rel of SITE_FILES) {
    const target = path.join(destDir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(sourceRoot, rel), target);
  }
}

export function listen(rootDir) {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(rootDir, rel));
    if (!file.startsWith(path.normalize(rootDir + path.sep)) && file !== path.normalize(rootDir)) {
      response.writeHead(403);
      response.end();
      return;
    }
    fs.readFile(file, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end('not found');
        return;
      }
      response.writeHead(200, {
        'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      response.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

export function addWorktree(repoRoot, sha) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'neon-tac-base-'));
  git(repoRoot, ['worktree', 'add', '--detach', dir, sha]);
  const checked = git(dir, ['rev-parse', 'HEAD']);
  if (checked !== sha) {
    throw new Error(`worktree HEAD ${checked} is not base ${sha}`);
  }
  return dir;
}

export function removeWorktree(repoRoot, dir) {
  if (!dir) return;
  try {
    git(repoRoot, ['worktree', 'remove', '--force', dir]);
  } catch {
    fs.rmSync(dir, { recursive: true, force: true });
    try {
      git(repoRoot, ['worktree', 'prune']);
    } catch {
      return;
    }
  }
}
