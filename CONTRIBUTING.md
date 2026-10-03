# Contributing

Every change goes through a pull request and is reviewed before it is merged. The pipeline runs the tests on Linux, Windows and macOS with Node 22 and 24, the tests with coverage, the repository checks, CodeQL, and a secure development check of the repository itself.

Commit messages in this repository follow Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `ci:`, `chore:`, with `!` for a breaking change.

## Changing a rule

1. Describe the change in docs/method.md first: what the rule reports, when, what it can see and what it cannot, and the sentence of a saved page it rests on. Where the tool makes its own choice, say so and say why.
2. The tool has no threshold of its own, and a change must not add one. Every number a rule compares must come from the configuration file.
3. An account is never left out by default. An unknown status counts as active, a leaver with no end of work is taken as gone, and a file that cannot be read stops the run with exit code `2`.
4. Add a test with the inputs written inline (`leaversCsv()`, `accountsCsv()`, `csvText()` and `configWith()` in test/helpers.js build them), small enough that the result can be worked out by hand, with a near miss on each side of the limit.
5. A rule id, once released, keeps its meaning: pipelines and other tools read it from the JSON report.

## Changing how values are compared

1. The comparison stays exact on a normal form. Never add matching by similarity, distance or sound, and never let a full name give an exact match.
2. A new step of the normal form is written in src/identity.js, returned in the steps so `--explain` can show it, documented in docs/method.md, and off by default unless leaving it out would let an account hide.
3. Change case with `toLowerCase`, never with a function that depends on the locale; `test/days.test.js` runs the comparison under other locales and time zones.

## Adding a preset

1. Open the documentation page of the export, save its text in `research/sources` (the address on the first line, plain ASCII, no date or year), and add the page and the sentences the preset rests on to `src/data.js` and docs/rules-and-sources.md.
2. A preset names only fields, columns and status values that a saved page shows. If no page names the columns, there is no preset: the export is mapped in the configuration.
3. Describe the preset in docs/inputs.md and test it in test/presets.test.js with a file in the shape the page shows.

## Changing the configuration file

1. A new key is added to `KEYS`, `EXPORT_KEYS` or `STATUS_KEYS` in src/config.js, documented in docs/inputs.md, and tested with a good value and a bad one. Every key the tool does not know stays an error, and an object that names a key twice stays refused.
2. A number is a whole number, checked for its range.

## Changing a reader

1. The tool reads; it never runs. A reader must not fetch anything a file names, follow anything but own properties, or build a pattern from the input.
2. Keep the work linear: one pass over the text, no pattern with nested repetition, and no loop over all accounts inside a loop over all leavers. Keep the limits on bytes, rows, fields, values, nesting and identifiers. Add a hostile test with a long input and a time check.
3. A time check in a test widens under coverage: read `process.env.NODE_V8_COVERAGE`, which the test runner sets only when coverage is on, and allow four times the time. Never read the flags of the process for this, because they hold the coverage flags of the runner in every run. Run `npm run test:coverage` before you open the pull request.
4. Files written with LF and with CRLF line ends must give the same report. The example inputs are stored as written (`.gitattributes`), and a test reads them both ways.
5. Paths are opened with `path.resolve`. Paths shown in a report are relative, with forward slashes.

## Tests that depend on the system

A test that depends on the operating system (a symbolic link, a device) is guarded with `process.platform`, says why in its `t.skip`, and asserts no line or column of its own: a line or column is asserted only in a test that runs on every system, and is worked out there with `lineOf()` of test/helpers.js or from the text itself, never written by hand. `test/repo.test.js` fails when a guarded test asserts a line or a column. Every other test builds its paths with `resolve()` from names with forward slashes.

A test never reads the clock and never holds a date: it builds a date from a day number with `isoDay()` of test/helpers.js.

## Personal data

Never commit a real leavers file, a real export or a real address, even as a fixture. Examples and tests use made-up people on `example.com`, `example.org` and `example.net`; `test/repo.test.js` checks the examples.

## Rules for the code

- No runtime dependencies. Node 22 or newer and nothing else.
- The tool reads the files it is given and writes only to the screen or to the file `--out` names. It opens no network connection, runs no program and reads no clock.
- Text from the input goes through `safeText` before it reaches a report, a note or an error message, and an email address goes through `shownValue`, which masks it unless `--show-identifiers` was given.
- Source files stay ASCII; write any other character as a Unicode escape, or build it from its code point.
- Never commit a real secret, even as a fixture. `npm run check` fails on anything that looks like a credential.
- No file carries a date, and no file holds a number that reads like a year. Version numbers (Node 22, 1.0.0) and the revision of a standard (Rev. 5) are fine.

## Before you open the pull request

```
npm test
npm run test:coverage
npm run check
npm run example
```
