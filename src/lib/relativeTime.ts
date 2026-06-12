/**
 * Returns a human-readable relative time string for the given date.
 * Examples: "just now", "5 minutes ago", "2 hours ago", "3 days ago",
 *           "2 weeks ago", "1 month ago"
 */
export function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1_000);
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr  = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);
  const diffWk  = Math.floor(diffDay / 7);
  const diffMo  = Math.floor(diffDay / 30);

  if (diffSec < 60)  return 'just now';
  if (diffMin < 60)  return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
  if (diffHr  < 24)  return `${diffHr} ${diffHr === 1 ? 'hour' : 'hours'} ago`;
  if (diffDay < 7)   return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;
  if (diffDay < 30)  return `${diffWk} ${diffWk === 1 ? 'week' : 'weeks'} ago`;
  return `${diffMo} ${diffMo === 1 ? 'month' : 'months'} ago`;
}
