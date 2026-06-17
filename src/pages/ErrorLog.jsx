import { useState, useEffect, useCallback } from 'react';
import { Search, X, ScrollText } from 'lucide-react';
import api from '@/services/api';
import AdminGrid from '@/components/ui/AdminGrid';
import DetailModal from '@/components/ui/DetailModal';
import { formatDateTime } from '@/utils/format';
import useAdminGrid from '@/utils/useAdminGrid';

const PER_PAGE = 20;

const EMPTY_FILTERS = { file: '', method: '', project: '', start_date: '', end_date: '', status: '' };

export default function ErrorLog() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [data, setData]       = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [projects, setProjects] = useState([]);

  // Modais: mensagem inteira e logs/stacktraces.
  const [msgModal, setMsgModal]   = useState(null);   // { title, text } | null
  const [logsModal, setLogsModal] = useState(null);   // { id, items, loading, error } | null
  const [detailModal, setDetailModal] = useState(null); // row object | null
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchUpdating, setBatchUpdating] = useState(false);

  const { page, setPage, sortColumn, sortDirection, handleSort } =
    useAdminGrid({ defaultSort: 'time', defaultDir: 'desc' });

  const openLogs = useCallback(async (row) => {
    setLogsModal({ id: row.id, items: [], loading: true });
    try {
      const res = await api.get(`/admin/errors/${row.id}/logs`);
      setLogsModal({ id: row.id, items: res.data.items || [], loading: false });
    } catch {
      setLogsModal({ id: row.id, items: [], loading: false, error: true });
    }
  }, []);

  const handleBatchStatus = useCallback(async (status) => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBatchUpdating(true);
    try {
      await api.put('/admin/errors/status', { ids, status });
      setSelectedIds(new Set());
      fetchData();
    } catch {
      // silent
    } finally {
      setBatchUpdating(false);
    }
  }, [selectedIds, fetchData]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page,
        per_page: PER_PAGE,
        sort_column: sortColumn,
        sort_direction: sortDirection,
      });
      if (applied.file)       params.set('file',       applied.file);
      if (applied.method)     params.set('method',     applied.method);
      if (applied.project)    params.set('project',    applied.project);
      if (applied.start_date) params.set('start_date', applied.start_date);
      if (applied.end_date)   params.set('end_date',   applied.end_date);
      if (applied.status)     params.set('status',     applied.status);
      const res = await api.get(`/admin/errors?${params}`);
      setData({ items: res.data.items || [], total: res.data.total || 0 });
    } catch {
      setError('Erro ao carregar log de erros.');
    } finally {
      setLoading(false);
    }
  }, [page, applied, sortColumn, sortDirection]);

  useEffect(() => {
    fetchData();
    setSelectedIds(new Set());
  }, [fetchData]);

  useEffect(() => {
    api.get('/admin/errors/projects').then(res => {
      setProjects(res.data?.projects || []);
    }).catch(() => {});
  }, []);

  function applyFilters(e) { e.preventDefault(); setPage(1); setApplied({ ...filters }); setSelectedIds(new Set()); }
  function clearFilters()  { setFilters(EMPTY_FILTERS); setApplied(EMPTY_FILTERS); setPage(1); setSelectedIds(new Set()); }

  const allSelected = data.items.length > 0 && selectedIds.size === data.items.length;

  function handleSelectOne(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.items.map(r => r.id)));
    }
  }

  const columns = [
    {
      key: 'checkbox', label: '',
      className: 'px-4 py-3 text-center w-12',
      headerRender: () => (
        <input
          type="checkbox"
          checked={allSelected}
          onChange={handleSelectAll}
          className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-violet-600 focus:ring-violet-500"
        />
      ),
      render: r => (
        <input
          type="checkbox"
          checked={selectedIds.has(r.id)}
          onChange={() => handleSelectOne(r.id)}
          className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-violet-600 focus:ring-violet-500"
        />
      ),
    },
    {
      key: 'status', label: 'Status', sortable: true,
      className: 'px-4 py-3 text-center w-24',
      render: r => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
          r.status === 'open'
            ? 'bg-emerald-900/60 text-emerald-400'
            : 'bg-gray-700 text-gray-400'
        }`}>
          {r.status === 'open' ? 'Aberto' : 'Fechado'}
        </span>
      ),
      csvValue: r => r.status === 'open' ? 'Aberto' : 'Fechado',
    },
    {
      key: 'time', label: 'Data/Hora', sortable: true,
      className: 'px-4 py-3 text-gray-400 whitespace-nowrap text-sm',
      render: r => formatDateTime(r.time),
      csvValue: r => r.time ?? '',
    },
    {
      key: 'file', label: 'Arquivo', sortable: true,
      className: 'px-4 py-3 text-gray-300 text-sm',
      render: r => r.file || '—',
      csvValue: r => r.file ?? '',
    },
    {
      key: 'method', label: 'Método', sortable: true,
      className: 'px-4 py-3 text-gray-300 text-sm',
      render: r => r.method || '—',
      csvValue: r => r.method ?? '',
    },
    {
      key: 'message', label: 'Mensagem',
      className: 'px-4 py-3 text-gray-400 text-xs max-w-[220px]',
      render: r => r.message ? (
        <button
          type="button"
          onClick={() => setMsgModal({ title: `Mensagem — erro #${r.id}`, text: r.message })}
          className="block w-full max-w-[220px] truncate text-left text-violet-300 hover:text-violet-200 hover:underline transition-colors"
          title="Ver mensagem completa"
        >
          {r.message}
        </button>
      ) : '—',
      csvValue: r => r.message ?? '',
    },
    {
      key: 'logs', label: 'Logs',
      className: 'px-4 py-3 text-center w-16',
      render: r => (r.logs_count > 0 ? (
        <button
          type="button"
          onClick={() => openLogs(r)}
          className="inline-flex items-center gap-1 text-violet-300 hover:text-violet-200 transition-colors"
          title={`Ver ${r.logs_count} log(s)`}
        >
          <ScrollText className="h-4 w-4" />
          <span className="text-xs">{r.logs_count}</span>
        </button>
      ) : <span className="text-gray-600">—</span>),
      csvValue: r => r.logs_count ?? 0,
    },
    {
      key: 'project', label: 'Projeto',
      className: 'px-4 py-3 text-gray-400 text-xs whitespace-nowrap',
      render: r => r.project || '—',
      csvValue: r => r.project ?? '',
    },
    {
      key: 'visualizar', label: '',
      className: 'px-4 py-3 text-center w-16',
      render: r => (
        <button
          type="button"
          onClick={() => setDetailModal(r)}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
          title="Visualizar detalhes completos"
        >
          Visualizar
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Log de Erros</h1>
        <p className="text-sm text-gray-400 mt-1">
          Erros de frontend registrados automaticamente
          {data.total > 0 && !loading && (
            <span className="ml-2 text-gray-500">({data.total.toLocaleString('pt-BR')} registros)</span>
          )}
        </p>
      </div>

      {/* Filters */}
      <form onSubmit={applyFilters} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Projeto</label>
            <select
              value={filters.project}
              onChange={e => setFilters(f => ({ ...f, project: e.target.value }))}
              className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
            >
              <option value="">Todos os projetos</option>
              {projects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Arquivo</label>
            <input
              type="text"
              placeholder="utils.js"
              value={filters.file}
              onChange={e => setFilters(f => ({ ...f, file: e.target.value }))}
              className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 w-36 focus:outline-none focus:border-violet-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Método</label>
            <input
              type="text"
              placeholder="efetuarPagamento"
              value={filters.method}
              onChange={e => setFilters(f => ({ ...f, method: e.target.value }))}
              className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 w-44 focus:outline-none focus:border-violet-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Status</label>
            <select
              value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
              className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
            >
              <option value="">Todos</option>
              <option value="open">Aberto</option>
              <option value="close">Fechado</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">De</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={e => setFilters(f => ({ ...f, start_date: e.target.value }))}
              className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Até</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={e => setFilters(f => ({ ...f, end_date: e.target.value }))}
              className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
            />
          </div>
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

      {/* Batch actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-gray-800/80 border border-gray-700 rounded-xl">
          <span className="text-sm text-gray-300">{selectedIds.size} selecionado(s)</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={batchUpdating}
              onClick={() => handleBatchStatus('open')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white transition-colors"
            >
              Marcar como Aberto
            </button>
            <button
              type="button"
              disabled={batchUpdating}
              onClick={() => handleBatchStatus('close')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white transition-colors"
            >
              Marcar como Fechado
            </button>
          </div>
        </div>
      )}

      <AdminGrid
        columns={columns}
        data={data}
        loading={loading}
        error={error}
        emptyMessage="Nenhum erro encontrado."
        page={page}
        perPage={PER_PAGE}
        onPageChange={setPage}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        totalLabel="erro"
        title="erros"
      />

      {/* Modal: mensagem inteira */}
      {msgModal && (
        <DetailModal
          title={msgModal.title}
          text={msgModal.text}
          onClose={() => setMsgModal(null)}
        />
      )}

      {/* Modal: logs / stacktraces */}
      {logsModal && (
        <DetailModal
          title={`Logs — erro #${logsModal.id}`}
          onClose={() => setLogsModal(null)}
        >
          {logsModal.loading ? (
            <p className="text-sm text-gray-400">Carregando logs…</p>
          ) : logsModal.error ? (
            <p className="text-sm text-red-400">Erro ao carregar logs.</p>
          ) : logsModal.items.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum log anexado a este erro.</p>
          ) : (
            <div className="space-y-4">
              {logsModal.items.map((lg, i) => (
                <div key={lg.id ?? i} className="border border-gray-700 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900/60 text-xs text-gray-400">
                    <span>Log {i + 1}{lg.created_at ? ` · ${lg.created_at}` : ''}</span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(lg.content || '')}
                      className="hover:text-gray-200 transition-colors"
                      title="Copiar este log"
                    >
                      Copiar
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap break-words font-mono text-xs text-gray-300 p-3 leading-relaxed">
                    {lg.content || '—'}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </DetailModal>
      )}

      {/* Modal: detalhes completos */}
      {detailModal && (
        <DetailModal
          title={`Erro #${detailModal.id}`}
          onClose={() => setDetailModal(null)}
        >
          <div className="space-y-3 text-sm">
            <DetailField label="ID" value={detailModal.id} />
            <DetailField label="Status" value={detailModal.status === 'open' ? 'Aberto' : 'Fechado'} />
            <DetailField label="Data/Hora" value={formatDateTime(detailModal.time)} />
            <DetailField label="Arquivo" value={detailModal.file || '—'} />
            <DetailField label="Método" value={detailModal.method || '—'} />
            <DetailField label="Mensagem" value={detailModal.message || '—'} mono />
            <DetailField label="Projeto" value={detailModal.project || '—'} />
            <DetailField label="Plataforma" value={detailModal.platform || '—'} />
            <DetailField label="Tela" value={detailModal.screen || '—'} />
            <DetailField label="User-Agent" value={detailModal.user_agent || '—'} />
            <DetailField label="Página" value={detailModal.page_url || '—'} />
          </div>
        </DetailModal>
      )}
    </div>
  );
}

function DetailField({ label, value, mono }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-gray-500 text-xs uppercase tracking-wider">{label}</span>
      {mono ? (
        <pre className="whitespace-pre-wrap break-words font-mono text-xs text-gray-200 leading-relaxed bg-gray-900/50 rounded-lg p-2 max-h-32 overflow-auto">
          {value}
        </pre>
      ) : (
        <span className="text-gray-200 break-words">{value}</span>
      )}
    </div>
  );
}
