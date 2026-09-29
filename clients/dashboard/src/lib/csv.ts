/**
 * Build and download a CSV file. Uses `;` separators and a UTF-8 BOM so
 * Excel with a Turkish locale opens it with columns split and "ş/ğ" intact.
 */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]): void {
  const escape = (cell: string | number) => {
    const s = String(cell);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [header, ...rows].map((r) => r.map(escape).join(";")).join("\r\n");
  const blob = new Blob(["﻿", body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
