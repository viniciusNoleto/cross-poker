// Lista (ou corrige, com --fix) classes Tailwind que têm forma canônica/nativa,
// usando o mesmo motor do aviso do IntelliSense do Tailwind ("The class ... can be written as ...").
//
//   npm run lint:tailwind          → só lista, sai com código 1 se achar algo
//   npm run lint:tailwind -- --fix → reescreve os arquivos
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { __unstable__loadDesignSystem } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';

const root = process.cwd();
const fix = process.argv.includes('--fix');

const css = fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8');
const designSystem = await __unstable__loadDesignSystem(css, { base: path.join(root, 'app') });

const files = execSync("git ls-files -co --exclude-standard -- '*.tsx' '*.ts' '*.jsx' '*.js' '*.mjs' '*.css'", { encoding: 'utf8' })
  .split('\n')
  .filter((file) => file && !/^(node_modules|\.next|public)\//.test(file) && fs.existsSync(file));

const scanner = new Scanner({});
let total = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const found = [];

  for (const { candidate, position } of scanner.getCandidatesWithPositions({ content, extension: path.extname(file).slice(1) })) {
    if (!designSystem.parseCandidate(candidate).length) continue;

    const [canonical] = designSystem.canonicalizeCandidates([candidate], { rem: 16 });

    if (canonical && canonical !== candidate) found.push({ candidate, canonical, position });
  }

  if (!found.length) continue;

  total += found.length;

  for (const { candidate, canonical, position } of found) {
    const line = content.slice(0, position).split('\n').length;

    console.log(`${file}:${line}  ${candidate} → ${canonical}`);
  }

  if (fix) {
    let next = content;

    for (const { candidate, canonical, position } of [...found].sort((a, b) => b.position - a.position)) {
      next = next.slice(0, position) + canonical + next.slice(position + candidate.length);
    }

    fs.writeFileSync(file, next);
  }
}

console.log(total ? `\n${total} classe(s) ${fix ? 'corrigida(s)' : 'com forma nativa'}.` : 'Nenhuma classe com forma nativa pendente.');

if (total && !fix) process.exit(1);
