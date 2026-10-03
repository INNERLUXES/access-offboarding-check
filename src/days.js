// Days. The tool reads no clock and no time zone: every day is a whole number. The end of work of a leaver is the last day
// of work, written either as a whole number of days from the as-of day (0 is the as-of day, -14 fourteen days before it,
// 3 three days after it) or as a calendar date YYYY-MM-DD. A date is turned into a day number in UTC with Date.UTC, which
// does not depend on the time zone or the locale of the machine, and it needs the as-of day given on the command line
// (--as-of YYYY-MM-DD), so the same files always give the same report. docs/decisions explains the choice.

const DAY_MS = 86400000;

export const DAY_LIMITS = { maxRelative: 36500 };

// The day number (whole days since the Unix epoch, in UTC) of a date written YYYY-MM-DD, or null when it is not a real date.
export function dayOfDate(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text).trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return ms / DAY_MS;
}

// The date YYYY-MM-DD of a day number, in UTC.
export const dateOfDay = (day) => new Date(day * DAY_MS).toISOString().slice(0, 10);

// Reads the end-of-work cell of a leaver: { kind: 'none' } for an empty cell, { kind: 'relative', value } for a whole
// number of days from the as-of day, { kind: 'date', day } for a date, or { kind: 'bad' } for anything else.
export function readEnd(raw) {
  const text = String(raw ?? '').trim();
  if (text === '') return { kind: 'none' };
  if (/^[+-]?\d{1,6}$/.test(text)) {
    const value = Number(text);
    if (Math.abs(value) > DAY_LIMITS.maxRelative) return { kind: 'bad' };
    return { kind: 'relative', value: value === 0 ? 0 : value };
  }
  const day = dayOfDate(text);
  return day === null ? { kind: 'bad' } : { kind: 'date', day };
}

// The whole days from the last day of work to the as-of day: positive after the last day, 0 on it, negative before it.
// asOf is the day number of --as-of, or null when it was not given (then only relative ends can be read). Returns null
// when the end is a date and there is no as-of day, and when there is no end.
export function daysSinceEnd(end, asOf) {
  if (end.kind === 'relative') return end.value === 0 ? 0 : -end.value;
  if (end.kind === 'date') return asOf === null ? null : asOf - end.day;
  return null;
}
