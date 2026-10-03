# access-offboarding-check

Finds access left behind after people stopped working for a company: the accounts of employees, contractors and augmented staff that are still active in the tools of the team after their last day. It reads a CSV file of leavers and the account exports of your tools, matches the accounts to the leavers, and lists every account that is still there, with the tool, the field that matched and the row. It also lists active accounts with an address outside the company domains in tools that should hold company accounts only.

It never calls an API and never needs a credential: it reads only files you exported, and it cannot change an account. NIST SP 800-53 Rev. 5 control PS-4, Personnel Termination, lists among the steps at the end of employment: "Terminate or revoke any authenticators and credentials associated with the individual;". Control PS-7, External Personnel Security, adds for people who work through other companies: "Notifications of external personnel changes ensure the appropriate termination of privileges and credentials." This tool gives the evidence to finish that work, from the exports a company already has.

- **Exact matching, explained.** An account matches a leaver when an email address or a username is the same after a normal form you can read in docs/method.md: without case, with a plus tag left out and an old domain read as the company domain when the configuration says so. A full name alone is only a possible match, reported under its own rule. Nothing is matched by similarity. `--explain` shows the column, the field and every step behind each match.
- **Any tool.** Each export is declared in the configuration with its format (CSV or JSON), the fields that hold the identifiers and the field that holds the status. Five presets cover exports whose shape is written on a documentation page: GitHub organization members and outside collaborators, Google Workspace users, Microsoft Entra ID users and Atlassian users.
- **No built-in thresholds.** Every rule, its level and the grace days after the last day of work come from your configuration. A key that the tool does not know is an error, so a typo cannot switch a rule off.
- **Fails closed.** A column that is missing, a row that cannot be read or a leaver with no identifier stops the run with no verdict. An account with a status the configuration does not list is counted as active and noted. A leaver with no end of work is taken as gone.
- **Personal data stays small.** Email addresses are masked (`a***@example.com`) unless `--show-identifiers` is given. Only the columns the configuration names are read. Nothing is written to disk except the report that `--out` names.
- **The same files give the same report.** The tool reads no clock and no time zone: the end of work is a number of days from the as-of day, or a date compared with `--as-of`.
- Reports as text, Markdown and JSON, with an exit code for a pipeline: `0` no finding at or above the fail level, `1` a finding at or above it, `2` usage or input error.
- Plain JavaScript, no dependencies.

```
npm test
```

```
tests 184
pass 182
fail 0
skipped 2
```

These are the summary lines that `npm test` prints at the end on Windows. The skipped tests are the ones that need a symbolic link or a device (a link to `/dev/zero` named as an export, and a link to a regular file); they are guarded with `process.platform`, run on Linux and macOS, and none of them asserts a line or a column. `npm run test:coverage` runs the same tests with coverage; their time limits are four times wider when coverage is on. One test runs the date and name functions under other time zones and locales and compares the results.

## Quick start

Requires Node 22 or newer. There is nothing to install.

```
git clone https://github.com/INNERLUXES/access-offboarding-check.git
cd access-offboarding-check
node bin/access-offboarding-check.js --config examples/config.json --leavers examples/example-co/leavers.csv --export code=examples/example-co/code-members.json --export wiki=examples/example-co/wiki-users.csv --export messenger=examples/example-co/messenger-users.csv
```

Or without a clone, on your own files:

```
npx --yes github:INNERLUXES/access-offboarding-check --config offboarding/config.json --leavers leavers.csv --export code=code-members.json --export wiki=wiki-users.csv
```

`examples/` holds a made-up company with six leavers and three tools: a code host exported in the shape of the GitHub list of organization members, a wiki exported in the shape of the Atlassian user export, and a messenger with a CSV export of its own, mapped in the configuration. Some access was cleaned up (Dana's wiki and messenger accounts are deactivated), some was left behind (Dana's code account, Omar's and Priya's accounts), one person is still inside the grace days (Tom), one still works there (Lea), one has no end of work in the file and an invited messenger account (Sam), and a contractor who is not a leaver joined the messenger with a personal address (Riley). The names and the addresses are made up, on `example.com`, `example.org` and `example.net`.

