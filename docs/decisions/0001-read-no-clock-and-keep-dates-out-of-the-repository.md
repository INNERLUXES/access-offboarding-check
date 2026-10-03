# 1. Read no clock, and keep dates out of the repository

## Status

Accepted.

## Context

The check needs to know, for each leaver, whether the last day of work is far enough behind to expect the accounts to be gone. That needs a day to compare with. The obvious day is today, read from the clock of the machine.

A clock makes the same files give a different report from one day to the next, and on two machines in two time zones on the same day. A pipeline that passes on Monday can fail on Tuesday with nothing changed, and a report saved in a ticket can no longer be reproduced. A test that reads the clock, or the time zone, passes on one machine and fails on another.

The repository itself has a second constraint: no file may hold a date or a number that reads like a year. That covers the example inputs, the saved example reports and every test fixture. An offboarding check whose example holds real dates would break the rule; one whose example dates are made up would still hold year-like numbers.

## Decision

1. The tool reads no clock, no time zone and no random number. `test/repo.test.js` looks for `Date.now(`, `new Date()`, `Math.random`, `getTimezoneOffset` and the locale date functions in `src` and fails if one appears.
2. The end-of-work column holds the last day of work in one of two forms:
   - a whole number of days from the as-of day: `0` is the as-of day, `-14` fourteen days before it, `3` three days after it. With this form the as-of day is simply day 0 of the file, and no date is needed at all;
   - a date `YYYY-MM-DD`. A date is turned into a day number with `Date.UTC`, which does not depend on the time zone or the locale, and checked to be a real calendar day. A file that holds a date needs the as-of day on the command line, `--as-of YYYY-MM-DD`; without it the run stops with exit code `2` and says so.
3. The example leavers file and every test fixture use the first form, or build a date at run time from a day number with `isoDay()` of `test/helpers.js`. No tracked file holds a date, and `test/repo.test.js` and `npm run check` look for year-like numbers in every file.
4. Reports say how far the last day is from the as-of day in whole days. A report shows a date only when the input held one, and then only at run time.

## Consequences

- The same files and arguments give the same report on every machine, on every day, which the CRLF test and the example check rely on.
- A team that exports dates from its HR system passes `--as-of` in its pipeline, for example the date of the run written by the pipeline itself. The choice of the day is theirs and is visible in the command.
- A team that wants to avoid dates altogether can write the column as days from the run, which is also what the example does.
- Tests check the date reading in other time zones and locales by running the functions in a child process with `TZ` and `LANG` set, and compare the results.
