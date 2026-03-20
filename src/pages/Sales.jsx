import { useState, useEffect, useCallback } from 'react';
import { Search, X, Mail, MessageCircle, Loader2, CreditCard } from 'lucide-react';
import api from '@/services/api';
import Badge, { statusVariant } from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import { LoadingRows, EmptyRow, ErrorRow } from '@/components/ui/TableStates';
import { EmailCell } from '@/components/ui/ContactCell';
import { formatDateTime, formatCurrency, todayISO } from '@/utils/format';

const PER_PAGE = 20;

const ALL_STATUSES = [
  'approved', 'pending', 'create', 'in_process',
  'payment_failed', 'reverted', 'refunded',
  'charged_back', 'in_mediation', 'cancelled',
];

const PROVIDERS = [{ value: 'mercadopago', label: 'Mercado Pago' }];

const PROVIDER_META = {
  mercadopago: {
    label: 'Mercado Pago',
    cls: 'text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 ring-1 ring-cyan-500/30',
  },
};

function getProvider(row) {
  if (row.mpid) return 'mercadopago';
  return null;
}

const getEmptyFilters = () => ({
  email: '', phone: '', product_id: '', store_id: '',
  status: '', provider: '',
  start_date: todayISO(), end_date: todayISO(),
});

export default function Sales() {
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [filters, setFilters] = useState(getEmptyFilters);
  const [applied, setApplied] = useState(getEmptyFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState({});
  const [feedback, setFeedback] = useState({});
  const [detailRow, setDetailRow] = useState(null);
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
      if (applied.store_id) params.set('store_id', applied.store_id);
      if (applied.status) params.set('status', applied.status);
      if (applied.provider) params.set('provider', applied.provider);
      if (applied.start_date) params.set('start_date', applied.start_date);
      if (applied.end_date) params.set('end_date', applied.end_date);
      params.set('sort_column', sortColumn);
      params.set('sort_direction', sortDirection);
      const res = await api.get(`/admin/transactions?${params}`);
      setData({ items: res.data.items || [], total: res.data.total || 0 });
    } catch {
      setError('Erro ao carregar vendas.');
    } finally {
      setLoading(false);
    }
  }, [page, applied, sortColumn, sortDirection]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function applyFilters(e) { e.preventDefault(); setPage(1); setApplied({ ...filters }); }
  function clearFilters() { const empty = getEmptyFilters(); setFilters(empty); setApplied(empty); setPage(1); }

  function handleSort(column) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setPage(1);
  }

  function exportCSV() {
    const headers = ['E-mail', 'Produto', 'Preço', 'Data', 'Status', 'Origem'];
    const rows = data.items.map(row => [
      row.email,
      row.title || '',
      row.value,
      formatDateTime(row.datetime),
      row.status,
      getProvider(row) ? 'Mercado Pago' : ''
    ]);
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `vendas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  function exportPDF() {
    window.print();
  }

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Vendas</h1>
        <p className="text-sm text-gray-400 mt-1">Histórico de transações</p>
      </div>

      {/* Filters */}
      <form onSubmit={applyFilters} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
          >
            <option value="">Todos os status</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filters.provider}
            onChange={(e) => setFilters((f) => ({ ...f, provider: e.target.value }))}
            className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
          >
            <option value="">Todos os providers</option>
            {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
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

      {/* Table */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <SortableTh column="email" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>E-mail</SortableTh>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Produto</th>
                <SortableTh column="value" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Preço</SortableTh>
                <SortableTh column="datetime" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Data</SortableTh>
                <SortableTh column="status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Status</SortableTh>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Origem</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && <LoadingRows cols={7} />}
              {!loading && error && <ErrorRow cols={7} message={error} />}
              {!loading && !error && data.items.length === 0 && <EmptyRow cols={7} message="Nenhuma venda encontrada." />}
              {!loading && !error && data.items.map((row) => {
                const provider = getProvider(row);
                const pMeta = PROVIDER_META[provider];
                return (
                  <tr key={row.id} className="border-b border-gray-800/60 hover:bg-gray-700/20 transition-colors">
                    <EmailCell email={row.email} />
                    <td className="px-4 py-3 text-gray-300">{row.title || '—'}</td>
                    <td className="px-4 py-3 text-gray-300">{formatCurrency(row.value)}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDateTime(row.datetime)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(row.status)}>{row.status || '—'}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {pMeta ? (
                        <button
                          onClick={() => setDetailRow(row)}
                          className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${pMeta.cls}`}
                        >
                          <CreditCard className="h-3 w-3" />
                          {pMeta.label}
                        </button>
                      ) : <span className="text-gray-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ActionBtn icon={<Mail className="h-3.5 w-3.5" />} label="Email"
                          loading={sending[`${row.id}_email`]} feedback={feedback[`${row.id}_email`]}
                          onClick={() => resend(row, 'email')} />
                        {row.phone && (
                          <ActionBtn icon={<MessageCircle className="h-3.5 w-3.5" />} label="WhatsApp"
                            loading={sending[`${row.id}_whats`]} feedback={feedback[`${row.id}_whats`]}
                            onClick={() => resend(row, 'whats')} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-700 bg-gray-800/50">
                <td colSpan="2" className="px-4 py-3 text-sm text-gray-300">
                  Total: {data.total} venda{data.total !== 1 ? 's' : ''}
                </td>
                <td className="px-4 py-3 text-sm text-gray-300 font-semibold">
                  {formatCurrency(data.total_value || 0)}
                </td>
                <td colSpan="4"></td>
              </tr>
            </tfoot>
          </table>
        </div>
        {data.total > PER_PAGE && (
          <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-between">
            <div className="flex gap-2">
              <button onClick={exportCSV} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded-lg transition-colors">
                CSV
              </button>
              <button onClick={exportPDF} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded-lg transition-colors">
                PDF
              </button>
            </div>
            <Pagination page={page} total={data.total} perPage={PER_PAGE} onChange={setPage} />
          </div>
        )}
      </div>

      {detailRow && (
        <MpDetailModal row={detailRow} onClose={() => setDetailRow(null)} />
      )}
    </div>
  );
}

