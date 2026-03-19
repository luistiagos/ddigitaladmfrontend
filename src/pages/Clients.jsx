import { useState, useEffect, useCallback } from 'react';
import { Search, X, UserCheck, UserX, Eye } from 'lucide-react';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { LoadingRows, EmptyRow, ErrorRow } from '@/components/ui/TableStates';
import { formatDate } from '@/utils/format';
import ClientProductsModal from '@/modals/ClientProductsModal';

const PER_PAGE = 20;

const EMPTY_FILTERS = { email: '', phone: '', product_id: '', start_date: '', end_date: '' };

export default function Clients() {
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedClient, setSelectedClient] = useState(null); // for ClientProductsModal
  const [toToggle, setToToggle] = useState(null); // { id, email, active } for ConfirmModal
  const [toggling, setToggling] = useState(false);

  // load products for filter dropdown
  useEffect(() => {
    api.get('/admin/items?per_page=100')
      .then((res) => setProducts(res.data.items || []))
      .catch(() => {});
  }, []);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, per_page: PER_PAGE });
      if (applied.email) params.set('email', applied.email);
      if (applied.phone) params.set('phone', applied.phone);
      if (applied.product_id) params.set('product_id', applied.product_id);
      if (applied.start_date) params.set('start_date', applied.start_date);
      if (applied.end_date) params.set('end_date', applied.end_date);
      const res = await api.get(`/admin/clients?${params}`);
      setData({ items: res.data.items || [], total: res.data.total || 0 });
    } catch {
      setError('Erro ao carregar clientes.');
    } finally {
      setLoading(false);
    }
  }, [page, applied]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  function applyFilters(e) {
    e.preventDefault();
    setPage(1);
    setApplied({ ...filters });
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  }

  async function confirmToggle() {
    if (!toToggle) return;
    setToggling(true);
    try {
      await api.patch(`/admin/clients/${toToggle.id}/status`, { active: !toToggle.active });
      setToToggle(null);
      fetchClients();
    } catch {
      alert('Erro ao atualizar status do cliente.');
    } finally {
      setToggling(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Clientes</h1>
        <p className="text-sm text-gray-400 mt-1">Busca e gerenciamento de clientes cadastrados</p>
      </div>

      {/* Filters */}
      <form onSubmit={applyFilters} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Input
            placeholder="E-mail"
            value={filters.email}
            onChange={(v) => setFilters((f) => ({ ...f, email: v }))}
          />
          <Input
            placeholder="Telefone"
            value={filters.phone}
            onChange={(v) => setFilters((f) => ({ ...f, phone: v }))}
          />
          <select
            value={filters.product_id}
            onChange={(e) => setFilters((f) => ({ ...f, product_id: e.target.value }))}
            className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
          >
            <option value="">Todos os produtos</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
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
        <div className="flex items-center gap-2 mt-3">
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

      {/* Table */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <Th>E-mail</Th>
                <Th>WhatsApp</Th>
                <Th>Cadastro</Th>
                <Th>Status</Th>
                <Th>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {loading && <LoadingRows cols={5} />}
              {!loading && error && <ErrorRow cols={5} message={error} />}
              {!loading && !error && data.items.length === 0 && (
                <EmptyRow cols={5} message="Nenhum cliente encontrado." />
              )}
              {!loading && !error &&
                data.items.map((client) => (
                  <tr key={client.id} className="border-b border-gray-800/60 hover:bg-gray-700/20 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{client.email}</td>
                    <td className="px-4 py-3 text-gray-300">{client.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{formatDate(client.created_at)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={client.active ? 'green' : 'gray'}>
                        {client.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedClient(client)}
                          title="Ver produtos"
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" /> Ver
                        </button>
                        <button
                          onClick={() => setToToggle(client)}
                          title={client.active ? 'Desativar' : 'Ativar'}
                          className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                            client.active
                              ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                              : 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
                          }`}
                        >
                          {client.active
                            ? <><UserX className="h-3.5 w-3.5" /> Desativar</>
                            : <><UserCheck className="h-3.5 w-3.5" /> Ativar</>
                          }
                        </button>
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

      {/* Confirm toggle modal */}
      {toToggle && toToggle.active && (
        <ConfirmModal
          title="Desativar cliente"
          message={`Tem certeza que deseja desativar "${toToggle.email}"? Ele perderá acesso à área do cliente.`}
          confirmLabel="Desativar"
          destructive
          loading={toggling}
          onConfirm={confirmToggle}
          onCancel={() => setToToggle(null)}
        />
      )}
      {toToggle && !toToggle.active && (
        <ConfirmModal
          title="Ativar cliente"
          message={`Deseja reativar o acesso de "${toToggle.email}"?`}
          confirmLabel="Ativar"
          loading={toggling}
          onConfirm={confirmToggle}
          onCancel={() => setToToggle(null)}
        />
      )}

      {/* Client products modal */}
      {selectedClient && (
        <ClientProductsModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
        />
      )}
    </div>
  );
}

function Th({ children }) {
  return <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{children}</th>;
}

function Input({ placeholder, value, onChange }) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500 placeholder-gray-500"
    />
  );
}
