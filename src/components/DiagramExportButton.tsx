'use client';

interface DiagramExportButtonProps {
  diagramId: string;
  title?: string;
}

export default function DiagramExportButton({ diagramId, title }: DiagramExportButtonProps) {
  async function handleExport() {
    const res = await fetch(`/api/diagrams/${diagramId}/export`);
    if (!res.ok) { alert('Export failed'); return; }
    const blob = await res.blob();
    const contentDisposition = res.headers.get('Content-Disposition') ?? '';
    const filename = contentDisposition.match(/filename="([^"]+)"/)?.[1] ?? `diagram-${diagramId.slice(0, 8)}.svg`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button className="btn btn-ghost btn-sm" onClick={handleExport} title={title ? `Export "${title}"` : 'Export diagram'}>
      ↓ Export SVG
    </button>
  );
}
