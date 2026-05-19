import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Pencil, Trash2, X, Loader2, Store, ExternalLink, ImageOff, Package, GripVertical, Copy } from 'lucide-react';
import api from '@/services/api';
import ConfirmModal from '@/components/ui/ConfirmModal';

// ---------------------------------------------------------------------------
// StorePackagesModal  manage products / order-bumps linked to a store
// ---------------------------------------------------------------------------

const EMPTY_ADD = { package_id: '', principal: '0', active: true, price: '', relprice: '', title: '', description: '', members_only: false };

function StorePackagesModal({ store, onClose }) {
  const [spItems, setSpItems] = useState([]);
  const [allPkgs, setAllPkgs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD);
  const [savingAdd, setSavingAdd] = useState(false);
  const [addError, setAddError] = useState('');

  // Drag-and-drop state
  const dragIndexRef = useRef(null);     // index being dragged
  const [dragOver, setDragOver] = useState(null); // index being hovered
  const reorderTimerRef = useRef(null);
  const [reordering, setReordering] = useState(false);

  const fetchAllPackages = useCallback(async () => {
    const perPage = 100;
    let page = 1;
    let total = 0;
    let items = [];

    do {
      const res = await api.get('/admin/items', { params: { per_page: perPage, page } });
      const batch = res.data.items || [];
      total = Number(res.data.total || 0);
      items = items.concat(batch);
      page += 1;
      if (batch.length === 0) break;
    } while (items.length < total);

    return items;
  }, []);

  const fetchSp = useCallback(async () => {
    const res = await api.get(`/admin/stores/${store.id}/packages`);
    setSpItems(res.data.items || []);
  }, [store.id]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/admin/stores/${store.id}/packages`),
      fetchAllPackages(),
    ])
      .then(([spRes, pkgRes]) => {
        setSpItems(spRes.data.items || []);
        setAllPkgs(pkgRes || []);
      })
      .finally(() => setLoading(false));
  }, [store.id, fetchAllPackages]);

  function openEdit(sp) {
    setEditingId(sp.id);
    setEditForm({
      principal: String(sp.principal ?? 0),
      active: sp.active !== 0,
      price: sp.price ?? '',
      relprice: sp.relprice ?? '',
      title: sp.title ?? '',
      description: sp.description ?? '',
      members_only: !!sp.members_only,
    });
  }

  async function handleSaveEdit(sp) {
    setSaving(true);
    try {
      const parsedPrice = editForm.price ? Number(String(editForm.price).replace(',', '.')) : null;
      const parsedRelPrice = editForm.relprice ? Number(String(editForm.relprice).replace(',', '.')) : null;

      await api.put(`/admin/stores/packages/${sp.id}`, {
        principal: editForm.principal === '1',
        active: editForm.active,
        price: isNaN(parsedPrice) ? null : parsedPrice,
        relprice: isNaN(parsedRelPrice) ? null : parsedRelPrice,
        title: editForm.title?.trim() || null,
        description: editForm.description?.trim() || null,
        members_only: editForm.members_only,
      });
      await fetchSp();
      setEditingId(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(sp) {
    setDeletingId(sp.id);
    try {
      await api.delete(`/admin/stores/packages/${sp.id}`);
      setSpItems(items => items.filter(i => i.id !== sp.id));
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao excluir vínculo.';
      alert(msg);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAdd() {
    setAddError('');
    if (!addForm.package_id) { setAddError('Selecione um produto.'); return; }
    setSavingAdd(true);
    try {
      const parsedPrice = addForm.price ? Number(String(addForm.price).replace(',', '.')) : null;
      const parsedRelPrice = addForm.relprice ? Number(String(addForm.relprice).replace(',', '.')) : null;

      await api.post(`/admin/stores/${store.id}/packages`, {
        package_id: Number(addForm.package_id),
        principal: addForm.principal === '1',
        active: addForm.active,
        price: isNaN(parsedPrice) ? null : parsedPrice,
        relprice: isNaN(parsedRelPrice) ? null : parsedRelPrice,
        title: addForm.title?.trim() || null,
        description: addForm.description?.trim() || null,
        members_only: addForm.members_only,
      });
      await fetchSp();
      setAddForm(EMPTY_ADD);
      setShowAdd(false);
    } catch (err) {
      setAddError(err.response?.data?.error || 'Erro ao adicionar.');
    } finally {
      setSavingAdd(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Drag-and-drop handlers  (only non-principal items are draggable)
  // ---------------------------------------------------------------------------

  function handleDragStart(e, index) {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
    // Semi-transparent ghost
    e.dataTransfer.setDragImage(e.currentTarget, 20, 20);
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (index !== dragIndexRef.current) {
      setDragOver(index);
    }
  }

  function handleDrop(e, dropIndex) {
    e.preventDefault();
    const dragIndex = dragIndexRef.current;
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragOver(null);
      return;
    }

    // Reorder locally (optimistic)
    const newItems = [...spItems];
    const [moved] = newItems.splice(dragIndex, 1);
    newItems.splice(dropIndex, 0, moved);
    setSpItems(newItems);
    dragIndexRef.current = null;
    setDragOver(null);

    // Persist to backend (debounced to avoid rapid calls during multi-step drag)
    clearTimeout(reorderTimerRef.current);
    reorderTimerRef.current = setTimeout(async () => {
      setReordering(true);
      try {
        await api.post(`/admin/stores/${store.id}/packages/reorder`, {
          ordered_ids: newItems.map(i => i.id),
        });
      } catch {
        // On failure, re-fetch to restore server order
        await fetchSp();
      } finally {
        setReordering(false);
      }
    }, 400);
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
    setDragOver(null);
  }

  const linkedPkgIds = new Set(spItems.map(i => i.package_id));
  const availablePkgs = allPkgs.filter(p => !linkedPkgIds.has(p.id));

  const inputCls = 'w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-500 placeholder-gray-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-2xl bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 shrink-0">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Package className="h-4 w-4 text-violet-400" />
            Produtos — {store.name}
            {reordering && <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400 ml-1" />}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
            </div>
          )}

          {!loading && spItems.length === 0 && !showAdd && (
            <p className="text-gray-500 text-sm text-center py-6">Nenhum produto vinculado ainda.</p>
          )}

          {!loading && spItems.length > 1 && !showAdd && (
            <p className="text-[11px] text-gray-500 text-center -mt-1 mb-1">
              <GripVertical className="inline h-3 w-3 mr-0.5 -mt-0.5" />
              Arraste pelo ícone para reordenar os order bumps
            </p>
          )}

          {!loading && spItems.map((sp, index) => (
            <div
              key={sp.id}
              draggable={!sp.principal && editingId !== sp.id}
              onDragStart={!sp.principal ? (e) => handleDragStart(e, index) : undefined}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`border rounded-xl p-3 transition-all ${
                dragOver === index
                  ? 'border-violet-500 bg-violet-500/10 scale-[1.01]'
                  : 'border-gray-700 bg-gray-700/30'
              }`}
            >
              {editingId === sp.id ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    {sp.package_image
                      ? <img src={sp.package_image} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                      : <div className="h-10 w-10 rounded bg-gray-700 flex items-center justify-center shrink-0"><ImageOff className="h-4 w-4 text-gray-600" /></div>
                    }
                    <span className="font-medium text-white text-sm">{sp.package_title}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Tipo</label>
                      <select value={editForm.principal} onChange={e => setEditForm(f => ({ ...f, principal: e.target.value }))} className={inputCls}>
                        <option value="1">Principal</option>
                        <option value="0">Order Bump</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Status</label>
                      <select value={editForm.active ? '1' : '0'} onChange={e => setEditForm(f => ({ ...f, active: e.target.value === '1' }))} className={inputCls}>
                        <option value="1">Ativo</option>
                        <option value="0">Inativo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Preço (override)</label>
                      <input type="text" inputMode="decimal" value={editForm.price}
                        onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                        placeholder="Padrão do produto" className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Preço de (riscado)</label>
                      <input type="text" inputMode="decimal" value={editForm.relprice}
                        onChange={e => setEditForm(f => ({ ...f, relprice: e.target.value }))}
                        placeholder="Opcional" className={inputCls} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-400 mb-1">Título Customizado (override)</label>
                      <input type="text" value={editForm.title}
                        onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="Deixe em branco para usar o padrão" className={inputCls} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-400 mb-1">Descrição</label>
                      <textarea
                        rows={3}
                        value={editForm.description || ''}
                        onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Descrição exibida no checkout para este bump"
                        className={inputCls}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <div
                          onClick={() => setEditForm(f => ({ ...f, members_only: !f.members_only }))}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            editForm.members_only ? 'bg-violet-600' : 'bg-gray-600'
                          }`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            editForm.members_only ? 'translate-x-4' : 'translate-x-1'
                          }`} />
                        </div>
                        <span className="text-xs text-gray-300">
                          Somente Área de Membros
                          <span className="block text-[10px] text-gray-500 leading-tight">
                            {editForm.members_only
                              ? 'Não aparece como order bump — apenas na área de membros'
                              : 'Aparece na loja (order bump) e na área de membros'}
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveEdit(sp)} disabled={saving}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white transition-colors">
                      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="px-3 py-2 text-xs rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {/* Drag handle — only for non-principal items */}
                  {!sp.principal ? (
                    <div
                      className="shrink-0 cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 transition-colors px-0.5"
                      title="Arraste para reordenar"
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="w-5 shrink-0" />
                  )}
                  {sp.package_image
                    ? <img src={sp.package_image} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                    : <div className="h-10 w-10 rounded bg-gray-700 flex items-center justify-center shrink-0"><ImageOff className="h-4 w-4 text-gray-600" /></div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white text-sm truncate">{sp.package_title}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${sp.principal ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {sp.principal ? 'Principal' : 'Order Bump'}
                      </span>
                      {!sp.active && <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-600 text-gray-400">Inativo</span>}
                      {sp.members_only ? (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300">Só Membros</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {sp.price != null
                        ? `R$ ${Number(sp.price).toFixed(2)}`
                        : `R$ ${Number(sp.package_price ?? 0).toFixed(2)} (padrão)`}
                      {sp.relprice != null && `  de R$ ${Number(sp.relprice).toFixed(2)}`}
                    </div>
                    {sp.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{sp.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => openEdit(sp)}
                      className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(sp)} disabled={deletingId === sp.id || sp.principal}
                      title={sp.principal ? 'Demote o produto principal antes de excluí-lo' : 'Excluir'}
                      className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                      {deletingId === sp.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add form */}
          {showAdd && !loading && (
            <div className="border border-violet-500/40 rounded-xl p-4 space-y-3 bg-gray-700/20">
              <h3 className="text-sm font-medium text-white">Adicionar Produto</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">Produto *</label>
                  <select value={addForm.package_id} onChange={e => setAddForm(f => ({ ...f, package_id: e.target.value }))} className={inputCls}>
                    <option value="">Selecione...</option>
                    {availablePkgs.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Tipo</label>
                  <select value={addForm.principal} onChange={e => setAddForm(f => ({ ...f, principal: e.target.value }))} className={inputCls}>
                    <option value="1">Principal</option>
                    <option value="0">Order Bump</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Status</label>
                  <select value={addForm.active ? '1' : '0'} onChange={e => setAddForm(f => ({ ...f, active: e.target.value === '1' }))} className={inputCls}>
                    <option value="1">Ativo</option>
                    <option value="0">Inativo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Preço (override)</label>
                  <input type="text" inputMode="decimal" value={addForm.price}
                    onChange={e => setAddForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="Padrão do produto" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Preço de (riscado)</label>
                  <input type="text" inputMode="decimal" value={addForm.relprice}
                    onChange={e => setAddForm(f => ({ ...f, relprice: e.target.value }))}
                    placeholder="Opcional" className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">Título Customizado (override)</label>
                  <input type="text" value={addForm.title}
                    onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Deixe em branco para usar o padrão" className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">Descrição</label>
                  <textarea
                    rows={3}
                    value={addForm.description}
                    onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Descrição exibida no checkout para este bump"
                    className={inputCls}
                  />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                      onClick={() => setAddForm(f => ({ ...f, members_only: !f.members_only }))}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        addForm.members_only ? 'bg-violet-600' : 'bg-gray-600'
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        addForm.members_only ? 'translate-x-4' : 'translate-x-1'
                      }`} />
                    </div>
                    <span className="text-xs text-gray-300">
                      Somente Área de Membros
                      <span className="block text-[10px] text-gray-500 leading-tight">
                        {addForm.members_only
                          ? 'Não aparece como order bump — apenas na área de membros'
                          : 'Aparece na loja (order bump) e na área de membros'}
                      </span>
                    </span>
                  </label>
                </div>
              </div>
              {addError && <p className="text-sm text-red-400">{addError}</p>}
              <div className="flex gap-2">
                <button onClick={handleAdd} disabled={savingAdd}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white transition-colors">
                  {savingAdd && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Adicionar
                </button>
                <button onClick={() => { setShowAdd(false); setAddError(''); setAddForm(EMPTY_ADD); }}
                  className="px-3 py-2 text-xs rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 shrink-0 flex justify-between items-center">
          {!showAdd && !loading ? (
            <button onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors">
              <Plus className="h-4 w-4" /> Adicionar Produto
            </button>
          ) : <div />}
          <button onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stores page
// ---------------------------------------------------------------------------

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
  const [copying, setCopying] = useState(null);

  const [pkgStore, setPkgStore] = useState(null);

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

  async function handleCopy(s) {
    setCopying(s.id);
    try {
      const payload = {
        name: `Cópia de ${s.name}`,
        url_thumb: s.url_thumb || null,
        url_checkout: s.url_checkout || null,
        url_page: s.url_page || null,
      };
      const res = await api.post(`/admin/stores/${s.id}/copy`, payload);
      const newStore = { ...payload, id: res.data.id };
      await fetchStores();
      openEdit(newStore);
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao copiar store.');
    } finally {
      setCopying(null);
    }
  }

  const sorted = [...stores].sort((a, b) =>
    String(a.name ?? '').toLowerCase().localeCompare(String(b.name ?? '').toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Lojas</h1>
          <p className="text-sm text-gray-400 mt-1">Gerenciamento de lojas ({stores.length})</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" /> Nova Loja
        </button>
      </div>

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

      {!loading && !error && sorted.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sorted.map(s => (
            <div key={s.id} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden flex flex-col">
              <StoreImage url={s.url_thumb} name={s.name} />

              <div className="p-4 flex flex-col gap-2 flex-1">
                <div>
                  <span className="text-xs font-mono text-gray-500">#{s.id}</span>
                  <h3 className="font-semibold text-white text-sm leading-tight">{s.name}</h3>
                </div>
                {s.url_page && (
                  <a href={s.url_page} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 truncate">
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{s.url_page}</span>
                  </a>
                )}
              </div>

              <div className="px-4 pb-4 flex flex-col gap-2">
                <button
                  onClick={() => setPkgStore(s)}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 transition-colors"
                >
                  <Package className="h-3.5 w-3.5" /> Gerenciar Produtos
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(s)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                  <button
                    onClick={() => handleCopy(s)}
                    disabled={copying === s.id}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors disabled:opacity-60"
                  >
                    {copying === s.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Copy className="h-3.5 w-3.5" />
                    } Copiar
                  </button>
                  <button
                    onClick={() => setToDelete(s)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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

      {pkgStore && (
        <StorePackagesModal store={pkgStore} onClose={() => setPkgStore(null)} />
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

function StoreImage({ url, name }) {
  const [error, setError] = useState(false);
  return (
    <div className="h-36 bg-gray-700 flex items-center justify-center overflow-hidden">
      {url && !error ? (
        <img
          src={url}
          alt={name}
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
