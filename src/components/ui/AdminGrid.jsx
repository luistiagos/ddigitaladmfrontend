/**
 * AdminGrid — reusable paginated admin table.
 *
 * All sorting, CSV/PDF export, footer summary, and pagination live here so
 * every admin page gets an identical, standardised experience with zero
 * duplication.
 *
 * Column definition shape:
 *   key           string        unique key; also the CSV/PDF fallback accessor (row[key])
 *   label         string        column header text
 *   sortable?     boolean       renders a clickable sort header
 *   headerRender? () => ReactNode  custom header cell content (replaces label)
 *   isValueColumn? boolean      marks this column for the monetary sum in the footer
 *   render?       (row, ctx) => ReactNode   cell content — AdminGrid wraps it in <td>.
 *                               ctx.card is true when rendering inside a mobile card
 *                               (see mobileCards): the page can then let long text wrap
 *                               instead of truncating it to keep a table row short.
 *   fullCell?     boolean       when true, render() must return the full <td> element
 *                               (used with EmailCell / PhoneCell which own their <td>)
 *   csvValue?     (row) => string      text for CSV/PDF export; falls back to row[key]
 *   className?    string        <td> className override
 *   cardBlock?    boolean       in a mobile card (see mobileCards), this field takes the
 *                               full width with its label above, instead of sharing the
 *                               line with the label. For the long free text of the row —
 *                               squeezed into the half-line left over by the label, it
 *                               wraps into a narrow ribbon.
 *   stickyRight?  boolean       pins the column to the right edge while the table scrolls
 *                               sideways. Use it on the column that carries the row's
 *                               action button: a table with many columns overflows the
 *                               container, and the LAST column is the first to leave the
 *                               screen — the action then looks like it was removed, with
 *                               the horizontal scrollbar sitting below 20 rows, off-screen.
 *                               Ignored for fullCell columns, which own their own <td>.
 */

