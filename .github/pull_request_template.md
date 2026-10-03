## What changes

<!-- One or two sentences. -->

## Checks

- [ ] `npm test`, `npm run test:coverage`, `npm run check` and `npm run example` pass, and the files under `examples/output` are the ones `npm run example` wrote
- [ ] A change to a rule, a reader, the comparison of identifiers or the configuration file is described in docs/method.md or docs/inputs.md, says what it can and cannot see, and has a test with the inputs written inline and a near miss on each side of the limit
- [ ] No threshold is built in: every number a rule compares comes from the configuration file
- [ ] Matching stays exact on a normal form: no similarity, and a full name is never an exact match
- [ ] An account is never left out by default: an unknown status counts as active, and an input that cannot be read stops the run with exit code 2
- [ ] A new preset names only fields, columns and values that its saved page shows
- [ ] A change to a quoted sentence follows the saved page: the new page text is saved in research/sources, `src/data.js` and docs/rules-and-sources.md match it, and nothing was added from memory
- [ ] Text from the input goes through `safeText`, and email addresses through `shownValue`, before they reach a report, a note or an error message
- [ ] The tool still opens no network connection, runs no program, reads no clock and writes nothing but the report `--out` names
- [ ] Work stays linear in the size of the input: no pattern with nested repetition, no loop over all accounts inside a loop over all leavers, and a hostile test with a time check that widens under coverage through `NODE_V8_COVERAGE`
- [ ] A test that depends on the operating system (a link, a device) is guarded with `process.platform`, asserts no line or column of its own, and builds its paths with `resolve()` from forward-slash names
- [ ] No real person, company, address, export or key in fixtures or examples, no date, and no number that reads like a year anywhere
- [ ] The commit messages of this pull request follow Conventional Commits
