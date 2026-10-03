import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDENTITY_LIMITS, companyDomainOf, emailKey, maskEmail, nameKey, parseEmail, shownValue, usernameKey } from '../src/index.js';

const aliases = new Map([['old.example.com', 'example.com']]);

test('parseEmail: one @, a local part and a domain with a dot, no white space', () => {
  assert.deepEqual(parseEmail(' Ana@Example.com '), { local: 'Ana', domain: 'Example.com' });
  assert.deepEqual(parseEmail('ana@example.com.'), { local: 'ana', domain: 'example.com' });
  for (const bad of ['', 'ana', '@example.com', 'ana@', 'ana@@example.com', 'a@b@example.com', 'ana@example', 'ana@.example.com', 'ana@example..com', 'an a@example.com', 'ana@exa mple.com', `${'a'.repeat(IDENTITY_LIMITS.maxLength)}@example.com`]) {
    assert.equal(parseEmail(bad), null, bad);
  }
});

test('emailKey: the whole address read without case, and the step says so', () => {
  assert.deepEqual(emailKey('Ana.Lopez@Example.COM'), { key: 'ana.lopez@example.com', domain: 'example.com', steps: ['read without case'] });
  assert.deepEqual(emailKey('ana@example.com'), { key: 'ana@example.com', domain: 'example.com', steps: [] });
  assert.equal(emailKey('not an address'), null);
});

test('emailKey: the plus tag is left out only when plusAddressing is on, and only after the first character', () => {
  assert.equal(emailKey('ana+contract@example.com').key, 'ana+contract@example.com');
  const k = emailKey('ana+contract+x@example.com', { plusAddressing: true });
  assert.equal(k.key, 'ana@example.com');
  assert.deepEqual(k.steps, ['the plus tag left out']);
  assert.equal(emailKey('+ana@example.com', { plusAddressing: true }).key, '+ana@example.com', 'a local part that starts with + keeps it');
});

test('emailKey: a domain alias is read as its company domain, after the case', () => {
  const k = emailKey('Ana@OLD.example.com', { domainAliases: aliases });
  assert.equal(k.key, 'ana@example.com');
  assert.equal(k.domain, 'example.com');
  assert.deepEqual(k.steps, ['read without case', 'the domain old.example.com read as example.com']);
  assert.equal(emailKey('ana@older.example.com', { domainAliases: aliases }).key, 'ana@older.example.com', 'only the exact alias domain');
  assert.equal(emailKey('ana@sub.old.example.com', { domainAliases: aliases }).key, 'ana@sub.old.example.com', 'a subdomain is not the alias');
});

test('usernameKey: trimmed, one leading @ left out, read without case, each step named', () => {
  assert.deepEqual(usernameKey('ana-l'), { key: 'ana-l', steps: [] });
  assert.deepEqual(usernameKey(' @Ana-L '), { key: 'ana-l', steps: ['trimmed', 'the leading @ left out', 'read without case'] });
  assert.equal(usernameKey('@@ana').key, '@ana', 'only one @ is left out');
  assert.equal(usernameKey('   '), null);
  assert.equal(usernameKey('@'), null);
  assert.equal(usernameKey('x'.repeat(IDENTITY_LIMITS.maxLength + 1)), null);
});

test('nameKey: white space and case left out, nothing else; a different spelling is a different name', () => {
  assert.equal(nameKey('  Ana   Lopez ').key, 'ana lopez');
  assert.equal(nameKey('ANA\tLOPEZ').key, 'ana lopez');
  assert.notEqual(nameKey('Ana Lopes').key, nameKey('Ana Lopez').key);
  assert.notEqual(nameKey('Lopez Ana').key, nameKey('Ana Lopez').key, 'the order of the words counts');
  assert.equal(nameKey(''), null);
  // A precomposed letter and the letter with a combining mark are the same name after NFC.
  assert.equal(nameKey(`Jos${String.fromCharCode(0xe9)}`).key, nameKey(`Jose${String.fromCharCode(0x301)}`).key);
});

test('maskEmail: the first character of the local part, three asterisks and the domain', () => {
  assert.equal(maskEmail('ana.lopez@example.com'), 'a***@example.com');
  assert.equal(maskEmail(' A@Example.com '), 'A***@Example.com');
  assert.equal(maskEmail('not-an-address'), 'n***');
  assert.equal(maskEmail(''), '');
  assert.equal(shownValue('email', 'ana@example.com', false), 'a***@example.com');
  assert.equal(shownValue('email', 'ana@example.com', true), 'ana@example.com');
  assert.equal(shownValue('username', ' ana-l ', false), 'ana-l', 'only addresses are masked');
});

test('companyDomainOf: the domain after the aliases, or null', () => {
  assert.equal(companyDomainOf('ana@OLD.example.com', { domainAliases: aliases }), 'example.com');
  assert.equal(companyDomainOf('ana@mail.example.net', { domainAliases: aliases }), 'mail.example.net');
  assert.equal(companyDomainOf('ana'), null);
});
