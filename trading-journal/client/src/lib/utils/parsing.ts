/**
 * Shared parsing utilities for CSV importers.
 */

let _idCounter = 0;

/** Generate a simple unique ID */
export function generateId(): string {
  return `${Date.now()}-${++_idCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Parse a decimal string that may contain commas, dollar signs, parentheses
 * (accounting negative notation), or be blank.
 * Returns 0 for unparseable input.
 */
export function parseDecimal(raw: string): number {
  if (!raw || raw.trim() === '' || raw.trim() === '--') return 0;
  // Remove currency symbols, spaces, commas
  let cleaned = raw.trim().replace(/[$,\s]/g, '');
  // Accounting negative: (123.45) → -123.45
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1);
  }
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

/**
 * Combine a date string and an optional time string into an ISO datetime.
 * Handles common formats: MM/DD/YYYY, YYYY-MM-DD, M/D/YY, etc.
 * If time is absent, defaults to 09:30:00 (market open).
 */
export function combineDatetime(dateStr: string, timeStr: string): string {
  const normalizedDate = normalizeDateStr(dateStr.trim());
  const normalizedTime = timeStr?.trim() || '09:30:00';
  // Ensure time has seconds
  const timeParts = normalizedTime.split(':');
  while (timeParts.length < 3) timeParts.push('00');
  return `${normalizedDate}T${timeParts.join(':')}`;
}

/**
 * Normalize various date formats to YYYY-MM-DD.
 */
function normalizeDateStr(raw: string): string {
  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // MM/DD/YYYY or M/D/YYYY or M/D/YY
  const mdyMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdyMatch) {
    let [, m, d, y] = mdyMatch;
    if (y.length === 2) y = parseInt(y) >= 50 ? `19${y}` : `20${y}`;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // MM-DD-YYYY
  const mdyDashMatch = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (mdyDashMatch) {
    let [, m, d, y] = mdyDashMatch;
    if (y.length === 2) y = parseInt(y) >= 50 ? `19${y}` : `20${y}`;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Try native Date parsing as fallback
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  // Return as-is if nothing works
  return raw;
}

/** Extract YYYY-MM-DD from an ISO datetime string */
export function dateFromISO(iso: string): string {
  return iso.slice(0, 10);
}

/** Extract hour (0-23) from an ISO datetime string */
export function hourFromISO(iso: string): number {
  const match = iso.match(/T(\d{2}):/);
  return match ? parseInt(match[1]) : 9;
}

/** Day of week (0=Sun, 1=Mon ... 6=Sat) from an ISO datetime string */
export function dayOfWeekFromISO(iso: string): number {
  return new Date(iso).getDay();
}

/** Format a number as currency: $1,234.56 or -$1,234.56 */
export function formatCurrency(val: number, showSign = false): string {
  const abs = Math.abs(val);
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (val < 0) return `-$${formatted}`;
  if (showSign && val > 0) return `+$${formatted}`;
  return `$${formatted}`;
}

/** Format a percentage: 65.3% */
export function formatPct(val: number, decimals = 1): string {
  return `${val.toFixed(decimals)}%`;
}