## Usage

```
access-offboarding-check --config <file> --leavers <file> --export <name>=<file> [...] [options]
```

```
--config <file>           the configuration file (JSON): company domains, email rules, leaver columns, exports, rules;
                          required
--leavers <file>          the leavers file (CSV); required
--export <name>=<file>    the file of an export the configuration declares; once for each export
--as-of <YYYY-MM-DD>      the day to compare the end-of-work dates with; needed only when the leavers file holds dates
--format <name>           text, markdown or json (default: text)
--explain                 show why each account matched (the column, the field and the steps of the normal form),
                          the status read, and the sentences each rule rests on
--show-identifiers        show email addresses in full (masked by default: they are personal data)
--fail-on <level>         the lowest level of a finding that fails the run: notice, warning, error (default: failOn
                          of the configuration, else warning)
--out <file>              write the report to this file instead of the screen
--help                    show the usage
--version                 show the version
```

Paths in the report are relative to the folder you run the command in, with forward slashes on every system, followed by the line of the account: the CSV row, or the line where the JSON object starts.

The report of the example starts with what was read and the counts, then the findings, then every leaver with every account that matched:

```
access-offboarding-check: examples/config.json (Example Co)
leavers: examples/example-co/leavers.csv (6 rows); end of work in the column last_day: 5 as days from the as-of day, 1 empty
exports: code examples/example-co/code-members.json (JSON, preset github-org-members): 6 accounts, 6 active
         wiki examples/example-co/wiki-users.csv (CSV, preset atlassian-users, company accounts only): 8 accounts, 6 active, 2 inactive
         messenger examples/example-co/messenger-users.csv (CSV, company accounts only): 8 accounts, 6 active, 1 inactive, 1 with a status not listed
matching: email addresses and usernames without case, the plus tag left out, 1 domain alias; full names give possible matches only
rules: still-active (error, 7 grace days); possible-match (warning); personal-address (warning, company domains example.com)
results: 6 leavers, 4 past their last day and grace days; 14 matched accounts: 11 active, 2 inactive, 1 possible by name
findings: 10 (6 error, 4 warning); fail level warning

Findings (10)

  ERROR    still-active      examples/example-co/code-members.json:8
           Dana Reyes: the account dreyes-dev in code is active; matched by username

  ERROR    still-active      examples/example-co/wiki-users.csv:4
           Omar Lind: the account Omar Lind in wiki is active; matched by email address

  ERROR    still-active      examples/example-co/messenger-users.csv:4
           Omar Lind: the account omar in messenger is active; matched by username

  ERROR    still-active      examples/example-co/code-members.json:26
           Priya Nair: the account PNair in code is active; matched by username

  ERROR    still-active      examples/example-co/wiki-users.csv:5
           Priya Nair: the account Priya Nair in wiki is active; matched by email address

  ERROR    still-active      examples/example-co/messenger-users.csv:9
           Sam Ortiz: the account samo in messenger is not marked inactive; matched by email address and username

  WARNING  possible-match    examples/example-co/wiki-users.csv:8
           Sam Ortiz: the account Sam  Ortiz in wiki has the same full name and is active; a possible match, to check by hand

  WARNING  personal-address  examples/example-co/wiki-users.csv:8
           the account Sam  Ortiz in wiki has s***@mail.example.net outside the company domains

  WARNING  personal-address  examples/example-co/messenger-users.csv:4
           the account omar in messenger has o***@mail.example.org outside the company domains

  WARNING  personal-address  examples/example-co/messenger-users.csv:8
           the account riley in messenger has r***@studio.example.net outside the company domains

Leavers (6)

  Dana Reyes  (line 2)  last day 30 days before the as-of day; past the 7 grace days
    code       dreyes-dev  active (listed)                     exact: username                 FINDING still-active
    wiki       Dana Reyes  inactive (User status Deactivated)  exact: email address
    messenger  dana.r      inactive (state deactivated)        exact: email address, username

  Omar Lind  (line 3)  last day 12 days before the as-of day; past the 7 grace days
    wiki       Omar Lind  active (User status Active)  exact: email address  FINDING still-active
    messenger  omar       active (state active)        exact: username       FINDING still-active

  Priya Nair  (line 4)  last day 45 days before the as-of day; past the 7 grace days
    code  PNair       active (listed)              exact: username       FINDING still-active
    wiki  Priya Nair  active (User status Active)  exact: email address  FINDING still-active

  Tom Becker  (line 5)  last day 5 days before the as-of day; in the grace period: 5 days of 7 grace days passed
    code       tbecker-x   active (listed)              exact: username
    wiki       Tom Becker  active (User status Active)  exact: email address
    messenger  tbecker     active (state active)        exact: email address, username

  Lea Hoffmann  (line 6)  last day 3 days after the as-of day; still working: the last day of work is after the as-of day
    code       leah   active (listed)        exact: username
    messenger  lea.h  active (state active)  exact: email address, username

  Sam Ortiz  (line 7)  no end of work given; taken as left
    wiki       Sam  Ortiz  active (User status Active)        possible: full name             FINDING possible-match
    messenger  samo        counted as active (state invited)  exact: email address, username  FINDING still-active

note: messenger: 1 account has a status the configuration does not list, and is counted as active
note: 1 leaver has no end of work and is taken as left

Email addresses are masked; --show-identifiers shows them.

RESULT: FAIL - 10 findings at or above warning
```

