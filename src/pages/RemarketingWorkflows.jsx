import { useState, useEffect, useCallback } from 'react';
import { Search, X, Eye, Activity } from 'lucide-react';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import AdminGrid from '@/components/ui/AdminGrid';
import useAdminGrid from '@/utils/useAdminGrid';
import { formatDateTime } from '@/utils/format';
import WorkflowDetailModal from '@/modals/WorkflowDetailModal';

const PER_PAGE = 20;

const STATUS_OPTIONS = [
  'starting',
  'started',
  'submitted',
  'already_started',
  'running',
  'waiting',
  'dispatching',
  'paused',
  'waiting_manual_review',
  'completed',
  'purchased',
  'failed',
  'canceled',
  'skipped',
  'no_sequence',
];

function workflowStatusVariant(status) {
  const s = (status || '').toLowerCase();
  if (['purchased', 'completed'].includes(s)) return 'green';
  if (['failed', 'canceled', 'cancelled'].includes(s)) return 'red';
  if (['paused', 'waiting_manual_review', 'waiting'].includes(s)) return 'yellow';
  if (['running', 'dispatching', 'started', 'submitted', 'already_started', 'starting'].includes(s)) return 'blue';
  return 'gray';
}

const getEmptyFilters = () => ({
  status: '',
  store_id: '',
  lead_id: '',
  start_date: '',
  end_date: '',
});

export default function RemarketingWorkflows() {
  const [stores, setStores] = useState([]);
  const [filters, setFilters] = useState(getEmptyFilters);
  const [applied, setApplied] = useState(getEmptyFilters);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);
  const { page, setPage, sortColumn, sortDirection, handleSort } = useAdminGrid({
    defaultSort: 'updated_at',
    defaultDir: 'desc',
  });

  useEffect(() => {
    api
      .get('/admin/stores')
      .then((r) => setStores(r.data.stores || []))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, per_page: PER_PAGE });
      if (applied.status) params.set('status', applied.status);
      if (applied.store_id) params.set('store_id', applied.store_id);
      if (applied.lead_id) params.set('lead_id', applied.lead_id);
      if (applied.start_date) params.set('start_date', applied.start_date);
      if (applied.end_date) params.set('end_date', applied.end_date);
      params.set('sort_column', sortColumn);
      params.set('sort_direction', sortDirection);
      const res = await api.get(`/admin/remarket/workflows?${params}`);
      setData({ items: res.data.items || [], total: res.data.total || 0 });
    } catch {
      setError('Erro ao carregar workflows.');
    } finally {
      setLoading(false);
    }
  }, [page, applied, sortColumn, sortDirection]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function applyFilters(e) {
    e.preventDefault();
    setPage(1);
    setApplied({ ...filters });
  }

  function clearFilters() {
    const empty = getEmptyFilters();
    setFilters(empty);
    setApplied(empty);
    setPage(1);
  }

  const columns = [
    {
      key: 'workflow_id',
      label: 'Workflow',
      sortable: false,
      render: (r) => (
        <code className="text-xs text-gray-400" title={r.workflow_id}>
          {(r.workflow_id || '').slice(-24)}
        </code>
      ),
      csvValue: (r) => r.workflow_id ?? '',
    },
    {
      key: 'lead_id',
      label: 'Lead',
      sortable: true,
      render: (r) => (
        <div className="flex flex-col">
          <span className="text-xs font-mono text-gray-500">#{r.lead_id}</span>
          {r.lead_email && <span className="text-xs text-gray-300 truncate max-w-45">{r.lead_email}</span>}
          {r.lead_phone && <span className="text-xs text-gray-500">{r.lead_phone}</span>}
        </div>
      ),
      csvValue: (r) => `${r.lead_id} ${r.lead_email || ''}`,
    },
    {
      key: 'store_id',
      label: 'Loja',
      sortable: true,
      render: (r) => r.store_name || `#${r.store_id || '?'}`,
      csvValue: (r) => r.store_name ?? '',
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (r) => <Badge variant={workflowStatusVariant(r.status)}>{r.status || '—'}</Badge>,
      csvValue: (r) => r.status ?? '',
    },
    {
      key: 'attempts',
      label: 'Tent.',
      sortable: false,
      render: (r) => (
        <span className="text-xs text-gray-400">
          {r.attempts || 0}
          {r.sequence_size ? ` / ${r.sequence_size}` : ''}
        </span>
      ),
      csvValue: (r) => r.attempts ?? 0,
    },
    {
      key: 'created_at',
      label: 'Criado',
      sortable: true,
      className: 'px-4 py-3 text-gray-400 whitespace-nowrap',
      render: (r) => formatDateTime(r.created_at),
      csvValue: (r) => r.created_at ?? '',
    },
    {
      key: 'updated_at',
      label: 'Atualizado',
      sortable: true,
      className: 'px-4 py-3 text-gray-400 whitespace-nowrap',
      render: (r) => formatDateTime(r.updated_at),
      csvValue: (r) => r.updated_at ?? '',
    },
    {
      key: 'actions',
      label: 'Ações',
      sortable: false,
      render: (r) => (
        <button
          onClick={() => setSelectedWorkflowId(r.workflow_id)}
          title="Ver detalhes do workflow"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
        >
          <Eye className="h-3.5 w-3.5" /> Ver
        </button>
      ),
    },
  ];

  return (
    <div>
      {selectedWorkflowId && (
        <WorkflowDetailModal
          workflowId={selectedWorkflowId}
          onClose={() => setSelectedWorkflowId(null)}
          onChange={fetchData}
        />
      )}

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <Activity className="h-5 w-5 text-violet-400" />
          Workflows de Remarketing
        </h1>
        <p className="text-sm text-gray-400 mt-1">Monitor em tempo real dos disparos automáticos por lead.</p>
      </div>

      <form onSubmit={applyFilters} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
          >
            <option value="">Todos os status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={filters.store_id}
            onChange={(e) => setFilters((f) => ({ ...f, store_id: e.target.value }))}
            className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
          >
            <option value="">Todas as lojas</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Lead ID"
            value={filters.lead_id}
            onChange={(e) => setFilters((f) => ({ ...f, lead_id: e.target.value }))}
            className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
          />
          <input
            type="date"
            value={filters.start_date}
            onChange={(e) => setFilters((f) => ({ ...f, start_date: e.target.value }))}
            className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
          />
          <input
            type="date"
            value={filters.end_date}
            onChange={(e) => setFilters((f) => ({ ...f, end_date: e.target.value }))}
            className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
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
        emptyMessage="Nenhum workflow encontrado."
        page={page}
        perPage={PER_PAGE}
        onPageChange={setPage}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        totalLabel="workflow"
        title="Workflows"
      />
    </div>
  );
}
