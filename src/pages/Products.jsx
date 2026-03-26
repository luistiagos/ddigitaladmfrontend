import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, X, Loader2, Package } from 'lucide-react';
import api from '@/services/api';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AdminGrid from '@/components/ui/AdminGrid';
import useAdminGrid from '@/utils/useAdminGrid';
import { formatCurrency } from '@/utils/format';

const EMPTY_FORM = {
  title: '', price: '', image: '',
  deliverlink: '', purchaselink: '',
  add_pkg: '', prd_content: '',
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { page, setPage, sortColumn, sortDirection, handleSort } =
    useAdminGrid({ defaultSort: 'title', defaultDir: 'asc' });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const PER_PAGE = 20;

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/items', { params: { page, per_page: PER_PAGE } });
      setProducts(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch {
      setError('Erro ao carregar produtos.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({
      title: p.title || '',
      price: p.price != null ? String(p.price) : '',
      image: p.image || '',
      deliverlink: p.deliverlink || '',
      purchaselink: p.purchaselink || '',
      add_pkg: p.add_pkg || '',
      prd_content: p.prd_content || '',
    });
    setFormError('');
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError('');
    const title = form.title.trim();
    if (!title) { setFormError('Informe o título do produto.'); return; }
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) { setFormError('Preço inválido.'); return; }
    setSaving(true);
    try {
      const payload = {
        title,
        price,
        image: form.image.trim() || null,
        deliverlink: form.deliverlink.trim() || null,
        purchaselink: form.purchaselink.trim() || null,
        add_pkg: form.add_pkg.trim() || null,
        prd_content: form.prd_content.trim() || null,
      };
      if (editing) {
        await api.put(`/admin/items/${editing.id}`, payload);
      } else {
        await api.post('/admin/items', payload);
      }
      setModalOpen(false);
      fetchProducts();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Erro ao salvar produto.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/items/${toDelete.id}`);
      setToDelete(null);
      fetchProducts();
    } catch {
      alert('Erro ao excluir produto.');
    } finally {
      setDeleting(false);
    }
  }

  const sorted = useMemo(() => {
    return [...products].sort((a, b) => {
      const v1 = sortColumn === 'price' ? (a.price ?? 0) : String(a[sortColumn] ?? '').toLowerCase();
      const v2 = sortColumn === 'price' ? (b.price ?? 0) : String(b[sortColumn] ?? '').toLowerCase();
      if (v1 < v2) return sortDirection === 'asc' ? -1 : 1;
      if (v1 > v2) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [products, sortColumn, sortDirection]);

  const columns = [
    {
      key: 'id', label: 'ID', sortable: true,
      render: r => <span className="text-gray-400 text-xs font-mono">{r.id}</span>,
      csvValue: r => r.id ?? '',
    },
    {
      key: 'image', label: 'Imagem', sortable: false,
      render: r => r.image
        ? <img src={r.image} alt="" className="h-10 w-10 rounded-lg object-cover" onError={e => { e.target.style.display = 'none'; }} />
        : <div className="h-10 w-10 rounded-lg bg-gray-700 flex items-center justify-center"><Package className="h-4 w-4 text-gray-500" /></div>,
      csvValue: r => r.image || '',
    },
    {
      key: 'title', label: 'Título', sortable: true,
      render: r => <span className="font-medium text-white">{r.title}</span>,
      csvValue: r => r.title ?? '',
    },
    {
      key: 'price', label: 'Preço', sortable: true,
      render: r => <span className="text-green-400 font-medium">{formatCurrency(r.price)}</span>,
      csvValue: r => r.price ?? '',
    },
    {
      key: 'deliverlink', label: 'Link de Entrega', sortable: false,
      render: r => r.deliverlink
        ? <a href={r.deliverlink} target="_blank" rel="noreferrer" className="text-violet-400 hover:underline text-xs truncate max-w-40 block">{r.deliverlink}</a>
        : <span className="text-gray-600 text-xs">—</span>,
      csvValue: r => r.deliverlink || '',
    },
    {
      key: 'prd_content', label: 'Conteúdo', sortable: false,
      render: r => r.prd_content
        ? <span className="text-gray-300 text-xs truncate max-w-50 block" title={r.prd_content}>{r.prd_content}</span>
        : <span className="text-gray-600 text-xs">—</span>,
      csvValue: r => r.prd_content || '',
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
          <h1 className="text-xl font-semibold text-white">Produtos</h1>
          <p className="text-sm text-gray-400 mt-1">Gerenciamento de pacotes (Package)</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" /> Novo Produto
        </button>
      </div>

      <AdminGrid
        columns={columns}
        data={{ items: sorted, total }}
        loading={loading}
        error={error}
        emptyMessage="Nenhum produto cadastrado."
        page={page}
        perPage={PER_PAGE}
        onPageChange={setPage}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        totalLabel="produto"
        title="Produtos"
      />

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-lg bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 shrink-0">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Package className="h-4 w-4 text-violet-400" />
                {editing ? 'Editar Produto' : 'Novo Produto'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Título *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="ex: Pacote Xbox 360"
                    className="w-full bg-gray-700/50 border border-gray-600 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-500 placeholder-gray-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Preço (R$) *</label>
                  <input
                    type="number"
                    min="0" step="0.01"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="ex: 39.90"
                    className="w-full bg-gray-700/50 border border-gray-600 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-500 placeholder-gray-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Add PKG</label>
                  <input
                    type="text"
                    value={form.add_pkg}
                    onChange={e => setForm(f => ({ ...f, add_pkg: e.target.value }))}
                    placeholder="ex: extra"
                    className="w-full bg-gray-700/50 border border-gray-600 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-500 placeholder-gray-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">URL da Imagem</label>
                <input
                  type="url"
                  value={form.image}
                  onChange={e => setForm(f => ({ ...f, image: e.target.value }))}
                  placeholder="https://..."
                  className="w-full bg-gray-700/50 border border-gray-600 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-500 placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Link de Entrega</label>
                <input
                  type="url"
                  value={form.deliverlink}
                  onChange={e => setForm(f => ({ ...f, deliverlink: e.target.value }))}
                  placeholder="https://..."
                  className="w-full bg-gray-700/50 border border-gray-600 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-500 placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Link de Compra</label>
                <input
                  type="url"
                  value={form.purchaselink}
                  onChange={e => setForm(f => ({ ...f, purchaselink: e.target.value }))}
                  placeholder="https://..."
                  className="w-full bg-gray-700/50 border border-gray-600 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-500 placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Conteúdo do Produto</label>
                <textarea
                  value={form.prd_content}
                  onChange={e => setForm(f => ({ ...f, prd_content: e.target.value }))}
                  placeholder="Descrição do conteúdo..."
                  rows={3}
                  className="w-full bg-gray-700/50 border border-gray-600 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-500 placeholder-gray-500 resize-none"
                />
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
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editing ? 'Salvar alterações' : 'Criar produto'}
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

      {toDelete && (
        <ConfirmModal
          title="Excluir produto"
          message={`Tem certeza que deseja excluir o produto "${toDelete.title}"? Esta ação não pode ser desfeita.`}
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
