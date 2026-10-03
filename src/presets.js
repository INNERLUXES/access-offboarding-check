// Presets: the shapes of a few common account exports, each written from a documentation page that is saved in
// research/sources. A preset names the format, where the rows are, which fields hold the identifiers and which field
// holds the status, and nothing else. A preset is only added when its page names the fields; a tool whose page does not
// is mapped in the configuration instead (docs/inputs.md shows how). The tool never guesses a column: a CSV export whose
// header lacks a column the preset names stops the run with exit code 2.

export const PRESETS = {
  'github-org-members': {
    title: 'GitHub, the response of List organization members (REST API)',
    format: 'json',
    rows: '',
    fields: { email: [], username: ['login'], name: [] },
    status: [],
    facts: ['githubMembers']
  },
  'github-outside-collaborators': {
    title: 'GitHub, the response of List outside collaborators for an organization (REST API)',
    format: 'json',
    rows: '',
    fields: { email: [], username: ['login'], name: [] },
    status: [],
    facts: ['githubOutside']
  },
  'google-directory-users': {
    title: 'Google Workspace, the response of users.list of the Directory API',
    format: 'json',
    rows: 'users',
    fields: { email: ['primaryEmail', 'aliases'], username: [], name: ['name.fullName'] },
    status: [
      { field: 'suspended', active: ['false'], inactive: ['true'] },
      { field: 'archived', active: ['false'], inactive: ['true'] }
    ],
    facts: ['googleUsersList', 'googleSuspended']
  },
  'entra-users': {
    title: 'Microsoft Entra ID, the CSV file of Download users, with the attribute names as column headings',
    format: 'csv',
    rows: '',
    fields: { email: ['userPrincipalName', 'mail'], username: [], name: ['displayName'] },
    status: [{ field: 'accountEnabled', active: ['true'], inactive: ['false'] }],
    facts: ['entraAttributes', 'graphAccountEnabled']
  },
  'atlassian-users': {
    title: 'Atlassian, the CSV file of Export users from a site',
    format: 'csv',
    rows: '',
    fields: { email: ['Email'], username: [], name: ['User name'] },
    status: [{ field: 'User status', active: ['Active'], inactive: ['Suspended', 'Deactivated'] }],
    facts: ['atlassianHeadings', 'atlassianStatuses']
  }
};

export const PRESET_NAMES = Object.keys(PRESETS);
