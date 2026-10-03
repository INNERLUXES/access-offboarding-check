import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { USAGE, VERSION, guardFormula, main, mdCell, parseArgs, toJson, toMarkdown, toText } from '../src/index.js';
import { ARGS, BASE_CONFIG, DAY0, accountsCsv, cli, configText, configWith, filesWith, isoDay, leaversCsv, lineOf, run, withFiles } from './helpers.js';

test('cli: --help and --version print and exit 0; the usage names every option, preset and rule', async () => {
  const help = await cli(['--help'], process.cwd());
  assert.equal(help.code, 0);
  assert.equal(help.out, USAGE);
  for (const o of ['--config', '--leavers', '--export', '--as-of', '--format', '--explain', '--show-identifiers', '--fail-on', '--out', 'github-org-members', 'atlassian-users', 'still-active (rules.stillActive)', 'personal-address']) assert.ok(USAGE.includes(o), o);
  const version = await cli(['--version'], process.cwd());
  assert.equal(version.out, `${VERSION}\n`);
  assert.equal(VERSION, '1.0.0');
});

test('cli: usage errors exit 2 with the reason and the usage on standard error', async () => {
  for (const [argv, pattern] of [
    [[], /give the configuration file with --config/],
    [['--config', 'c.json'], /give the leavers file with --leavers/],
    [['--config', 'c.json', '--leavers', 'l.csv'], /give at least one account export with --export/],
    [['--config', 'c.json', '--config', 'd.json'], /--config was given twice/],
    [[...ARGS, '--export', 'tool=other.csv'], /--export tool was given twice/],
    [[...ARGS.slice(0, 4), '--export', 'tool'], /--export needs <name>=<file>/],
    [[...ARGS.slice(0, 4), '--export', '=x.csv'], /--export needs <name>=<file>/],
    [[...ARGS.slice(0, 4), '--export', 'tool='], /--export needs <name>=<file>/],
    [[...ARGS, '--format', 'html'], /unknown format html/],
    [[...ARGS, '--fail-on', 'fatal'], /unknown level fatal/],
    [[...ARGS, '--as-of', 'tomorrow'], /--as-of tomorrow is not a date written YYYY-MM-DD/],
    [[...ARGS, '--wat'], /unknown argument --wat/],
    [[...ARGS, 'extra.csv'], /unexpected argument extra\.csv/],
    [[...ARGS, '-'], /standard input is not supported/],
    [['--config', '-'], /standard input is not supported/],
    [['--config'], /--config needs a value/],
    [['--config', '--leavers'], /--config needs a value/],
    [['--config', 'https://example.com/c.json', '--leavers', 'l.csv', '--export', 'a=b'], /never fetches a URL/]
  ]) {
    const r = await cli(argv, process.cwd());
    assert.equal(r.code, 2, argv.join(' '));
    assert.match(r.err, pattern);
    assert.ok(r.err.includes('Usage: access-offboarding-check'), argv.join(' '));
    assert.equal(r.out, '');
  }
  assert.deepEqual(parseArgs([...ARGS, '--export', 'b=C:\\x\\y.csv']).exports.map((e) => e.path), ['tool.csv', 'C:\\x\\y.csv']);
});

test('cli: exit 0 when no finding is at or above the fail level, 1 when one is, and --fail-on moves the level', async () => {
  const clean = await run(filesWith({ 'tool.csv': accountsCsv([['Cy Moe', 'cy@example.com', 'cym', 'active']]) }), ARGS);
  assert.equal(clean.code, 0);
  assert.match(clean.out, /RESULT: PASS - no finding at or above warning\n$/);
  const found = await run(filesWith(), ARGS);
  assert.equal(found.code, 1);
  assert.match(found.out, /RESULT: FAIL - 1 finding at or above warning\n$/);
  const config = configWith({ rules: { stillActive: { graceDays: 0, level: 'notice' } } });
  assert.equal((await run(filesWith({}, config), ARGS)).code, 0);
  assert.equal((await run(filesWith({}, config), [...ARGS, '--fail-on', 'notice'])).code, 1);
});

test('cli: an input problem exits 2 with no verdict and every problem listed', async () => {
  const r = await run({ 'config.json': configText(BASE_CONFIG) }, ARGS);
  assert.equal(r.code, 2);
  assert.match(r.err, /^access-offboarding-check: no verdict, the input has 2 problems:\n {2}leavers\.csv: no such file\n {2}tool\.csv: no such file\n$/);
  assert.equal(r.out, '');
  const bad = await run(filesWith({ 'config.json': '{"rules": 1}' }), ARGS);
  assert.equal(bad.code, 2);
  assert.match(bad.err, /config\.json:1: rules: must be an object/);
});

test('cli: every export the configuration declares must be given, and every one given must be declared', async () => {
  const r = await run(filesWith(), ['--config', 'config.json', '--leavers', 'leavers.csv', '--export', 'tol=tool.csv']);
  assert.equal(r.code, 2);
  assert.match(r.err, /--export tol: the configuration declares no export with this name \(it declares tool\)/);
  assert.match(r.err, /the configuration declares the export tool; give its file with --export tool=<file>/);
});

