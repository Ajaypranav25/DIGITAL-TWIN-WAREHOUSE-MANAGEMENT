import { format, formatDistanceToNow } from 'date-fns';

export function safeFormat(dateVal, formatStr = 'MMM d, yyyy HH:mm', fallback = '-') {
  if (!dateVal) return fallback;
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return fallback;
    return format(d, formatStr);
  } catch (e) {
    return fallback;
  }
}

export function safeDistanceToNow(dateVal, fallback = 'Recently') {
  if (!dateVal) return fallback;
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return fallback;
    return formatDistanceToNow(d, { addSuffix: true });
  } catch (e) {
    return fallback;
  }
}
