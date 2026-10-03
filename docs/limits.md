# Limits

The tool compares the files it is given. It is as good as the leavers file and the exports, and it cannot see anything that is not in them.

## What it cannot see

- **Tools you did not export.** An account in a tool with no export is not checked. The report lists the exports it read; compare that list with the list of your tools.
- **Identifiers the leavers file does not hold.** A person who used a second address, a shared login, a username that does not appear in the leavers file, or an address on a domain that is neither the company domain nor an alias, is not matched. A full name helps as a possible match, but only when both files spell it the same way.
- **Names written differently.** `Ana Lopez` and `Ana M. Lopez`, a name with and without an accent, or a name in another order are different names. Nothing is matched by similarity, because a silent near match would be wrong as often as it is right.
- **Access inside a tool.** Personal access tokens, SSH keys, API keys, OAuth grants, open sign-ins on devices, shared passwords, and access granted through a group of another directory are not in a list of accounts. An inactive account in an export can still own a token in some tools.
- **Whether a status is true.** The tool reads the status the export says. An export taken before an account was disabled shows it as active; an export taken after a person came back shows the new account.
- **Who owns an account.** A match says that an identifier is the same; it does not say that the person still uses the account. A username in one tool can belong to someone else in another, and a name can be shared by two people.
- **Case in local parts.** Addresses are compared without case. On a mail server that gives case a meaning, `Ana@example.com` and `ana@example.com` are two people, and the tool reports a match a person must check.
- **Plus tags and aliases.** They are used only as the configuration says; the tool does not know the rules of your mail server.
- **Dates in other forms.** The end-of-work column takes days from the as-of day or `YYYY-MM-DD`. A date such as `03/04` is refused rather than read one of two ways.
- **Formats.** CSV and JSON only, in UTF-8. A spreadsheet file must be saved as CSV first.

## Size limits

Past a limit, the input is refused with exit code `2` and no verdict; nothing is half read.

| What | Limit |
| --- | --- |
| configuration file | 1 MB, 50 exports, 100 company domains, 100 domain aliases, 20 fields of each kind, 50 status values, 200 characters for a name or a field |
| leavers file | 16 MB, 100,000 leavers |
| one export | 64 MB, 1,000,000 accounts |
| all inputs together | 512 MB |
| CSV | 1,000 fields in a row, 65,536 characters in a field |
| JSON export | nesting 64 deep, 20,000,000 values, 65,536 characters in a string |
| JSON configuration | nesting 32 deep, 100,000 values, 4,096 characters in a string |
| one identifier | 320 characters; a longer value is not compared, and a note gives the count for email fields |
| pairs of a leaver and an account | 200,000; past this one name or identifier is held by very many rows on both sides, and the report would be too large to read |
| grace days | 0 to 3,650 |
| days from the as-of day | -36,500 to 36,500 |
| problems listed | 20 for the leavers file, then a count of the rest |

The tests read fifty thousand leavers against two hundred thousand accounts with a time check, and refuse cells of a million characters, quotes that are never closed and JSON nested a million deep in one pass.