The exit code is `1`: six findings are errors and four are warnings, and the configuration fails on `warning`. `--explain` shows the reasons behind each finding; for Priya's wiki account, which matched only after the plus tag of the leavers file was left out:

```
  ERROR    still-active      examples/example-co/wiki-users.csv:5
           Priya Nair: the account Priya Nair in wiki is active; matched by email address
           why: active (User status Active)
           why: past the 7 grace days
           why: email address P***@Example.com in the leavers column email and p***@example.com in the field Email, equal after their normal form (read without case; the plus tag left out)
           basis: "Terminate or revoke any authenticators and credentials associated with the individual;" (PS-4 Statement, https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json)
           basis: "Notifications of external personnel changes ensure the appropriate termination of privileges and credentials." (PS-7 Guidance, https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json)
```

[examples/output](examples/output) holds the report as text, with `--explain`, as Markdown and as JSON.

## What it finds

| Rule | Key | A finding is |
| --- | --- | --- |
| `still-active` | `rules.stillActive` | an account that is not inactive and matches a leaver by email address or username, more than `graceDays` days after the last day of work |
| `possible-match` | `rules.possibleMatch` | the same, by full name only: a prompt to check by hand |
| `personal-address` | `rules.personalAddress` | an account that is not inactive, in an export with `companyAccountsOnly`, with an email address outside `company.domains` |

A rule runs only when the configuration states it, with the `level` the configuration gives it (`notice`, `warning` or `error`), and the run fails when a finding is at `failOn` or above. An inactive account is listed under its leaver as cleaned up and is never a finding. A leaver whose last day of work is the as-of day or later, or who is inside the grace days, is listed with every matched account and gives no finding yet.

## How accounts are matched

| Identifier | Same when | Match |
| --- | --- | --- |
| email address | equal after trimming, read without case, with the plus tag left out (`email.plusAddressing`) and an alias domain read as its company domain (`email.domainAliases`) | exact |
| username | equal after trimming, without one leading `@`, read without case | exact |
| full name | equal with runs of white space as one space, read without case | possible |

The leaver columns that hold each kind are named in `leavers.columns`; the fields of each export in `fields`. An address is only compared with addresses and a username with usernames. A full name gives a possible match only when no exact match joins the same account and the same leaver. [docs/method.md](docs/method.md) gives every step, the reason for reading the local part of an address without case, and what each rule can and cannot see; [docs/rules-and-sources.md](docs/rules-and-sources.md) lists every quoted sentence with the saved page it comes from.

