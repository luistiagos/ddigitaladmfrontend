import { useState, useEffect, useCallback } from 'react';
import { Search, X, UserCheck, UserX, Eye } from 'lucide-react';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AdminGrid from '@/components/ui/AdminGrid';
import { EmailCell, PhoneCell } from '@/components/ui/ContactCell';
import ClientProductsModal from '@/modals/ClientProductsModal';
import useAdminGrid from '@/utils/useAdminGrid';

const PER_PAGE = 20;

const EMPTY_FILTERS = { email: '', phone: '', product_id: '', store_id: '', start_date: '', end_date: '' };

export default function Clients() {
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [toToggle, setToToggle] = useState(null);
  const [toggling, setToggling] = useState(false);
  const { page, setPage, sortColumn, sortDirection, handleSort } =
    useAdminGrid({ defaultSort: 'created_at', defaultDir: 'desc' });

  // load products for filter dropdown
  useEffect(() => {
    api.get('/admin/items?per_page=100')
      .then((res) => setProducts(res.data.items || []))
      .catch(() => {});
    api.get('/admin/stores')
      .then((res) => setStores(res.data.stores || []))
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
      if (applied.store_id) params.set('store_id', applied.store_id);
      if (applied.start_date) params.set('start_date', applied.start_date);
      if (applied.end_date) params.set('end_date', applied.end_date);
      params.set('sort_column', sortColumn);
      params.set('sort_direction', sortDirection);
      const res = await api.get(`/admin/clients?${params}`);
      setData({ items: res.data.items || [], total: res.data.total || 0 });
    } catch {
      setError('Erro ao carregar clientes.');
    } finally {
      setLoading(false);
    }
  }, [page, applied, sortColumn, sortDirection]);

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
      key: 'status', label: 'Status',
      render: r => <Badge variant={r.active ? 'green' : 'gray'}>{r.active ? 'Ativo' : 'Inativo'}</Badge>,
      csvValue: r => r.active ? 'Ativo' : 'Inativo',
    },
    {
      key: 'actions', label: 'Ações',
      render: r => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedClient(r)}
            title="Ver produtos"
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" /> Ver
          </button>
          <button
            onClick={() => setToToggle(r)}
            title={r.active ? 'Desativar' : 'Ativar'}
            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
              r.active
                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                : 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
            }`}
          >
            {r.active
              ? <><UserX className="h-3.5 w-3.5" /> Desativar</>
              : <><UserCheck className="h-3.5 w-3.5" /> Ativar</>}
          </button>
        </div>
      ),
      csvValue: () => '',
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Clientes</h1>
        <p className="text-sm text-gray-400 mt-1">Busca e gerenciamento de clientes cadastrados</p>
      </div>

      {/* Filters */}
      <form onSubmit={applyFilters} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
          <select
            value={filters.store_id}
            onChange={(e) => setFilters((f) => ({ ...f, store_id: e.target.value }))}
            className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
          >
            <option value="">Todas as lojas</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
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

      <AdminGrid
        columns={columns}
        data={data}
        loading={loading}
        error={error}
        emptyMessage="Nenhum cliente encontrado."
        page={page}
        perPage={PER_PAGE}
        onPageChange={setPage}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        totalLabel="cliente"
        title="Clientes"
      />

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

function Input({ placeholder, value, onChange }) {
  return (
    <input type="text" placeholder={placeholder} value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500 placeholder-gray-500" />
  );
}
