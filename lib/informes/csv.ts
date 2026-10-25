/** Export CSV simple (UTF-8 con BOM para Excel). */

export function escaparCeldaCsv(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function filasACsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [
    headers.map(escaparCeldaCsv).join(','),
    ...rows.map((r) => r.map(escaparCeldaCsv).join(',')),
  ];
  return `\uFEFF${lines.join('\n')}`;
}

export function descargarCsv(nombreArchivo: string, csv: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo.endsWith('.csv') ? nombreArchivo : `${nombreArchivo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
