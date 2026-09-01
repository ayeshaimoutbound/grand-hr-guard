// Local-calendar date helpers.
// Never use toISOString() for calendar dates: it converts to UTC and shifts the
// day backwards for timezones ahead of UTC (e.g. Sri Lanka, UTC+5:30), which
// caused month ranges to miss the 31st and "today" to land on yesterday.

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD for a local date (defaults to today). */
export function toDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYY-MM for a local date (defaults to the current month). */
export function toMonthStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** First and last calendar day of the month that contains `d`. */
export function monthRange(d: Date): { start: string; end: string } {
  const y = d.getFullYear();
  const m = d.getMonth();
  return {
    start: `${y}-${pad(m + 1)}-01`,
    end: `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`,
  };
}

/** First and last calendar day for a "YYYY-MM" string. */
export function monthRangeFromStr(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  return monthRange(new Date(y, m - 1, 1));
}

/** Shift a "YYYY-MM" string by a number of months, rolling the year over. */
export function shiftMonthStr(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return toMonthStr(new Date(y, m - 1 + delta, 1));
}
