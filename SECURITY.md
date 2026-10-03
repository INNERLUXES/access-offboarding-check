# Security

## Reporting a problem

Write to info@innerluxes.dev with the subject line "access-offboarding-check security", or use private vulnerability reporting on this repository. Please do not open a public issue for a vulnerability.

Include a small made-up input that shows the problem, what you expected and what happened. Use made-up names, usernames and addresses on `example.com`, never an export of a real tool or a real leavers file, and never a real key, token or password, even a revoked one.

## Scope

In scope:

- an input that makes the tool open a network connection, call an API, run a program, load a module or evaluate any part of a file
- an input that makes the tool write a file other than the one `--out` names, or write the report over one of its inputs
- an account that is active, or has a status the configuration does not list, and matches a leaver exactly, that is not reported for a leaver who is due; an inactive account reported as active; a leaver taken as due before the grace period has passed, or not due after it
- two values reported as an exact match when their normal forms differ, a full name reported as an exact match, or a match made by similarity
- an input that the tool fails to read and passes over without a note or an error, such as a missing column, a row that is not an object or an end of work in another form
- an input that makes the tool hang, take very long or use unbounded memory, such as a very large file, very many rows, a very long cell, a quote that is never closed, JSON nested very deep, or one identifier held by very many rows
- text from an input that breaks a Markdown table, makes a link, is read as a formula when a table is pasted into a spreadsheet, rewrites the terminal through control or direction characters, or is shown unescaped in a report
- a name such as `__proto__` that changes how objects behave inside the tool
- an email address shown in full in a report without `--show-identifiers`
- a configuration that makes the tool accept a key it does not know or a key named twice, or run a pattern of its own
- a report that changes with the clock, the time zone or the locale of the machine
- a sentence in src/data.js that differs from the saved page in research/sources

Out of scope: whether the leavers file is complete and the exports are current, access that is not an account in an export (docs/limits.md lists what the tool cannot see), the safety of the systems that wrote the files, who may change the configuration in your repository, and where your pipeline keeps the inputs and the reports.

Read [docs/threat-model.md](docs/threat-model.md) for the rest.
