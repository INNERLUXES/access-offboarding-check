# Rules and sources

Every sentence the tool quotes, in a report or in these documents, comes from a page that was opened and saved as plain text in `research/sources`, with its address on the first line. `src/data.js` holds the sentences, and `test/data.test.js` compares each one with the saved text, so a sentence cannot drift from its page. Where the tool makes a choice that no page makes for it, docs/method.md says so.

## The saved pages

| File | Page | What is quoted |
| --- | --- | --- |
| `nist-sp800-53r5-ps-4-ps-7.txt` | NIST SP 800-53 Rev. 5, controls PS-4 Personnel Termination and PS-7 External Personnel Security, from the OSCAL catalog, https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json | the statements, parameters and guidance of PS-4 Personnel Termination and PS-7 External Personnel Security, read from the OSCAL catalog of NIST SP 800-53 Rev. 5 that NIST publishes in usnistgov/oscal-content |
| `rfc4180-csv-definition.txt` | RFC 4180, Common Format and MIME Type for Comma-Separated Values (CSV) Files, https://www.rfc-editor.org/rfc/rfc4180 | section 2, the definition of the CSV format |
| `rfc8259-json-objects.txt` | RFC 8259, The JSON Data Interchange Format, https://www.rfc-editor.org/rfc/rfc8259 | section 4, objects and repeated names |
| `rfc5321-mailbox.txt` | RFC 5321, Simple Mail Transfer Protocol: mailbox and address, and case, https://www.rfc-editor.org/rfc/rfc5321 | section 2.3.11 on mailbox and address, and the paragraph of section 2.4 on case |
| `gdpr-article-5.txt` | General Data Protection Regulation, Article 5, on EUR-Lex, https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679 | Article 5(1), points (a) to (c), of the General Data Protection Regulation, from the official text on EUR-Lex |
| `github-rest-org-members.txt` | GitHub REST API documentation: List organization members, https://docs.github.com/en/rest/orgs/members | the List organization members endpoint and its example response |
| `github-rest-outside-collaborators.txt` | GitHub REST API documentation: List outside collaborators for an organization, https://docs.github.com/en/rest/orgs/outside-collaborators | the List outside collaborators endpoint and its example response |
| `google-directory-users.txt` | Google Workspace Admin SDK, Directory API: the User resource and users.list, https://developers.google.com/workspace/admin/directory/reference/rest/v1/users | the User resource of the Directory API and the response of users.list |
| `entra-users-bulk-download.txt` | Microsoft Learn: Download a list of users in the Azure portal (Microsoft Entra ID), https://learn.microsoft.com/en-us/entra/identity/users/users-bulk-download | the steps and the attribute list of Download users |
| `graph-user-resource.txt` | Microsoft Graph REST API v1.0: the user resource type, https://learn.microsoft.com/en-us/graph/api/resources/user | the rows of the user properties accountEnabled, displayName, mail and userPrincipalName |
| `atlassian-export-users.txt` | Atlassian Support: Export users from a site, https://support.atlassian.com/organization-administration/docs/export-users-from-a-site/ | the user statuses of the export and the first four columns of the CSV file |

The NIST page is read from the OSCAL catalog in JSON, which is the machine-readable form of the controls that NIST publishes; each prose field is kept word for word, and a parameter is written as the catalog writes it, `{{ insert: param, <id> }}`, with its label in the list of parameters. The GDPR page is the official English text of the regulation on EUR-Lex; its typographic quotes are written as ASCII. The GitHub pages leave out the line of the request example that sets the API version header, because its value is a date.

## The rules

