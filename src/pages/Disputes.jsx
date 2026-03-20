import { useState, useEffect, useCallback } from 'react';
import { Search, X, Mail, MessageCircle, Loader2 } from 'lucide-react';
import api from '@/services/api';
import Badge, { statusVariant } from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import { LoadingRows, EmptyRow, ErrorRow } from '@/components/ui/TableStates';
import { EmailCell, PhoneCell } from '@/components/ui/ContactCell';
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
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState({});
  const [feedback, setFeedback] = useState({});

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
      const res = await api.get(`/admin/disputes?${params}`);
      setData({ items: res.data.items || [], total: res.data.total || 0 });
    } catch {
      setError('Erro ao carregar disputas.');
    } finally {
      setLoading(false);
    }
  }, [page, applied]);

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

      {/* Table */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                {['E-mail', 'WhatsApp', 'Produto', 'Preço', 'Data', 'Status', 'Ações'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <LoadingRows cols={7} />}
              {!loading && error && <ErrorRow cols={7} message={error} />}
              {!loading && !error && data.items.length === 0 && <EmptyRow cols={7} message="Nenhuma disputa encontrada." />}
              {!loading && !error && data.items.map((row) => (
                <tr key={row.id} className="border-b border-gray-800/60 hover:bg-gray-700/20 transition-colors">
                  <EmailCell email={row.email} />
                  <PhoneCell phone={row.phone} />
                  <td className="px-4 py-3 text-gray-300">{row.title || '—'}</td>
                  <td className="px-4 py-3 text-gray-300">{formatCurrency(row.value)}</td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDateTime(row.datetime)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(row.status)}>{row.status || '—'}</Badge>
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