## Presets

| Preset | Export | Identifiers | Status |
| --- | --- | --- | --- |
| `github-org-members` | the JSON response of List organization members of the GitHub REST API | `login` | none: every member is active |
| `github-outside-collaborators` | the JSON response of List outside collaborators for an organization | `login` | none |
| `google-directory-users` | the JSON response of `users.list` of the Google Workspace Directory API, accounts at `users` | `primaryEmail`, `aliases`, `name.fullName` | `suspended` and `archived`, `true` is inactive |
| `entra-users` | the CSV file of Download users of Microsoft Entra ID, with the attribute names as headings | `userPrincipalName`, `mail`, `displayName` | `accountEnabled`, `false` is inactive |
| `atlassian-users` | the CSV file of Export users from a site of Atlassian | `Email`, `User name` | `User status`, `Suspended` and `Deactivated` are inactive |

A preset is only there when its documentation page names the fields, and the page is saved in `research/sources`. A CSV file that lacks a column the preset names is refused, so a file in another shape stops the run instead of passing. Any other export, such as a member list of a messenger, is mapped in the configuration with the column names of your file. [docs/inputs.md](docs/inputs.md) describes each preset.

## The configuration file

[docs/inputs.md](docs/inputs.md) has every key and every default. The configuration of the example is [examples/config.json](examples/config.json):

```json
{
  "name": "Example Co",
  "company": { "domains": ["example.com"] },
  "email": {
    "plusAddressing": true,
    "domainAliases": { "old.example.com": "example.com" }
  },
  "leavers": {
    "columns": {
      "email": ["email"],
      "username": ["code_login", "messenger_handle"],
      "name": ["full_name"],
      "end": "last_day"
    }
  },
  "exports": [
    { "name": "code", "preset": "github-org-members" },
    { "name": "wiki", "preset": "atlassian-users", "companyAccountsOnly": true },
    {
      "name": "messenger",
      "format": "csv",
      "fields": { "username": ["handle"], "email": ["email"], "name": ["full_name"] },
      "status": [{ "field": "state", "active": ["active"], "inactive": ["deactivated"] }],
      "companyAccountsOnly": true
    }
  ],
  "rules": {
    "stillActive": { "graceDays": 7, "level": "error" },
    "possibleMatch": { "level": "warning" },
    "personalAddress": { "level": "warning" }
  },
  "failOn": "warning"
}
```

Only `leavers.columns`, one export and one rule are needed, and `graceDays` when `stillActive` is stated. The defaults are `level` warning, `failOn` warning, `plusAddressing` off and `companyAccountsOnly` off; none of them is a threshold.

## Dates

The end-of-work column holds the last day of work, either as a whole number of days from the as-of day (`-30` is thirty days before it, `3` three days after it) or as a date `YYYY-MM-DD`, which needs `--as-of YYYY-MM-DD`. The tool reads no clock and no time zone, so the same files give the same report on every machine and every day. The example and every test use day numbers, so no file of the repository holds a date; [the decision](docs/decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md) explains why.

## Privacy

The leavers file and the exports are personal data. The reports mask every email address as its first character, three asterisks and the domain, in text, Markdown and JSON alike, and show it in full only with `--show-identifiers`. Only the columns the configuration names are read, and a report shows the identifiers that matched, not the whole row. The tool writes nothing to disk except the report that `--out` names, and refuses an `--out` path that is one of its inputs. [docs/secure-defaults.md](docs/secure-defaults.md) explains these defaults, with the data minimisation principle of the General Data Protection Regulation quoted from its official text, and what to think about before a report is posted; [docs/threat-model.md](docs/threat-model.md) lists the risks and their controls.

## Formats

