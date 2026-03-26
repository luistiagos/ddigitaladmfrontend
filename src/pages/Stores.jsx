import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, X, Loader2, Store } from 'lucide-react';
import api from '@/services/api';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AdminGrid from '@/components/ui/AdminGrid';
import useAdminGrid from '@/utils/useAdminGrid';

const EMPTY_FORM = { name: '', url_thumb: '', url_checkout: '', url_page: '' };

export default function Stores() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { sortColumn, sortDirection, handleSort } =
    useAdminGrid({ defaultSort: 'name', defaultDir: 'asc' });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
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
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(s) {
    setEditing(s);
    setForm({
      name: s.name || '',
      url_thumb: s.url_thumb || '',
      url_checkout: s.url_checkout || '',
      url_page: s.url_page || '',
    });
    setFormError('');
    setModalOpen(true);
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
        url_checkout: form.url_checkout.trim() || null,
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

  const sorted = useMemo(() => {
    return [...stores].sort((a, b) => {
      const v1 = String(a[sortColumn] ?? '').toLowerCase();
      const v2 = String(b[sortColumn] ?? '').toLowerCase();
      if (v1 < v2) return sortDirection === 'asc' ? -1 : 1;
      if (v1 > v2) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [stores, sortColumn, sortDirection]);

  const columns = [
    {
      key: 'id', label: 'ID', sortable: true,
      render: r => <span className="text-gray-400 text-xs font-mono">{r.id}</span>,
      csvValue: r => r.id ?? '',
    },
    {
      key: 'name', label: 'Nome', sortable: true,
      render: r => <span className="font-medium text-white">{r.name}</span>,
      csvValue: r => r.name ?? '',
    },
    {
      key: 'url_page', label: 'Página', sortable: false,
      render: r => r.url_page
        ? <a href={r.url_page} target="_blank" rel="noreferrer" className="text-violet-400 hover:underline text-xs truncate max-w-45 block">{r.url_page}</a>
        : <span className="text-gray-600 text-xs">—</span>,
      csvValue: r => r.url_page || '',
    },
    {
      key: 'url_checkout', label: 'Checkout', sortable: false,
      render: r => r.url_checkout
        ? <a href={r.url_checkout} target="_blank" rel="noreferrer" className="text-violet-400 hover:underline text-xs truncate max-w-45 block">{r.url_checkout}</a>
        : <span className="text-gray-600 text-xs">—</span>,
      csvValue: r => r.url_checkout || '',
    },
    {
      key: 'url_thumb', label: 'Thumb', sortable: false,
      render: r => r.url_thumb
        ? <img src={r.url_thumb} alt="" className="h-8 w-8 rounded object-cover" onError={e => { e.target.style.display = 'none'; }} />
        : <span className="text-gray-600 text-xs">—</span>,
      csvValue: r => r.url_thumb || '',
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
          <h1 className="text-xl font-semibold text-white">Stores</h1>
          <p className="text-sm text-gray-400 mt-1">Gerenciamento de lojas</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" /> Nova Store
        </button>
      </div>

      <AdminGrid
        columns={columns}
        data={{ items: sorted, total: sorted.length }}
        loading={loading}
        error={error}
        emptyMessage="Nenhuma store cadastrada."
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        totalLabel="store"
        title="Stores"
      />

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
                <label className="block text-xs font-medium text-gray-400 mb-1.5">URL de Checkout</label>
                <input
                  type="url"
                  value={form.url_checkout}
                  onChange={(e) => setForm(f => ({ ...f, url_checkout: e.target.value }))}
                  placeholder="https://..."
                  className="w-full bg-gray-700/50 border border-gray-600 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-500 placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">URL da Thumbnail</label>
                <input
                  type="url"
                  value={form.url_thumb}
                  onChange={(e) => setForm(f => ({ ...f, url_thumb: e.target.value }))}
                  placeholder="https://..."
                  className="w-full bg-gray-700/50 border border-gray-600 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-500 placeholder-gray-500"
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
