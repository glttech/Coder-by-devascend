/**
 * reportTemplates.ts — reusable HTML building blocks for client-facing governance reports.
 *
 * All functions return plain strings. No framework, no external dependencies.
 * Designed to be embedded in a self-contained HTML document with inline styles.
 */

/**
 * Wraps a body string in a full <!DOCTYPE html> document with inline styles.
 * The resulting page is self-contained (no external resources) and print-friendly.
 */
export function htmlWrapper(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #1a1a2e;
      background: #f8f9fc;
      padding: 32px 16px;
    }
    .report-container {
      max-width: 860px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 40px;
    }
    h1 { font-size: 24px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
    h2 { font-size: 16px; font-weight: 600; color: #1e293b; margin-bottom: 12px; }
    h3 { font-size: 14px; font-weight: 600; color: #334155; margin-bottom: 8px; }
    p { margin-bottom: 8px; color: #374151; }
    .report-header {
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 20px;
      margin-bottom: 28px;
    }
    .report-header .brand {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #6366f1;
      margin-bottom: 6px;
    }
    .report-header .timestamp {
      font-size: 12px;
      color: #64748b;
      margin-top: 6px;
    }
    .report-section {
      margin-bottom: 28px;
      padding-bottom: 24px;
      border-bottom: 1px solid #f1f5f9;
    }
    .report-section:last-of-type {
      border-bottom: none;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #475569;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
    }
    .summary-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 16px;
    }
    .summary-box .field {
      display: flex;
      gap: 8px;
      margin-bottom: 6px;
      font-size: 13px;
    }
    .summary-box .field-label {
      font-weight: 600;
      color: #475569;
      min-width: 140px;
    }
    .summary-box .field-value {
      color: #1e293b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-top: 4px;
    }
    thead th {
      background: #f1f5f9;
      text-align: left;
      padding: 8px 12px;
      font-weight: 600;
      color: #475569;
      border-bottom: 1px solid #e2e8f0;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    tbody td {
      padding: 8px 12px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
      vertical-align: top;
    }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:nth-child(even) { background: #fafbfc; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.6;
      letter-spacing: 0.02em;
    }
    ul.risk-list { list-style: none; padding: 0; }
    ul.risk-list li {
      padding: 8px 12px;
      border-left: 3px solid #f59e0b;
      background: #fffbeb;
      margin-bottom: 6px;
      border-radius: 0 4px 4px 0;
      font-size: 13px;
      color: #92400e;
    }
    ul.risk-list li.high {
      border-left-color: #ef4444;
      background: #fef2f2;
      color: #991b1b;
    }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
    }
    code {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 12px;
      background: #f1f5f9;
      padding: 1px 5px;
      border-radius: 3px;
      color: #475569;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .report-container {
        border: none;
        border-radius: 0;
        padding: 20px;
        max-width: 100%;
      }
      .no-print { display: none !important; }
      table { page-break-inside: avoid; }
      .report-section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
<div class="report-container">
${body}
</div>
</body>
</html>`;
}

/**
 * Returns an inline-styled badge span.
 * @param text  Display text
 * @param color Named colour preset or any CSS background value
 */
export function htmlBadge(text: string, color: string): string {
  const presets: Record<string, { bg: string; fg: string }> = {
    green:   { bg: '#dcfce7', fg: '#166534' },
    red:     { bg: '#fee2e2', fg: '#991b1b' },
    amber:   { bg: '#fef3c7', fg: '#92400e' },
    blue:    { bg: '#dbeafe', fg: '#1e40af' },
    purple:  { bg: '#ede9fe', fg: '#5b21b6' },
    gray:    { bg: '#f1f5f9', fg: '#475569' },
    orange:  { bg: '#ffedd5', fg: '#9a3412' },
    indigo:  { bg: '#e0e7ff', fg: '#3730a3' },
  };
  const preset = presets[color.toLowerCase()];
  const bgStyle = preset
    ? `background:${preset.bg};color:${preset.fg};`
    : `background:${color};color:#fff;`;
  return `<span class="badge" style="${bgStyle}">${escapeHtml(text)}</span>`;
}

/**
 * Wraps content in a titled report section.
 */
export function htmlSection(title: string, content: string): string {
  return `<div class="report-section">
  <div class="section-title">${escapeHtml(title)}</div>
  ${content}
</div>`;
}

/**
 * Builds an HTML table from headers and rows.
 * @param headers  Column header labels
 * @param rows     Array of rows; each row is an array of cell strings (may contain HTML)
 */
export function htmlTable(headers: string[], rows: string[][]): string {
  const ths = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const trs = rows
    .map((row) => {
      const tds = row.map((cell) => `<td>${cell}</td>`).join('');
      return `<tr>${tds}</tr>`;
    })
    .join('\n');
  return `<table>
  <thead><tr>${ths}</tr></thead>
  <tbody>
${trs}
  </tbody>
</table>`;
}

/** Escapes HTML special characters to prevent injection. */
export function escapeHtml(text: string | null | undefined): string {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