test('cli: dates in the leavers file need --as-of, and are then compared with it in UTC', async () => {
  const leavers = leaversCsv([['Ana Lopez', 'ana@example.com', 'ana-l', isoDay(DAY0)], ['Ben Ode', 'ben@example.com', 'bode', '-3']]);
  const files = filesWith({ 'leavers.csv': leavers, 'tool.csv': accountsCsv([['Ana Lopez', 'ana@example.com', 'ana-l', 'active']]) });
  const without = await run(files, ARGS);
  assert.equal(without.code, 2);
  assert.match(without.err, new RegExp(`leavers\\.csv:${lineOf(leavers, 'Ana Lopez')}: the column end holds a date; give the day to compare the dates with, --as-of YYYY-MM-DD \\(the tool reads no clock\\)`));
  const before = await run(files, [...ARGS, '--as-of', isoDay(DAY0)]);
  assert.equal(before.code, 0, 'the last day of work is the as-of day');
  assert.ok(before.out.includes(`last day ${isoDay(DAY0)}, on the as-of day`));
  assert.ok(before.out.includes(`as-of day ${isoDay(DAY0)}`));
  const after = await run(files, [...ARGS, '--as-of', isoDay(DAY0 + 1), '--format', 'json']);
  assert.equal(after.code, 1);
  const report = JSON.parse(after.out);
  assert.equal(report.inputs.asOf, isoDay(DAY0 + 1));
  assert.equal(report.leavers[0].daysSinceEnd, 1);
  assert.equal(report.leavers[0].end, `last day ${isoDay(DAY0)}, 1 day before the as-of day`);
});

test('reports: email addresses are masked in text, Markdown and JSON unless --show-identifiers is given', async () => {
  for (const format of ['text', 'markdown', 'json']) {
    const masked = await run(filesWith(), [...ARGS, '--format', format, '--explain']);
    assert.ok(!masked.out.includes('ana@example.com'), format);
    assert.ok(masked.out.includes('a***@example.com') || masked.out.includes('a\\*\\*\\*@example.com'), format);
    const shown = await run(filesWith(), [...ARGS, '--format', format, '--explain', '--show-identifiers']);
    assert.ok(shown.out.includes('ana@example.com'), format);
  }
  const text = await run(filesWith(), ARGS);
  assert.match(text.out, /Email addresses are masked; --show-identifiers shows them\./);
});

