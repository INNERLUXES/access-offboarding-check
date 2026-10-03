// Command line: access-offboarding-check --config <file> --leavers <file> --export <name>=<file> [...] [options]

import { readFileSync } from 'node:fs';
import { InputError, checkPaths, presetList } from './check.js';
import { writeReport } from './files.js';
import { toText, toMarkdown, toJson } from './report.js';
import { RULES } from './rules.js';
import { LEVELS } from './data.js';
import { dayOfDate } from './days.js';
import { safeText } from './text.js';

export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const FORMATS = { text: toText, markdown: toMarkdown, json: toJson };

export const USAGE = `Usage: access-offboarding-check --config <file> --leavers <file> --export <name>=<file> [...] [options]

Finds access left behind after people stopped working for the company: contractors, augmented staff and employees.
It reads a CSV file of leavers and the account exports of your tools (CSV or JSON), matches the accounts to the leavers
by email address and username, and by full name as a possible match only, and reports every account that is still
active, with the export, the field that matched and the row. It also reports active accounts with an address outside
the company domains in tools that hold company accounts only. Every number of a rule is yours; the tool has no threshold
of its own. It calls no API, needs no credentials, reads no clock, opens no network connection and writes nothing to
disk but the file --out names. Email addresses are masked unless --show-identifiers is given.

Options:
  --config <file>           the configuration file (JSON): company domains, email rules, leaver columns, exports,
                            rules; required
  --leavers <file>          the leavers file (CSV); required
  --export <name>=<file>    the file of an export the configuration declares; once for each export
  --as-of <YYYY-MM-DD>      the day to compare the end-of-work dates with; needed only when the leavers file holds dates
  --format <name>           text, markdown or json (default: text)
  --explain                 show why each account matched (the column, the field and the steps of the normal form),
                            the status read, and the sentences each rule rests on
  --show-identifiers        show email addresses in full (masked by default: they are personal data)
  --fail-on <level>         the lowest level of a finding that fails the run: ${LEVELS.join(', ')} (default: failOn of
                            the configuration, else warning)
  --out <file>              write the report to this file instead of the screen
  --help                    show this text
  --version                 show the version

Presets:
${presetList().map((p) => `  ${p}`).join('\n')}

Rules: ${RULES.map((r) => `${r.id} (rules.${r.key})`).join(', ')}.

Exit codes: 0 no finding at or above the fail level, 1 a finding at or above it, 2 usage or input error.
`;

const isUrl = (f) => /^[a-z][a-z0-9+.-]*:\/\//i.test(f);

export function parseArgs(argv) {
  const o = { config: null, leavers: null, exports: [], asOf: null, format: 'text', explain: false, showIdentifiers: false, failOn: null, out: null, help: false, version: false };
  const once = (name, current, value) => {
    if (current !== null) throw new Error(`${name} was given twice`);
    return value;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined || (v.startsWith('--') && v.length > 2)) throw new Error(`${a} needs a value`);
      if (v === '-') throw new Error('reading from standard input is not supported; give a file');
      i += 1;
      return v;
    };
    if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--version' || a === '-v') o.version = true;
    else if (a === '--explain') o.explain = true;
    else if (a === '--show-identifiers') o.showIdentifiers = true;
    else if (a === '--config') o.config = once(a, o.config, next());
    else if (a === '--leavers') o.leavers = once(a, o.leavers, next());
    else if (a === '--as-of') o.asOf = once(a, o.asOf, next());
    else if (a === '--out') o.out = once(a, o.out, next());
    else if (a === '--format') o.format = next();
    else if (a === '--fail-on') o.failOn = once(a, o.failOn, next());
    else if (a === '--export') {
      const v = next();
      const eq = v.indexOf('=');
      if (eq <= 0 || eq === v.length - 1) throw new Error(`--export needs <name>=<file>, such as --export wiki=exports/wiki.csv; got ${v}`);
      const name = v.slice(0, eq);
      if (o.exports.some((e) => e.name === name)) throw new Error(`--export ${name} was given twice`);
      o.exports.push({ name, path: v.slice(eq + 1) });
    } else if (a === '-') throw new Error('reading from standard input is not supported; give a file');
    else if (a.startsWith('-')) throw new Error(`unknown argument ${a}`);
    else throw new Error(`unexpected argument ${a}; give each file with its option, such as --leavers ${a}`);
  }
  if (!o.help && !o.version) {
    if (!o.config) throw new Error('give the configuration file with --config <file>');
    if (!o.leavers) throw new Error('give the leavers file with --leavers <file>');
    if (!o.exports.length) throw new Error('give at least one account export with --export <name>=<file>');
    for (const p of [o.config, o.leavers, o.out, ...o.exports.map((e) => e.path)].filter(Boolean)) if (isUrl(p)) throw new Error('give a local path; the tool never fetches a URL');
    if (!Object.hasOwn(FORMATS, o.format)) throw new Error(`unknown format ${o.format} (text, markdown or json)`);
    if (o.failOn !== null && !LEVELS.includes(o.failOn)) throw new Error(`unknown level ${o.failOn} (${LEVELS.join(', ')})`);
    if (o.asOf !== null && dayOfDate(o.asOf) === null) throw new Error(`--as-of ${o.asOf} is not a date written YYYY-MM-DD`);
  }
  return o;
}

const clean = (text) => safeText(text, 1500);

// Exit code: 0 no finding at or above the fail level, 1 a finding at or above it, 2 usage or input error.
export async function main(argv, io = { out: (t) => process.stdout.write(t), err: (t) => process.stderr.write(t) }, limits = undefined, base = process.cwd()) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (error) {
    io.err(`access-offboarding-check: ${clean(error.message)}\n\n${USAGE}`);
    return 2;
  }
  if (o.help) {
    io.out(USAGE);
    return 0;
  }
  if (o.version) {
    io.out(`${VERSION}\n`);
    return 0;
  }
  let report;
  try {
    report = await checkPaths({ config: o.config, leavers: o.leavers, exports: o.exports, asOf: o.asOf, failOn: o.failOn, showIdentifiers: o.showIdentifiers, version: VERSION, limits, base });
  } catch (error) {
    if (error instanceof InputError) io.err(`access-offboarding-check: no verdict, the input has ${error.problems.length === 1 ? 'a problem' : `${error.problems.length} problems`}:\n${error.problems.map((p) => `  ${clean(p)}`).join('\n')}\n`);
    else io.err(`access-offboarding-check: ${clean(error.message)}\n`);
    return 2;
  }
  const text = FORMATS[o.format](report, { explain: o.explain });
  if (o.out) {
    try {
      const shown = await writeReport(o.out, text, base, [o.config, o.leavers, ...o.exports.map((e) => e.path)]);
      io.err(`access-offboarding-check: the report is in ${clean(shown)}; ${report.verdict.text}\n`);
    } catch (error) {
      io.err(`access-offboarding-check: ${clean(error.message)}\n`);
      return 2;
    }
  } else io.out(text);
  return report.verdict.pass ? 0 : 1;
}
