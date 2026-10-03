# Secure defaults

The default run is the safe run. Nothing in the first two sections needs a flag, and none of it can be switched off. The rest of the document is about what the tool cannot do for you: where the inputs come from, where a report goes, and who may change the configuration.

## How the tool behaves by default

- **No API, no credentials.** The tool reads files that someone exported. It opens no network connection, refuses an argument that looks like an address, and never needs a token, a password or a key. It cannot change an account; it lists them.
- **No threshold of its own.** Every number a rule compares comes from the configuration. A rule the configuration does not state is not run, and a configuration with no rule is refused. `graceDays` has no default and must be written. The defaults that exist (docs/inputs.md) are not thresholds of a rule.
- **Unknown keys are errors.** A key in the configuration that the tool does not know stops the run, with its line and a suggestion, so a typo cannot switch a rule off. A key named twice stops the run.
- **Fail closed on what it cannot read.** An input that cannot be read stops the run with exit code `2` and no verdict. A column the configuration or a preset names and the file lacks stops the run. A leaver with no identifier, or with an email cell that is not an address, stops the run. An account whose status is not in the lists of the configuration is counted as active, and a note says so. A leaver with no end of work is taken as gone.
- **Exact matching, explained.** Two values match when their normal forms are equal; nothing is matched by similarity. A full name is only ever a possible match, reported under its own rule. `--explain` shows every column, field and step behind every match.
- **No regular expression from the input.** No pattern is built from the configuration or the files; the readers read each text once.
- **No prototype tricks.** Identifiers are kept in maps keyed by text, JSON objects are built with own properties, and a field path follows own properties only, so a name such as `__proto__` is just data.
- **Clean output.** Text from the input has control characters, line separators and direction controls removed and its length capped before it reaches a report or an error message. Markdown cells escape pipes, backslashes, square brackets, backticks, asterisks, underscores, line breaks and `<`, `>` and `&`, and a cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return gets a leading apostrophe, so a table pasted into a spreadsheet is not read as a formula.
- **The same files give the same report.** The tool reads no clock, no time zone and no random number; dates need `--as-of`. Case is changed without the locale of the machine. [The decision](decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md) explains this.
- **No dependencies.** Node 22 or newer and nothing else.

## Personal data

The leavers file and the exports are personal data: names, email addresses, usernames, the day a person stopped working. The General Data Protection Regulation says in Article 5(1)(c) that personal data shall be "adequate, relevant and limited to what is necessary in relation to the purposes for which they are processed ('data minimisation');" (quoted from the official English text on EUR-Lex, saved in `research/sources/gdpr-article-5.txt`). The tool follows that idea in what it shows and what it keeps; whether a given use of the files is lawful is for your company to decide, not for the tool.

- **Email addresses are masked.** Every report shows an address as its first character, three asterisks and the domain: `a***@example.com`. The domain stays, because the `personal-address` rule is about the domain. `--show-identifiers` shows addresses in full, for the person who has to act on a finding.
- **Only the named columns are read.** Columns of the leavers file and the exports that the configuration does not name are not read and never reach a report. A report shows the identifiers that matched, the status read and the line, not the whole row.
- **Nothing is written to disk but the report that `--out` names.** The tool keeps no cache, no history and no temporary file. Without `--out` the report goes to the screen. With `--out` the file is created for its owner only where the system has file permissions, and a path that is one of the inputs is refused, so a report never overwrites the data it was made from.
- **Errors say little.** An error about a bad email cell shows its first character only.

Before you run it and post a report:

- Keep the exports and the leavers file where only the people who do the offboarding can read them, and delete them when the check is done.
- Post the report where only those people read it: a finding names a person who left.
- Do not post `--show-identifiers` output outside that group.
- Run it in a pipeline only on a runner you trust with the files, and do not keep the inputs as build artifacts.

## Rules that make the check stricter

- **`graceDays: 0`.** An account is a finding from the day after the last day of work.
- **`failOn: "notice"`.** Every finding fails the run.
- **`possibleMatch` at `warning` or `error`.** Name-only matches fail the run too.
- **`companyAccountsOnly` on every tool that should hold company accounts only,** with the `personal-address` rule.
- **A status list for every export that has one.** Without it, every row of the export is active, which is safe but noisy.

## Running it in a pipeline

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
    with:
      node-version: 22
  - name: Access left behind
    run: >
      npx --yes github:INNERLUXES/access-offboarding-check
      --config offboarding/config.json --leavers "$RUNNER_TEMP/leavers.csv"
      --export code="$RUNNER_TEMP/code-members.json" --export wiki="$RUNNER_TEMP/wiki-users.csv"
```

- Give the job read access to the contents and nothing more. The tool needs no secret. The step that fetches the exports does, and should be a separate step with its own narrow token.
- Pin every action to a full commit, as above, and pin the tool to a release commit or a tag you have read, because `npx` runs what it downloads.
- Keep the inputs in the temporary folder of the runner, not in the repository and not as artifacts.
- Do not hide the exit code with a trailing `|| true`.

## Protecting the configuration

The configuration decides which exports are read, what counts as inactive, how long the grace is and what fails the run. Keep it in the repository, in its own path, and put the path in `CODEOWNERS` with the people who own offboarding; require their review in branch protection. Review a change to a status list or a domain alias like code: an alias that maps the wrong domain, or a status value moved to the inactive list, can hide an account.

## SSDF

The repository is checked against NIST SP 800-218 (SSDF) in its own pipeline and before every release, with `ssdf-repo-check` pinned to its release commit. The evidence it looks for is in these files:

| Practice | Evidence in this repository |
| --- | --- |
| PO.1 Define security requirements | CONTRIBUTING.md, docs/secure-defaults.md |
| PO.2 Roles and responsibilities | .github/CODEOWNERS |
| PO.3 Toolchain | .github/workflows/ci.yml, codeql.yml, release.yml |
| PO.4 Criteria for security checks | CodeQL with the security-extended queries, the SSDF gate in ci.yml and release.yml |
| PO.5 Secure environments | a `permissions:` block in every workflow, actions pinned to commits |
| PS.1 Protect the code | .gitignore for keys and `.env`, `npm run check` for committed secrets |
| PS.2 Integrity of releases | SHA-256 checksums and a build provenance attestation in release.yml |
| PS.3 Archive and provenance | a CycloneDX SBOM and the CHANGELOG with every release |
| PW.1 Design for security | docs/threat-model.md |
| PW.2 Review the design | docs/decisions |
| PW.4 Reuse secure components | no runtime dependencies, a lock file, Dependabot |
| PW.5 Secure coding | CONTRIBUTING.md, `npm run check` |
| PW.6 Build settings | `npm ci` from the lock file |
| PW.7 Code review | the pull request template and CODEOWNERS |
| PW.8 Testing | `npm test` on Linux, Windows and macOS with Node 22 and 24, `npm run test:coverage`, hostile input tests |
| PW.9 Secure defaults | this document |
| RV.1 Find vulnerabilities | SECURITY.md, Dependabot |
| RV.2 Respond to vulnerabilities | SECURITY.md |
