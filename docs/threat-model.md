# Threat model

## What the tool touches

- It reads the configuration file, the leavers file and the account exports named on the command line. Nothing else is opened.
- It writes the report to the screen, or to the one file `--out` names. It writes nothing else.
- It opens no network connection, calls no API, evaluates nothing it reads, starts no program and reads no clock.

## What the input may hold

The inputs are personal data, and they come from many hands. The leavers file is often exported from an HR system or kept by hand in a spreadsheet. The exports come from the administration pages of tools, and their content is written by everyone who could set a display name, a username or a profile field in those tools, including the people who left and any contractor or guest with an account. A display name is attacker-controlled text.

Through the inputs, a person can try to:

- hide an account: a status value the configuration does not list, an address with another case or a plus tag, an address on an old domain, a username with a leading `@` or trailing spaces, a second address, a name spelled another way;
- make the check pass for the wrong reason: a leaver row with no identifier, an email cell that is not an address, an export in another shape than the preset, a column renamed in a new version of the tool, a JSON field that is missing from every row, an end of work in a form that could be read two ways;
- move the verdict: a key named twice in the configuration, an unknown key that looks like a known one, a status value moved from one list to the other, a domain alias that maps the wrong domain;
- exhaust the memory or the time: a file of gigabytes, millions of rows, a cell of a million characters, a quote that is never closed, JSON nested a million deep, one name held by thousands of rows in both files so that the pairs grow with leavers times accounts;
- rewrite the terminal or break a report: control characters, ANSI escapes, direction controls and line separators in a display name, and pipes, brackets and angle brackets that a Markdown table would render;
- run a formula: a display name that starts with `=`, `+`, `-` or `@`, which a spreadsheet would run when a Markdown table of the report is pasted into it;
- change how objects behave: a column, a field, a username or a name such as `__proto__`, `constructor` or `toString`;
- leak personal data: a report posted where more people can read it than the inputs, with the addresses of every leaver;
- make the tool overwrite its input: `--out` pointed at the leavers file.

## What could go wrong, and what stops it

| Risk | Control |
| --- | --- |
| An account hides behind case, a plus tag, an old domain or a leading `@` | Addresses and usernames are compared on a normal form: without case, with the plus tag left out and the aliases applied when the configuration says so, with one leading `@` left out of a username. Tests near-miss each step |
| An account hides behind an unknown status | A value in neither status list, an empty value or a missing field is an unknown status, counted as active and noted |
| A name is matched silently to the wrong person | Names never give an exact match; a name-only match is a `possible-match` finding of its own, at its own level, with the reason. Nothing is matched by similarity |
| The check passes because a file was half read | A missing column, a CSV problem, a JSON problem, rows that are not objects, a leaver with no identifier, an email cell that is not an address or an end of work that cannot be read stops the run with exit code `2` and no verdict. A JSON field that is in no row is noted |
| A date is read two ways, or the report changes with the day or the machine | Only days from the as-of day or `YYYY-MM-DD` are read; dates need `--as-of`; the tool reads no clock and no time zone; tests compare results under other time zones and locales |
| A key named twice or an unknown key moves the verdict | The JSON reader refuses a repeated key, as RFC 8259 says the behavior of software that receives one is unpredictable; an unknown key stops the run with its line |
| The memory or the time is exhausted | Every input has a size limit checked on the open file before it is read; rows, fields, cells, values, nesting and identifiers are capped; the readers read each text once; identifiers are looked up in maps, so the work grows with the rows; the pairs of leavers and accounts are capped, so one name held by thousands of rows on both sides stops the run instead of growing with leavers times accounts. Tests check the time, with limits that widen under coverage only |
| A quote that is never closed or a deep JSON value hangs the reader | The CSV reader finds the closing quote with one search and refuses a quote that is not closed with its line; the JSON reader refuses nesting past its limit |
| A pattern from the input is slow | No regular expression is built from the configuration or the files; a test looks for `new RegExp` in src |
| Text from the input rewrites the terminal or breaks a Markdown table | Every text goes through `safeText`, which removes control, line separator and direction characters and caps the length; Markdown cells escape the characters a table, a link or HTML needs. Tests put ANSI escapes and direction controls in names, usernames and statuses |
| A cell is run as a formula | A Markdown cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return gets a leading apostrophe. A test puts `=HYPERLINK(...)` in a leaver name |
| `__proto__` changes how objects behave | Identifiers are kept in maps; the JSON reader defines own properties; field paths follow own properties only. A test uses `__proto__`, `constructor` and `toString` as columns, fields, usernames and names |
| A link or a device named as an input hangs the tool | A file is opened once, and its type and size are taken from the open handle: a device or a pipe is refused as not a regular file. A path named on the command line may be a link to a regular file, because the person who runs the tool named it |
| Personal data leaks through a report | Email addresses are masked unless `--show-identifiers` is given; only the named columns are read; a report shows the identifiers that matched, not the row; errors show the first character of a bad address only (docs/secure-defaults.md) |
| A report overwrites an input, or the tool leaves files behind | Only `--out` writes, and a path that is one of the inputs is refused; there is no cache or temporary file. A test checks that a run leaves the folder as it was |

## Out of scope

Whether the leavers file is complete and the exports are current and cover every tool (docs/limits.md), access that is not an account in an export, the safety of the systems that produced the files, who may change the configuration in your repository, where your pipeline keeps the inputs and the reports, and the law that applies to the personal data in them.
