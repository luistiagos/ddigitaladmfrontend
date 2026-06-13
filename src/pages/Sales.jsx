import { useState, useEffect, useCallback } from 'react';
import { Search, X, Mail, MessageCircle, Loader2, CreditCard, Facebook, Users, Globe } from 'lucide-react';
import api from '@/services/api';
import Badge, { statusVariant } from '@/components/ui/Badge';
import AdminGrid from '@/components/ui/AdminGrid';
import { EmailCell } from '@/components/ui/ContactCell';
import useAdminGrid from '@/utils/useAdminGrid';
import { formatDateTime, formatCurrency, todayISO } from '@/utils/format';

const PER_PAGE = 20;

const ALL_STATUSES = [
  'approved', 'pending', 'create', 'in_process',
  'payment_required', 'payment_failed', 'rejected', 'reverted', 'refunded',
  'charged_back', 'in_mediation', 'cancelled',
];

const PROVIDERS = [
  { value: 'mercadopago', label: 'Mercado Pago' },
  { value: 'stripe', label: 'Stripe' },
];

const PROVIDER_META = {
  mercadopago: {
    label: 'Mercado Pago',
    cls: 'text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 ring-1 ring-cyan-500/30',
  },
  stripe: {
    label: 'Stripe',
    cls: 'text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 ring-1 ring-violet-500/30',
  },
};

function getProvider(row) {
  if (row.mpid && String(row.mpid).startsWith('cs_')) return 'stripe';
  if (row.mpid) return 'mercadopago';
  if (row.payment_id) return 'stripe';
  return null;
}

const getEmptyFilters = () => ({
  email: '', phone: '', product_id: '', store_id: '',
  status: '', provider: '', mpid: '',
  start_date: todayISO(), end_date: todayISO(),
});

