#!/usr/bin/env node
/**
 * Nila colour gate (docs/objective.md section 9). Semantic token classes only:
 * no raw Tailwind palette colours, no gradients, no backdrop blur.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOTS = ['app', 'components', 'lib'];
const PATTERN =
  /(pink|purple|fuchsia|violet|rose|indigo|cyan|emerald|teal|amber|lime|sky)-[0-9]{2,3}|bg-gradient|backdrop-blur/;
const EXTENSIONS = new Set(['.ts', '.tsx', '.css']);

const hits = [];

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path);
      continue;
    }
    if (!EXTENSIONS.has(path.slice(path.lastIndexOf('.')))) continue;

    const lines = readFileSync(path, 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (PATTERN.test(line)) {
        hits.push(`${relative(process.cwd(), path)}:${index + 1}: ${line.trim()}`);
      }
    });
  }
}

for (const root of ROOTS) walk(root);

if (hits.length > 0) {
  console.error('Forbidden colours found (use semantic tokens instead):');
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}

console.log('lint:colors - clean');
