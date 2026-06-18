'use client';

export default function ReportPrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="btn btn-secondary btn-sm"
    >
      Print / Export PDF
    </button>
  );
}
