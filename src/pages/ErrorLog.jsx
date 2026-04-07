import { useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import api from '@/services/api';
import AdminGrid from '@/components/ui/AdminGrid';
import { formatDateTime } from '@/utils/format';
import useAdminGrid from '@/utils/useAdminGrid';

const PER_PAGE = 20;

const EMPTY_FILTERS = { file: '', method: '', project: '', start_date: '', end_date: '' };

const KNOWN_PROJECTS = [
  'emuladores.github.io',
  'digitalmemberarea.digitalstoregames.com',
];

export default function ErrorLog() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [data, setData]       = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const { page, setPage, sortColumn, sortDirection, handleSort } =
    useAdminGrid({ defaultSort: 'time', defaultDir: 'desc' });

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
      const res = await api.get(`/admin/errors?${params}`);
      setData({ items: res.data.items || [], total: res.data.total || 0 });
    } catch {
      setError('Erro ao carregar log de erros.');
    } finally {
      setLoading(false);
    }
  }, [page, applied, sortColumn, sortDirection]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function applyFilters(e) { e.preventDefault(); setPage(1); setApplied({ ...filters }); }
  function clearFilters()  { setFilters(EMPTY_FILTERS); setApplied(EMPTY_FILTERS); setPage(1); }

  const columns = [
    {
      key: 'id', label: 'ID', sortable: true,
      className: 'px-4 py-3 text-gray-400 text-xs w-16',
      render: r => r.id,
      csvValue: r => r.id,
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
      render: r => (
        <span className="block truncate" title={r.message || ''}>
          {r.message || '—'}
        </span>
      ),
      csvValue: r => r.message ?? '',
    },
    {
      key: 'project', label: 'Projeto',
      className: 'px-4 py-3 text-gray-400 text-xs whitespace-nowrap',
      render: r => r.project || '—',
      csvValue: r => r.project ?? '',
    },
    {
      key: 'platform', label: 'Plataforma',
      className: 'px-4 py-3 text-gray-400 text-xs whitespace-nowrap',
      render: r => r.platform || '—',
      csvValue: r => r.platform ?? '',
    },
    {
      key: 'screen', label: 'Tela',
      className: 'px-4 py-3 text-gray-400 text-xs whitespace-nowrap',
      render: r => r.screen || '—',
      csvValue: r => r.screen ?? '',
    },
    {
      key: 'user_agent', label: 'User-Agent',
      className: 'px-4 py-3 text-gray-500 text-xs max-w-[200px]',
      render: r => (
        <span className="block truncate" title={r.user_agent || ''}>
          {r.user_agent || '—'}
        </span>
      ),
      csvValue: r => r.user_agent ?? '',
    },
    {
      key: 'page_url', label: 'Página',
      className: 'px-4 py-3 text-gray-500 text-xs max-w-[180px]',
      render: r => r.page_url ? (
        <a
          href={r.page_url}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-violet-400 hover:text-violet-300 transition-colors"
          title={r.page_url}
        >
          {r.page_url}
        </a>
      ) : '—',
      csvValue: r => r.page_url ?? '',
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
              {KNOWN_PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
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
    </div>
  );
}
