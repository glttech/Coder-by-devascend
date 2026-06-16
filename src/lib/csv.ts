/**
 * CSV serializer (RFC 4180 compliant with CSV-injection hardening).
 * Prefixes values starting with =, +, -, @ with a single quote to prevent
 * formula injection in Excel/Sheets.
 */

const INJECTION_CHARS = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = value instanceof Date
    ? value.toISOString()
    : String(value);
  // Injection hardening
  const safe = INJECTION_CHARS.test(str) ? `'${str}` : str;
  // RFC 4180: wrap in quotes if contains comma, quote, or newline
  if (safe.includes('"') || safe.includes(',') || safe.includes('\n') || safe.includes('\r')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function buildCsvRow(cells: unknown[]): string {
  return cells.map(escapeCsvCell).join(',');
}

export function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [buildCsvRow(headers)];
  for (const row of rows) lines.push(buildCsvRow(row));
  return lines.join('\r\n');
}
