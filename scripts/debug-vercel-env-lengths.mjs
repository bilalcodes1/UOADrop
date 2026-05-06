#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const names = process.argv.slice(2);
if (names.length === 0) {
  console.error('Usage: node scripts/debug-vercel-env-lengths.mjs NAME [NAME...]');
  process.exit(1);
}

const tempDir = mkdtempSync(join(tmpdir(), 'uoadrop-vercel-env-debug-'));
const envFile = join(tempDir, 'production.env');

try {
  execFileSync('pnpm', ['dlx', 'vercel@latest', 'env', 'pull', envFile, '--environment=production'], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const text = readFileSync(envFile, 'utf8');
  const lines = text.split(/\r?\n/);
  const result = {};
  for (const name of names) {
    const line = lines.find((entry) => entry.trim().startsWith(`${name}=`) || entry.trim().startsWith(`export ${name}=`));
    if (!line) {
      result[name] = { found: false };
      continue;
    }
    const valuePart = line.slice(line.indexOf('=') + 1).trim();
    result[name] = {
      found: true,
      valuePartLength: valuePart.length,
      quoted: (valuePart.startsWith('"') && valuePart.endsWith('"')) || (valuePart.startsWith("'") && valuePart.endsWith("'")),
      emptyAssignment: valuePart === '' || valuePart === '""' || valuePart === "''",
    };
  }
  console.log(JSON.stringify(result, null, 2));
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
