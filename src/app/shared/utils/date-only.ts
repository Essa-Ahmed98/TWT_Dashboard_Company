/**
 * A calendar date (birth date, ...) for the API: the day the user picked, at 00:00 UTC.
 * `new Date(picked).toISOString()` would shift it to the previous day for users east of UTC
 * (Saudi Arabia / Egypt): 10 May at 00:00 local = 9 May 21:00 UTC.
 * Returns null when the date is empty, so the server stores "no date" (an empty string fails on the server).
 */
export function toDateOnlyIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;

  if (typeof value === 'string') {
    const day = /^\d{4}-\d{2}-\d{2}/.exec(value.trim());
    if (day) return `${day[0]}T00:00:00Z`;
    value = new Date(value);
  }

  if (Number.isNaN(value.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T00:00:00Z`;
}
