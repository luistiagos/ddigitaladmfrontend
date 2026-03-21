import { useState, useEffect, useCallback } from 'react';
import { Search, X, Mail, MessageCircle, Loader2 } from 'lucide-react';
import api from '@/services/api';
import Badge, { statusVariant } from '@/components/ui/Badge';
import AdminGrid from '@/components/ui/AdminGrid';
import { EmailCell, PhoneCell } from '@/components/ui/ContactCell';
import useAdminGrid from '@/utils/useAdminGrid';
import { formatDateTime, formatCurrency, todayISO } from '@/utils/format';

const PER_PAGE = 20;
const getEmptyFilters = () => ({
  email: '', phone: '', product_id: '', store_id: '',
  start_date: todayISO(), end_date: todayISO(),
});

export default function Disputes() {
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [filters, setFilters] = useState(getEmptyFilters);
  const [applied, setApplied] = useState(getEmptyFilters);
  const [data, setData] = useState({ items: [], total: 0, total_value: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState({});
  const [feedback, setFeedback] = useState({});
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
      if (applied.store_id) params.set('store_id', applied.store_id);
      if (applied.start_date) params.set('start_date', applied.start_date);
      if (applied.end_date) params.set('end_date', applied.end_date);
      params.set('sort_column', sortColumn);
      params.set('sort_direction', sortDirection);
      const res = await api.get(`/admin/disputes?${params}`);
      setData({ items: res.data.items || [], total: res.data.total || 0, total_value: res.data.total_value ?? null });
    } catch {
      setError('Erro ao carregar disputas.');
    } finally {
      setLoading(false);
    }
  }, [page, applied, sortColumn, sortDirection]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function applyFilters(e) { e.preventDefault(); setPage(1); setApplied({ ...filters }); }
  function clearFilters() { const empty = getEmptyFilters(); setFilters(empty); setApplied(empty); setPage(1); }

  async function resend(row, via) {
    const key = `${row.id}_${via}`;
    setSending((s) => ({ ...s, [key]: true }));
    try {
      const payload = { email: row.email, product_id: row.product_id };
      if (via === 'whats') payload.phone = row.phone;
      await api.post(via === 'email' ? '/admin/resend_email' : '/admin/resend_whats', payload);
      setFeedback((f) => ({ ...f, [key]: 'ok' }));
    } catch {
      setFeedback((f) => ({ ...f, [key]: 'err' }));
    } finally {
      setSending((s) => ({ ...s, [key]: false }));
      setTimeout(() => setFeedback((f) => { const n = { ...f }; delete n[key]; return n; }), 3000);
    }
  }

  const columns = [
    {
      key: 'email', label: 'E-mail', sortable: true, fullCell: true,
      render: r => <EmailCell email={r.email} />,
      csvValue: r => r.email ?? '',
    },
    {
      key: 'phone', label: 'WhatsApp', sortable: true, fullCell: true,
      render: r => <PhoneCell phone={r.phone} />,
      csvValue: r => r.phone ?? '',
    },
    {
      key: 'title', label: 'Produto', sortable: true,
      render: r => r.title || '—',
      csvValue: r => r.title ?? '',
    },
    {
      key: 'value', label: 'Preço', sortable: true, isValueColumn: true,
      render: r => formatCurrency(r.value),
      csvValue: r => r.value != null ? Number(r.value).toFixed(2).replace('.', ',') : '',
    },
    {
      key: 'datetime', label: 'Data', sortable: true,
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
      key: 'actions', label: 'Ações',
      render: r => (
        <div className="flex items-center gap-2">
          <ActionBtn icon={<Mail className="h-3.5 w-3.5" />} label="Email"
            loading={sending[`${r.id}_email`]} feedback={feedback[`${r.id}_email`]}
            onClick={() => resend(r, 'email')} />
          {r.phone && (
            <ActionBtn icon={<MessageCircle className="h-3.5 w-3.5" />} label="WhatsApp"
              loading={sending[`${r.id}_whats`]} feedback={feedback[`${r.id}_whats`]}
              onClick={() => resend(r, 'whats')} />
          )}
        </div>
      ),
      csvValue: () => '',
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Disputas</h1>
        <p className="text-sm text-gray-400 mt-1">Transações estornadas, canceladas ou em mediação</p>
      </div>

      {/* Filters */}
      <form onSubmit={applyFilters} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <TxtInput placeholder="E-mail" value={filters.email} onChange={(v) => setFilters((f) => ({ ...f, email: v }))} />
          <TxtInput placeholder="Telefone" value={filters.phone} onChange={(v) => setFilters((f) => ({ ...f, phone: v }))} />
          <select
            value={filters.product_id}
            onChange={(e) => setFilters((f) => ({ ...f, product_id: e.target.value }))}
            className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
          >
            <option value="">Todos os produtos</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
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

      <AdminGrid
        columns={columns}
        data={data}
        loading={loading}
        error={error}
        emptyMessage="Nenhuma disputa encontrada."
        page={page}
        perPage={PER_PAGE}
        onPageChange={setPage}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        totalLabel="disputa"
        title="Disputas"
      />
    </div>
  );
}

function TxtInput({ placeholder, value, onChange }) {
  return (
    <input type="text" placeholder={placeholder} value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500 placeholder-gray-500" />
  );
}

function ActionBtn({ icon, label, loading, feedback, onClick }) {
  let cls = 'inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors bg-gray-700 hover:bg-gray-600 text-gray-300';
  if (feedback === 'ok')  cls = 'inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-500/20 text-green-400';
  if (feedback === 'err') cls = 'inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-500/20 text-red-400';
  return (
    <button onClick={onClick} disabled={loading} className={cls + (loading ? ' opacity-60 cursor-not-allowed' : '')}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}{label}
    </button>
  );
}
