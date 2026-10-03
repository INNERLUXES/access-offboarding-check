## access-offboarding-check: FAIL - 10 findings at or above warning

- Configuration: examples/config.json (Example Co)
- Leavers: examples/example-co/leavers.csv (6 rows); end of work in the column last\_day: 5 as days from the as-of day, 1 empty
- Export: code examples/example-co/code-members.json (JSON, preset github-org-members): 6 accounts, 6 active
- Export: wiki examples/example-co/wiki-users.csv (CSV, preset atlassian-users, company accounts only): 8 accounts, 6 active, 2 inactive
- Export: messenger examples/example-co/messenger-users.csv (CSV, company accounts only): 8 accounts, 6 active, 1 inactive, 1 with a status not listed
- Matching: email addresses and usernames without case, the plus tag left out, 1 domain alias; full names give possible matches only
- Rules: still-active (error, 7 grace days); possible-match (warning); personal-address (warning, company domains example.com)
- Results: 6 leavers, 4 past their last day and grace days; 14 matched accounts: 11 active, 2 inactive, 1 possible by name
- Findings: 10 (6 error, 4 warning); fail level warning

### Findings

| Level | Rule | Found | Where |
| --- | --- | --- | --- |
| **error** | still-active | Dana Reyes: the account dreyes-dev in code is active; matched by username | examples/example-co/code-members.json:8 |
| **error** | still-active | Omar Lind: the account Omar Lind in wiki is active; matched by email address | examples/example-co/wiki-users.csv:4 |
| **error** | still-active | Omar Lind: the account omar in messenger is active; matched by username | examples/example-co/messenger-users.csv:4 |
| **error** | still-active | Priya Nair: the account PNair in code is active; matched by username | examples/example-co/code-members.json:26 |
| **error** | still-active | Priya Nair: the account Priya Nair in wiki is active; matched by email address | examples/example-co/wiki-users.csv:5 |
| **error** | still-active | Sam Ortiz: the account samo in messenger is not marked inactive; matched by email address and username | examples/example-co/messenger-users.csv:9 |
| warning | possible-match | Sam Ortiz: the account Sam  Ortiz in wiki has the same full name and is active; a possible match, to check by hand | examples/example-co/wiki-users.csv:8 |
| warning | personal-address | the account Sam  Ortiz in wiki has s\*\*\*@mail.example.net outside the company domains | examples/example-co/wiki-users.csv:8 |
| warning | personal-address | the account omar in messenger has o\*\*\*@mail.example.org outside the company domains | examples/example-co/messenger-users.csv:4 |
| warning | personal-address | the account riley in messenger has r\*\*\*@studio.example.net outside the company domains | examples/example-co/messenger-users.csv:8 |

#### still-active: examples/example-co/code-members.json:8

- Why: active (listed; the export has no status field)
- Why: past the 7 grace days
- Why: username dreyes-dev in the leavers column code\_login and dreyes-dev in the field login, equal as written
- Basis: "Terminate or revoke any authenticators and credentials associated with the individual;" (PS-4 Statement, https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST\_SP-800-53\_rev5\_catalog.json)
- Basis: "Notifications of external personnel changes ensure the appropriate termination of privileges and credentials." (PS-7 Guidance, https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST\_SP-800-53\_rev5\_catalog.json)

#### still-active: examples/example-co/wiki-users.csv:4

- Why: active (User status Active)
- Why: past the 7 grace days
- Why: email address o\*\*\*@example.com in the leavers column email and O\*\*\*@Example.com in the field Email, equal after their normal form (read without case)
- Basis: "Terminate or revoke any authenticators and credentials associated with the individual;" (PS-4 Statement, https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST\_SP-800-53\_rev5\_catalog.json)
- Basis: "Notifications of external personnel changes ensure the appropriate termination of privileges and credentials." (PS-7 Guidance, https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST\_SP-800-53\_rev5\_catalog.json)

#### still-active: examples/example-co/messenger-users.csv:4

- Why: active (state active)
- Why: past the 7 grace days
- Why: username omar in the leavers column messenger\_handle and omar in the field handle, equal as written
- Basis: "Terminate or revoke any authenticators and credentials associated with the individual;" (PS-4 Statement, https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST\_SP-800-53\_rev5\_catalog.json)
- Basis: "Notifications of external personnel changes ensure the appropriate termination of privileges and credentials." (PS-7 Guidance, https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST\_SP-800-53\_rev5\_catalog.json)

#### still-active: examples/example-co/code-members.json:26

