export function exportRowsToExcel(
  fileName: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): void {
  const tableHead = `<tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr>`;
  const tableBody = rows.map(row => (
    `<tr>${row.map(cell => `<td>${escapeHtml(formatCell(cell))}</td>`).join('')}</tr>`
  )).join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <style>
          table { border-collapse: collapse; width: 100%; direction: rtl; }
          th, td { border: 1px solid #d9dfe7; padding: 8px 10px; text-align: right; }
          th { background: #f4f6f9; font-weight: 700; }
          body { font-family: Arial, sans-serif; }
        </style>
      </head>
      <body>
        <table>
          <thead>${tableHead}</thead>
          <tbody>${tableBody}</tbody>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob(['\uFEFF', html], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.xls`;
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function formatCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
