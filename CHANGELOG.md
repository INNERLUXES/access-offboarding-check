# Changes

## 1.0.0

First release.

- Finds access left behind after people stopped working for the company: employees, contractors and augmented staff. Reads a CSV file of leavers and the account exports of any number of tools (CSV or JSON), declared in a configuration file with their fields and statuses, and never calls an API or needs a credential.
- Matches accounts to leavers by email address and username, exactly, on a normal form written out in docs/method.md: without case, with the plus tag left out and domain aliases applied when the configuration says so, with one leading `@` left out of a username. A full name gives a possible match only, reported under its own rule. Nothing is matched by similarity, and `--explain` shows the column, the field and every step behind each match.
- Three rules, each run only when the configuration states it, with its level from the configuration: `still-active` (an account that is not inactive matches a leaver more than `graceDays` after the last day of work), `possible-match` (the same by full name only) and `personal-address` (an account with an address outside the company domains in a tool that holds company accounts only). An account with a status the configuration does not list is counted as active and noted.
- Presets for the shapes of five exports, each written from a saved documentation page: `github-org-members`, `github-outside-collaborators`, `google-directory-users`, `entra-users` and `atlassian-users`. A file that lacks a column the preset names is refused.
- The end of work is a number of days from the as-of day or a date with `--as-of`; the tool reads no clock and no time zone, so the same files give the same report everywhere.
- Reports as text, Markdown and JSON, with every leaver and every matched account, the file and the line of each account, and the notes. Email addresses are masked unless `--show-identifiers` is given. Markdown cells are escaped and guarded against spreadsheet formulas. `--out` writes the report to a file and refuses a path that is one of the inputs; nothing else is written. Exit code `0` when no finding is at or above the fail level, `1` when one is, `2` for a usage or input error, with no verdict.
- Own small strict readers: a CSV reader written from RFC 4180 that refuses bad quoting with its line, and a JSON reader that refuses a repeated key. Limits on files, rows, fields, values, nesting, identifiers and pairs of leavers and accounts.
- Every quoted sentence comes from NIST SP 800-53 Rev. 5 (PS-4 and PS-7, from the OSCAL catalog), RFC 4180, RFC 8259, RFC 5321, Article 5 of the General Data Protection Regulation on EUR-Lex and the documentation pages of the presets, saved in `research/sources`; a test compares `src/data.js` and the documents with the saved text.
- Release packages come with a CycloneDX SBOM, SHA-256 checksums and a build provenance attestation, after the SSDF gate of the repository.
