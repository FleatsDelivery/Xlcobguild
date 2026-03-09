/**
 * Date formatting utilities — Single source of truth
 *
 * Every date formatter in the app imports from here.
 * Do NOT define local formatDate/timeAgo functions in components.
 */

/** Full date with optional time + timezone (e.g. "Jan 5, 2026" or "Jan 5, 2026 at 7:00 PM EST") */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'TBD';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const hasTime = d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0;
  const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (!hasTime) return datePart;
  return datePart + ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}

/** Compact date with optional time (e.g. "Jan 5" or "Jan 5, 7:00 PM EST") */
export function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return 'TBD';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const hasTime = d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0;
  const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (!hasTime) return datePart;
  return `${datePart}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}`;
}

/** Long date format (e.g. "January 5, 2026") — used in archives and profiles */
export function formatDateLong(dateStr: string | null): string {
  if (!dateStr) return 'TBA';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Date with time always shown (e.g. "Jan 5, 2026, 7:00 PM") — used on match cards */
export function formatDateWithTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Relative time string (e.g. "just now", "5m ago", "3h ago", "2d ago") */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