test('reports: the text report lists the inputs, the findings with their row, every leaver with every matched account', async () => {
  const r = await run(filesWith(), [...ARGS, '--explain']);
  assert.match(r.out, /^access-offboarding-check: config\.json\n/);
  assert.match(r.out, /\nleavers: leavers\.csv \(2 rows\); end of work in the column end: 2 as days from the as-of day\n/);
  assert.match(r.out, /\nexports: tool tool\.csv \(CSV\): 3 accounts, 2 active, 1 inactive\n/);
  assert.match(r.out, /\n {2}ERROR {4}still-active {6}tool\.csv:2\n {11}Ana Lopez: the account ana-l in tool is active; matched by email address and username\n/);
  assert.match(r.out, /why: email address a\*\*\*@example\.com in the leavers column email and a\*\*\*@example\.com in the field email, equal as written/);
  assert.match(r.out, /basis: "Terminate or revoke any authenticators and credentials associated with the individual;" \(PS-4 Statement, https:\/\/raw\.githubusercontent\.com\//);
  assert.match(r.out, /\n {2}Ben Ode {2}\(line 3\) {2}last day 3 days before the as-of day; past the last day of work\n {4}identifiers: email b\*\*\*@example\.com; username bode; name Ben Ode\n {4}tool {2}bode {2}inactive \(status disabled\) {2}exact: email address, username\n {6}at tool\.csv:3\n/);
});

test('reports: a leaver known only by an email address is named by the masked address, and the full one with --show-identifiers', async () => {
  const config = configWith({ leavers: { columns: { email: ['email'], end: 'end' } } });
  const files = filesWith({ 'leavers.csv': leaversCsv([['', 'ana@example.com', '', '-3']]) }, config);
  const masked = JSON.parse((await run(files, [...ARGS, '--format', 'json'])).out);
  assert.equal(masked.leavers[0].label, 'a***@example.com');
  assert.equal(masked.findings[0].leaver, 'a***@example.com');
  const shown = JSON.parse((await run(files, [...ARGS, '--format', 'json', '--show-identifiers'])).out);
  assert.equal(shown.leavers[0].label, 'ana@example.com');
});

test('reports: a leaver with no account found says so, and no finding prints none', async () => {
  const r = await run(filesWith({ 'tool.csv': accountsCsv([['Cy Moe', 'cy@example.com', 'cym', 'active']]) }), ARGS);
  assert.match(r.out, /Findings \(0\)\n\n {2}none\n/);
  assert.match(r.out, /Ana Lopez {2}\(line 2\).*\n {4}no account found in the exports\n/);
});

test('reports: Markdown escapes table characters and guards cells a spreadsheet would read as a formula', async () => {
  assert.equal(guardFormula('=cmd|"/C calc"!A0'), '\'=cmd|"/C calc"!A0');
  for (const c of ['+1', '-1', '@SUM(A1)', '\tx', '\rx']) assert.equal(guardFormula(c)[0], "'", JSON.stringify(c));
  assert.equal(guardFormula('Ana'), 'Ana');
  assert.equal(guardFormula(''), '');
  assert.equal(mdCell('=1+1|x'), "'=1+1\\|x");
  assert.equal(mdCell('a|b<c>&[d](e)`f`*g*_h_\\i\nj'), 'a\\|b&lt;c&gt;&amp;\\[d\\](e)\\`f\\`\\*g\\*\\_h\\_\\\\i j');
  const leavers = leaversCsv([['=HYPERLINK("http://x.example.com","y")', 'ana@example.com', '@cmd|x', '-3']]);
  const r = await run(filesWith({ 'leavers.csv': leavers, 'tool.csv': accountsCsv([['+danger', 'ana@example.com', '-x', 'active']]) }), [...ARGS, '--format', 'markdown', '--explain']);
  assert.equal(r.code, 1);
  const rows = r.out.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| ---'));
  for (const row of rows) {
    const cells = row.slice(2, -2).split(/(?<!\\) \| /);
    for (const cell of cells) assert.ok(!/^[=+\-@]/.test(cell), `a cell starts like a formula: ${cell}`);
  }
  assert.ok(r.out.includes("'=HYPERLINK"), 'the leaver name is kept, with the guard');
  assert.ok(!r.out.includes('](http'), 'no link is made');
});

test('reports: the JSON report holds the configuration, the inputs, the totals, the findings, the leavers and the verdict', async () => {
  const plain = JSON.parse((await run(filesWith(), [...ARGS, '--format', 'json'])).out);
  assert.equal(plain.tool, 'access-offboarding-check');
  assert.equal(plain.version, VERSION);
  assert.deepEqual(Object.keys(plain), ['tool', 'version', 'config', 'inputs', 'totals', 'showIdentifiers', 'findings', 'leavers', 'verdict', 'notes']);
  assert.deepEqual(plain.totals, { leavers: 2, due: 2, exports: 1, accounts: 3, matched: 2, exactLive: 1, exactInactive: 1, possible: 0 });
  assert.equal(plain.findings[0].why, undefined, 'the reasons are in --explain only');
  assert.equal(plain.leavers[0].accounts[0].reasons, undefined);
  const explained = JSON.parse((await run(filesWith(), [...ARGS, '--format', 'json', '--explain'])).out);
  assert.equal(explained.findings[0].basis.length, 2);
  assert.equal(explained.leavers[0].accounts[0].reasons.length, 2);
  assert.deepEqual(explained.verdict, { pass: false, failOn: 'warning', failing: 1, byLevel: { error: 1, warning: 0, notice: 0 }, text: 'FAIL - 1 finding at or above warning' });
});

test('reports: toText, toMarkdown and toJson take the same report', async () => {
  const report = JSON.parse((await run(filesWith(), [...ARGS, '--format', 'json', '--explain'])).out);
  assert.match(toText(report), /RESULT: FAIL/);
  assert.match(toMarkdown(report, { explain: true }), /^## access-offboarding-check: FAIL/);
  assert.equal(JSON.parse(toJson(report, { explain: true })).findings.length, 1);
  assert.match(toMarkdown({ ...report, findings: [], leavers: [], notes: [] }), /### Findings\n\nNone\.\n\n### Leavers\n\nNone\./);
});

test('--out: the report goes to the file and nowhere else; the screen gets one line on standard error', async () => {
  await withFiles(filesWith(), async (dir) => {
    let out = '';
    let err = '';
    const code = await main([...ARGS, '--out', 'report.md', '--format', 'markdown'], { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, dir);
    assert.equal(code, 1);
    assert.equal(out, '');
    assert.equal(err, 'access-offboarding-check: the report is in report.md; FAIL - 1 finding at or above warning\n');
    assert.match(await readFile(resolve(dir, 'report.md'), 'utf8'), /^## access-offboarding-check: FAIL/);
    assert.deepEqual((await readdir(dir)).sort(), ['config.json', 'leavers.csv', 'report.md', 'tool.csv'], 'no other file is written');
    const onInput = await main([...ARGS, '--out', 'leavers.csv'], { out: () => {}, err: (t) => { err = t; } }, undefined, dir);
    assert.equal(onInput, 2);
    assert.match(err, /leavers\.csv: is one of the inputs; give --out another file/);
  });
});

test('reports: a run writes nothing to disk without --out', async () => {
  await withFiles(filesWith(), async (dir) => {
    for (const format of ['text', 'markdown', 'json']) await main([...ARGS, '--format', format, '--explain'], { out: () => {}, err: () => {} }, undefined, dir);
    assert.deepEqual((await readdir(dir)).sort(), ['config.json', 'leavers.csv', 'tool.csv']);
  });
});
