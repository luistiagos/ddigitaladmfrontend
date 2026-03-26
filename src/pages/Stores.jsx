import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Loader2, Store, ExternalLink, ImageOff } from 'lucide-react';
import api from '@/services/api';
import ConfirmModal from '@/components/ui/ConfirmModal';

const EMPTY_FORM = { name: '', url_thumb: '', url_page: '' };

export default function Stores() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [thumbPreview, setThumbPreview] = useState('');
  const [thumbError, setThumbError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchStores = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/stores');
      setStores(res.data.stores || []);
    } catch {
      setError('Erro ao carregar stores.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStores(); }, [fetchStores]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setThumbPreview('');
    setThumbError(false);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(s) {
    setEditing(s);
    setForm({ name: s.name || '', url_thumb: s.url_thumb || '', url_page: s.url_page || '' });
    setThumbPreview(s.url_thumb || '');
    setThumbError(false);
    setFormError('');
    setModalOpen(true);
  }

  function handleThumbChange(val) {
    setForm(f => ({ ...f, url_thumb: val }));
    setThumbPreview(val);
    setThumbError(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError('');
    const name = form.name.trim();
    if (!name) { setFormError('Informe o nome da store.'); return; }
    setSaving(true);
    try {
      const payload = {
        name,
        url_thumb: form.url_thumb.trim() || null,
        url_checkout: null,
        url_page: form.url_page.trim() || null,
      };
      if (editing) {
        await api.put(`/admin/stores/${editing.id}`, payload);
      } else {
        await api.post('/admin/stores', payload);
      }
      setModalOpen(false);
      fetchStores();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Erro ao salvar store.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/stores/${toDelete.id}`);
      setToDelete(null);
      fetchStores();
    } catch {
      alert('Erro ao excluir store.');
    } finally {
      setDeleting(false);
    }
  }

  const sorted = [...stores].sort((a, b) =>
    String(a.name ?? '').toLowerCase().localeCompare(String(b.name ?? '').toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Stores</h1>
          <p className="text-sm text-gray-400 mt-1">Gerenciamento de lojas ({stores.length})</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" /> Nova Store
        </button>
      </div>

      {/* States */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        </div>
      )}
      {!loading && error && (
        <p className="text-red-400 text-sm text-center py-8">{error}</p>
      )}
      {!loading && !error && sorted.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-16">Nenhuma store cadastrada.</p>
      )}

      {/* Cards grid */}
      {!loading && !error && sorted.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sorted.map(s => (
            <div key={s.id} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden flex flex-col">
              {/* Thumbnail */}
              <div className="h-36 bg-gray-700 flex items-center justify-center overflow-hidden">
                {s.url_thumb ? (
                  <img
                    src={s.url_thumb}
                    alt={s.name}
                    className="w-full h-full object-cover"
                    onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                  />
                ) : null}
                <div
                  className="w-full h-full items-center justify-center flex-col gap-1"
                  style={{ display: s.url_thumb ? 'none' : 'flex' }}
                >
                  <ImageOff className="h-8 w-8 text-gray-600" />
                  <span className="text-xs text-gray-600">Sem imagem</span>
                </div>
              </div>

              {/* Info */}
              <div className="p-4 flex flex-col gap-2 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono text-gray-500">#{s.id}</span>
                    <h3 className="font-semibold text-white text-sm leading-tight">{s.name}</h3>
                  </div>
                </div>

                {s.url_page && (
                  <a
                    href={s.url_page}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 truncate"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{s.url_page}</span>
                  </a>
                )}
              </div>

              {/* Actions */}
              <div className="px-4 pb-4 flex gap-2">
                <button
                  onClick={() => openEdit(s)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </button>
                <button
                  onClick={() => setToDelete(s)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Store className="h-4 w-4 text-violet-400" />
                {editing ? 'Editar Store' : 'Nova Store'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Nome *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ex: Loja Principal"
                  className="w-full bg-gray-700/50 border border-gray-600 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-500 placeholder-gray-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">URL da Página</label>
                <input
                  type="url"
                  value={form.url_page}
                  onChange={(e) => setForm(f => ({ ...f, url_page: e.target.value }))}
                  placeholder="https://..."
                  className="w-full bg-gray-700/50 border border-gray-600 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-500 placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">URL da Thumbnail</label>
                <input
                  type="url"
                  value={form.url_thumb}
                  onChange={(e) => handleThumbChange(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-gray-700/50 border border-gray-600 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-500 placeholder-gray-500"
                />
                {/* Thumbnail preview */}
                {thumbPreview && (
                  <div className="mt-2 rounded-lg overflow-hidden border border-gray-600 bg-gray-700 h-32 flex items-center justify-center">
                    {!thumbError ? (
                      <img
                        src={thumbPreview}
                        alt="preview"
                        className="w-full h-full object-cover"
                        onError={() => setThumbError(true)}
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
                  {editing ? 'Salvar alterações' : 'Criar store'}
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
          title="Excluir store"
          message={`Tem certeza que deseja excluir a store "${toDelete.name}"? Esta ação não pode ser desfeita.`}
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
