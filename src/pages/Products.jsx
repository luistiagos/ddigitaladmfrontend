import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Pencil, Trash2, X, Loader2, Package, ImageOff, ShoppingCart, ChevronLeft, ChevronRight, Search, Copy } from 'lucide-react';
import api from '@/services/api';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { formatCurrency } from '@/utils/format';

const EMPTY_FORM = { title: '', price: '', image: '', purchaselink: '', deliverlink: '', prd_content: '', add_pkg: '' };
const PER_PAGE = 20;

export default function Products() {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Debounce search input — wait 400ms after last keystroke
  const debounceRef = useRef(null);
  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imgPreview, setImgPreview] = useState('');
  const [imgError, setImgError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [copying, setCopying] = useState(null);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, per_page: PER_PAGE };
      if (debouncedSearch.trim()) params.title = debouncedSearch.trim();
      const res = await api.get('/admin/items', { params });
      setProducts(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch {
      setError('Erro ao carregar produtos.');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  function handleSearchChange(val) {
    setSearch(val);
    setPage(1);
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setImgPreview('');
    setImgError(false);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({
      title: p.title || '',
      price: p.price != null ? String(p.price) : '',
      image: p.image || '',
      purchaselink: p.purchaselink || '',
      deliverlink: p.deliverlink || '',
      prd_content: p.prd_content || '',
      add_pkg: p.add_pkg || '',
    });
    setImgPreview(p.image || '');
    setImgError(false);
    setFormError('');
    setModalOpen(true);
  }

  function handleImgChange(val) {
    setForm(f => ({ ...f, image: val }));
    setImgPreview(val);
    setImgError(false);
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
        purchaselink: form.purchaselink.trim() || null,
        deliverlink: form.deliverlink.trim() || null,
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

  async function handleCopy(p) {
    setCopying(p.id);
    try {
      const payload = {
        title: `Cópia de ${p.title}`,
        price: p.price,
        image: p.image || null,
        purchaselink: p.purchaselink || null,
        deliverlink: p.deliverlink || null,
        add_pkg: p.add_pkg || null,
        prd_content: p.prd_content || null,
      };
      const res = await api.post('/admin/items', payload);
      const newProduct = { ...p, id: res.data.id, title: payload.title };
      await fetchProducts();
      openEdit(newProduct);
    } catch {
      alert('Erro ao copiar produto.');
    } finally {
      setCopying(null);
    }
  }

  const inputCls = 'w-full bg-gray-700/50 border border-gray-600 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-500 placeholder-gray-500';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Produtos</h1>
          <p className="text-sm text-gray-400 mt-1">Gerenciamento de pacotes ({total})</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" /> Novo Produto
        </button>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          placeholder="Buscar por nome do produto..."
          className="w-full sm:w-80 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:border-violet-500 placeholder-gray-500"
        />
        {search && (
          <button
            onClick={() => handleSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        </div>
      )}
      {!loading && error && (
        <p className="text-red-400 text-sm text-center py-8">{error}</p>
      )}
      {!loading && !error && products.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-16">Nenhum produto cadastrado.</p>
      )}

      {!loading && !error && products.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map(p => (
              <div key={p.id} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden flex flex-col">
                {/* Image */}
                <ProductImage image={p.image} title={p.title} />

                {/* Info */}
                <div className="p-4 flex flex-col gap-2 flex-1">
                  <h3 className="font-semibold text-white text-sm leading-tight">{p.title}</h3>
                  <span className="text-green-400 font-semibold text-base">{formatCurrency(p.price)}</span>
                  {p.purchaselink && (
                    <a href={p.purchaselink} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 truncate">
                      <ShoppingCart className="h-3 w-3 shrink-0" />
                      <span className="truncate">Link de Compra</span>
                    </a>
                  )}
                  {p.deliverlink && (
                    <a href={p.deliverlink} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 truncate">
                      <Package className="h-3 w-3 shrink-0" />
                      <span className="truncate">Link de Entrega</span>
                    </a>
                  )}
                </div>

                {/* Actions */}
                <div className="px-4 pb-4 flex gap-2">
                  <button
                    onClick={() => openEdit(p)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                  <button
                    onClick={() => handleCopy(p)}
                    disabled={copying === p.id}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors disabled:opacity-60"
                  >
                    {copying === p.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Copy className="h-3.5 w-3.5" />
                    } Copiar
                  </button>
                  <button
                    onClick={() => setToDelete(p)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <span className="text-sm text-gray-400">
                Página {page} de {totalPages} ({total} produtos)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
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
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Título *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="ex: Pacote Xbox 360"
                  className={inputCls}
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
                  className={inputCls}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Link de Compra</label>
                <input
                  type="url"
                  value={form.purchaselink}
                  onChange={e => setForm(f => ({ ...f, purchaselink: e.target.value }))}
                  placeholder="https://..."
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Link de Entrega</label>
                <input
                  type="url"
                  value={form.deliverlink}
                  onChange={e => setForm(f => ({ ...f, deliverlink: e.target.value }))}
                  placeholder="https://..."
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Benefícios/Destaques (um por linha)</label>
                <textarea
                  value={form.prd_content}
                  onChange={e => setForm(f => ({ ...f, prd_content: e.target.value }))}
                  placeholder="ex: Acesso Imediato&#10;Download Rápido&#10;Atualizações Gratuitas"
                  rows={4}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Metadados/Sub-pacotes (JSON)</label>
                <input
                  type="text"
                  value={form.add_pkg}
                  onChange={e => setForm(f => ({ ...f, add_pkg: e.target.value }))}
                  placeholder="ex: [9021115]"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">URL da Imagem</label>
                <input
                  type="url"
                  value={form.image}
                  onChange={e => handleImgChange(e.target.value)}
                  placeholder="https://..."
                  className={inputCls}
                />
                {imgPreview && (
                  <div className="mt-2 rounded-lg overflow-hidden border border-gray-600 bg-gray-700 h-32 flex items-center justify-center">
                    {!imgError ? (
                      <img
                        src={imgPreview}
                        alt="preview"
                        className="w-full h-full object-cover"
                        onError={() => setImgError(true)}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-gray-500">
                        <ImageOff className="h-6 w-6" />
                        <span className="text-xs">URL inválida ou imagem não carregou</span>
                      </div>
                    )}
                  </div>
                )}
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

function ProductImage({ image, title }) {
  const [error, setError] = useState(false);
  return (
    <div className="h-36 bg-gray-700 flex items-center justify-center overflow-hidden">
      {image && !error ? (
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover"
          onError={() => setError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center flex-col gap-1">
          <ImageOff className="h-8 w-8 text-gray-600" />
          <span className="text-xs text-gray-600">Sem imagem</span>
        </div>
      )}
    </div>
  );
}
