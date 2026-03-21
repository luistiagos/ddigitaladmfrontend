/**
 * AdminGrid — reusable paginated admin table.
 *
 * All sorting, CSV/PDF export, footer summary, and pagination live here so
 * every admin page gets an identical, standardised experience with zero
 * duplication.
 *
 * Column definition shape:
 *   key          string        unique key; also the CSV/PDF fallback accessor (row[key])
 *   label        string        column header text
 *   sortable?    boolean       renders a clickable sort header
 *   isValueColumn? boolean     marks this column for the monetary sum in the footer
 *   render?      (row) => ReactNode   cell content — AdminGrid wraps it in <td>
 *   fullCell?    boolean       when true, render() must return the full <td> element
 *                              (used with EmailCell / PhoneCell which own their <td>)
 *   csvValue?    (row) => string      text for CSV/PDF export; falls back to row[key]
 *   className?   string        <td> className override
 */

import { cloneElement } from 'react';
import { Download, FileText } from 'lucide-react';
import Pagination from './Pagination';
import { LoadingRows, EmptyRow, ErrorRow } from './TableStates';
import { formatCurrency } from '@/utils/format';

// ---------------------------------------------------------------------------
// Exported header-cell helpers (usable standalone if needed)
// ---------------------------------------------------------------------------

export function SortableTh({ children, column, sortColumn, sortDirection, onSort }) {
  const active = sortColumn === column;
  return (
    <th
      onClick={() => onSort(column)}
      className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-300 select-none"
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <span className="inline-block w-3 text-center text-gray-500">
          {active ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
        </span>
      </span>
    </th>
  );
}

export function Th({ children }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
      {children}
    </th>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminGrid({
  columns,
  data = { items: [], total: 0, total_value: null },
  loading,
  error,
  emptyMessage = 'Nenhum registro encontrado.',
  page,
  perPage,
  onPageChange,
  sortColumn,
  sortDirection,
  onSort,
  /** singular label used in footer, e.g. 'venda' → shows '5 vendas' */
  totalLabel = 'registro',
  /** used in PDF title and CSV filename */
  title = '',
}) {
  const items = data.items || [];
  const total = data.total ?? 0;
  const totalValue = data.total_value ?? null;
  const colCount = columns.length;
  const valueColIdx = columns.findIndex(c => c.isValueColumn);
  const hasValueSummary = valueColIdx >= 0 && totalValue !== null;
  const safeFilename = (title || `${totalLabel}s`).toLowerCase().replace(/\s+/g, '_');
  const countText = `${total.toLocaleString('pt-BR')} ${total !== 1 ? `${totalLabel}s` : totalLabel}`;

  // ---- CSV export -----------------------------------------------------------
  function handleExportCSV() {
    const escape = v => String(v ?? '').replace(/"/g, '""');
    const header = columns.map(c => `"${escape(c.label)}"`).join(',');
    const rows = items.map(row =>
      columns.map(c => `"${escape(c.csvValue ? c.csvValue(row) : (row[c.key] ?? ''))}"`)
             .join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeFilename}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    // Defer revoke so the browser has time to start the download
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // ---- PDF export (opens clean print window) --------------------------------
  function handleExportPDF() {
    const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const titleStr = title || (totalLabel.charAt(0).toUpperCase() + totalLabel.slice(1) + 's');
    const ths = columns.map(c => `<th>${esc(c.label)}</th>`).join('');
    const trs = items.map(row => (
      '<tr>' +
      columns.map(c => `<td>${esc(c.csvValue ? c.csvValue(row) : (row[c.key] ?? ''))}</td>`).join('') +
      '</tr>'
    )).join('');
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${esc(titleStr)}</title><style>
  body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#111}
  h2{font-size:14px;margin:0 0 6px}p{color:#555;font-size:10px;margin:0 0 12px}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;word-break:break-word}
  th{background:#f0f0f0;font-weight:600}tr:nth-child(even) td{background:#fafafa}
  @media print{@page{margin:15mm}}</style></head><body>
<h2>${esc(titleStr)}</h2>
<p>Exportado em ${new Date().toLocaleString('pt-BR')} · ${items.length} registro(s) na página atual</p>
<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>
<script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  }

  // ---- Footer colspan logic -------------------------------------------------
  // before the value column → count text
  // value column            → formatted sum
  // after the value column  → empty filler
  const footerBefore = hasValueSummary ? (valueColIdx > 0 ? valueColIdx : 1) : colCount;
  const footerAfter  = hasValueSummary ? colCount - valueColIdx - 1 : 0;

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">

          {/* ---- HEADER ---- */}
          <thead>
            <tr className="border-b border-gray-700">
              {columns.map(col =>
                col.sortable ? (
                  <SortableTh
                    key={col.key}
                    column={col.key}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={onSort}
                  >
                    {col.label}
                  </SortableTh>
                ) : (
                  <Th key={col.key}>{col.label}</Th>
                )
              )}
            </tr>
          </thead>

          {/* ---- BODY ---- */}
          <tbody>
            {loading && <LoadingRows cols={colCount} />}
            {!loading && error && <ErrorRow cols={colCount} message={error} />}
            {!loading && !error && items.length === 0 && (
              <EmptyRow cols={colCount} message={emptyMessage} />
            )}
            {!loading && !error && items.map((row, idx) => (
              <tr
                key={row.id ?? idx}
                className="border-b border-gray-800/60 hover:bg-gray-700/20 transition-colors"
              >
                {columns.map(col => {
                  // fullCell: render() returns the complete <td> element (e.g. EmailCell)
                  if (col.fullCell) {
                    return cloneElement(col.render(row), { key: col.key });
                  }
                  return (
                    <td key={col.key} className={col.className ?? 'px-4 py-3 text-gray-300'}>
                      {col.render ? col.render(row) : (row[col.key] ?? '—')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>

          {/* ---- FOOTER ---- */}
          <tfoot>
            <tr className="border-t border-gray-700 bg-gray-800/50">
              <td colSpan={footerBefore} className="px-4 py-3 text-sm text-gray-300">
                {countText}
              </td>
              {hasValueSummary && (
                <td className="px-4 py-3 text-sm text-emerald-400 font-semibold">
                  {formatCurrency(totalValue)}
                </td>
              )}
              {footerAfter > 0 && <td colSpan={footerAfter} />}
            </tr>
          </tfoot>

        </table>
      </div>

      {/* ---- TOOLBAR: export + pagination (always visible) ---- */}
      <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-medium rounded-lg transition-colors"
          >
            <FileText className="h-3.5 w-3.5" /> PDF
          </button>
        </div>
        <Pagination page={page} total={total} perPage={perPage} onChange={onPageChange} />
      </div>
    </div>
  );
}
