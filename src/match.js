// Matching accounts to leavers. Every leaver identifier goes into a map keyed by its normal form (src/identity.js), and
// every identifier of every account is looked up once, so the work grows with the number of rows and never with leavers
// times accounts. An email address or a username that is equal after its normal form is an exact match; a full name that
// is equal after its normal form is a possible match, reported apart and never counted as exact. Every match keeps its
// reasons: which column of the leaver and which field of the account held the values, and which steps of the normal form
// made them equal.

import { companyDomainOf, emailKey, nameKey, usernameKey } from './identity.js';

const add = (map, key, entry) => {
  const list = map.get(key);
  if (list) list.push(entry);
  else map.set(key, [entry]);
};

// The three maps of the leaver identifiers: { email, username, name }, each from a normal form to the leavers that hold
// it, with the column and the steps. shared lists the normal forms that more than one leaver holds.
export function buildIndex(leavers) {
  const index = { email: new Map(), username: new Map(), name: new Map() };
  leavers.forEach((l, i) => {
    for (const e of l.emails) add(index.email, e.key, { leaver: i, column: e.column, raw: e.raw, steps: e.steps });
    for (const u of l.usernames) add(index.username, u.key, { leaver: i, column: u.column, raw: u.raw, steps: u.steps });
    for (const n of l.names) add(index.name, n.key, { leaver: i, column: n.column, raw: n.raw, steps: n.steps });
  });
  const shared = [];
  for (const kind of ['email', 'username']) {
    for (const [key, list] of index[kind]) if (new Set(list.map((x) => x.leaver)).size > 1) shared.push({ kind, key, leavers: [...new Set(list.map((x) => x.leaver))] });
  }
  return { ...index, shared };
}

const KEY_OF = { email: emailKey, username: usernameKey, name: nameKey };

// The matches of one account: [{ leaver, strength: 'exact' | 'possible', reasons }]. options holds plusAddressing and
// domainAliases. bad counts the email values of the account that are not email addresses.
export function matchAccount(index, account, options, bad = { emails: 0 }) {
  const exact = new Map();
  const possible = new Map();
  for (const kind of ['email', 'username', 'name']) {
    for (const v of account.values[kind]) {
      const k = kind === 'email' ? KEY_OF.email(v.raw, options) : KEY_OF[kind](v.raw);
      if (!k) {
        if (kind === 'email') bad.emails += 1;
        continue;
      }
      for (const hit of index[kind].get(k.key) ?? []) {
        const target = kind === 'name' ? possible : exact;
        const reason = { kind, leaverColumn: hit.column, leaverValue: hit.raw, leaverSteps: hit.steps, accountField: v.field, accountValue: v.raw, accountSteps: k.steps };
        add(target, hit.leaver, reason);
      }
    }
  }
  const out = [];
  for (const [leaver, reasons] of exact) out.push({ leaver, strength: 'exact', reasons });
  for (const [leaver, reasons] of possible) if (!exact.has(leaver)) out.push({ leaver, strength: 'possible', reasons });
  return out.sort((a, b) => a.leaver - b.leaver);
}

// The addresses of an account outside the company domains: { checked, outside } where checked is false when the account
// holds no email address at all. Domains are read after the aliases of the configuration.
export function outsideAddresses(account, companyDomains, options) {
  const outside = [];
  let checked = false;
  for (const v of account.values.email) {
    const domain = companyDomainOf(v.raw, options);
    if (domain === null) continue;
    checked = true;
    if (!companyDomains.includes(domain)) outside.push({ field: v.field, value: v.raw, domain });
  }
  return { checked, outside };
}
