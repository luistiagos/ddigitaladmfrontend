import { useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import AdminGrid from '@/components/ui/AdminGrid';
import { EmailCell } from '@/components/ui/ContactCell';
import { formatDateTime } from '@/utils/format';
import useAdminGrid from '@/utils/useAdminGrid';

const PER_PAGE = 20;

const ALL_STATUSES = [
  'delivered', 'not_delivered', 'bounce', 'dropped', 'open', 'click',
  'processed', 'deferred', 'spamreport', 'unsubscribe',
];

const STATUS_VARIANT = {
  delivered:     'success',
  not_delivered: 'danger',
  open:          'info',
  click:         'info',
  processed:     'neutral',
  deferred:      'warning',
  bounce:        'danger',
  dropped:       'danger',
  spamreport:    'danger',
  unsubscribe:   'warning',
};

const EMPTY_FILTERS = {
  email: '', subject: '', status: '', start_date: '', end_date: '',
};

export default function EmailActivity() {
  const [filters, setFilters]   = useState(EMPTY_FILTERS);
  const [applied, setApplied]   = useState(EMPTY_FILTERS);
  const [data, setData]         = useState({ items: [], total: 0 });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const { page, setPage, sortColumn, sortDirection, handleSort } =
    useAdminGrid({ defaultSort: 'last_event_time', defaultDir: 'desc' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, per_page: PER_PAGE });
      if (applied.email)      params.set('email',      applied.email);
      if (applied.subject)    params.set('subject',    applied.subject);
      if (applied.status)     params.set('status',     applied.status);
      if (applied.start_date) params.set('start_date', applied.start_date);
      if (applied.end_date)   params.set('end_date',   applied.end_date);
      params.set('sort_column',    sortColumn);
      params.set('sort_direction', sortDirection);
      const res = await api.get(`/admin/email_activity?${params}`);
      setData({ items: res.data.items || [], total: res.data.total || 0 });
    } catch {
      setError('Erro ao carregar atividade de e-mails.');
    } finally {
      setLoading(false);
    }
  }, [page, applied, sortColumn, sortDirection]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function applyFilters(e) { e.preventDefault(); setPage(1); setApplied({ ...filters }); }
  function clearFilters()  { setFilters(EMPTY_FILTERS); setApplied(EMPTY_FILTERS); setPage(1); }

  const columns = [
    {
      key: 'to_email', label: 'Destinatário', sortable: true, fullCell: true,
      render: r => <EmailCell email={r.to_email} />,
      csvValue: r => r.to_email ?? '',
    },
    {
      key: 'subject', label: 'Assunto', sortable: true,
      render: r => (
        <span className="block max-w-xs truncate text-gray-300 text-sm" title={r.subject || ''}>
          {r.subject || '—'}
        </span>
      ),
      csvValue: r => r.subject ?? '',
    },
    {
      key: 'status', label: 'Status', sortable: true,
      render: r => (
        <Badge variant={STATUS_VARIANT[r.status] || 'neutral'}>
          {r.status || '—'}
        </Badge>
      ),
      csvValue: r => r.status ?? '',
    },
    {
      key: 'opens_count', label: 'Opens', sortable: true,
      className: 'px-4 py-3 text-gray-400 text-center',
      render: r => r.opens_count ?? 0,
      csvValue: r => r.opens_count ?? 0,
    },
    {
      key: 'clicks_count', label: 'Clicks', sortable: true,
      className: 'px-4 py-3 text-gray-400 text-center',
      render: r => r.clicks_count ?? 0,
      csvValue: r => r.clicks_count ?? 0,
    },
    {
      key: 'last_event_time', label: 'Último Evento', sortable: true,
      className: 'px-4 py-3 text-gray-400 whitespace-nowrap',
      render: r => formatDateTime(r.last_event_time),
      csvValue: r => r.last_event_time ?? '',
    },
    {
      key: 'from_email', label: 'Remetente', sortable: true,
      className: 'px-4 py-3 text-gray-500 text-xs',
      render: r => r.from_email || '—',
      csvValue: r => r.from_email ?? '',
    },
    {
      key: 'msg_id', label: 'Message ID',
      className: 'px-4 py-3 text-gray-600 text-xs font-mono max-w-[120px] truncate',
      render: r => (
        <span className="block max-w-[120px] truncate" title={r.msg_id || ''}>
          {r.msg_id || '—'}
        </span>
      ),
      csvValue: r => r.msg_id ?? '',
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Atividade de E-mails</h1>
        <p className="text-sm text-gray-400 mt-1">
          Histórico de envios via SendGrid
          {data.total > 0 && !loading && (
            <span className="ml-2 text-gray-500">({data.total.toLocaleString('pt-BR')} registros)</span>
          )}
        </p>
      </div>

      {/* Filters */}
      <form onSubmit={applyFilters} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <TxtInput
            placeholder="E-mail destinatário"
            value={filters.email}
            onChange={v => setFilters(f => ({ ...f, email: v }))}
          />
          <TxtInput
            placeholder="Assunto"
            value={filters.subject}
            onChange={v => setFilters(f => ({ ...f, subject: v }))}
          />
          <select
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            className={SEL_CLS}
          >
            <option value="">Todos os status</option>
            {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            type="date"
            value={filters.start_date}
            onChange={e => setFilters(f => ({ ...f, start_date: e.target.value }))}
            className={INP_CLS}
          />
          <input
            type="date"
            value={filters.end_date}
            onChange={e => setFilters(f => ({ ...f, end_date: e.target.value }))}
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
        emptyMessage="Nenhuma atividade encontrada. Use os filtros para buscar."
        page={page}
        perPage={PER_PAGE}
        onPageChange={setPage}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        totalLabel="registro"
        title="EmailActivity"
      />
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
      onChange={e => onChange(e.target.value)}
      className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500 placeholder-gray-500"
    />
  );
}
