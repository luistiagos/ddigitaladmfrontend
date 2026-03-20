import { useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import api from '@/services/api';
import Badge, { statusVariant } from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import { LoadingRows, EmptyRow, ErrorRow } from '@/components/ui/TableStates';
import { EmailCell, PhoneCell } from '@/components/ui/ContactCell';
import { formatDateTime, todayISO } from '@/utils/format';

const PER_PAGE = 20;
const getEmptyFilters = () => ({
  has_email: false,
  status: '',
  exclude_status: '',
  store_id: '',
  start_date: todayISO(),
  end_date: todayISO(),
});

export default function Leads() {
  const [statuses, setStatuses] = useState([]);
  const [stores, setStores] = useState([]);
  const [filters, setFilters] = useState(getEmptyFilters);
  const [applied, setApplied] = useState(getEmptyFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/leads/statuses').then((r) => setStatuses(r.data.statuses || [])).catch(() => {});
    api.get('/admin/stores').then((r) => setStores(r.data.stores || [])).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, per_page: PER_PAGE });
      if (applied.has_email) params.set('has_email', '1');
      if (applied.status) params.set('status', applied.status);
      if (applied.exclude_status) params.set('exclude_status', applied.exclude_status);
      if (applied.store_id) params.set('store_id', applied.store_id);
      if (applied.start_date) params.set('start_date', applied.start_date);
      if (applied.end_date) params.set('end_date', applied.end_date);
      const res = await api.get(`/admin/leads?${params}`);
      setData({ items: res.data.items || [], total: res.data.total || 0 });
    } catch {
      setError('Erro ao carregar leads.');
    } finally {
      setLoading(false);
    }
  }, [page, applied]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function applyFilters(e) { e.preventDefault(); setPage(1); setApplied({ ...filters }); }
  function clearFilters() { const empty = getEmptyFilters(); setFilters(empty); setApplied(empty); setPage(1); }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Leads</h1>
        <p className="text-sm text-gray-400 mt-1">Visitantes e potenciais clientes</p>
      </div>

      {/* Filters */}
      <form onSubmit={applyFilters} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
          >
            <option value="">Todos os status</option>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filters.exclude_status}
            onChange={(e) => setFilters((f) => ({ ...f, exclude_status: e.target.value }))}
            className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
          >
            <option value="">Excluir status...</option>
            {statuses.map((s) => <option key={s} value={s}>≠ {s}</option>)}
          </select>
          <select
            value={filters.store_id}
            onChange={(e) => setFilters((f) => ({ ...f, store_id: e.target.value }))}
            className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
          >
            <option value="">Todas as lojas</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="date" value={filters.start_date} onChange={(e) => setFilters((f) => ({ ...f, start_date: e.target.value }))}
            className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500" />
          <input type="date" value={filters.end_date} onChange={(e) => setFilters((f) => ({ ...f, end_date: e.target.value }))}
            className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500" />
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.has_email}
              onChange={(e) => setFilters((f) => ({ ...f, has_email: e.target.checked }))}
              className="w-4 h-4 rounded accent-violet-500"
            />
            Apenas com e-mail
          </label>
        </div>
        <div className="flex gap-2 mt-3">
          <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors">
            <Search className="h-4 w-4" /> Buscar
          </button>
          <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors">
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
                {['E-mail', 'Telefone', 'Produto', 'Data', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <LoadingRows cols={5} />}
              {!loading && error && <ErrorRow cols={5} message={error} />}
              {!loading && !error && data.items.length === 0 && <EmptyRow cols={5} message="Nenhum lead encontrado." />}
              {!loading && !error && data.items.map((row) => (
                <tr key={row.id} className="border-b border-gray-800/60 hover:bg-gray-700/20 transition-colors">
                  {/* E-mail */}
                  <EmailCell email={row.email} />
                  {/* Telefone */}
                  <PhoneCell phone={row.phone} />
                  <td className="px-4 py-3 text-gray-300">{row.product || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDateTime(row.dttime)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(row.status)}>{row.status || '—'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
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
