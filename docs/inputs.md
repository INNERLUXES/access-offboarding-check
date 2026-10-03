# Inputs

The tool reads three kinds of file, all named on the command line, and nothing else:

- the configuration file, JSON, with `--config`;
- the leavers file, CSV, with `--leavers`;
- one account export for each tool the configuration declares, CSV or JSON, with `--export <name>=<file>`.

Every file is read as UTF-8; a byte order mark at the start is skipped, a file in UTF-16 or with a null byte is refused. A file over its size limit is refused before it is read (docs/limits.md lists the limits). A path is opened as given, relative to the folder the command runs in; a path that looks like an address (`https://...`) is refused, because the tool never fetches anything.

## The leavers file

One row for each person who stopped working for the company: an employee, a contractor, a member of augmented staff. The first row holds the column names. The file is read by the strict CSV reader of the tool, written from RFC 4180: a field in double quotes may hold commas, line breaks and doubled quotes, and a quote inside a field that is not quoted, a quote that is never closed, or a row with another number of fields than the header stops the run with its line.

Only the columns that `leavers.columns` names are read. A named column that the header lacks, or holds twice, stops the run. Other columns, such as the kind of engagement or a manager, are left alone.

Each row needs at least one identifier: an email address, a username or a name. A row with none, or an email cell that is not an email address, stops the run with its line, because a leaver who cannot be matched would make the check pass for the wrong reason. An empty cell is no value. At most twenty problems are listed, then a count of the rest.

The end-of-work column holds the last day of work, in one of two forms:

- a whole number of days from the as-of day: `0` is the as-of day, `-14` fourteen days before it, `3` three days after it (`+3` is read too);
- a date written `YYYY-MM-DD`, which needs `--as-of YYYY-MM-DD` on the command line.

An empty cell means the end of work is not known: the person is taken as gone, and a note says so. Anything else stops the run. [docs/decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md](decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md) explains why the tool reads no clock.

## The account exports

Each export holds the accounts of one tool, as the tool or its administration page writes them. The configuration declares each export with a name; the command line gives its file with `--export <name>=<file>`. Every declared export must be given, and every export given must be declared.

A CSV export is read with the same strict reader as the leavers file: each row after the header is an account, and the line of the row is shown in the report. A JSON export is read with the strict JSON reader of the tool: the accounts are the objects of a list, either the top value of the file or the list at the dot path that `rows` names (such as `users`), and the line where each object starts is shown in the report. A field of a JSON account is named by a dot path (`name.fullName`); only the own properties of an object are followed, so a field named `__proto__` is only data. A field that holds a list of strings (such as `aliases`) gives one value for each string.

### The status of an account

The status is read only from the status fields the configuration or the preset names:

- a value in the `inactive` list makes the account inactive: it is listed under the leaver as removed and is never a finding;
- a value in the `active` list leaves it active;
- any other value, an empty cell or a missing field is an unknown status. The account is counted as active, because an account the tool cannot place must not drop out of the check, and a note gives the count.

Values are compared after trimming, without case. With several status fields, any inactive value makes the account inactive, and an unknown value in any field makes the status unknown. An export with no status field is a list of accounts that exist, such as the members of an organization, and every row in it is active.

## Presets

A preset sets the format, the rows, the fields and the status of an export whose shape is written down on a documentation page saved in `research/sources`. A preset is only added when its page names the fields. A CSV export whose header lacks a column the preset names stops the run, so a file in another shape is refused rather than half read; map such a file in the configuration instead.

### `github-org-members`

The JSON response of List organization members of the GitHub REST API: a list of user objects. The username is `login`. The page says the endpoint will "List all users who are members of an organization." The objects have no status field, so every row is an active member. Save every page of the response into one JSON list. The objects the endpoint returns have no email address; give the leavers file a column with GitHub usernames.

### `github-outside-collaborators`

The JSON response of List outside collaborators for an organization, of the same shape: the username is `login`, and every row is active.

### `google-directory-users`

The JSON response of `users.list` of the Google Workspace Directory API: the accounts are the list at `users`. The email addresses are `primaryEmail` and every string of `aliases`, the name is `name.fullName`, and the status fields are `suspended` and `archived`, each `false` for active and `true` for inactive. The page describes `suspended` as "Indicates if user is suspended." This preset is for the API response; the download of the Admin console has columns that its help page does not list, so map that file in the configuration.

### `entra-users`

The CSV file of Download users in the Microsoft Entra admin center, with the attribute names that its page lists as column headings: the email addresses are `userPrincipalName` and `mail`, the name is `displayName`, and the status is `accountEnabled`, `true` for active and `false` for inactive (read without case). The Entra page lists the attributes; the Microsoft Graph page on the user resource defines `accountEnabled` as "true if the account is enabled; otherwise, false." The Entra page also says that with the newer download "the export will mirror those selected columns", so a file with other headings is refused and must be mapped in the configuration. A value of `accountEnabled` other than true or false is an unknown status, counted as active and noted.

### `atlassian-users`

