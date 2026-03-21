import { useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import api from '@/services/api';
import Badge, { statusVariant } from '@/components/ui/Badge';
import AdminGrid from '@/components/ui/AdminGrid';
import { EmailCell, PhoneCell } from '@/components/ui/ContactCell';
import { formatDateTime, formatCurrency } from '@/utils/format';
import useAdminGrid from '@/utils/useAdminGrid';

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
  const [data, setData] = useState({ items: [], total: 0, total_value: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { page, setPage, sortColumn, sortDirection, handleSort } =
    useAdminGrid({ defaultSort: 'datetime', defaultDir: 'desc' });

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
      setData({ items: res.data.items || [], total: res.data.total || 0, total_value: res.data.total_value ?? null });
    } catch {
      setError('Erro ao carregar transações.');
    } finally {
      setLoading(false);
    }
  }, [page, applied, sortColumn, sortDirection]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function applyFilters(e) { e.preventDefault(); setPage(1); setApplied({ ...filters }); }
  function clearFilters() { setFilters(EMPTY_FILTERS); setApplied(EMPTY_FILTERS); setPage(1); }

  const columns = [
    {
      key: 'id', label: '#',
      className: 'px-4 py-3 text-gray-500 text-xs font-mono',
      render: r => r.id,
      csvValue: r => r.id ?? '',
    },
    {
      key: 'email', label: 'E-mail', sortable: true, fullCell: true,
      render: r => <EmailCell email={r.email} />,
      csvValue: r => r.email ?? '',
    },
    {
      key: 'phone', label: 'Telefone', sortable: true, fullCell: true,
      render: r => <PhoneCell phone={r.phone} />,
      csvValue: r => r.phone ?? '',
    },
    {
      key: 'title', label: 'Produto', sortable: true,
      render: r => <span className="block max-w-40 truncate" title={r.title || ''}>{r.title || '—'}</span>,
      csvValue: r => r.title ?? '',
    },
    {
      key: 'value', label: 'Valor', sortable: true, isValueColumn: true,
      className: 'px-4 py-3 text-gray-300 whitespace-nowrap',
      render: r => formatCurrency(r.value),
      csvValue: r => r.value != null ? Number(r.value).toFixed(2).replace('.', ',') : '',
    },
    {
      key: 'datetime', label: 'Data/Hora', sortable: true,
      className: 'px-4 py-3 text-gray-400 whitespace-nowrap',
      render: r => formatDateTime(r.datetime),
      csvValue: r => r.datetime ?? '',
    },
    {
      key: 'status', label: 'Status', sortable: true,
      render: r => <Badge variant={statusVariant(r.status)}>{r.status || '—'}</Badge>,
      csvValue: r => r.status ?? '',
    },
    {
      key: 'store_name', label: 'Loja', sortable: true,
      className: 'px-4 py-3 text-gray-400 text-xs whitespace-nowrap',
      render: r => r.store_name || '—',
      csvValue: r => r.store_name ?? '',
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Transações</h1>
        <p className="text-sm text-gray-400 mt-1">
          Todas as transações — todos os status
          {data.total > 0 && !loading && (
            <span className="ml-2 text-gray-500">({data.total.toLocaleString('pt-BR')} total)</span>
          )}
        </p>
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

      <AdminGrid
        columns={columns}
        data={data}
        loading={loading}
        error={error}
        emptyMessage="Nenhuma transação encontrada. Use os filtros para buscar."
        page={page}
        perPage={PER_PAGE}
        onPageChange={setPage}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        totalLabel="transação"
        title="Transações"
      />
    </div>
  );
}

const SEL_CLS = 'bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500';
const INP_CLS = 'bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500';

function TxtInput({ placeholder, value, onChange }) {
  return (
    <input type="text" placeholder={placeholder} value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500 placeholder-gray-500" />
  );
}
