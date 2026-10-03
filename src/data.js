// The pages and sentences the tool and its documents rest on. Each sentence comes from a page that is saved, with its
// address on the first line, in research/sources, and test/data.test.js compares this file with the saved text. Change a
// sentence here only after saving the new page text and updating docs/rules-and-sources.md. The code in src/ uses these
// constants and never writes a quoted sentence of its own.

export const SOURCES = [
  { id: 'nist-ps', file: 'nist-sp800-53r5-ps-4-ps-7.txt', url: 'https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json', label: 'NIST SP 800-53 Rev. 5, controls PS-4 Personnel Termination and PS-7 External Personnel Security, from the OSCAL catalog' },
  { id: 'rfc4180', file: 'rfc4180-csv-definition.txt', url: 'https://www.rfc-editor.org/rfc/rfc4180', label: 'RFC 4180, Common Format and MIME Type for Comma-Separated Values (CSV) Files' },
  { id: 'rfc8259', file: 'rfc8259-json-objects.txt', url: 'https://www.rfc-editor.org/rfc/rfc8259', label: 'RFC 8259, The JSON Data Interchange Format' },
  { id: 'rfc5321', file: 'rfc5321-mailbox.txt', url: 'https://www.rfc-editor.org/rfc/rfc5321', label: 'RFC 5321, Simple Mail Transfer Protocol: mailbox and address, and case' },
  { id: 'gdpr', file: 'gdpr-article-5.txt', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679', label: 'General Data Protection Regulation, Article 5, on EUR-Lex' },
  { id: 'github-members', file: 'github-rest-org-members.txt', url: 'https://docs.github.com/en/rest/orgs/members', label: 'GitHub REST API documentation: List organization members' },
  { id: 'github-outside', file: 'github-rest-outside-collaborators.txt', url: 'https://docs.github.com/en/rest/orgs/outside-collaborators', label: 'GitHub REST API documentation: List outside collaborators for an organization' },
  { id: 'google-users', file: 'google-directory-users.txt', url: 'https://developers.google.com/workspace/admin/directory/reference/rest/v1/users', label: 'Google Workspace Admin SDK, Directory API: the User resource and users.list' },
  { id: 'entra-download', file: 'entra-users-bulk-download.txt', url: 'https://learn.microsoft.com/en-us/entra/identity/users/users-bulk-download', label: 'Microsoft Learn: Download a list of users in the Azure portal (Microsoft Entra ID)' },
  { id: 'graph-user', file: 'graph-user-resource.txt', url: 'https://learn.microsoft.com/en-us/graph/api/resources/user', label: 'Microsoft Graph REST API v1.0: the user resource type' },
  { id: 'atlassian-export', file: 'atlassian-export-users.txt', url: 'https://support.atlassian.com/organization-administration/docs/export-users-from-a-site/', label: 'Atlassian Support: Export users from a site' }
];

export const source = (id) => SOURCES.find((s) => s.id === id);

// Sentences quoted in the reports and the documents. Every text is on its saved page word for word (test/data.test.js
// compares them, with runs of white space read as one space), and holds no year.
export const FACTS = {
  ps4Upon: { source: 'nist-ps', section: 'PS-4 Statement', text: 'Upon termination of individual employment:' },
  ps4Credentials: { source: 'nist-ps', section: 'PS-4 Statement', text: 'Terminate or revoke any authenticators and credentials associated with the individual;' },
  ps4TimePeriod: { source: 'nist-ps', section: 'PS-4 Parameters', text: 'a time period within which to disable system access is defined;' },
  ps7Requirements: { source: 'nist-ps', section: 'PS-7 Statement', text: 'Establish personnel security requirements, including security roles and responsibilities for external providers;' },
  ps7Monitor: { source: 'nist-ps', section: 'PS-7 Statement', text: 'Monitor provider compliance with personnel security requirements.' },
  ps7Providers: { source: 'nist-ps', section: 'PS-7 Guidance', text: 'External providers include service bureaus, contractors, and other organizations that provide system development, information technology services, testing or assessment services, outsourced applications, and network/security management.' },
  ps7Notifications: { source: 'nist-ps', section: 'PS-7 Guidance', text: 'Notifications of external personnel changes ensure the appropriate termination of privileges and credentials.' },
  csvSameFields: { source: 'rfc4180', section: '2. Definition of the CSV Format', text: 'Each line should contain the same number of fields throughout the file.' },
  csvQuotes: { source: 'rfc4180', section: '2. Definition of the CSV Format', text: 'If fields are not enclosed with double quotes, then double quotes may not appear inside the fields.' },
  jsonUnpredictable: { source: 'rfc8259', section: '4. Objects', text: 'When the names within an object are not unique, the behavior of software that receives such an object is unpredictable.' },
  mailboxDomain: { source: 'rfc5321', section: '2.3.11. Mailbox and Address', text: 'the local-part MUST be interpreted and assigned semantics only by the host specified in the domain part of the address.' },
  localPartCase: { source: 'rfc5321', section: '2.4. General Syntax Principles and Transaction Model', text: 'The local-part of a mailbox MUST BE treated as case sensitive.' },
  localPartCaseDiscouraged: { source: 'rfc5321', section: '2.4. General Syntax Principles and Transaction Model', text: 'However, exploiting the case sensitivity of mailbox local-parts impedes interoperability and is discouraged.' },
  domainCase: { source: 'rfc5321', section: '2.4. General Syntax Principles and Transaction Model', text: 'Mailbox domains follow normal DNS rules and are hence not case sensitive.' },
  dataMinimisation: { source: 'gdpr', section: 'Article 5', text: "adequate, relevant and limited to what is necessary in relation to the purposes for which they are processed ('data minimisation');" },
  githubMembers: { source: 'github-members', section: 'List organization members', text: 'List all users who are members of an organization.' },
  githubOutside: { source: 'github-outside', section: 'List outside collaborators for an organization', text: 'List all users who are outside collaborators of an organization.' },
  googlePrimaryEmail: { source: 'google-users', section: 'primaryEmail', text: "The user's primary email address." },
  googleAliases: { source: 'google-users', section: 'aliases[]', text: "Output only. The list of the user's alias email addresses." },
  googleSuspended: { source: 'google-users', section: 'suspended', text: 'Indicates if user is suspended.' },
  googleArchived: { source: 'google-users', section: 'archived', text: 'Indicates if user is archived.' },
  googleFullName: { source: 'google-users', section: 'fullName', text: "The user's full name formed by concatenating the first and last name values." },
  googleUsersList: { source: 'google-users', section: 'users[]', text: 'A list of user objects.' },
  entraAttributes: { source: 'entra-download', section: 'To download a list of users', text: 'The following user attributes are included:' },
  entraCustomColumns: { source: 'entra-download', section: 'Improved bulk user download', text: 'With this update, admins can customize their User List View columns, and the export will mirror those selected columns.' },
  graphAccountEnabled: { source: 'graph-user', section: 'accountEnabled', text: 'true if the account is enabled; otherwise, false.' },
  atlassianHeadings: { source: 'atlassian-export', section: 'Understand the CSV spreadsheet', text: 'The first row of the CSV spreadsheet are column headings.' },
  atlassianStatuses: { source: 'atlassian-export', section: 'Select the user status', text: 'All users - Includes all active, suspended and deactivated users.' },
  atlassianEmail: { source: 'atlassian-export', section: 'Email', text: "The user's email address." }
};

// The page of a quoted sentence.
export const factPage = (key) => source(FACTS[key].source).url;

// The levels of a finding, from the lowest. A finding fails the run when its level is the fail level or above.
export const LEVELS = ['notice', 'warning', 'error'];

// The kinds of identifier, from the strongest. An email address or a username gives an exact match; a full name gives a
// possible match only.
export const IDENTIFIER_KINDS = ['email', 'username', 'name'];

// The formats of an account export.
export const EXPORT_FORMATS = ['csv', 'json'];
