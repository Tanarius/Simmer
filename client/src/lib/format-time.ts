/**
 * Format minutes into a human-friendly string.
 * - Under 60 min: "45m"
 * - Exactly on the hour: "2h"
 * - Over 60 with remainder: "1h 30m"
 */
export function formatTime(minutes: number): string {
  if (minutes <= 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Format prep + cook time for the detail view.
 * e.g. "10m prep + 8h cook = 8h 10m total"
 */
export function formatTimeBreakdown(prepTime: number, cookTime: number): string {
  const total = prepTime + cookTime;
  return `${formatTime(prepTime)} prep + ${formatTime(cookTime)} cook = ${formatTime(total)} total`;
}
