import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, X, Loader2, Tag } from 'lucide-react';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AdminGrid from '@/components/ui/AdminGrid';
import useAdminGrid from '@/utils/useAdminGrid';

const EMPTY_FORM = { name: '', discount: '', product_id: '', valid_date: '' };

export default function Coupons() {
  const [cupons, setCupons] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { sortColumn, sortDirection, handleSort } =
    useAdminGrid({ defaultSort: 'name', defaultDir: 'asc' });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = create, object = edit
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCupons = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/cupons');
      setCupons(res.data.cupons || []);
    } catch {
      setError('Erro ao carregar cupons.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCupons();
    api.get('/admin/items?per_page=100')
      .then((r) => setProducts(r.data.items || []))
      .catch(() => {});
  }, [fetchCupons]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(c) {
    setEditing(c);
    setForm({
      name: c.name,
      // discount is stored as 0-1 float, display as %
      discount: c.discount != null ? String(Math.round(c.discount * 100)) : '',
      product_id: c.product_id ? String(c.product_id) : '',
      valid_date: c.valid_date || '',
    });
    setFormError('');
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError('');
    const name = form.name.trim();
    if (!name) { setFormError('Informe o código do cupom.'); return; }
    const discountNum = parseFloat(form.discount);
    if (isNaN(discountNum) || discountNum <= 0 || discountNum > 100) {
      setFormError('Desconto deve ser entre 1 e 100.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        discount: discountNum,
        product_id: form.product_id ? parseInt(form.product_id, 10) : 0,
        valid_date: form.valid_date || null,
      };
      if (editing) {
        await api.put(`/admin/cupons/${editing.id}`, payload);
      } else {
        await api.post('/admin/cupons', payload);
      }
      setModalOpen(false);
      fetchCupons();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Erro ao salvar cupom.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/cupons/${toDelete.id}`);
      setToDelete(null);
      fetchCupons();
    } catch {
      alert('Erro ao excluir cupom.');
    } finally {
      setDeleting(false);
    }
  }

  const sortedCupons = useMemo(() => {
    return [...cupons].sort((a, b) => {
      const v1 = sortColumn === 'discount' ? (a.discount ?? 0) : String(a[sortColumn] == null ? '' : a[sortColumn]).toLowerCase();
      const v2 = sortColumn === 'discount' ? (b.discount ?? 0) : String(b[sortColumn] == null ? '' : b[sortColumn]).toLowerCase();
      if (v1 < v2) return sortDirection === 'asc' ? -1 : 1;
      if (v1 > v2) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [cupons, sortColumn, sortDirection]);

  const columns = [
    {
      key: 'name', label: 'Código', sortable: true,
      render: r => (
        <span className="inline-flex items-center gap-1.5 font-mono text-xs bg-gray-700 text-violet-300 px-2 py-1 rounded">
          <Tag className="h-3 w-3" />{r.name}
        </span>
      ),
      csvValue: r => r.name ?? '',
    },
    {
      key: 'discount', label: 'Desconto', sortable: true,
      render: r => <Badge variant="green">{Math.round((r.discount || 0) * 100)}% OFF</Badge>,
      csvValue: r => `${Math.round((r.discount || 0) * 100)}%`,
    },
    {
      key: 'product_title', label: 'Produto', sortable: true,
      render: r => r.product_title || <span className="text-gray-500 text-xs">Todos os produtos</span>,
      csvValue: r => r.product_title || 'Todos os produtos',
    },
    {
      key: 'valid_date', label: 'Validade', sortable: true,
      className: 'px-4 py-3 text-gray-400',
      render: r => r.valid_date
        ? new Date(r.valid_date + 'T00:00:00').toLocaleDateString('pt-BR')
        : <span className="text-gray-600 text-xs">Sem validade</span>,
      csvValue: r => r.valid_date
        ? new Date(r.valid_date + 'T00:00:00').toLocaleDateString('pt-BR')
        : 'Sem validade',
    },
    {
      key: 'actions', label: 'Ações',
      render: r => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEdit(r)}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
          <button
            onClick={() => setToDelete(r)}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
        </div>
      ),
      csvValue: () => '',
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Cupons</h1>
          <p className="text-sm text-gray-400 mt-1">Gerenciamento de cupons de desconto</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" /> Novo Cupom
        </button>
      </div>

      <AdminGrid
        columns={columns}
        data={{ items: sortedCupons, total: sortedCupons.length }}
        loading={loading}
        error={error}
        emptyMessage="Nenhum cupom cadastrado."
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        totalLabel="cupom"
        title="Cupons"
      />

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="font-semibold text-white">
                {editing ? 'Editar Cupom' : 'Novo Cupom'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Código do Cupom *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.toUpperCase() }))}
                  placeholder="ex: DESCONTO50"
                  className="w-full bg-gray-700/50 border border-gray-600 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-500 placeholder-gray-500 uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Desconto % *</label>
                <input
                  type="number"
                  min="1" max="100" step="1"
                  value={form.discount}
                  onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))}
                  placeholder="ex: 50"
                  className="w-full bg-gray-700/50 border border-gray-600 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-500 placeholder-gray-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Ex: 50 = 50% de desconto</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Produto (opcional)</label>
                <select
                  value={form.product_id}
                  onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))}
                  className="w-full bg-gray-700/50 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-500"
                >
                  <option value="">Todos os produtos</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Data de Validade (opcional)</label>
                <input
                  type="date"
                  value={form.valid_date}
                  onChange={(e) => setForm((f) => ({ ...f, valid_date: e.target.value }))}
                  className="w-full bg-gray-700/50 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-500"
                />
                <p className="text-xs text-gray-500 mt-1">Deixe vazio para sem validade</p>
              </div>

              {formError && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{formError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm rounded-lg transition-colors"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {editing ? 'Salvar alterações' : 'Criar cupom'}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {toDelete && (
        <ConfirmModal
          title="Excluir cupom"
          message={`Tem certeza que deseja excluir o cupom "${toDelete.name}"? Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          destructive
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}