- Why: active (listed; the export has no status field)
- Why: past the 7 grace days
- Why: username pnair in the leavers column code\_login and PNair in the field login, equal after their normal form (read without case)
- Basis: "Terminate or revoke any authenticators and credentials associated with the individual;" (PS-4 Statement, https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST\_SP-800-53\_rev5\_catalog.json)
- Basis: "Notifications of external personnel changes ensure the appropriate termination of privileges and credentials." (PS-7 Guidance, https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST\_SP-800-53\_rev5\_catalog.json)

#### still-active: examples/example-co/wiki-users.csv:5

- Why: active (User status Active)
- Why: past the 7 grace days
- Why: email address P\*\*\*@Example.com in the leavers column email and p\*\*\*@example.com in the field Email, equal after their normal form (read without case; the plus tag left out)
- Basis: "Terminate or revoke any authenticators and credentials associated with the individual;" (PS-4 Statement, https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST\_SP-800-53\_rev5\_catalog.json)
- Basis: "Notifications of external personnel changes ensure the appropriate termination of privileges and credentials." (PS-7 Guidance, https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST\_SP-800-53\_rev5\_catalog.json)

#### still-active: examples/example-co/messenger-users.csv:9

- Why: status not listed in the configuration (state invited); counted as active
- Why: taken as left
- Why: email address s\*\*\*@example.com in the leavers column email and s\*\*\*@example.com in the field email, equal as written
- Why: username samo in the leavers column messenger\_handle and samo in the field handle, equal as written
- Basis: "Terminate or revoke any authenticators and credentials associated with the individual;" (PS-4 Statement, https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST\_SP-800-53\_rev5\_catalog.json)
- Basis: "Notifications of external personnel changes ensure the appropriate termination of privileges and credentials." (PS-7 Guidance, https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST\_SP-800-53\_rev5\_catalog.json)

#### possible-match: examples/example-co/wiki-users.csv:8

- Why: active (User status Active)
- Why: taken as left
- Why: full name Sam Ortiz in the leavers column full\_name and Sam  Ortiz in the field User name, equal after their normal form (white space and case left out)
- Basis: "Terminate or revoke any authenticators and credentials associated with the individual;" (PS-4 Statement, https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST\_SP-800-53\_rev5\_catalog.json)

#### personal-address: examples/example-co/wiki-users.csv:8

