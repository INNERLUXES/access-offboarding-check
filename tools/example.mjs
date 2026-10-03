// Runs the README examples, checks that they report what the README shows, and writes the reports of the made-up company
// to examples/output. CI runs it and then fails if those files changed, so the example output in the repository is always
// the real output.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

// The arguments of the example; every path is relative to the root of the repository.
const ARGS = [
  '--config', 'examples/config.json',
  '--leavers', 'examples/example-co/leavers.csv',
  '--export', 'code=examples/example-co/code-members.json',
  '--export', 'wiki=examples/example-co/wiki-users.csv',
  '--export', 'messenger=examples/example-co/messenger-users.csv'
];

// Runs the tool on files of the repository; the paths shown in the report are relative to the root of the repository.
async function run(argv) {
  let out = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => process.stderr.write(t) }, undefined, root);
  return { code, out };
}

const problems = [];
function expect(name, result, code, expected, unwanted) {
  const missing = expected.filter((e) => !result.out.includes(e));
  const wrong = unwanted.filter((e) => result.out.includes(e));
  if (result.code !== code || missing.length || wrong.length) {
    problems.push(`${name}: unexpected report (exit code ${result.code}, expected ${code}; missing: ${missing.join(' / ') || 'none'}; should not appear: ${wrong.join(' / ') || 'none'})`);
  }
}

const full = await run(ARGS);
process.stdout.write(full.out);
expect('example company', full, 1, [
  'leavers: examples/example-co/leavers.csv (6 rows); end of work in the column last_day: 5 as days from the as-of day, 1 empty',
  'results: 6 leavers, 4 past their last day and grace days; 14 matched accounts: 11 active, 2 inactive, 1 possible by name',
  'findings: 10 (6 error, 4 warning); fail level warning',
  'Dana Reyes: the account dreyes-dev in code is active; matched by username',
  'Priya Nair: the account Priya Nair in wiki is active; matched by email address',
  'Sam Ortiz: the account samo in messenger is not marked inactive; matched by email address and username',
  'the account riley in messenger has r***@studio.example.net outside the company domains',
  'in the grace period: 5 days of 7 grace days passed',
  'still working: the last day of work is after the as-of day',
  'inactive (User status Deactivated)',
  'RESULT: FAIL - 10 findings at or above warning'
], ['dana.reyes@example.com', 'RESULT: PASS', 'Tom Becker: the account']);

// With the fail level at error, the warnings still show and the run still fails on the six errors.
const errorsOnly = await run([...ARGS, '--fail-on', 'error']);
expect('fail on error', errorsOnly, 1, ['RESULT: FAIL - 6 findings at or above error'], []);

// --show-identifiers shows the addresses in full.
const shown = await run([...ARGS, '--show-identifiers', '--explain']);
expect('show identifiers', shown, 1, ['email address Priya.Nair+contract@Example.com in the leavers column email and priya.nair@example.com in the field Email'], ['--show-identifiers shows them']);

// The README shows the whole report and the --explain lines of one finding.
const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
if (!readme.includes(full.out)) problems.push('README: the sample output differs from a real run');

await mkdir(resolve(root, 'examples/output'), { recursive: true });
await writeFile(resolve(root, 'examples/output/example-co.txt'), full.out);
const explain = await run([...ARGS, '--explain']);
if (explain.code !== 1) problems.push(`explain: exit code ${explain.code}, expected 1`);
const explainLines = explain.out.split('\n');
const at = explainLines.findIndex((l) => l.includes('still-active') && l.includes('wiki-users.csv:5'));
const priya = explainLines.slice(at, at + 7).join('\n');
if (at < 0 || !readme.includes(priya)) problems.push('README: the --explain sample of Priya Nair in the wiki differs from a real run');
await writeFile(resolve(root, 'examples/output/example-co-explain.txt'), explain.out);
for (const [format, name] of [['markdown', 'example-co.md'], ['json', 'example-co.json']]) {
  const r = await run([...ARGS, '--format', format, '--explain']);
  if (r.code !== 1) problems.push(`${format}: exit code ${r.code}, expected 1`);
  await writeFile(resolve(root, 'examples/output', name), r.out);
}

if (problems.length) {
  for (const p of problems) console.error(`example: ${p}`);
  process.exit(1);
}
