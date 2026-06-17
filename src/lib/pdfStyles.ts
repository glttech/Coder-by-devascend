export const PDF_PRINT_CSS = `
  @page { margin: 20mm; size: A4; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Arial, sans-serif; font-size: 12px; color: #111; background: #fff; }
  h1 { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
  h2 { font-size: 14px; font-weight: 600; margin: 16px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  h3 { font-size: 12px; font-weight: 600; margin: 12px 0 6px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 11px; }
  th { background: #f5f5f5; font-weight: 600; text-align: left; padding: 6px 8px; border: 1px solid #ddd; }
  td { padding: 6px 8px; border: 1px solid #ddd; vertical-align: top; }
  pre { background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px; padding: 8px; font-size: 10px; white-space: pre-wrap; word-break: break-all; }
  .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; }
  .badge-low { background: #d1fae5; color: #065f46; }
  .badge-medium { background: #fef3c7; color: #92400e; }
  .badge-high { background: #fee2e2; color: #991b1b; }
  .badge-success { background: #d1fae5; color: #065f46; }
  .badge-pending { background: #fef3c7; color: #92400e; }
  .badge-neutral { background: #f3f4f6; color: #374151; }
  .meta-row { display: flex; gap: 16px; margin: 4px 0; }
  .meta-label { font-weight: 600; min-width: 140px; color: #6b7280; font-size: 11px; }
  .meta-value { font-size: 11px; }
  .header-block { margin-bottom: 20px; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 10px; color: #9ca3af; }
  @media screen { body { max-width: 900px; margin: 0 auto; padding: 32px; } }
`;
