// The three reports: text for a terminal, Markdown for a ticket or a job summary, and JSON for other tools. Every text
// from the input (a name, a username, an address, a field name, a status value) was cleaned by safeText before it reached
// the report, and email addresses are masked unless --show-identifiers was given. The Markdown report also escapes each
// cell, so a value cannot break a table, make a link or be read as HTML, and a cell that starts with =, +, -, @, a tab or
// a carriage return gets a leading apostrophe, so a spreadsheet that the table is pasted into does not read it as a
// formula. The reports hold no clock time.

import { grouped, plural } from './size.js';

const FORMULA_START = new Set(['=', '+', '-', '@', '\t', '\r']);

// A cell that a spreadsheet would read as a formula, with a leading apostrophe.
export function guardFormula(t) {
  const s = String(t);
  return s.length && FORMULA_START.has(s[0]) ? `'${s}` : s;
}

export function mdCell(t) {
  return guardFormula(String(t))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/[[\]`*_]/g, (c) => `\\${c}`)
    .replace(/\r?\n|\r/g, ' ');
}

function head(r) {
  return `${r.config.file}${r.config.name ? ` (${r.config.name})` : ''}`;
}

function leaversLine(r) {
  const l = r.inputs.leavers;
  const parts = [];
  if (l.ends.relative) parts.push(`${grouped(l.ends.relative)} as days from the as-of day`);
  if (l.ends.date) parts.push(`${grouped(l.ends.date)} as dates`);
  if (l.ends.none) parts.push(`${grouped(l.ends.none)} empty`);
  const ends = l.endColumn ? `end of work in the column ${l.endColumn}: ${parts.join(', ')}` : 'no end-of-work column; every leaver is taken as left';
  return `${l.file} (${plural(l.rows, 'row')}); ${ends}${r.inputs.asOf ? `; as-of day ${r.inputs.asOf}` : ''}`;
}

function exportLine(e) {
  const how = [e.format.toUpperCase(), ...(e.preset ? [`preset ${e.preset}`] : []), ...(e.companyAccountsOnly ? ['company accounts only'] : [])].join(', ');
  const parts = [`${grouped(e.active)} active`];
  if (e.inactive) parts.push(`${grouped(e.inactive)} inactive`);
  if (e.unknown) parts.push(`${grouped(e.unknown)} with a status not listed`);
  return `${e.name} ${e.file} (${how}): ${plural(e.accounts, 'account')}, ${parts.join(', ')}`;
}

function matchingLine(r) {
  const c = r.config;
  const email = ['email addresses and usernames without case'];
  if (c.plusAddressing) email.push('the plus tag left out');
  if (c.domainAliases) email.push(plural(c.domainAliases, 'domain alias', 'domain aliases'));
  return `${email.join(', ')}; full names give possible matches only`;
}

function rulesLine(r) {
  return r.config.rules.map((x) => `${x.id} (${x.level}${x.graceDays !== undefined ? `, ${plural(x.graceDays, 'grace day')}` : ''}${x.id === 'personal-address' ? `, company domains ${r.config.companyDomains.join(', ')}` : ''})`).join('; ');
}

function resultsLine(r) {
  const t = r.totals;
  return `${plural(t.leavers, 'leaver')}, ${grouped(t.due)} past their last day and grace days; ${plural(t.matched, 'matched account')}: ${grouped(t.exactLive)} active, ${grouped(t.exactInactive)} inactive, ${grouped(t.possible)} possible by name`;
}

function findingsLine(r) {
  const b = r.verdict.byLevel;
  const parts = ['error', 'warning', 'notice'].filter((l) => b[l]).map((l) => `${grouped(b[l])} ${l}`);
  return `${grouped(r.findings.length)}${parts.length ? ` (${parts.join(', ')})` : ''}; fail level ${r.verdict.failOn}`;
}

const strengthText = (a) => `${a.strength}: ${a.matchedBy.join(', ')}`;

// Pads the columns of a table of text to their widths.
function table(rows, indent = '  ') {
  const widths = rows[0].map((_, i) => Math.min(40, Math.max(...rows.map((row) => String(row[i]).length))));
  return rows.map((row) => `${indent}${row.map((cell, i) => (i === row.length - 1 ? String(cell) : String(cell).padEnd(widths[i]))).join('  ')}`.trimEnd());
}

export function toText(r, { explain = false } = {}) {
  const out = [];
  out.push(`access-offboarding-check: ${head(r)}`);
  out.push(`leavers: ${leaversLine(r)}`);
  r.inputs.exports.forEach((e, i) => out.push(`${i === 0 ? 'exports: ' : '         '}${exportLine(e)}`));
  out.push(`matching: ${matchingLine(r)}`);
  out.push(`rules: ${rulesLine(r)}`);
  out.push(`results: ${resultsLine(r)}`);
  out.push(`findings: ${findingsLine(r)}`);
  out.push('', `Findings (${grouped(r.findings.length)})`, '');
  if (!r.findings.length) out.push('  none', '');
  const pad = ' '.repeat(11);
  for (const f of r.findings) {
    out.push(`  ${f.level.toUpperCase().padEnd(8)} ${f.rule.padEnd(16)}  ${f.at}`);
    out.push(`${pad}${f.found}`);
    if (explain) {
      for (const w of f.why) out.push(`${pad}why: ${w}`);
      for (const b of f.basis) out.push(`${pad}basis: "${b.text}" (${b.section}, ${b.page})`);
    }
    out.push('');
  }
  out.push(`Leavers (${grouped(r.leavers.length)})`, '');
  if (!r.leavers.length) out.push('  none', '');
  for (const l of r.leavers) {
    out.push(`  ${l.label}  (line ${grouped(l.line)})  ${l.end}; ${l.dueText}`);
    if (explain) {
      const ids = ['email', 'username', 'name'].filter((k) => l.identifiers[k].length).map((k) => `${k} ${l.identifiers[k].join(', ')}`);
      out.push(`    identifiers: ${ids.join('; ')}`);
    }
    if (!l.accounts.length) out.push('    no account found in the exports');
    else {
      const rows = l.accounts.map((a) => [a.export, a.account, a.statusShort, strengthText(a), a.finding ? `FINDING ${a.finding}` : '']);
      for (const [i, line] of table(rows, '    ').entries()) {
        out.push(line);
        if (explain) {
          out.push(`      at ${l.accounts[i].at}`);
          for (const reason of l.accounts[i].reasons) out.push(`      ${reason}`);
        }
      }
    }
    out.push('');
  }
  for (const n of r.notes) out.push(`note: ${n}`);
  if (r.notes.length) out.push('');
  if (!r.showIdentifiers) out.push('Email addresses are masked; --show-identifiers shows them.', '');
  out.push(`RESULT: ${r.verdict.text}`);
  return `${out.join('\n')}\n`;
}

export function toMarkdown(r, { explain = false } = {}) {
  const lines = [`## access-offboarding-check: ${r.verdict.text}`, ''];
  lines.push(`- Configuration: ${mdCell(head(r))}`);
  lines.push(`- Leavers: ${mdCell(leaversLine(r))}`);
  for (const e of r.inputs.exports) lines.push(`- Export: ${mdCell(exportLine(e))}`);
  lines.push(`- Matching: ${mdCell(matchingLine(r))}`);
  lines.push(`- Rules: ${mdCell(rulesLine(r))}`);
  lines.push(`- Results: ${mdCell(resultsLine(r))}`);
  lines.push(`- Findings: ${mdCell(findingsLine(r))}`);
  lines.push('', '### Findings', '');
  if (r.findings.length) {
    lines.push('| Level | Rule | Found | Where |', '| --- | --- | --- | --- |');
    for (const f of r.findings) lines.push(`| ${f.level === 'error' ? '**error**' : f.level} | ${f.rule} | ${mdCell(f.found)} | ${mdCell(f.at)} |`);
  } else lines.push('None.');
  if (explain) {
    for (const f of r.findings) {
      lines.push('', `#### ${f.rule}: ${mdCell(f.at)}`, '');
      for (const w of f.why) lines.push(`- Why: ${mdCell(w)}`);
      for (const b of f.basis) lines.push(`- Basis: ${mdCell(`"${b.text}" (${b.section}, ${b.page})`)}`);
    }
  }
  lines.push('', '### Leavers', '');
  if (r.leavers.length) {
    lines.push('| Leaver | Line | End of work | Export | Account | Status | Match | Finding |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const l of r.leavers) {
      const first = [mdCell(l.label), grouped(l.line), mdCell(`${l.end}; ${l.dueText}`)];
      if (!l.accounts.length) lines.push(`| ${first.join(' | ')} | none | none | none | none | none |`);
      l.accounts.forEach((a, i) => {
        const lead = i === 0 ? first : ['', '', ''];
        lines.push(`| ${[...lead, mdCell(a.export), mdCell(a.account), mdCell(a.statusShort), mdCell(strengthText(a)), a.finding ?? 'none'].join(' | ')} |`);
      });
    }
    if (explain) {
      for (const l of r.leavers) {
        if (!l.accounts.length) continue;
        lines.push('', `#### ${mdCell(l.label)} (line ${grouped(l.line)})`, '');
        for (const a of l.accounts) for (const reason of a.reasons) lines.push(`- ${mdCell(a.export)}, ${mdCell(a.at)}: ${mdCell(reason)}`);
      }
    }
  } else lines.push('None.');
  if (r.notes.length) {
    lines.push('', '### Notes', '');
    for (const n of r.notes) lines.push(`- ${mdCell(n)}`);
  }
  if (!r.showIdentifiers) lines.push('', 'Email addresses are masked; `--show-identifiers` shows them.');
  return `${lines.join('\n')}\n`;
}

export function toJson(r, { explain = false } = {}) {
  const out = {
    ...r,
    findings: r.findings.map((f) => (explain ? f : { ...f, why: undefined, basis: undefined })),
    leavers: r.leavers.map((l) => ({ ...l, accounts: l.accounts.map((a) => (explain ? a : { ...a, reasons: undefined })) }))
  };
  return `${JSON.stringify(out, null, 2)}\n`;
}
