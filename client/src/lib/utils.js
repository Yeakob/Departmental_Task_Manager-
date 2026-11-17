import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday, differenceInCalendarDays } from 'date-fns';

export const cn = (...inputs) => twMerge(clsx(inputs));

/** Lean API documents use `_id`, serialized ones use `id`. */
export const oid = (x) => (x == null ? x : typeof x === 'string' ? x : x._id ?? x.id);

export const OPEN_STATUSES = ['assigned', 'acknowledged', 'in_progress', 'under_review', 'revision_required', 'on_hold'];

export const STATUS_META = {
  draft: { label: 'Draft', tone: 'bg-muted text-muted-foreground' },
  assigned: { label: 'Assigned', tone: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' },
  acknowledged: { label: 'Acknowledged', tone: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' },
  in_progress: { label: 'In progress', tone: 'bg-primary-soft text-primary' },
  under_review: { label: 'Under review', tone: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300' },
  revision_required: { label: 'Revision required', tone: 'bg-highlight-soft text-amber-800 dark:text-amber-300' },
  completed: { label: 'Completed', tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  rejected: { label: 'Rejected', tone: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
  cancelled: { label: 'Cancelled', tone: 'bg-muted text-muted-foreground line-through' },
  on_hold: { label: 'On hold', tone: 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300' },
};
export const STATUS_ORDER = Object.keys(STATUS_META);

/** Same transition table as the server — used to offer only valid moves. */
export const STATUS_TRANSITIONS = {
  draft: ['assigned', 'cancelled'],
  assigned: ['acknowledged', 'in_progress', 'on_hold', 'cancelled'],
  acknowledged: ['in_progress', 'on_hold', 'cancelled'],
  in_progress: ['under_review', 'completed', 'on_hold', 'cancelled'],
  under_review: ['completed', 'revision_required', 'rejected'],
  revision_required: ['in_progress', 'under_review', 'cancelled'],
  completed: ['in_progress'],
  rejected: ['assigned', 'in_progress'],
  cancelled: ['assigned'],
  on_hold: ['assigned', 'in_progress', 'cancelled'],
};

export const PRIORITY_META = {
  critical: { label: 'Critical', dot: 'bg-red-600', tone: 'text-red-700 dark:text-red-400', chart: '#C2410C' },
  high: { label: 'High', dot: 'bg-orange-500', tone: 'text-orange-700 dark:text-orange-400', chart: '#D9921E' },
  medium: { label: 'Medium', dot: 'bg-sky-600', tone: 'text-sky-700 dark:text-sky-400', chart: '#2B7A9B' },
  low: { label: 'Low', dot: 'bg-slate-400', tone: 'text-muted-foreground', chart: '#94A3A0' },
};
export const PRIORITIES = Object.keys(PRIORITY_META);

export const isOverdue = (t) => Boolean(t?.deadline && OPEN_STATUSES.includes(t.status) && new Date(t.deadline) < new Date());

/** CSS colour for the urgency edge. */
export function urgencyColor(t) {
  if (!t?.deadline || !OPEN_STATUSES.includes(t.status)) return 'transparent';
  const days = (new Date(t.deadline) - Date.now()) / 86400000;
  if (days < 0) return 'hsl(var(--destructive))';
  if (days <= 2) return 'hsl(var(--highlight))';
  if (days <= 7) return 'hsl(var(--highlight) / 0.35)';
  return 'transparent';
}

export function fmtDate(d, pattern = 'd MMM yyyy') {
  if (!d) return '—';
  return format(new Date(d), pattern);
}
export const fmtDateTime = (d) => fmtDate(d, 'd MMM yyyy, h:mm a');

export function relativeDeadline(d) {
  if (!d) return 'No deadline';
  const date = new Date(d);
  if (isToday(date)) return `Today, ${format(date, 'h:mm a')}`;
  if (isTomorrow(date)) return 'Tomorrow';
  if (isYesterday(date)) return 'Yesterday';
  const diff = differenceInCalendarDays(date, new Date());
  if (Math.abs(diff) < 7) return diff > 0 ? `In ${diff} days` : `${-diff} days ago`;
  return format(date, 'd MMM');
}

export const timeAgo = (d) => (d ? `${formatDistanceToNowStrict(new Date(d))} ago` : '');

export const initials = (name = '') =>
  name
    .replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

export const humanize = (s = '') => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export const fileSize = (n = 0) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

/** For <input type="datetime-local"> */
export function toLocalInput(d) {
  if (!d) return '';
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
export const toDateInput = (d) => (d ? toLocalInput(d).slice(0, 10) : '');

export const stripHtml = (html = '') => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export function apiError(err, fallback = 'Something went wrong') {
  const d = err?.data;
  if (d?.details?.length) return `${d.message}: ${d.details.map((x) => `${x.path} ${x.message}`).join('; ')}`;
  return d?.message || err?.error || fallback;
}

// Categorical order validated (CVD, lightness, contrast) against light #fcfcfb and dark #151f1c surfaces.
export const CHART_COLORS = ['#1A7A55', '#C47A12', '#2F6DB8', '#C2477A', '#6B6F14', '#7B57C2'];
