# Method

This document says exactly how the tool goes from the files to the findings: how each identifier is read, when two values are the same, when a leaver is due, what each rule reports, and what each rule can and cannot see. Where the tool makes its own choice, it says so and says why. The sentences quoted here are on the pages saved in `research/sources`; [rules-and-sources.md](rules-and-sources.md) lists them.

## What the check rests on

NIST SP 800-53 Rev. 5 sets out what an organization does when a person leaves. Control PS-4, Personnel Termination, opens with "Upon termination of individual employment:" and lists, among other actions, "Terminate or revoke any authenticators and credentials associated with the individual;". Its first item disables system access within a time period that the organization defines; the parameter of that item reads "a time period within which to disable system access is defined;". Control PS-7, External Personnel Security, covers people who work through other organizations; its guidance says that "External providers include service bureaus, contractors, and other organizations that provide system development, information technology services, testing or assessment services, outsourced applications, and network/security management." and that "Notifications of external personnel changes ensure the appropriate termination of privileges and credentials." PS-7 also asks the organization to "Monitor provider compliance with personnel security requirements."

The tool does not decide whether a company meets these controls. It reads the exports a company already has and lists the accounts that are still there for people who are gone: the evidence a person needs to finish the work the controls describe. The grace days of the configuration are the company's own time period.

## Reading the identifiers

Every value is trimmed. An empty value is no value.

- **Email address.** A value is an address when it holds exactly one `@`, a local part and a domain that are not empty and hold no white space, and a domain with a dot that does not start or end with one. A trailing dot of the domain is left out. Longer than 320 characters is not an address.
- **Username.** One leading `@` is left out (`@ana` and `ana` are the same handle). Longer than 320 characters is not a username.
- **Full name.** Runs of white space are read as one space and the text is put in Unicode normal form C, so a letter with a combining accent and the same letter written as one character are the same name.

## When two values are the same

Each kind of value has one normal form, and two values are the same when their normal forms are equal, character for character. Nothing is compared by similarity, distance or sound: `Ana Lopes` is not `Ana Lopez`, and `bode2` is not `bode`. Every step that changed a value is kept and shown by `--explain`.

- **Email address.** The domain is read without case: RFC 5321 says "Mailbox domains follow normal DNS rules and are hence not case sensitive." The local part is also read without case. This is the tool's own choice, and it goes against the letter of RFC 5321, which says "The local-part of a mailbox MUST BE treated as case sensitive." The same paragraph adds "However, exploiting the case sensitivity of mailbox local-parts impedes interoperability and is discouraged." An offboarding check that missed `Ana@example.com` because the leavers file says `ana@example.com` would fail open, so the tool reads both without case; a company whose mail server does give case a meaning will see a match it can check by hand.
- **Plus tags.** With `email.plusAddressing`, the part of the local part from the first `+` is left out on both sides, so `ana+contract@example.com` and `ana@example.com` are the same. It is off unless the configuration turns it on, because RFC 5321 says "the local-part MUST be interpreted and assigned semantics only by the host specified in the domain part of the address."; whether `+` starts a tag is up to the mail server of the company. A local part that starts with `+` keeps it.
- **Domain aliases.** With `email.domainAliases`, an alias domain is read as its company domain on both sides, so `ana@old.example.com` and `ana@example.com` are the same. Only the exact domain is an alias; a subdomain of it is another domain.
- **Username.** Read without case.
- **Full name.** Read without case, after the white space step above.

Case is changed with `toLowerCase`, which does not depend on the locale of the machine, so the same files give the same matches everywhere.

## Matching an account to a leaver

Every identifier of every leaver goes into a map keyed by its normal form. Every identifier of every account is looked up once. The work grows with the number of rows, not with leavers times accounts, except when one identifier is held by many rows on both sides; then the number of pairs is capped (docs/limits.md) and the run stops with no verdict rather than build a report nobody can read.

- An email address equal to an email address of a leaver, or a username equal to a username of a leaver, is an **exact** match. An address is never compared with a username: a username field that holds an address is compared with usernames only.
- A full name equal to a full name of a leaver, with no exact match between the same account and the same leaver, is a **possible** match. A name is never an exact match, because two people can share a name; a possible match is reported under its own rule, at its own level, and says that it is to be checked by hand.
- One account can match more than one leaver, and one leaver can match many accounts. Every pair is listed, with every value that matched.
- The leaver usernames are compared with the usernames of every export: a GitHub login in the leavers file can match a username in another tool. `--explain` names the column and the field, so such a match is easy to see.

## When a leaver is due

The days since the last day of work are the as-of day minus the last day: positive after it, `0` on it, negative before it. The last day of work is a working day, so on it nothing is due.

- With the `still-active` rule, a leaver is due when more than `graceDays` days have passed since the last day of work.
- Without that rule, a leaver is due when the last day of work has passed.
- A leaver with no end of work is taken as gone, and a note says so.

A leaver who is not due is still listed with every matched account, so the report shows what will become a finding, but no finding is made.

## The rules

A rule is run only when the configuration states it. Every number a rule compares comes from the configuration; the tool has no threshold of its own.

### `still-active`

A finding for each pair of a due leaver and an account that matches the leaver **exactly** (by email address or username) and is not inactive: active, or with a status the configuration does not list. The finding names the leaver, the export, the account, the file and the line or the JSON object, and the values that matched; `--explain` adds the status read, the grace, each step of the normal form, and the sentences of PS-4 and PS-7 above.

It can see: every account of every export given, whatever its status field says. It cannot see: an account in a tool you did not export, an account under an identifier the leavers file does not hold (a shared login, a second address), tokens, keys and open sign-ins inside a tool, or access granted through a group in another system. An inactive account is listed under the leaver as removed and is never a finding.

### `possible-match`

A finding for each pair of a due leaver and an account that is not inactive and matches the leaver **by full name only**. It is a prompt to check by hand: the account may belong to another person with the same name, or to the leaver under an address the leavers file does not hold. Give it a lower level than `still-active` when the run should fail only on exact matches.

### `personal-address`

A finding for each account that is not inactive, in an export with `companyAccountsOnly`, with an email address whose domain, after the domain aliases, is not one of `company.domains`. It looks at every address of the account (for Google Workspace, the primary address and every alias). A subdomain of a company domain is another domain and is reported. An account with no address at all cannot be checked; a note gives the count.

This rule is not limited to leavers: a contractor who joined a tool with a personal address is easy to forget at the end of the engagement, because the address is not in the company directory. The rule rests on the PS-7 statement "Establish personnel security requirements, including security roles and responsibilities for external providers;" and on the RFC 5321 sentence quoted above that the domain part names the host that assigns the meaning of an address.

## Levels and the verdict

Each rule gives its findings the level of the configuration: `notice`, `warning` or `error`. The run fails when a finding is at `failOn` or above (`--fail-on` overrides it). Findings are sorted by level, then rule, then leaver in the order of the leavers file, then export in the order of the configuration, then line, so the same files always give the same order.

Exit codes: `0` no finding at or above the fail level, `1` at least one, `2` a usage or input error. With `2` there is no verdict: an input that cannot be read stops the run, and every problem is printed on standard error.