export default function Sales() {
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [filters, setFilters] = useState(getEmptyFilters);
  const [applied, setApplied] = useState(getEmptyFilters);
  const [data, setData] = useState({ items: [], total: 0, total_value: null, total_gross: null, total_fees: null, total_net: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState({});
  const [feedback, setFeedback] = useState({});
  const [detailRow, setDetailRow] = useState(null);
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
      if (applied.status) params.set('status', applied.status);
      if (applied.provider) params.set('provider', applied.provider);
      if (applied.mpid) params.set('mpid', applied.mpid);
      if (applied.start_date) params.set('start_date', applied.start_date);
      if (applied.end_date) params.set('end_date', applied.end_date);
      params.set('sort_column', sortColumn);
      params.set('sort_direction', sortDirection);
      const res = await api.get(`/admin/transactions?${params}`);
      setData({
        items: res.data.items || [],
        total: res.data.total || 0,
        total_value: res.data.total_value ?? null,
        total_gross: res.data.total_gross ?? res.data.total_value ?? null,
        total_fees: res.data.total_fees ?? null,
        total_net: res.data.total_net ?? null,
      });
    } catch {
      setError('Erro ao carregar vendas.');
    } finally {
      setLoading(false);
    }
  }, [page, applied, sortColumn, sortDirection]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function applyFilters(e) { e.preventDefault(); setPage(1); setApplied({ ...filters }); }
  function clearFilters() { const empty = getEmptyFilters(); setFilters(empty); setApplied(empty); setPage(1); }

  async function resend(row, via) {
    const key = `${row.id ?? row.order_id}_${via}`;
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
      key: 'title', label: 'Produto',
      render: r => (
        <div className="flex items-center gap-2">
          <span>{r.title || '—'}</span>
          {r.has_transaction === false && (
            <span
              title="Venda sem transação acoplada (apenas Mercado Pago)"
              className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30 whitespace-nowrap"
            >
              sem transação
            </span>
          )}
        </div>
      ),
      csvValue: r => r.title ?? '',
    },
    {
      key: 'value', label: 'Bruto', sortable: true, isValueColumn: true,
      render: r => formatCurrency(r.gross_amount ?? r.value),
      csvValue: r => (r.gross_amount ?? r.value) != null ? Number(r.gross_amount ?? r.value).toFixed(2).replace('.', ',') : '',
    },
    {
      key: 'total_fees', label: 'Taxas',
      className: 'px-4 py-3 text-rose-300 whitespace-nowrap',
      render: r => r.total_fees != null ? formatCurrency(r.total_fees) : '—',
      csvValue: r => r.total_fees != null ? Number(r.total_fees).toFixed(2).replace('.', ',') : '',
    },
    {
      key: 'net_amount', label: 'Líquido',
      className: 'px-4 py-3 text-emerald-300 whitespace-nowrap',
      render: r => r.net_amount != null ? formatCurrency(r.net_amount) : '—',
      csvValue: r => r.net_amount != null ? Number(r.net_amount).toFixed(2).replace('.', ',') : '',
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
      key: 'lead_source', label: 'Canal',
      render: r => <LeadSourceBadge row={r} />,
      csvValue: r => r.is_facebook ? 'Facebook' : r.is_existing_customer ? 'Cliente' : 'Orgânico',
    },
    {
      key: 'provider', label: 'Origem',
      render: r => {
        const p = getProvider(r);
        const m = PROVIDER_META[p];
        return m ? (
          <button
            onClick={() => setDetailRow(r)}
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${m.cls}`}
          >
            <CreditCard className="h-3 w-3" />{m.label}
          </button>
        ) : <span className="text-gray-600 text-xs">—</span>;
      },
      csvValue: r => {
        const p = getProvider(r);
        return PROVIDER_META[p]?.label ?? '';
      },
    },
    {
      key: 'actions', label: 'Ações',
      render: r => {
        const rk = r.id ?? r.order_id;
        return (
        <div className="flex items-center gap-2">
          <ActionBtn icon={<Mail className="h-3.5 w-3.5" />} label="Email"
            loading={sending[`${rk}_email`]} feedback={feedback[`${rk}_email`]}
            onClick={() => resend(r, 'email')} />
          {r.phone && (
            <ActionBtn icon={<MessageCircle className="h-3.5 w-3.5" />} label="WhatsApp"
              loading={sending[`${rk}_whats`]} feedback={feedback[`${rk}_whats`]}
              onClick={() => resend(r, 'whats')} />
          )}
        </div>
        );
      },
      csvValue: () => '',
    },
  ];

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
          <TxtInput placeholder="Nº Mercado Pago / ID" value={filters.mpid} onChange={(v) => setFilters((f) => ({ ...f, mpid: v }))} />
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

      {/* Resumo de totais (bruto / taxas / líquido) */}
      {(data.total_gross != null || data.total_fees != null || data.total_net != null) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <SummaryCard label="Total Bruto" value={data.total_gross} cls="text-cyan-300" />
          <SummaryCard label="Total Taxas" value={data.total_fees} cls="text-rose-300" />
          <SummaryCard label="Total Líquido" value={data.total_net} cls="text-emerald-300" />
        </div>
      )}

      <AdminGrid
        columns={columns}
        data={data}
        loading={loading}
        error={error}
        emptyMessage="Nenhuma venda encontrada."
        page={page}
        perPage={PER_PAGE}
        onPageChange={setPage}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        totalLabel="venda"
        title="Vendas"
      />

      {detailRow && (
        <ProviderDetailModal row={detailRow} onClose={() => setDetailRow(null)} />
      )}
    </div>
  );
}

function LeadSourceBadge({ row }) {
  if (row.is_facebook) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium text-blue-400 bg-blue-500/10 ring-1 ring-blue-500/30 whitespace-nowrap">
        <Facebook className="h-3 w-3" />Facebook
      </span>
    );
  }
  if (row.is_existing_customer) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/30 whitespace-nowrap">
        <Users className="h-3 w-3" />Cliente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium text-gray-400 bg-gray-500/10 ring-1 ring-gray-500/20 whitespace-nowrap">
      <Globe className="h-3 w-3" />Orgânico
    </span>
  );
}

function ProviderDetailModal({ row, onClose }) {
  const provider = getProvider(row);
  const isStripe = provider === 'stripe';
  const { label, cls } = PROVIDER_META[provider] ?? { label: 'Detalhes', cls: 'text-gray-400' };

  const fields = [
    { label: 'ID Transação', value: row.id },
    { label: 'ID Ordem MP', value: row.order_id },
    { label: isStripe ? 'Stripe Session ID' : 'MP Payment ID', value: row.mpid },
    { label: 'Payment ID', value: row.payment_id },
    !isStripe && { label: 'Preference ID', value: row.preference_id },
    { label: 'Status', value: row.status },
    { label: 'Bruto', value: row.gross_amount != null ? formatCurrency(row.gross_amount) : formatCurrency(row.value) },
    { label: 'Taxas', value: row.total_fees != null ? formatCurrency(row.total_fees) : null },
    { label: 'Líquido', value: row.net_amount != null ? formatCurrency(row.net_amount) : null },
    { label: 'Data da venda', value: formatDateTime(row.paid_date || row.datetime) },
    { label: 'E-mail', value: row.email },
    { label: 'Telefone', value: row.phone },
    { label: 'Produto', value: row.title },
    { label: 'Loja', value: row.store_name },
    { label: 'Cidade / Estado', value: [row.cidade, row.uf_nome || row.uf].filter(Boolean).join(' — ') || null },
    { label: 'CEP', value: row.zipcode },
    { label: 'Campanha', value: row.campaign },
    { label: 'FB Browser ID (fbp)', value: row.fbp },
    { label: 'FB Click ID (fbc)', value: row.fbc },
  ].filter(Boolean).filter((f) => f.value != null && f.value !== '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            <CreditCard className={`h-4 w-4 ${cls.match(/text-[\w-]+/)?.[0] ?? 'text-gray-400'}`} />
            <span className={`text-sm font-semibold ${cls.match(/text-[\w-]+/)?.[0] ?? 'text-gray-300'}`}>{label} — Detalhes da Transação</span>
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

        <div className="px-6 py-4 border-t border-gray-700 shrink-0 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-300 transition-colors">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, cls }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-semibold mt-0.5 ${cls}`}>
        {value != null ? formatCurrency(value) : '—'}
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


