import { format, formatDistanceToNow, isAfter, subHours } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { ko } from 'date-fns/locale/ko';
import { ja } from 'date-fns/locale/ja';

const STORAGE_KEY = 'tiptap-locale';

const detectLocale = () => {
  if (typeof window === 'undefined') return 'en-US';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch {
    /* ignore */
  }
  return navigator.language || 'en-US';
};

const resolveDateFnsLocale = () => {
  const lc = detectLocale().toLowerCase();
  if (lc.startsWith('ko')) return ko;
  if (lc.startsWith('ja')) return ja;
  return enUS;
};

export const formatRelativeDate = (dateString: string): string => {
  const date = new Date(dateString);
  const twelveHoursAgo = subHours(new Date(), 12);
  const locale = resolveDateFnsLocale();

  if (isAfter(date, twelveHoursAgo)) {
    return formatDistanceToNow(date, { addSuffix: true, locale });
  }

  return format(date, 'yyyy-MM-dd HH:mm', { locale });
};