The CSV file of Export users from a site in Atlassian Administration: the email address is `Email`, the name is `User name`, and the status is `User status`, with `Active` for active and `Suspended` and `Deactivated` for inactive.

A tool whose page does not name its columns has no preset. The Slack help page on downloading a member list, for one, says how to export the list and not which columns it holds; map such an export in the configuration with the column names of your file.

## The configuration file

The configuration is one JSON object, read with the strict JSON reader of the tool: no comments, no trailing comma, and an object that names a key twice is refused, because RFC 8259 says "When the names within an object are not unique, the behavior of software that receives such an object is unpredictable." Every key that the tool does not know is an error, with its line and the nearest known key, so a typo cannot switch a rule off.

| Key | What it holds | Default |
| --- | --- | --- |
| `name` | a name for the reports | none |
| `company` | the company | none |
| `company.domains` | the domains of the company addresses, such as `example.com`; read without case | none; needed by `companyAccountsOnly` |
| `email` | how email addresses are compared | |
| `email.plusAddressing` | `true` to leave out the part of the local part from the first `+` (`ana+x@example.com` is read as `ana@example.com`), on both sides | `false` |
| `email.domainAliases` | an object that maps another domain to a company domain, such as `{ "old.example.com": "example.com" }`; an alias may not map to another alias or to itself, and a company domain may not be an alias | none |
| `leavers` | the leavers file | needed |
| `leavers.columns` | the columns of the leavers file; at least one identifier column is needed | needed |
| `leavers.columns.email` | a list of columns that hold email addresses | none |
| `leavers.columns.username` | a list of columns that hold usernames, such as a GitHub login or a messenger handle | none |
| `leavers.columns.name` | a list of columns that hold full names | none |
| `leavers.columns.end` | the column of the last day of work | none: every leaver is taken as gone |
| `leavers.delimiter` | `,`, `;` or a tab (`"\t"`) | `,` |
| `exports` | the list of account exports, at least one | needed |
| `rules` | the rules to run, at least one | needed |
| `rules.stillActive` | the `still-active` rule | not run |
| `rules.stillActive.graceDays` | the whole days after the last day of work before an active account is a finding; `0` for none | needed by the rule |
| `rules.stillActive.level` | `notice`, `warning` or `error` | `warning` |
| `rules.possibleMatch` | the `possible-match` rule | not run |
| `rules.possibleMatch.level` | the level of its findings | `warning` |
| `rules.personalAddress` | the `personal-address` rule; needs an export with `companyAccountsOnly` | not run |
| `rules.personalAddress.level` | the level of its findings | `warning` |
| `failOn` | the lowest level that fails the run; `--fail-on` overrides it | `warning` |

Each entry of `exports`:

| Key | What it holds | Default |
| --- | --- | --- |
| `exports[].name` | the name of the tool, used with `--export <name>=<file>`: lower case letters, digits, `-` and `_`, at most 40 characters, unique | needed |
| `exports[].preset` | one of the presets above; then `format`, `rows`, `fields`, `delimiter` and `status` must be left out | none |
| `exports[].format` | `csv` or `json` | needed without a preset |
| `exports[].rows` | JSON only: the dot path of the list of accounts | the top value |
| `exports[].delimiter` | CSV only: `,`, `;` or a tab | `,` |
| `exports[].fields` | the columns or JSON paths of the identifiers; at least one | needed without a preset |
| `exports[].fields.email` | a list of columns or paths that hold email addresses | none |
| `exports[].fields.username` | a list of columns or paths that hold usernames | none |
| `exports[].fields.name` | a list of columns or paths that hold full names | none |
| `exports[].status` | a list of status fields | none: every row is active |
| `exports[].companyAccountsOnly` | `true` when the tool should hold company accounts only; the `personal-address` rule looks at these exports | `false` |

Each entry of `status`:

| Key | What it holds |
| --- | --- |
| `exports[].status[].field` | the column or JSON path of the status |
| `exports[].status[].active` | the values that mean the account can be used, compared without case |
| `exports[].status[].inactive` | the values that mean it cannot; a value may not be in both lists |

None of the defaults is a threshold. The defaults of `level` and `failOn` make a stated rule fail the run unless the configuration says otherwise; `graceDays` has no default and must be written.

## The command line

```
access-offboarding-check --config <file> --leavers <file> --export <name>=<file> [...] [options]
```

| Option | What it does |
| --- | --- |
| `--config <file>` | the configuration file; required |
| `--leavers <file>` | the leavers file; required |
| `--export <name>=<file>` | the file of an export the configuration declares; once for each export |
| `--as-of <YYYY-MM-DD>` | the day to compare the dates of the leavers file with; needed only when the file holds dates |
| `--format <name>` | `text`, `markdown` or `json` |
| `--explain` | why each account matched, the status read, and the sentences each rule rests on |
| `--show-identifiers` | email addresses in full; they are masked by default |
| `--fail-on <level>` | the lowest level of a finding that fails the run |
| `--out <file>` | write the report to this file instead of the screen; a path that is one of the inputs is refused |
| `--help`, `--version` | the usage and the version |

Reading from standard input is not supported: every input is a file with a name, so a report can say which file a row came from.
