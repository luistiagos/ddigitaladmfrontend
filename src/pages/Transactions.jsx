import { useState, useEffect, useCallback } from 'react';
import { Search, X, Download, Printer, Loader2 } from 'lucide-react';
import api from '@/services/api';
import Badge, { statusVariant } from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import { LoadingRows, EmptyRow, ErrorRow } from '@/components/ui/TableStates';
import { EmailCell, PhoneCell } from '@/components/ui/ContactCell';
import { formatDateTime, formatCurrency } from '@/utils/format';

const PER_PAGE = 20;

const ALL_STATUSES = [
  'approved', 'pending', 'create', 'in_process',
  'payment_failed', 'reverted', 'refunded',
  'charged_back', 'in_mediation', 'cancelled',
];

const EMPTY_FILTERS = {
  email: '', phone: '', product_id: '', status: '',
  store_id: '', start_date: '', end_date: '',
};

export default function Transactions() {
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [sortColumn, setSortColumn] = useState('datetime');
  const [sortDirection, setSortDirection] = useState('desc');

  useEffect(() => {
    api.get('/admin/items?per_page=100').then((r) => setProducts(r.data.items || [])).catch(() => {});
    api.get('/admin/stores').then((r) => setStores(r.data.stores || [])).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, per_page: PER_PAGE });
      if (applied.email) params.set('email', applied.email);
      if (applied.phone) params.set('phone', applied.phone);
      if (applied.product_id) params.set('product_id', applied.product_id);
      if (applied.status) params.set('status', applied.status);
      if (applied.store_id) params.set('store_id', applied.store_id);
      if (applied.start_date) params.set('start_date', applied.start_date);
      if (applied.end_date) params.set('end_date', applied.end_date);
      params.set('sort_column', sortColumn);
      params.set('sort_direction', sortDirection);
      const res = await api.get(`/admin/transactions_all?${params}`);
      setData({ items: res.data.items || [], total: res.data.total || 0 });
    } catch {
      setError('Erro ao carregar transações.');
    } finally {
      setLoading(false);
    }
  }, [page, applied, sortColumn, sortDirection]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function applyFilters(e) { e.preventDefault(); setPage(1); setApplied({ ...filters }); }
  function clearFilters() { setFilters(EMPTY_FILTERS); setApplied(EMPTY_FILTERS); setPage(1); }

  function handleSort(column) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setPage(1);
  }

  async function exportCSV() {
    setExporting(true);
    try {
      const params = new URLSearchParams({ page: 1, per_page: 5000 });
      if (applied.email) params.set('email', applied.email);
      if (applied.phone) params.set('phone', applied.phone);
      if (applied.product_id) params.set('product_id', applied.product_id);
      if (applied.status) params.set('status', applied.status);
      if (applied.store_id) params.set('store_id', applied.store_id);
      if (applied.start_date) params.set('start_date', applied.start_date);
      if (applied.end_date) params.set('end_date', applied.end_date);
      const res = await api.get(`/admin/transactions_all?${params}`);
      const items = res.data.items || [];

      const headers = ['ID', 'E-mail', 'Telefone', 'Produto', 'Valor (R$)', 'Data/Hora', 'Status', 'MP ID', 'Loja'];
      const rows = items.map((r) => [
        r.id ?? '',
        r.email ?? '',
        r.phone ?? '',
        r.title ?? '',
        r.value != null ? Number(r.value).toFixed(2).replace('.', ',') : '',
        r.datetime ?? '',
        r.status ?? '',
        r.mpid ?? '',
        r.store_name ?? '',
      ]);

      const csv = [headers, ...rows]
        .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
        .join('\n');

      // BOM (\uFEFF) ensures Excel opens UTF-8 correctly
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transacoes_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Erro ao exportar CSV.');
    } finally {
      setExporting(false);
    }
  }

  function exportPrint() {
    const rows = data.items;
    const escaped = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Transações — ${new Date().toLocaleDateString('pt-BR')}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #111; }
    h2 { margin-bottom: 6px; font-size: 14px; }
    p { margin: 0 0 10px; color: #555; font-size: 10px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #bbb; padding: 4px 6px; text-align: left; }
    th { background: #f0f0f0; font-weight: 600; }
    tr:nth-child(even) td { background: #fafafa; }
    @media print { @page { margin: 15mm; } }
  </style>
</head>
<body>
  <h2>Transações</h2>
  <p>Exportado em ${new Date().toLocaleString('pt-BR')} — ${rows.length} registro(s) na página atual</p>
  <table>
    <thead>
      <tr>
        <th>ID</th><th>E-mail</th><th>Telefone</th><th>Produto</th>
        <th>Valor</th><th>Data/Hora</th><th>Status</th><th>Loja</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((r) => `
      <tr>
        <td>${escaped(r.id)}</td>
        <td>${escaped(r.email)}</td>
        <td>${escaped(r.phone)}</td>
        <td>${escaped(r.title)}</td>
        <td>${r.value != null ? `R$ ${Number(r.value).toFixed(2).replace('.', ',')}` : ''}</td>
        <td>${escaped(r.datetime)}</td>
        <td>${escaped(r.status)}</td>
        <td>${escaped(r.store_name)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Transações</h1>
          <p className="text-sm text-gray-400 mt-1">
            Todas as transações — todos os status
            {data.total > 0 && !loading && (
              <span className="ml-2 text-gray-500">({data.total.toLocaleString('pt-BR')} total)</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            disabled={exporting}
            title="Exportar todos os resultados filtrados como CSV"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-60 text-white text-sm rounded-lg transition-colors"
          >
            {exporting
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Download className="h-3.5 w-3.5" />}
            CSV
          </button>
          <button
            onClick={exportPrint}
            title="Imprimir / Salvar como PDF"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm rounded-lg transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={applyFilters} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <TxtInput
            placeholder="E-mail"
            value={filters.email}
            onChange={(v) => setFilters((f) => ({ ...f, email: v }))}
          />
          <TxtInput
            placeholder="Telefone"
            value={filters.phone}
            onChange={(v) => setFilters((f) => ({ ...f, phone: v }))}
          />
          <select
            value={filters.product_id}
            onChange={(e) => setFilters((f) => ({ ...f, product_id: e.target.value }))}
            className={SEL_CLS}
          >
            <option value="">Todos os produtos</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className={SEL_CLS}
          >
            <option value="">Todos os status</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filters.store_id}
            onChange={(e) => setFilters((f) => ({ ...f, store_id: e.target.value }))}
            className={SEL_CLS}
          >
            <option value="">Todas as lojas</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input
            type="date"
            value={filters.start_date}
            onChange={(e) => setFilters((f) => ({ ...f, start_date: e.target.value }))}
            className={INP_CLS}
          />
          <input
            type="date"
            value={filters.end_date}
            onChange={(e) => setFilters((f) => ({ ...f, end_date: e.target.value }))}
            className={INP_CLS}
          />
        </div>
        <div className="flex gap-2 mt-3">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors"
          >
            <Search className="h-4 w-4" /> Buscar
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
          >
            <X className="h-4 w-4" /> Limpar
          </button>
        </div>
      </form>

      {/* Table */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">#</th>
                <SortableTh column="email" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>E-mail</SortableTh>
                <SortableTh column="phone" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Telefone</SortableTh>
                <SortableTh column="title" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Produto</SortableTh>
                <SortableTh column="value" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Valor</SortableTh>
                <SortableTh column="datetime" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Data/Hora</SortableTh>
                <SortableTh column="status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Status</SortableTh>
                <SortableTh column="store_name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Loja</SortableTh>
              </tr>
            </thead>
            <tbody>
              {loading && <LoadingRows cols={8} />}
              {!loading && error && <ErrorRow cols={8} message={error} />}
              {!loading && !error && data.items.length === 0 && (
                <EmptyRow cols={8} message="Nenhuma transação encontrada. Use os filtros para buscar." />
              )}
              {!loading && !error && data.items.map((row) => (
                <tr key={row.id} className="border-b border-gray-800/60 hover:bg-gray-700/20 transition-colors">
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">{row.id}</td>
                  <EmailCell email={row.email} />
                  <PhoneCell phone={row.phone} />
                  <td className="px-4 py-3 text-gray-300 max-w-[160px] truncate" title={row.title}>
                    {row.title || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{formatCurrency(row.value)}</td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDateTime(row.datetime)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(row.status)}>{row.status || '—'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{row.store_name || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-700 bg-gray-800/50">
                <td colSpan="4" className="px-4 py-3 text-sm text-gray-300">
                  Total: {data.total} transação{data.total !== 1 ? 'ões' : ''}
                </td>
                <td className="px-4 py-3 text-sm text-gray-300 font-semibold">
                  {formatCurrency(data.total_value || 0)}
                </td>
                <td colSpan="3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
        {data.total > PER_PAGE && (
          <div className="px-4 py-3 border-t border-gray-700">
            <Pagination page={page} total={data.total} perPage={PER_PAGE} onChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}

const SEL_CLS = 'bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500';
const INP_CLS = 'bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500';

function TxtInput({ placeholder, value, onChange }) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500 placeholder-gray-500"
    />
  );
}

function SortableTh({ children, column, sortColumn, sortDirection, onSort }) {
  const isActive = sortColumn === column;
  return (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-300 select-none"
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {isActive && (
          <span className="text-gray-500">
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  );
}
