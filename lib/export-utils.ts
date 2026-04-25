// Builds a timestamped export filename with optional page suffix.
export function buildExportFilename(prefix: string, currentPage: number, exportCurrentPageOnly: boolean) {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('');
  const suffix = exportCurrentPageOnly ? `_page${currentPage}` : '';
  return `${prefix}_${stamp}${suffix}.xlsx`;
}

// Sends export data to the API and triggers a browser download.
export function downloadXlsx(params: {
  filename: string;
  sheetName: string;
  data: Record<string, string | number>[];
}) {
  const { filename, sheetName, data } = params;

  fetch('/api/export/dashboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, sheetName, data })
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Export failed: ${response.statusText}`);
      return response.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    })
    .catch((error) => {
      window.alert(`Export failed: ${error.message}`);
    });
}

// Converts unknown failures into a display-friendly message.
export function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
