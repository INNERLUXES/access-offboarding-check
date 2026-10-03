import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { EXPORT_FORMATS, FACTS, IDENTIFIER_KINDS, LEVELS, PRESETS, RULES, SOURCES, factPage, flat, source } from '../src/index.js';

// These tests read the saved pages again and compare them with src/data.js: every sentence that a rule, a preset or a
// document quotes.

const text = async (id) => readFile(new URL(`../research/sources/${source(id).file}`, import.meta.url), 'utf8');
const has = (page, needle) => flat(page).includes(flat(needle));
// The words of a tool that wrote a text, built from pieces so that this file does not hold them.
const WRITTEN = new RegExp(`\\b(?:${['A', 'I'].join('')}|${['cha', 't'].join('')}|${['gene', 'rated'].join('')}|${['assis', 'tants?'].join('')}|${['g', 'pt'].join('')}|${['l', 'lms?'].join('')})\\b|${['clau', 'de'].join('')}|${['anthro', 'pic'].join('')}|${['ses', 'sion'].join('')}`, 'i');
const YEAR = /\b(?:19|20)\d{2}\b/;

test('sources: every saved page has its address on the first line, as listed in src/data.js, and holds text', async () => {
  for (const s of SOURCES) {
    const page = await text(s.id);
    assert.equal(page.split('\n')[0], `Source: ${s.url}`, s.file);
    assert.ok(page.length > 400, `${s.file} holds the page text`);
    assert.match(s.url, /^https:\/\/[a-z0-9.-]+\/[A-Za-z0-9/._?=:-]*$/);
    assert.ok(s.label.length > 10, s.id);
  }
  assert.equal(SOURCES.length, new Set(SOURCES.map((s) => s.url)).size);
  assert.equal(SOURCES.length, new Set(SOURCES.map((s) => s.file)).size);
  assert.equal(SOURCES.length, new Set(SOURCES.map((s) => s.id)).size);
});

test('sources: every file in research/sources is listed in src/data.js, and the other way round', async () => {
  const files = (await readdir(new URL('../research/sources/', import.meta.url))).sort();
  assert.deepEqual(files, SOURCES.map((s) => s.file).sort());
});

test('sources: NIST through the OSCAL catalog of usnistgov, the RFC Editor, EUR-Lex, and the pages of each preset', () => {
  const hosts = SOURCES.map((s) => new URL(s.url).host);
  assert.deepEqual([...new Set(hosts)].sort(), ['developers.google.com', 'docs.github.com', 'eur-lex.europa.eu', 'learn.microsoft.com', 'raw.githubusercontent.com', 'support.atlassian.com', 'www.rfc-editor.org']);
  assert.ok(source('nist-ps').url.startsWith('https://raw.githubusercontent.com/usnistgov/oscal-content/'));
});

test('sources: no saved page holds a year, a mention of a tool that wrote it, a control byte, a carriage return or a character that is not ASCII', async () => {
  for (const s of SOURCES) {
    const page = await text(s.id);
    assert.doesNotMatch(page, YEAR, s.file);
    assert.doesNotMatch(page, WRITTEN, s.file);
    assert.doesNotMatch(page, new RegExp(`[${String.fromCharCode(1)}-${String.fromCharCode(8)}]`), s.file);
    assert.ok(!page.includes('\r'), s.file);
    assert.ok([...page].every((c) => c.charCodeAt(0) < 128), s.file);
    assert.ok(page.endsWith('\n'), s.file);
  }
});

test('the NIST page holds PS-4 and PS-7 with their statements, parameters and guidance, as the catalog writes them', async () => {
  const page = await text('nist-ps');
  for (const s of ['Control PS-4: Personnel Termination', 'Control PS-7: External Personnel Security', 'a. Disable system access within {{ insert: param, ps-04_odp.01 }};', 'ps-04_odp.01 (label: time period)', 'd. Require external providers to notify {{ insert: param, ps-07_odp.01 }} of any personnel transfers or terminations of external personnel who possess organizational credentials and/or badges, or who have system privileges within {{ insert: param, ps-07_odp.02 }} ; and', 'NIST SP 800-53 Rev. 5']) assert.ok(page.includes(s), s);
});

