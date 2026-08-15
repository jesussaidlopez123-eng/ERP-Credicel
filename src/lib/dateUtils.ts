/**
 * Utility functions for safe date parsing and formatting
 * Prevents RangeError: Invalid time value when handling legacy or Firestore dates
 */

export function parseSafeDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? new Date() : val;
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return new Date();

    // 1. Direct standard parse
    const directDate = new Date(trimmed);
    if (!isNaN(directDate.getTime())) return directDate;

    // 2. Handle DD/MM/YYYY or DD/MM/YYYY HH:mm:ss
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

    // 3. Handle pure time string like "14:30:15" or "02:30:15 p. m."
    if (trimmed.includes(':') && !trimmed.includes('-') && !trimmed.includes('/')) {
      const today = new Date();
      return today;
    }
  }

  return new Date();
}

export function safeIsoString(val: any): string {
  try {
    const d = parseSafeDate(val);
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export function safeDateIsoKey(val: any): string {
  try {
    return safeIsoString(val).split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

export function safeFormatDate(val: any): string {
  try {
    const d = parseSafeDate(val);
    return d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return new Date().toLocaleDateString('es-MX');
  }
}

export function safeFormatTime(val: any): string {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    // If it's already a pure time string like "14:30:15" or "02:30 p. m."
    if (trimmed.includes(':') && !trimmed.includes('-') && !trimmed.includes('/')) {
      return trimmed;
    }
  }
  try {
    const d = parseSafeDate(val);
    return d.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '--:--';
  }
}
