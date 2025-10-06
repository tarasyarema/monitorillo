import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely formats a date string to a relative time string (e.g., "2 hours ago")
 * Returns null if the date is invalid, null, or undefined
 */
export function safeFormatDistanceToNow(
  dateString: string | null | undefined,
  options?: { addSuffix?: boolean }
): string | null {
  if (!dateString) return null;

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return formatDistanceToNow(date, options);
  } catch {
    return null;
  }
}

/**
 * Safely converts a date string to a locale time string
 * Returns a fallback string if the date is invalid, null, or undefined
 */
export function safeToLocaleTimeString(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleTimeString();
  } catch {
    return 'N/A';
  }
}

/**
 * Safely converts a date string to a locale date string
 * Returns a fallback string if the date is invalid, null, or undefined
 */
export function safeToLocaleDateString(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString();
  } catch {
    return 'N/A';
  }
}
