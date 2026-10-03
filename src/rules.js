// The three rules and the verdict. A rule is run only when the configuration states it, and every number it compares
// comes from the configuration: the tool has no threshold of its own. Each rule names the sentences of the saved pages it
// rests on (src/data.js); docs/method.md says what each rule can and cannot see.

import { LEVELS } from './data.js';
import { grouped, plural } from './size.js';

export const RULES = [
  {
    id: 'still-active',
    key: 'stillActive',
    title: 'an account that is still active for a person who left',
    facts: ['ps4Credentials', 'ps7Notifications'],
    rule: (r) => `an account that is active, or has a status the configuration does not list, matches a leaver by email address or username, and more than ${plural(r.graceDays, 'day')} have passed since the last day of work`
  },
  {
    id: 'possible-match',
    key: 'possibleMatch',
    title: 'an active account whose full name is the name of a person who left',
    facts: ['ps4Credentials'],
    rule: () => 'an account that is active, or has a status the configuration does not list, matches a leaver by full name only, after the last day of work (and its grace days, when still-active is stated); a name is never an exact match'
  },
  {
    id: 'personal-address',
    key: 'personalAddress',
    title: 'an active account with an address outside the company domains, in a tool that holds company accounts only',
    facts: ['mailboxDomain', 'ps7Requirements'],
    rule: (r, config) => `an account that is active, or has a status the configuration does not list, in an export with companyAccountsOnly, has an email address whose domain is not ${config.companyDomains.join(', ')}`
  }
];

export const ruleById = (id) => RULES.find((r) => r.id === id);

// True when a level is the fail level or above it.
export const atOrAbove = (level, failOn) => LEVELS.indexOf(level) >= LEVELS.indexOf(failOn);

// The grace of a leaver: whether the last day of work is far enough behind the as-of day for the rules to look at the
// accounts. daysSince is null when the leavers file gives no end of work for the person, who is then taken as gone.
// Returns { due, text }.
export function dueOf(daysSince, graceDays) {
  if (daysSince === null) return { due: true, text: 'taken as left' };
  if (daysSince > graceDays) return { due: true, text: graceDays ? `past the ${plural(graceDays, 'grace day')}` : 'past the last day of work' };
  if (daysSince > 0) return { due: false, text: `in the grace period: ${plural(daysSince, 'day')} of ${plural(graceDays, 'grace day')} passed` };
  return { due: false, text: daysSince === 0 ? 'the last day of work is the as-of day' : 'still working: the last day of work is after the as-of day' };
}

// The verdict: { pass, failOn, failing, byLevel, text }.
export function decide(findings, failOn) {
  const byLevel = { error: 0, warning: 0, notice: 0 };
  for (const f of findings) byLevel[f.level] += 1;
  const failing = findings.filter((f) => atOrAbove(f.level, failOn)).length;
  const text = failing ? `FAIL - ${plural(failing, 'finding')} at or above ${failOn}` : `PASS - no finding at or above ${failOn}${findings.length ? ` (${grouped(findings.length)} below it)` : ''}`;
  return { pass: failing === 0, failOn, failing, byLevel, text };
}
