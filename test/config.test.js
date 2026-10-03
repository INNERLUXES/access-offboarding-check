import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG_LIMITS, ConfigError, DEFAULTS, EXPORT_KEYS, KEYS, RULE_IDS, STATUS_KEYS, readConfig, validateConfig } from '../src/index.js';
import { BASE_CONFIG, configOf, configWith, lineOf } from './helpers.js';

// Every problem of a configuration, as texts.
function problems(object) {
  try {
    configOf(object);
  } catch (error) {
    if (error instanceof ConfigError) return error.problems.map((p) => p.text);
    throw error;
  }
  return [];
}
const refused = (object, pattern) => {
  const p = problems(object);
  assert.ok(p.some((t) => pattern.test(t)), `expected ${pattern} in:\n${p.join('\n')}`);
};
const exp = (extra) => ({ name: 'tool', format: 'csv', fields: { email: ['email'] }, ...extra });

test('config: the base configuration gives its normal form with the defaults', () => {
  const c = configOf(BASE_CONFIG);
  assert.deepEqual(c.companyDomains, ['example.com']);
  assert.equal(c.plusAddressing, DEFAULTS.plusAddressing);
  assert.equal(c.domainAliases.size, 0);
  assert.deepEqual(c.leavers, { email: ['email'], username: ['login'], name: ['name'], end: 'end', delimiter: ',' });
  assert.equal(c.exports.length, 1);
  assert.equal(c.exports[0].preset, null);
  assert.equal(c.exports[0].companyAccountsOnly, false);
  assert.deepEqual([...c.exports[0].status[0].active], ['active']);
  assert.deepEqual(c.rules, [{ id: 'still-active', key: 'stillActive', level: 'error', graceDays: 0 }, { id: 'possible-match', key: 'possibleMatch', level: 'warning' }]);
  assert.equal(c.failOn, 'warning');
  assert.deepEqual(RULE_IDS, { stillActive: 'still-active', possibleMatch: 'possible-match', personalAddress: 'personal-address' });
});

test('config: an unknown key is an error with its line and a suggestion, at every level', () => {
  const text = JSON.stringify({ ...BASE_CONFIG, rules: { stillActive: { graceDay: 3 } } }, null, 2);
  try {
    readConfig(text, 'config.json');
    assert.fail('not refused');
  } catch (error) {
    const p = error.problems.map((x) => x.text).join('\n');
    assert.match(p, new RegExp(`config\\.json:${lineOf(text, '"graceDay"')}: rules\\.stillActive\\.graceDay: unknown key; did you mean graceDays\\?`));
  }
  refused(configWith({ exports: [exp({ feilds: {} })] }), /exports\[0\]\.feilds: unknown key; did you mean fields\?/);
  refused(configWith({ exports: [exp({ status: [{ field: 's', active: ['a'], inactive: ['b'], other: 1 }] })] }), /exports\[0\]\.status\[0\]\.other: unknown key/);
  refused(configWith({ colour: 'red' }), /colour: unknown key; the keys here are/);
});

test('config: a key named twice is refused by the JSON reader, with RFC 8259 as the reason', () => {
  assert.throws(() => readConfig('{"failOn": "error", "failOn": "notice"}', 'c.json'), (e) => e instanceof ConfigError && /appears twice in one object; RFC 8259/.test(e.message));
  assert.throws(() => readConfig('{', 'c.json'), (e) => e instanceof ConfigError && /^c\.json: line 1, column 2/.test(e.message));
});

test('config: leavers, exports and one rule are needed, and the leavers need an identifier column', () => {
  refused({ exports: BASE_CONFIG.exports, rules: BASE_CONFIG.rules }, /leavers: is needed/);
  refused(configWith({ exports: undefined }), /exports: is needed/);
  refused(configWith({ rules: undefined }), /rules: is needed: at least one rule/);
  refused(configWith({ rules: {} }), /rules: states no rule/);
  refused(configWith({ leavers: {} }), /leavers\.columns: is needed/);
  refused(configWith({ leavers: { columns: { end: 'end' } } }), /leavers\.columns: names no identifier column/);
  refused(configWith({ leavers: { columns: { email: [] } } }), /leavers\.columns\.email: is an empty list/);
  refused(configWith({ exports: [] }), /exports: is an empty list/);
  refused(configWith({ rules: { stillActive: { level: 'error' } } }), /rules\.stillActive\.graceDays: is needed/);
});

