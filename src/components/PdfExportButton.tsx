'use client';

export default function PdfExportButton({ taskId }: { taskId: string }) {
  function openPdf() {
    const url = `/api/tasks/${taskId}/pdf`;
    window.open(url, '_blank');
  }

  return (
    <button className="btn btn-ghost btn-sm" onClick={openPdf}>
      PDF Export ↗
    </button>
  );
}