| Rule | Key | Sentences | Method |
| --- | --- | --- | --- |
| `still-active` | `rules.stillActive` | `ps4Credentials`, `ps7Notifications` | [still-active](method.md#still-active) |
| `possible-match` | `rules.possibleMatch` | `ps4Credentials` | [possible-match](method.md#possible-match) |
| `personal-address` | `rules.personalAddress` | `mailboxDomain`, `ps7Requirements` | [personal-address](method.md#personal-address) |

`--explain` prints the sentences of each rule under its findings, with the section and the page.

## The presets

| Preset | Page | Sentences |
| --- | --- | --- |
| `github-org-members` | github-rest-org-members.txt | `githubMembers` |
| `github-outside-collaborators` | github-rest-outside-collaborators.txt | `githubOutside` |
| `google-directory-users` | google-directory-users.txt | `googleUsersList`, `googleSuspended`, `googlePrimaryEmail`, `googleAliases`, `googleArchived`, `googleFullName` |
| `entra-users` | entra-users-bulk-download.txt, graph-user-resource.txt | `entraAttributes`, `entraCustomColumns`, `graphAccountEnabled` |
| `atlassian-users` | atlassian-export-users.txt | `atlassianHeadings`, `atlassianStatuses`, `atlassianEmail` |

`test/presets.test.js` checks that every field, column and status value of a preset is on its page, and reads a file in the shape the page shows; for GitHub, it reads the example response saved from the page itself.

## Every quoted sentence

| Key | Used by | Sentence | Section | Page |
| --- | --- | --- | --- | --- |
| `ps4Upon` | docs/method.md | Upon termination of individual employment: | PS-4 Statement | nist-ps |
| `ps4Credentials` | `still-active`, `possible-match` | Terminate or revoke any authenticators and credentials associated with the individual; | PS-4 Statement | nist-ps |
| `ps4TimePeriod` | docs/method.md (the grace days) | a time period within which to disable system access is defined; | PS-4 Parameters | nist-ps |
| `ps7Requirements` | `personal-address` | Establish personnel security requirements, including security roles and responsibilities for external providers; | PS-7 Statement | nist-ps |
| `ps7Monitor` | docs/method.md | Monitor provider compliance with personnel security requirements. | PS-7 Statement | nist-ps |
| `ps7Providers` | docs/method.md | External providers include service bureaus, contractors, and other organizations that provide system development, information technology services, testing or assessment services, outsourced applications, and network/security management. | PS-7 Guidance | nist-ps |
| `ps7Notifications` | `still-active` | Notifications of external personnel changes ensure the appropriate termination of privileges and credentials. | PS-7 Guidance | nist-ps |
| `csvSameFields` | the CSV reader | Each line should contain the same number of fields throughout the file. | 2. Definition of the CSV Format | rfc4180 |
| `csvQuotes` | the CSV reader | If fields are not enclosed with double quotes, then double quotes may not appear inside the fields. | 2. Definition of the CSV Format | rfc4180 |
| `jsonUnpredictable` | the JSON reader | When the names within an object are not unique, the behavior of software that receives such an object is unpredictable. | 4. Objects | rfc8259 |
| `mailboxDomain` | `personal-address`, plus tags | the local-part MUST be interpreted and assigned semantics only by the host specified in the domain part of the address. | 2.3.11. Mailbox and Address | rfc5321 |
| `localPartCase` | the comparison of addresses | The local-part of a mailbox MUST BE treated as case sensitive. | 2.4. General Syntax Principles and Transaction Model | rfc5321 |
| `localPartCaseDiscouraged` | the comparison of addresses | However, exploiting the case sensitivity of mailbox local-parts impedes interoperability and is discouraged. | 2.4. General Syntax Principles and Transaction Model | rfc5321 |
| `domainCase` | the comparison of addresses | Mailbox domains follow normal DNS rules and are hence not case sensitive. | 2.4. General Syntax Principles and Transaction Model | rfc5321 |
| `dataMinimisation` | docs/secure-defaults.md | adequate, relevant and limited to what is necessary in relation to the purposes for which they are processed ('data minimisation'); | Article 5 | gdpr |
| `githubMembers` | `github-org-members` | List all users who are members of an organization. | List organization members | github-members |
| `githubOutside` | `github-outside-collaborators` | List all users who are outside collaborators of an organization. | List outside collaborators for an organization | github-outside |
| `googlePrimaryEmail` | `google-directory-users` | The user's primary email address. | primaryEmail | google-users |
| `googleAliases` | `google-directory-users` | Output only. The list of the user's alias email addresses. | aliases[] | google-users |
| `googleSuspended` | `google-directory-users` | Indicates if user is suspended. | suspended | google-users |
| `googleArchived` | `google-directory-users` | Indicates if user is archived. | archived | google-users |
| `googleFullName` | `google-directory-users` | The user's full name formed by concatenating the first and last name values. | fullName | google-users |
| `googleUsersList` | `google-directory-users` | A list of user objects. | users[] | google-users |
| `entraAttributes` | `entra-users` | The following user attributes are included: | To download a list of users | entra-download |
| `entraCustomColumns` | `entra-users` | With this update, admins can customize their User List View columns, and the export will mirror those selected columns. | Improved bulk user download | entra-download |
| `graphAccountEnabled` | `entra-users` | true if the account is enabled; otherwise, false. | accountEnabled | graph-user |
| `atlassianHeadings` | `atlassian-users` | The first row of the CSV spreadsheet are column headings. | Understand the CSV spreadsheet | atlassian-export |
| `atlassianStatuses` | `atlassian-users` | All users - Includes all active, suspended and deactivated users. | Select the user status | atlassian-export |
| `atlassianEmail` | `atlassian-users` | The user's email address. | Email | atlassian-export |

## What no page says

These are the choices of the tool, each explained in docs/method.md or docs/decisions:

- reading the local part of an address without case;
- taking a full name as a possible match only, never an exact one;
- counting an account with an unknown status as active;
- taking a leaver with no end of work as gone;
- treating the last day of work as a working day;
- masking email addresses by default;
- reading no clock.

Add a rule or a sentence only after opening the page, saving its text in `research/sources` and quoting it word for word. If a page cannot be opened, do not cite it.