test('config: graceDays is a whole number of days from 0 to the limit, with near misses on both sides', () => {
  assert.equal(configOf(configWith({ rules: { stillActive: { graceDays: 0 } } })).rules[0].graceDays, 0);
  assert.equal(configOf(configWith({ rules: { stillActive: { graceDays: CONFIG_LIMITS.maxGraceDays } } })).rules[0].graceDays, CONFIG_LIMITS.maxGraceDays);
  for (const bad of [-1, 1.5, CONFIG_LIMITS.maxGraceDays + 1, '7', null, true]) refused(configWith({ rules: { stillActive: { graceDays: bad } } }), /rules\.stillActive\.graceDays: /);
  assert.equal(configOf(configWith({ rules: { possibleMatch: {} } })).rules[0].level, DEFAULTS.level, 'the default level');
});

test('config: levels and the fail level are notice, warning or error', () => {
  refused(configWith({ failOn: 'fatal' }), /failOn: must be one of notice, warning, error/);
  refused(configWith({ rules: { possibleMatch: { level: 'ERROR' } } }), /must be one of notice, warning, error/);
  assert.equal(configOf(configWith({ failOn: 'notice' })).failOn, 'notice');
});

test('config: company domains are domain names, lower case, each named once', () => {
  assert.deepEqual(configOf(configWith({ company: { domains: ['Example.COM', 'example.org'] } })).companyDomains, ['example.com', 'example.org']);
  for (const bad of ['example', '@example.com', 'exa mple.com', '-x.example.com', 'example..com', 'https://example.com']) refused(configWith({ company: { domains: [bad] } }), /is not a domain name/);
  refused(configWith({ company: { domains: ['example.com', 'EXAMPLE.com'] } }), /example\.com is named twice/);
  refused(configWith({ company: {} }), /company\.domains: is needed/);
});

test('config: domain aliases map another domain to a company domain, never to itself or through another alias', () => {
  const c = configOf(configWith({ email: { plusAddressing: true, domainAliases: { 'OLD.example.com': 'example.com' } } }));
  assert.equal(c.plusAddressing, true);
  assert.equal(c.domainAliases.get('old.example.com'), 'example.com');
  refused(configWith({ email: { domainAliases: { 'example.org': 'example.org' } } }), /maps a domain to itself/);
  refused(configWith({ email: { domainAliases: { 'a.example.org': 'b.example.org', 'b.example.org': 'example.com' } } }), /which is itself an alias/);
  refused(configWith({ email: { domainAliases: { 'example.com': 'example.org' } } }), /example\.com is a company domain/);
  refused(configWith({ email: { domainAliases: {} } }), /is an empty object/);
  refused(configWith({ email: { domainAliases: ['x'] } }), /must be an object that maps/);
  refused(configWith({ email: { plusAddressing: 'yes' } }), /must be true or false/);
});

test('config: an export with a preset takes its shape from the preset and refuses fields of its own', () => {
  const c = configOf(configWith({ exports: [{ name: 'wiki', preset: 'atlassian-users', companyAccountsOnly: true }] }));
  const e = c.exports[0];
  assert.equal(e.preset, 'atlassian-users');
  assert.equal(e.format, 'csv');
  assert.deepEqual(e.fields, { email: ['Email'], username: [], name: ['User name'] });
  assert.deepEqual([...e.status[0].inactive], ['suspended', 'deactivated']);
  assert.equal(e.companyAccountsOnly, true);
  refused(configWith({ exports: [{ name: 'wiki', preset: 'atlassian-users', fields: { email: ['x'] } }] }), /give a preset or fields, not both/);
  refused(configWith({ exports: [{ name: 'wiki', preset: 'atlassian-users', status: [] }] }), /give a preset or status, not both/);
  refused(configWith({ exports: [{ name: 'wiki', preset: 'atlassian-user' }] }), /unknown preset; did you mean atlassian-users\?/);
  refused(configWith({ exports: [{ name: 'x', preset: 'slack' }] }), /unknown preset; the presets are github-org-members/);
});

