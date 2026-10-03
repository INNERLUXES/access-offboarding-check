// How an identifier is compared, and how it is shown. Each comparison is exact on a normal form that is written out here
// and in docs/method.md; nothing is compared by similarity, and every step that changed a value is returned, so --explain
// can say why two values were taken as the same.
//
// An email address: the text is trimmed, the domain is read without case (RFC 5321 says that mailbox domains "are hence
// not case sensitive"), and the local part is also read without case. RFC 5321 says that the local part "MUST BE treated
// as case sensitive" and also that exploiting that "is discouraged"; an offboarding check that missed an account because
// of a capital letter would fail open, so the tool reads both parts without case and says so in docs/method.md. With
// plusAddressing on, the part of the local part from the first + is left out; with domainAliases, an alias domain is read
// as its company domain. Both come from the configuration only.
//
// A username: trimmed, one leading @ left out, read without case. A full name: runs of white space read as one space,
// read without case. A name gives a possible match only.

// The longest identifier that is compared; a longer value is not an identifier and is counted in a note.
export const IDENTITY_LIMITS = { maxLength: 320 };

const WHITE = /\s+/g;
const lower = (s) => s.toLowerCase();

// The parts of an email address, or null when the text is not one: exactly one @, a local part and a domain that are not
// empty and hold no white space, and a domain with a dot that does not start or end with one.
export function parseEmail(raw) {
  const text = String(raw).trim();
  if (text.length === 0 || text.length > IDENTITY_LIMITS.maxLength) return null;
  const at = text.indexOf('@');
  if (at <= 0 || at !== text.lastIndexOf('@') || at === text.length - 1) return null;
  const local = text.slice(0, at);
  let domain = text.slice(at + 1);
  if (/\s/.test(text)) return null;
  if (domain.endsWith('.')) domain = domain.slice(0, -1);
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return null;
  return { local, domain };
}

// The normal form of an email address with the steps that changed it, or null when the text is not an address.
// options: { plusAddressing, domainAliases: Map(alias -> company domain) }.
export function emailKey(raw, options = {}) {
  const parts = parseEmail(raw);
  if (!parts) return null;
  const steps = [];
  let local = lower(parts.local);
  let domain = lower(parts.domain);
  if (local !== parts.local || domain !== parts.domain) steps.push('read without case');
  if (options.plusAddressing) {
    const plus = local.indexOf('+');
    if (plus > 0) {
      local = local.slice(0, plus);
      steps.push('the plus tag left out');
    }
  }
  const alias = options.domainAliases?.get(domain);
  if (alias !== undefined) {
    steps.push(`the domain ${domain} read as ${alias}`);
    domain = alias;
  }
  return { key: `${local}@${domain}`, domain, steps };
}

// The normal form of a username, or null when the text is empty or too long.
export function usernameKey(raw) {
  const steps = [];
  let text = String(raw);
  if (text.trim() !== text) steps.push('trimmed');
  text = text.trim();
  if (text.startsWith('@')) {
    text = text.slice(1).trim();
    steps.push('the leading @ left out');
  }
  if (text.length === 0 || text.length > IDENTITY_LIMITS.maxLength) return null;
  const key = lower(text);
  if (key !== text) steps.push('read without case');
  return { key, steps };
}

// The normal form of a full name, or null when the text is empty or too long.
export function nameKey(raw) {
  const text = String(raw).normalize('NFC').replace(WHITE, ' ').trim();
  if (text.length === 0 || text.length > IDENTITY_LIMITS.maxLength) return null;
  return { key: lower(text), steps: ['white space and case left out'] };
}

// An email address as a report shows it by default: the first character of the local part, three asterisks, and the
// domain. A text that is not an address keeps its first character only.
export function maskEmail(raw) {
  const text = String(raw).trim();
  const parts = parseEmail(text);
  if (!parts) return text.length ? `${text.slice(0, 1)}***` : '';
  return `${parts.local.slice(0, 1)}***@${parts.domain}`;
}

// An identifier of the given kind as a report shows it: email addresses are masked unless show is true.
export const shownValue = (kind, raw, show) => (kind === 'email' && !show ? maskEmail(raw) : String(raw).trim());

// The domain of an address after the aliases, for the company check; null when the text is not an address.
export function companyDomainOf(raw, options = {}) {
  const k = emailKey(raw, { domainAliases: options.domainAliases });
  return k ? k.domain : null;
}
