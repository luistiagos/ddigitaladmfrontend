import { useState, useEffect, useCallback } from 'react';
import { Search, X, RefreshCw, RotateCcw } from 'lucide-react';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import AdminGrid from '@/components/ui/AdminGrid';
import { EmailCell } from '@/components/ui/ContactCell';
import { formatDateTime } from '@/utils/format';
import useAdminGrid from '@/utils/useAdminGrid';

const PER_PAGE = 20;

const ALL_STATUSES = ['pending', 'sent', 'delivered', 'failed', 'bounced', 'dropped'];

const STATUS_VARIANT = {
  pending:   'yellow',
  sent:      'blue',
  delivered: 'green',
  failed:    'red',
  bounced:   'red',
  dropped:   'red',
};

const EMPTY_FILTERS = { status: '' };

export default function EmailQueue() {
  const [filters, setFilters]   = useState(EMPTY_FILTERS);
  const [applied, setApplied]   = useState(EMPTY_FILTERS);
  const [data, setData]         = useState({ items: [], total: 0 });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [actionMsg, setActionMsg] = useState('');

  const { page, setPage, sortColumn, sortDirection, handleSort } =
    useAdminGrid({ defaultSort: 'created_at', defaultDir: 'desc' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, per_page: PER_PAGE });
      if (applied.status) params.set('status', applied.status);
      params.set('sort_column', sortColumn);
      params.set('sort_direction', sortDirection);
      const res = await api.get(`/admin/email_queue?${params}`);
      setData({ items: res.data.items || [], total: res.data.total || 0 });
    } catch {
      setError('Erro ao carregar fila de emails.');
    } finally {
      setLoading(false);
    }
  }, [page, applied, sortColumn, sortDirection]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function applyFilters(e) { e.preventDefault(); setPage(1); setApplied({ ...filters }); }
  function clearFilters()  { setFilters(EMPTY_FILTERS); setApplied(EMPTY_FILTERS); setPage(1); }

  async function handleRetry(id) {
    setActionMsg('');
    try {
      const res = await api.post(`/admin/email_queue/${id}/retry`);
      setActionMsg(res.data.success ? `✓ Email ${id} reenviado com sucesso.` : `✗ ${res.data.error}`);
    } catch {
      setActionMsg(`✗ Erro ao reenviar email ${id}.`);
    }
    fetchData();
  }

  async function handleReset(id) {
    setActionMsg('');
    try {
      await api.post(`/admin/email_queue/${id}/reset`);
      setActionMsg(`✓ Item ${id} resetado para pending.`);
    } catch {
      setActionMsg(`✗ Erro ao resetar item ${id}.`);
    }
    fetchData();
  }

  const columns = [
    {
      key: 'id', label: 'ID', sortable: true,
      className: 'px-4 py-3 text-gray-400 text-xs w-16',
      render: r => r.id,
      csvValue: r => r.id,
    },
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
        <Badge variant={STATUS_VARIANT[r.status] || 'neutral'}>{r.status || '—'}</Badge>
      ),
      csvValue: r => r.status ?? '',
    },
    {
      key: 'attempts', label: 'Tent.', sortable: true,
      className: 'px-4 py-3 text-gray-400 text-center text-sm',
      render: r => `${r.attempts ?? 0}/${r.max_attempts ?? 5}`,
      csvValue: r => r.attempts ?? 0,
    },
    {
      key: 'original_error', label: 'Erro original',
      className: 'px-4 py-3 text-gray-500 text-xs max-w-[200px]',
      render: r => (
        <span className="block truncate" title={r.original_error || ''}>
          {r.original_error || '—'}
        </span>
      ),
      csvValue: r => r.original_error ?? '',
    },
    {
      key: 'next_attempt_at', label: 'Próx. tentativa', sortable: true,
      className: 'px-4 py-3 text-gray-400 whitespace-nowrap text-sm',
      render: r => r.status === 'pending' ? formatDateTime(r.next_attempt_at) : '—',
      csvValue: r => r.next_attempt_at ?? '',
    },
    {
      key: 'created_at', label: 'Criado em', sortable: true,
      className: 'px-4 py-3 text-gray-400 whitespace-nowrap text-sm',
      render: r => formatDateTime(r.created_at),
      csvValue: r => r.created_at ?? '',
    },
    {
      key: '_actions', label: 'Ações',
      className: 'px-4 py-3 whitespace-nowrap',
      render: r => (
        <div className="flex gap-2">
          <button
            onClick={() => handleRetry(r.id)}
            title="Reenviar agora"
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-violet-700 hover:bg-violet-600 text-white transition-colors"
          >
            <RefreshCw className="h-3 w-3" /> Reenviar
          </button>
          {['bounced', 'dropped', 'failed'].includes(r.status) && (
            <button
              onClick={() => handleReset(r.id)}
              title="Resetar para pending"
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </div>
      ),
      csvValue: () => '',
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Fila de Reenvio de Emails</h1>
        <p className="text-sm text-gray-400 mt-1">
          Emails que falharam no envio e aguardam reenvio automático
          {data.total > 0 && !loading && (
            <span className="ml-2 text-gray-500">({data.total.toLocaleString('pt-BR')} registros)</span>
          )}
        </p>
      </div>

      {actionMsg && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${actionMsg.startsWith('✓') ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
          {actionMsg}
        </div>
      )}

      {/* Filters */}
      <form onSubmit={applyFilters} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <select
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
          >
            <option value="">Todos os status</option>
            {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
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
        emptyMessage="Nenhum item na fila de reenvio."
        page={page}
        perPage={PER_PAGE}
        onPageChange={setPage}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        totalLabel="registro"
        title="EmailQueue"
      />
    </div>
  );
}
