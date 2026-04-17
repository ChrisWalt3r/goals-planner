import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, isValid, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDeadline(deadline: string | null | undefined, pattern = 'MMM d, yy') {
  if (!deadline) return '';

  const parsed = parseISO(deadline);
  if (!isValid(parsed)) return deadline;

  return format(parsed, pattern);
}

export function isDeadlineOverdue(deadline: string | null | undefined) {
  if (!deadline) return false;

  const parsed = parseISO(deadline);
  if (!isValid(parsed)) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(parsed);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate < today;
}
