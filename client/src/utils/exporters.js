/**
 * Client-side exports. Heavy libraries are loaded on demand so they never
 * weigh down the initial bundle.
 */
const stamp = () => new Date().toISOString().slice(0, 10);

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

/**
 * rows: array of flat objects (keys are column headers).
 * format: 'csv' | 'xlsx' | 'pdf'
 * sheets (xlsx only): optional { name: rows } for multi-sheet workbooks.
 */
export async function exportRows(rows, name, format, { title, subtitle, sheets } = {}) {
  const filename = `${name}-${stamp()}`;
  if (format === 'csv') {
    const cols = Object.keys(rows[0] || {});
    const body = [cols.map(csvEscape).join(','), ...rows.map((r) => cols.map((c) => csvEscape(r[c])).join(','))].join('\n');
    download(new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
    return;
  }
  if (format === 'xlsx') {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const all = sheets || { [title || 'Data']: rows };
    for (const [sheet, data] of Object.entries(all)) {
      const ws = XLSX.utils.json_to_sheet(data);
      const cols = Object.keys(data[0] || {});
      ws['!cols'] = cols.map((c) => ({ wch: Math.min(48, Math.max(c.length, ...data.map((r) => String(r[c] ?? '').length)) + 2) }));
      XLSX.utils.book_append_sheet(wb, ws, sheet.slice(0, 31));
    }
    XLSX.writeFile(wb, `${filename}.xlsx`);
    return;
  }
  if (format === 'pdf') {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const cols = Object.keys(rows[0] || {});
    const doc = new jsPDF({ orientation: cols.length > 6 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
    doc.setFontSize(14);
    doc.text(title || name, 40, 40);
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(subtitle || `Generated ${new Date().toLocaleString('en-GB')} from DWMT`, 40, 56);
    autoTable(doc, {
      startY: 70,
      head: [cols],
      body: rows.map((r) => cols.map((c) => r[c] ?? '')),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [31, 107, 82] },
      alternateRowStyles: { fillColor: [245, 247, 246] },
      margin: { left: 40, right: 40 },
    });
    doc.save(`${filename}.pdf`);
  }
}