test('config: an export without a preset needs a format and fields; rows and the delimiter belong to one format', () => {
  refused(configWith({ exports: [{ name: 'tool', fields: { email: ['e'] } }] }), /exports\[0\]\.format: is needed/);
  refused(configWith({ exports: [{ name: 'tool', format: 'xml', fields: { email: ['e'] } }] }), /must be csv or json/);
  refused(configWith({ exports: [{ name: 'tool', format: 'csv' }] }), /exports\[0\]\.fields: is needed/);
  refused(configWith({ exports: [{ name: 'tool', format: 'csv', fields: {} }] }), /names no column/);
  refused(configWith({ exports: [exp({ rows: 'users' })] }), /is for a JSON export only/);
  refused(configWith({ exports: [exp({ format: 'json', delimiter: ';' })] }), /is for a CSV export only/);
  refused(configWith({ exports: [exp({ format: 'json', fields: { name: ['name..full'] } })] }), /has an empty part/);
  refused(configWith({ exports: [exp({ delimiter: '|' })] }), /must be a comma, a semicolon or a tab/);
  assert.equal(configOf(configWith({ exports: [exp({ delimiter: '\t' })] })).exports[0].delimiter, '\t');
  assert.equal(configOf(configWith({ exports: [exp({ format: 'json', rows: 'data.users' })] })).exports[0].rows, 'data.users');
});

test('config: export names are short, lower case and unique; the field lists name each column once', () => {
  refused(configWith({ exports: [exp({ name: 'Tool' })] }), /must be lower case letters/);
  refused(configWith({ exports: [exp({ name: 'a b' })] }), /must be lower case letters/);
  refused(configWith({ exports: [exp({ name: 'x'.repeat(41) })] }), /at most 40 characters/);
  refused(configWith({ exports: [exp(), exp()] }), /tool is the name of another export/);
  refused(configWith({ exports: [{ format: 'csv', fields: { email: ['e'] } }] }), /exports\[0\]\.name: is needed/);
  refused(configWith({ exports: [exp({ fields: { email: ['e', 'e'] } })] }), /e is named twice/);
  refused(configWith({ exports: ['tool'] }), /must be an object with name/);
});

test('config: a status needs its field and both lists, and a value in both lists is refused', () => {
  const s = (status) => configWith({ exports: [exp({ status })] });
  refused(s([{ active: ['a'], inactive: ['b'] }]), /status\[0\]\.field: is needed/);
  refused(s([{ field: 'f', inactive: ['b'] }]), /status\[0\]\.active: is needed/);
  refused(s([{ field: 'f', active: ['a'] }]), /status\[0\]\.inactive: is needed/);
  refused(s([{ field: 'f', active: ['On'], inactive: ['on'] }]), /on is also in active/);
  refused(s([{ field: 'f', active: ['On', 'ON'], inactive: ['off'] }]), /ON is named twice/);
  refused(s('f'), /status: must be a list/);
  assert.deepEqual(configOf(s([])).exports[0].status, [], 'an empty status list is allowed: every row is active');
});

test('config: company accounts only needs the company domains, and personal-address needs such an export', () => {
  refused(configWith({ company: undefined, exports: [exp({ companyAccountsOnly: true })] }), /company: is needed: tool holds company accounts only/);
  refused(configWith({ rules: { personalAddress: { level: 'warning' } } }), /rules\.personalAddress: needs an export with companyAccountsOnly: true/);
  const c = configOf(configWith({ exports: [exp({ companyAccountsOnly: true })], rules: { personalAddress: { level: 'notice' } } }));
  assert.deepEqual(c.rules, [{ id: 'personal-address', key: 'personalAddress', level: 'notice' }]);
  refused(configWith({ exports: [exp({ companyAccountsOnly: 'yes' })] }), /must be true or false/);
});

test('config: names such as __proto__ are data and change no prototype', () => {
  const p = problems({ ...BASE_CONFIG, ['__proto__']: { polluted: true } });
  assert.ok(p.some((t) => /__proto__: unknown key/.test(t)));
  assert.throws(() => readConfig('{"__proto__": {"failOn": "notice"}}', 'c.json'), /__proto__: unknown key/);
  assert.equal({}.failOn, undefined);
  refused(configWith({ email: { domainAliases: JSON.parse('{"__proto__": "example.com"}') } }), /is not a domain name/);
});

test('config: the configuration must be one object, and every key of the tree is checked against KEYS', () => {
  assert.throws(() => validateConfig([], new Map(), 'c.json'), /must be one JSON object, not an array/);
  assert.throws(() => validateConfig('x', new Map(), 'c.json'), /not a string/);
  assert.ok(Object.keys(KEYS).includes('exports'));
  assert.ok(Object.keys(EXPORT_KEYS).includes('companyAccountsOnly'));
  assert.deepEqual(Object.keys(STATUS_KEYS), ['field', 'active', 'inactive']);
  refused(configWith({ name: '' }), /name: must be a string that is not empty/);
  refused(configWith({ name: 'a\u0007b' }), /no control character/);
  refused(configWith({ leavers: { columns: { email: ['email'] }, delimiter: ':' } }), /leavers\.delimiter: must be a comma/);
});