import { cloneElement, useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import Pagination from './Pagination';
import { LoadingRows, EmptyRow, ErrorRow } from './TableStates';
import { formatCurrency } from '@/utils/format';

// ---------------------------------------------------------------------------
// Largura da tela, decidida em JS e nao por classe de CSS.
//
// Por que nao `lg:hidden` + `hidden lg:block`: isso deixa as DUAS superficies no DOM e so
// esconde uma. O navegador aguenta, mas cada registro passa a existir em dobro -- e em
// jsdom, que nao aplica media query, TUDO fica visivel e qualquer `getByText` encontra
// dois elementos (foi o que quebrou 51 testes desta suite de uma vez).
//
// Sem `matchMedia` (jsdom), a resposta e "nao e estreita": o teste ve a tabela, que e a
// superficie que ele sempre viu. Quem for testar o cartao dubla `window.matchMedia`.
const CONSULTA_ESTREITA = '(max-width: 1023.98px)';   // abaixo do `lg` do Tailwind

function useTelaEstreita(ativo) {
  const [estreita, setEstreita] = useState(false);
  useEffect(() => {
    if (!ativo || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setEstreita(false);
      return undefined;
    }
    const mq = window.matchMedia(CONSULTA_ESTREITA);
    const aoMudar = (e) => setEstreita(e.matches);
    setEstreita(mq.matches);
    mq.addEventListener('change', aoMudar);
    return () => mq.removeEventListener('change', aoMudar);
  }, [ativo]);
  return estreita;
}

// ---------------------------------------------------------------------------
// Exported header-cell helpers (usable standalone if needed)
// ---------------------------------------------------------------------------

// Classes que prendem a celula na borda direita enquanto a tabela rola de lado.
// O fundo precisa ser OPACO: o conteudo das outras colunas passa por baixo.
const STICKY_TH = 'sticky right-0 z-20 bg-gray-800 border-l border-gray-700';
const STICKY_TD = 'sticky right-0 z-10 bg-gray-800 border-l border-gray-700';

export function SortableTh({ children, column, sortColumn, sortDirection, onSort, className = '' }) {
  const active = sortColumn === column;
  return (
    <th
      onClick={() => onSort(column)}
      className={`px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-300 select-none ${className}`}
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

export function Th({ children, className = '' }) {
  return (
    <th className={`px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider ${className}`}>
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
  /**
   * Abaixo de `lg` (1024px), troca a tabela por um cartao por registro. Opt-in porque o
   * ganho depende do numero de colunas: uma tabela de 4 colunas cabe no celular, uma de 9
   * vira 1100px de rolagem lateral para ler UMA linha. Os cartoes saem das MESMAS
   * `columns` -- rotulo + valor renderizado --, entao nao existe segunda definicao de tela
   * para divergir da primeira.
   */
  mobileCards = false,
}) {
  const emCartoes = useTelaEstreita(mobileCards);
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
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
  const footerAfter  = hasValueSummary ? colCount - footerBefore - 1 : 0;

  // ---- Cartoes (telas estreitas) --------------------------------------------
  // Colunas sem rotulo (o seletor) e a coluna presa na borda direita (a acao da linha)
  // vao para a faixa de cima do cartao; o resto vira rotulo + valor.
  const colTopo = columns.filter((c) => !c.label || c.stickyRight);
  const colCorpo = columns.filter((c) => c.label && !c.stickyRight);
  const colAcao = columns.find((c) => c.stickyRight);

  // `fullCell` devolve o <td> inteiro, que nao existe fora da tabela: no cartao cai no
  // texto do CSV, que e exatamente "o valor desta celula em texto".
  //
  // O segundo argumento do `render` diz em QUE superficie a celula esta. Existe porque
  // largura de cartao nao e largura de coluna: o que na tabela se corta com `truncate`
  // (para a linha nao crescer) no cartao precisa quebrar em varias linhas -- e quem sabe
  // disso e a pagina, que escreveu o `render`. Quem ignora o argumento nao muda de
  // comportamento.
  const valorNoCartao = (col, row) => (
    col.fullCell
      ? (col.csvValue ? col.csvValue(row) : (row[col.key] ?? '—'))
      : (col.render ? col.render(row, { card: true }) : (row[col.key] ?? '—'))
  );

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
      {emCartoes && (
        <div className="divide-y divide-gray-800">
          {loading && <div className="px-4 py-6 text-sm text-gray-400">Carregando…</div>}
          {!loading && error && <div className="px-4 py-6 text-sm text-red-400">{error}</div>}
          {!loading && !error && items.length === 0 && (
            <div className="px-4 py-6 text-sm text-gray-400">{emptyMessage}</div>
          )}
          {!loading && !error && items.map((row, idx) => (
            <div key={row.id ?? idx} className="px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {colTopo.filter((c) => c !== colAcao).map((col) => (
                    <div key={col.key} className="shrink-0">{valorNoCartao(col, row)}</div>
                  ))}
                </div>
                {colAcao && <div className="shrink-0">{valorNoCartao(colAcao, row)}</div>}
              </div>
              <dl className="mt-3 space-y-2">
                {colCorpo.map((col) => {
                  const valor = valorNoCartao(col, row);
                  if (valor == null || valor === '') return null;
                  if (col.cardBlock) {
                    return (
                      <div key={col.key}>
                        <dt className="text-[11px] uppercase tracking-wider text-gray-500">
                          {col.label}
                        </dt>
                        <dd className="text-sm text-gray-300 mt-0.5">{valor}</dd>
                      </div>
                    );
                  }
                  return (
                    <div key={col.key} className="flex items-start justify-between gap-3">
                      <dt className="text-[11px] uppercase tracking-wider text-gray-500 shrink-0 pt-0.5">
                        {col.label}
                      </dt>
                      <dd className="text-sm text-gray-300 text-right min-w-0">
                        {valor}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ))}
          <div className="px-4 py-3 text-sm text-gray-300">
            {countText}
            {hasValueSummary && (
              <span className="text-emerald-400 font-semibold"> · {formatCurrency(totalValue)}</span>
            )}
          </div>
        </div>
      )}

      {!emCartoes && (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">

          {/* ---- HEADER ---- */}
          <thead>
            <tr className="border-b border-gray-700">
              {columns.map(col => {
                const headerContent = col.headerRender ? col.headerRender() : col.label;
                return col.sortable ? (
                  <SortableTh
                    key={col.key}
                    column={col.key}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={onSort}
                    className={col.stickyRight ? STICKY_TH : ''}
                  >
                    {headerContent}
                  </SortableTh>
                ) : (
                  <Th key={col.key} className={col.stickyRight ? STICKY_TH : ''}>{headerContent}</Th>
                );
              })}
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
                  const tdCls = col.className ?? 'px-4 py-3 text-gray-300';
                  return (
                    <td key={col.key} className={col.stickyRight ? `${tdCls} ${STICKY_TD}` : tdCls}>
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
      )}

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
