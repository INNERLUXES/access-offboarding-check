import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

const ARGS = ['--config', 'examples/config.json', '--leavers', 'examples/example-co/leavers.csv', '--export', 'code=examples/example-co/code-members.json', '--export', 'wiki=examples/example-co/wiki-users.csv', '--export', 'messenger=examples/example-co/messenger-users.csv'];

async function run(argv, base = root) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

const saved = (name) => readFile(resolve(root, 'examples/output', name), 'utf8');

test('examples: the made-up company fails with the report that is saved in examples/output', async () => {
  const r = await run(ARGS);
  assert.equal(r.code, 1);
  assert.equal(r.err, '');
  assert.equal(r.out, await saved('example-co.txt'));
  assert.match(r.out, /findings: 10 \(6 error, 4 warning\); fail level warning/);
  assert.match(r.out, /RESULT: FAIL - 10 findings at or above warning\n$/);
});

test('examples: --explain, Markdown and JSON are the reports that are saved', async () => {
  assert.equal((await run([...ARGS, '--explain'])).out, await saved('example-co-explain.txt'));
  assert.equal((await run([...ARGS, '--format', 'markdown', '--explain'])).out, await saved('example-co.md'));
  assert.equal((await run([...ARGS, '--format', 'json', '--explain'])).out, await saved('example-co.json'));
});

test('examples: each leaver has the accounts and the findings that the README describes', async () => {
  const report = JSON.parse((await run([...ARGS, '--format', 'json'])).out);
  const summary = Object.fromEntries(report.leavers.map((l) => [l.label, [l.due, l.accounts.map((a) => `${a.export} ${a.strength} ${a.status}${a.finding ? ` ${a.finding}` : ''}`)]]));
  assert.deepEqual(summary, {
    'Dana Reyes': [true, ['code exact active still-active', 'wiki exact inactive', 'messenger exact inactive']],
    'Omar Lind': [true, ['wiki exact active still-active', 'messenger exact active still-active']],
    'Priya Nair': [true, ['code exact active still-active', 'wiki exact active still-active']],
    'Tom Becker': [false, ['code exact active', 'wiki exact active', 'messenger exact active']],
    'Lea Hoffmann': [false, ['code exact active', 'messenger exact active']],
    'Sam Ortiz': [true, ['wiki possible active possible-match', 'messenger exact unknown still-active']]
  });
  assert.deepEqual(report.findings.filter((f) => f.rule === 'personal-address').map((f) => `${f.export} ${f.at.split(':').at(-1)}`), ['wiki 8', 'messenger 4', 'messenger 8']);
});

test('examples: every matching rule is used once at least: case, plus tag, domain alias, username, name only', async () => {
  const report = JSON.parse((await run([...ARGS, '--format', 'json', '--explain', '--show-identifiers'])).out);
  const reasons = report.leavers.flatMap((l) => l.accounts.flatMap((a) => a.reasons)).join('\n');
  for (const s of ['the plus tag left out', 'the domain old.example.com read as example.com', 'read without case', 'username omar in the leavers column messenger_handle', 'full name Sam Ortiz in the leavers column full_name and Sam  Ortiz in the field User name']) assert.ok(reasons.includes(s), s);
});

test('examples: the same files written with CRLF line ends give the same reports, with the same lines', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'access-offboarding-check-crlf-'));
  try {
    await cp(resolve(root, 'examples'), resolve(dir, 'examples'), { recursive: true });
    const walk = async (rel) => {
      for (const e of await readdir(resolve(dir, rel), { withFileTypes: true })) {
        const r = `${rel}/${e.name}`;
        if (e.isDirectory()) await walk(r);
        else if (!r.startsWith('examples/output/')) {
          const text = (await readFile(resolve(dir, r), 'utf8')).split('\r\n').join('\n');
          await writeFile(resolve(dir, r), text.split('\n').join('\r\n'));
        }
      }
    };
    await walk('examples');
    const r = await run([...ARGS, '--explain'], dir);
    assert.equal(r.code, 1);
    assert.equal(r.out, await saved('example-co-explain.txt'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
