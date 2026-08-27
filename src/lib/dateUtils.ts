/**
 * Utility functions for safe date parsing and formatting
 * Prevents RangeError: Invalid time value when handling legacy or Firestore dates
 */

export function tryParseDate(val: any): Date | null {
  if (val === null || val === undefined || val === '') return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  if (val && typeof val.toDate === 'function') {
    try {
      const d = val.toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d : null;
    } catch {
      return null;
    }
  }
  if (val && typeof val.seconds === 'number') {
    const d = new Date(val.seconds * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;

    const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      const d = new Date(year, month, day, 12, 0, 0);
      if (!isNaN(d.getTime())) return d;
    }

    if (trimmed.includes('/')) {
      const parts = trimmed.split(/[\s,]+/);
      const datePart = parts[0];
      const timePart = parts[1];
      const dateBits = datePart.split('/');
      if (dateBits.length === 3) {
        const day = parseInt(dateBits[0], 10);
        const month = parseInt(dateBits[1], 10) - 1;
        const year = parseInt(dateBits[2], 10);
        let hours = 12;
        let mins = 0;
        let secs = 0;

        if (timePart && timePart.includes(':')) {
          const timeBits = timePart.split(':');
          hours = parseInt(timeBits[0], 10) || 0;
          mins = parseInt(timeBits[1], 10) || 0;
          secs = parseInt(timeBits[2], 10) || 0;
        }

        const customDate = new Date(year, month, day, hours, mins, secs);
        if (!isNaN(customDate.getTime())) return customDate;
      }
    }

    const directDate = new Date(trimmed);
    if (!isNaN(directDate.getTime())) return directDate;
  }

  return null;
}

export function parseSafeDate(val: any): Date {
  return tryParseDate(val) ?? new Date();
}

export function safeIsoString(val: any): string {
  try {
    const d = tryParseDate(val) ?? new Date();
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/** Calendar key YYYY-MM-DD. Returns empty string when the value is not a real date (never invents "today"). */
export function safeDateIsoKey(val: any): string {
  const d = tryParseDate(val);
  if (!d) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function safeFormatDate(val: any): string {
  const d = tryParseDate(val);
  if (!d) return '--/--/----';
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export function safeFormatTime(val: any): string {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.includes(':') && !trimmed.includes('-') && !trimmed.includes('/')) {
      return trimmed;
    }
  }
  const d = tryParseDate(val);
  if (!d) return '--:--';
  return d.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit'
  });
}
