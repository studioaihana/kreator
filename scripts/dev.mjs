#!/usr/bin/env node
/**
 * Runs the API server and the Vite dev server together.
 * The web app talks to the API through Vite's proxy, so the browser only ever
 * hits one origin (important for sandboxed previews / iframes).
 */
import { spawn } from 'node:child_process';
import process from 'node:process';

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const targets = [
  { name: 'api', color: '\u001b[36m', args: ['--workspace', '@kreator/server', 'run', 'dev'] },
  { name: 'web', color: '\u001b[35m', args: ['--workspace', '@kreator/web', 'run', 'dev'] },
];

const children = [];
let shuttingDown = false;

function prefix(name, color, chunk) {
  const text = chunk.toString();
  return text
    .split('\n')
    .filter((line, index, arr) => line.length > 0 || index < arr.length - 1)
    .map((line) => `${color}[${name}]\u001b[0m ${line}`)
    .join('\n');
}

for (const target of targets) {
  const child = spawn(npmCmd, target.args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' },
  });
  child.stdout.on('data', (chunk) => process.stdout.write(prefix(target.name, target.color, chunk) + '\n'));
  child.stderr.on('data', (chunk) => process.stderr.write(prefix(target.name, target.color, chunk) + '\n'));
  child.on('exit', (code) => {
    if (shuttingDown) return;
    console.log(`\n${target.name} exited with code ${code}. Shutting down.`);
    shutdown(code ?? 0);
  });
  children.push(child);
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 400);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