- `text`: for a terminal: what was read, the counts, the findings with their file and line, every leaver with every matched account and its status, the notes and the result. With `--explain` also the identifiers of each leaver, the reasons of each match and the sentences each rule rests on.
- `markdown`: the same for a ticket or a job summary, with the findings and the leavers as tables. Pipes, square brackets, backticks, asterisks, underscores, line breaks and angle brackets from the input are escaped, and a cell that starts with `=`, `+`, `-` or `@` gets a leading apostrophe, so a value cannot break a table, make a link, or run as a formula when the table is pasted into a spreadsheet.
- `json`: the whole report: the configuration, the inputs, the totals, every finding, every leaver with every matched account, the verdict and the notes.

## Exit codes

`0`: no finding at or above the fail level. `1`: at least one finding at or above it. `2`: a usage or input error: an option missing or given twice, an unknown option, a file that cannot be read, a configuration with an unknown key, a key named twice or no rule, an export declared and not given or given and not declared, a column a preset or the configuration names that the file lacks, a CSV or JSON problem, a leaver with no identifier or an email cell that is not an address, a date with no `--as-of`, an input over the limits. With exit code `2` the tool gives no verdict and prints the problems on standard error.

## Architecture

Plain ES modules in `src/`, with no dependencies.

| File | Job |
| --- | --- |
| `src/cli.js` | the command line, the usage and the exit codes |
| `src/check.js` | reads the inputs, matches, runs the rules and builds the report |
| `src/config.js` | validates the configuration against the known keys and builds its normal form |
| `src/presets.js` | the shapes of the five exports with a documentation page |
| `src/leavers.js`, `src/accounts.js` | the leavers file, and the account exports in CSV and JSON with their status |
| `src/identity.js` | the normal form of addresses, usernames and names, and the masking of addresses |
| `src/match.js` | the maps of the leaver identifiers, the matches of each account, and the company domain check |
| `src/rules.js`, `src/days.js` | the three rules, the grace and the verdict; days and dates without a clock |
| `src/csv.js`, `src/json.js` | the strict CSV reader written from RFC 4180, and the strict JSON reader |
| `src/files.js` | bounded reading of the named files, and the one write of `--out` |
| `src/report.js`, `src/text.js`, `src/size.js` | the reports, the cleaning of text from the input, number formats |
| `src/data.js` | the sentences the tool rests on, compared with the saved pages in `research/sources` |
| `tools/check.mjs`, `tools/example.mjs` | the repository checks, and the example with its real output |

## Where the facts come from

| Fact | Source |
| --- | --- |
| Personnel termination and external personnel security | NIST SP 800-53 Rev. 5, controls PS-4 and PS-7, read from the OSCAL catalog that NIST publishes in the usnistgov/oscal-content repository |
| The CSV format | RFC 4180, https://www.rfc-editor.org/rfc/rfc4180 |
| Repeated names in a JSON object | RFC 8259, https://www.rfc-editor.org/rfc/rfc8259 |
| The local part and the domain of an address, and case | RFC 5321, https://www.rfc-editor.org/rfc/rfc5321 |
| Data minimisation | General Data Protection Regulation, Article 5(1)(c), the official text on EUR-Lex |
| The shapes of the presets | the GitHub REST API, Google Workspace Directory API, Microsoft Entra ID, Microsoft Graph and Atlassian Support pages listed in docs/rules-and-sources.md |

## Limits

The tool compares the files it is given. A tool you did not export, an account under an identifier the leavers file does not hold, a name spelled another way, and access that is not an account (tokens, keys, open sign-ins on devices, access through a group of another directory) are not seen. A match says an identifier is the same, not that the person still uses the account. An export is a picture of one moment. [docs/limits.md](docs/limits.md) lists these, with the size limits.

## Background

When a team works with contractors or augmented staff, their accounts live in the tools of the team for the length of the engagement and have to be removed at its end. How such engagements are run is described on the page [IT Staff Augmentation Services](https://innerluxes.dev/software-development/it-staff-augmentation).

## License

MIT