function MpDetailModal({ row, onClose }) {
  const fields = [
    { label: 'ID Transação', value: row.id },
    { label: 'MP Payment ID', value: row.mpid },
    { label: 'Payment ID Interno', value: row.payment_id },
    { label: 'Preference ID', value: row.preference_id },
    { label: 'Status', value: row.status },
    { label: 'Valor', value: formatCurrency(row.value) },
    { label: 'Data / Hora', value: formatDateTime(row.datetime) },
    { label: 'E-mail', value: row.email },
    { label: 'Telefone', value: row.phone },
    { label: 'Produto', value: row.title },
    { label: 'Loja', value: row.store_name },
    { label: 'Cidade / Estado', value: [row.cidade, row.uf_nome || row.uf].filter(Boolean).join(' — ') || null },
    { label: 'CEP', value: row.zipcode },
    { label: 'Campanha', value: row.campaign },
  ].filter((f) => f.value != null && f.value !== '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-semibold text-cyan-300">Mercado Pago — Detalhes da Transação</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            {fields.map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</dt>
                <dd className="text-sm text-gray-100 break-all">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="px-6 py-4 border-t border-gray-700 flex-shrink-0 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-300 transition-colors">
            Fechar
          </button>
        </div>
      </div>
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
  if (feedback === 'ok') cls = 'inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-500/20 text-green-400';
  if (feedback === 'err') cls = 'inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-500/20 text-red-400';
  return (
    <button onClick={onClick} disabled={loading} className={cls + (loading ? ' opacity-60 cursor-not-allowed' : '')}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}{label}
    </button>
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