- Why: active (User status Active)
- Why: the field Email holds s\*\*\*@mail.example.net, on the domain mail.example.net, which is not example.com
- Basis: "the local-part MUST be interpreted and assigned semantics only by the host specified in the domain part of the address." (2.3.11. Mailbox and Address, https://www.rfc-editor.org/rfc/rfc5321)
- Basis: "Establish personnel security requirements, including security roles and responsibilities for external providers;" (PS-7 Statement, https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST\_SP-800-53\_rev5\_catalog.json)

#### personal-address: examples/example-co/messenger-users.csv:4

- Why: active (state active)
- Why: the field email holds o\*\*\*@mail.example.org, on the domain mail.example.org, which is not example.com
- Basis: "the local-part MUST be interpreted and assigned semantics only by the host specified in the domain part of the address." (2.3.11. Mailbox and Address, https://www.rfc-editor.org/rfc/rfc5321)
- Basis: "Establish personnel security requirements, including security roles and responsibilities for external providers;" (PS-7 Statement, https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST\_SP-800-53\_rev5\_catalog.json)

#### personal-address: examples/example-co/messenger-users.csv:8

- Why: active (state active)
- Why: the field email holds r\*\*\*@studio.example.net, on the domain studio.example.net, which is not example.com
- Basis: "the local-part MUST be interpreted and assigned semantics only by the host specified in the domain part of the address." (2.3.11. Mailbox and Address, https://www.rfc-editor.org/rfc/rfc5321)
- Basis: "Establish personnel security requirements, including security roles and responsibilities for external providers;" (PS-7 Statement, https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST\_SP-800-53\_rev5\_catalog.json)

### Leavers

| Leaver | Line | End of work | Export | Account | Status | Match | Finding |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dana Reyes | 2 | last day 30 days before the as-of day; past the 7 grace days | code | dreyes-dev | active (listed) | exact: username | still-active |
|  |  |  | wiki | Dana Reyes | inactive (User status Deactivated) | exact: email address | none |
|  |  |  | messenger | dana.r | inactive (state deactivated) | exact: email address, username | none |
| Omar Lind | 3 | last day 12 days before the as-of day; past the 7 grace days | wiki | Omar Lind | active (User status Active) | exact: email address | still-active |
|  |  |  | messenger | omar | active (state active) | exact: username | still-active |
| Priya Nair | 4 | last day 45 days before the as-of day; past the 7 grace days | code | PNair | active (listed) | exact: username | still-active |
|  |  |  | wiki | Priya Nair | active (User status Active) | exact: email address | still-active |
| Tom Becker | 5 | last day 5 days before the as-of day; in the grace period: 5 days of 7 grace days passed | code | tbecker-x | active (listed) | exact: username | none |
|  |  |  | wiki | Tom Becker | active (User status Active) | exact: email address | none |
|  |  |  | messenger | tbecker | active (state active) | exact: email address, username | none |
| Lea Hoffmann | 6 | last day 3 days after the as-of day; still working: the last day of work is after the as-of day | code | leah | active (listed) | exact: username | none |
|  |  |  | messenger | lea.h | active (state active) | exact: email address, username | none |
| Sam Ortiz | 7 | no end of work given; taken as left | wiki | Sam  Ortiz | active (User status Active) | possible: full name | possible-match |
|  |  |  | messenger | samo | counted as active (state invited) | exact: email address, username | still-active |

#### Dana Reyes (line 2)

- code, examples/example-co/code-members.json:8: username dreyes-dev in the leavers column code\_login and dreyes-dev in the field login, equal as written
- wiki, examples/example-co/wiki-users.csv:3: email address d\*\*\*@example.com in the leavers column email and d\*\*\*@example.com in the field Email, equal as written
- messenger, examples/example-co/messenger-users.csv:3: email address d\*\*\*@example.com in the leavers column email and d\*\*\*@example.com in the field email, equal as written
- messenger, examples/example-co/messenger-users.csv:3: username dana.r in the leavers column messenger\_handle and dana.r in the field handle, equal as written

#### Omar Lind (line 3)

- wiki, examples/example-co/wiki-users.csv:4: email address o\*\*\*@example.com in the leavers column email and O\*\*\*@Example.com in the field Email, equal after their normal form (read without case)
- messenger, examples/example-co/messenger-users.csv:4: username omar in the leavers column messenger\_handle and omar in the field handle, equal as written

#### Priya Nair (line 4)

- code, examples/example-co/code-members.json:26: username pnair in the leavers column code\_login and PNair in the field login, equal after their normal form (read without case)
- wiki, examples/example-co/wiki-users.csv:5: email address P\*\*\*@Example.com in the leavers column email and p\*\*\*@example.com in the field Email, equal after their normal form (read without case; the plus tag left out)

#### Tom Becker (line 5)

- code, examples/example-co/code-members.json:32: username tbecker-x in the leavers column code\_login and tbecker-x in the field login, equal as written
- wiki, examples/example-co/wiki-users.csv:6: email address t\*\*\*@old.example.com in the leavers column email and t\*\*\*@example.com in the field Email, equal after their normal form (the domain old.example.com read as example.com)
- messenger, examples/example-co/messenger-users.csv:5: email address t\*\*\*@old.example.com in the leavers column email and t\*\*\*@example.com in the field email, equal after their normal form (the domain old.example.com read as example.com)
- messenger, examples/example-co/messenger-users.csv:5: username tbecker in the leavers column messenger\_handle and tbecker in the field handle, equal as written

#### Lea Hoffmann (line 6)

- code, examples/example-co/code-members.json:20: username leah in the leavers column code\_login and leah in the field login, equal as written
- messenger, examples/example-co/messenger-users.csv:6: email address l\*\*\*@example.com in the leavers column email and l\*\*\*@example.com in the field email, equal as written
- messenger, examples/example-co/messenger-users.csv:6: username lea.h in the leavers column messenger\_handle and lea.h in the field handle, equal as written

#### Sam Ortiz (line 7)

- wiki, examples/example-co/wiki-users.csv:8: full name Sam Ortiz in the leavers column full\_name and Sam  Ortiz in the field User name, equal after their normal form (white space and case left out)
- messenger, examples/example-co/messenger-users.csv:9: email address s\*\*\*@example.com in the leavers column email and s\*\*\*@example.com in the field email, equal as written
- messenger, examples/example-co/messenger-users.csv:9: username samo in the leavers column messenger\_handle and samo in the field handle, equal as written

### Notes

- messenger: 1 account has a status the configuration does not list, and is counted as active
- 1 leaver has no end of work and is taken as left

Email addresses are masked; `--show-identifiers` shows them.