test('facts: every quoted sentence is on its saved page, word for word, with its section, no year and no mention of a tool that wrote it', async () => {
  for (const [key, fact] of Object.entries(FACTS)) {
    assert.ok(SOURCES.some((s) => s.id === fact.source), key);
    assert.ok(has(await text(fact.source), fact.text), `${key}: "${fact.text}"`);
    assert.ok(has(await text(fact.source), fact.section.replace(/^PS-\d /, '')), `${key}: the section ${fact.section} is on the page`);
    assert.doesNotMatch(fact.text, YEAR, key);
    assert.doesNotMatch(fact.text, WRITTEN, key);
    assert.ok(fact.text.length <= 360, `${key} is short`);
    assert.equal(factPage(key), source(fact.source).url);
  }
});

test('facts: the PS-4 and PS-7 sentences are in the part of their own control', async () => {
  const page = await text('nist-ps');
  const ps7 = page.indexOf('Control PS-7');
  for (const [key, fact] of Object.entries(FACTS).filter(([, f]) => f.source === 'nist-ps')) {
    const at = page.indexOf(fact.text);
    assert.ok(at > 0, key);
    assert.equal(at > ps7, fact.section.startsWith('PS-7'), key);
  }
});

test('facts: every rule and every preset rests on sentences of src/data.js, and every source page is quoted at least once', () => {
  for (const r of RULES) {
    assert.match(r.id, /^[a-z]+(?:-[a-z]+)*$/, r.id);
    assert.ok(r.title.length > 10, r.id);
    assert.ok(r.facts.length >= 1 && r.facts.length <= 2, r.id);
    for (const k of r.facts) assert.ok(FACTS[k], `${r.id}: ${k}`);
  }
  for (const [name, p] of Object.entries(PRESETS)) for (const k of p.facts) assert.ok(FACTS[k], `${name}: ${k}`);
  const quoted = new Set(Object.values(FACTS).map((f) => f.source));
  for (const s of SOURCES) assert.ok(quoted.has(s.id), s.id);
});

test('lists: the levels, the identifier kinds and the formats', () => {
  assert.deepEqual(LEVELS, ['notice', 'warning', 'error']);
  assert.deepEqual(IDENTIFIER_KINDS, ['email', 'username', 'name']);
  assert.deepEqual(EXPORT_FORMATS, ['csv', 'json']);
});

test('src writes no quoted sentence outside src/data.js', async () => {
  for (const file of (await readdir(new URL('../src/', import.meta.url))).filter((f) => f !== 'data.js')) {
    const code = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
    for (const fact of Object.values(FACTS)) if (fact.text.length > 40) assert.ok(!code.includes(fact.text.slice(0, 40)), `${file} writes "${fact.text.slice(0, 40)}" itself`);
  }
});

test('docs: every sentence that the documents quote from a saved page is on a saved page', async () => {
  const pages = (await Promise.all(SOURCES.map((s) => text(s.id)))).map(flat).join(' ');
  let checked = 0;
  const files = ['docs/method.md', 'docs/rules-and-sources.md', 'docs/inputs.md', 'docs/limits.md', 'docs/threat-model.md', 'docs/secure-defaults.md', 'docs/decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md', 'README.md'];
  for (const file of files) {
    const doc = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    // Code blocks and inline code hold file contents, not quotes.
    const prose = doc.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
    for (const m of prose.matchAll(/"([^"\n]{30,400})"/g)) {
      assert.ok(pages.includes(flat(m[1])), `${file}: ${m[1]}`);
      checked += 1;
    }
  }
  assert.ok(checked >= 10, `${checked} quotes checked`);
});

test('docs: docs/rules-and-sources.md names every saved page, every quoted sentence and every rule with its sentences', async () => {
  const doc = await readFile(new URL('../docs/rules-and-sources.md', import.meta.url), 'utf8');
  for (const s of SOURCES) {
    assert.ok(doc.includes(s.file), s.file);
    assert.ok(doc.includes(s.url), s.url);
  }
  for (const [key, fact] of Object.entries(FACTS)) assert.ok(doc.includes(`| \`${key}\` |`) && doc.includes(flat(fact.text).replace(/\|/g, '\\|')), key);
  for (const r of RULES) {
    assert.ok(doc.includes(`| \`${r.id}\` | \`rules.${r.key}\` |`), r.id);
    assert.ok(doc.includes(`(method.md#${r.id})`), r.id);
    for (const k of r.facts) assert.ok(new RegExp(`\\| \`${k}\` \\| [^|]*\`${r.id}\``).test(doc), `${k} is used by ${r.id}`);
  }
  for (const name of Object.keys(PRESETS)) assert.ok(doc.includes(`\`${name}\``), name);
});
