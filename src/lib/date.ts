/**
 * Returns today's date as YYYY-MM-DD in the user's local timezone.
 * Avoids UTC date drift issues with JavaScript Date.
 */
export function getTodayDate(): string {
  return new Date().toLocaleDateString('en-CA');
}

/**
 * Returns first day of the current month as YYYY-MM-DD in local timezone.
 */
export function getMonthStartDate(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
}

/**
 * Returns first day of the current week (Monday) as YYYY-MM-DD in local timezone.
 */
export function getWeekStartDate(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(now.getFullYear(), now.getMonth(), diff).toLocaleDateString('en-CA');
}

/**
 * Returns a date string YYYY-MM-DD for a given Date object in local timezone.
 */
export function toLocalDateString(date: Date): string {
  return date.toLocaleDateString('en-CA');
}
