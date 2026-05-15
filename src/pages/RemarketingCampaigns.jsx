import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Mail,
  MessageCircle,
  Send,
  GripVertical,
  Settings2,
  ChevronRight,
  Copy,
  ArrowRight,
} from 'lucide-react';
import api from '@/services/api';
import ConfirmModal from '@/components/ui/ConfirmModal';

const EMPTY_STEP = {
  name: '',
  delivery_type: 'EMAIL',
  template: '',
  subject: '',
  time_trigger_min: '',
  days_cyclic: '',
  time_send: '',
  day_send: '',
  ord: '',
};

const inputCls =
  'w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-500 placeholder-gray-500';

function ChannelBadge({ type }) {
  const t = (type || '').toUpperCase();
  if (t === 'WHATSAPP') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-300">
        <MessageCircle className="h-3 w-3" /> WhatsApp
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
      <Mail className="h-3 w-3" /> Email
    </span>
  );
}

function timingLabel(step) {
  const parts = [];
  if (step.time_trigger_min != null && step.time_trigger_min !== '') {
    parts.push(`Atraso ${step.time_trigger_min}min`);
  }
  if (step.time_send) parts.push(`${step.time_send}`);
  if (step.day_send) parts.push(`dia ${step.day_send}`);
  if (step.days_cyclic && Number(step.days_cyclic) > 0) {
    parts.push(`repete cada ${step.days_cyclic}d`);
  }
  return parts.length ? parts.join(' · ') : 'Sem timing definido';
}

function StepEditor({ value, onChange }) {
  const set = (key, v) => onChange({ ...value, [key]: v });
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className="block text-xs text-gray-400 mb-1">Nome do step *</label>
        <input
          type="text"
          value={value.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="ex: Plataforma Multigames — Abandono 01"
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Canal *</label>
        <select
          value={value.delivery_type}
          onChange={(e) => set('delivery_type', e.target.value)}
          className={inputCls}
        >
          <option value="EMAIL">Email</option>
          <option value="WHATSAPP">WhatsApp</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Ordem</label>
        <input
          type="number"
          min="1"
          value={value.ord}
          onChange={(e) => set('ord', e.target.value)}
          placeholder="auto"
          className={inputCls}
        />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-gray-400 mb-1">Template *</label>
        <input
          type="text"
          value={value.template}
          onChange={(e) => set('template', e.target.value)}
          placeholder="ex: remarket/wpp_remarket_ai_multigames.txt"
          className={inputCls}
        />
        <p className="text-[10px] text-gray-500 mt-1">
          Caminho relativo a <code className="text-gray-400">mysite/templates/</code>. Para WhatsApp IA, aponte para um prompt
          em <code className="text-gray-400">remarket/wpp_remarket_ai_*.txt</code>.
        </p>
      </div>
      {value.delivery_type === 'EMAIL' && (
        <div className="col-span-2">
          <label className="block text-xs text-gray-400 mb-1">Assunto do email</label>
          <input
            type="text"
            value={value.subject}
            onChange={(e) => set('subject', e.target.value)}
            placeholder="Você parou bem na melhor parte..."
            className={inputCls}
          />
        </div>
      )}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Atraso inicial (min)</label>
        <input
          type="number"
          min="0"
          value={value.time_trigger_min}
          onChange={(e) => set('time_trigger_min', e.target.value)}
          placeholder="ex: 15"
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Repetir a cada (dias)</label>
        <input
          type="number"
          min="0"
          value={value.days_cyclic}
          onChange={(e) => set('days_cyclic', e.target.value)}
          placeholder="0 = sem repetição"
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Horário preferido</label>
        <input
          type="time"
          value={value.time_send || ''}
          onChange={(e) => set('time_send', e.target.value)}
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Dia do mês</label>
        <input
          type="number"
          min="1"
          max="31"
          value={value.day_send}
          onChange={(e) => set('day_send', e.target.value)}
          placeholder="opcional"
          className={inputCls}
        />
      </div>
    </div>
  );
}

function CopyStepsPicker({ targetStore, allStores, onClose, onCopied }) {
  const [sourceStoreId, setSourceStoreId] = useState('');
  const [sourceSteps, setSourceSteps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState('');

  const candidates = (allStores || []).filter(
    (s) => s.store_id !== targetStore.store_id && Number(s.step_count || 0) > 0
  );

  async function loadSteps(storeId) {
    setSourceStoreId(storeId);
    setSelected(new Set());
    setError('');
    if (!storeId) {
      setSourceSteps([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/admin/remarket/stores/${storeId}/steps`);
      const items = res.data.items || [];
      setSourceSteps(items);
      setSelected(new Set(items.map((i) => i.id)));
    } catch {
      setError('Erro ao carregar steps da loja origem.');
    } finally {
      setLoading(false);
    }
  }

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCopy() {
    if (selected.size === 0) {
      setError('Selecione ao menos um step.');
      return;
    }
    setCopying(true);
    setError('');
    try {
      const res = await api.post(`/admin/remarket/stores/${targetStore.store_id}/steps/copy`, {
        source_step_ids: Array.from(selected),
      });
      onCopied?.(res.data.count || 0);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao copiar steps.');
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-2xl bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 shrink-0">
          <h2 className="font-semibold text-white flex items-center gap-2 text-sm">
            <Copy className="h-4 w-4 text-violet-400" />
            Copiar steps para <span className="text-violet-300">{targetStore.store_name}</span>
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {/* Source store selector */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Loja de origem</label>
            <select
              value={sourceStoreId}
              onChange={(e) => loadSteps(e.target.value)}
              className={inputCls}
            >
              <option value="">Selecione uma loja...</option>
              {candidates.map((s) => (
                <option key={s.store_id} value={s.store_id}>
                  {s.store_name} ({s.step_count} step{s.step_count === 1 ? '' : 's'})
                </option>
              ))}
            </select>
            {candidates.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">Nenhuma outra loja tem steps cadastrados.</p>
            )}
          </div>

          {loading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
            </div>
          )}

          {!loading && sourceSteps.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">
                  {selected.size} de {sourceSteps.length} selecionados
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(new Set(sourceSteps.map((s) => s.id)))}
                    className="text-xs text-violet-400 hover:text-violet-300"
                  >
                    Todos
                  </button>
                  <span className="text-gray-600">·</span>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="text-xs text-violet-400 hover:text-violet-300"
                  >
                    Nenhum
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                {sourceSteps.map((step) => {
                  const checked = selected.has(step.id);
                  return (
                    <label
                      key={step.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        checked
                          ? 'border-violet-500 bg-violet-500/10'
                          : 'border-gray-700 bg-gray-700/30 hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(step.id)}
                        className="w-4 h-4 rounded accent-violet-500 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-gray-500">#{step.ord}</span>
                          <span className="text-sm text-white truncate">{step.name}</span>
                          <ChannelBadge type={step.delivery_type} />
                        </div>
                        <div className="text-xs text-gray-400 truncate mt-0.5">
                          <span className="text-gray-500">Template:</span>{' '}
                          <code>{step.template || '—'}</code>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{timingLabel(step)}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-500 mt-3 flex items-center gap-1">
                <ArrowRight className="h-3 w-3" />
                Os steps copiados serão adicionados ao final da sequência atual de{' '}
                <span className="text-gray-300">{targetStore.store_name}</span>.
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 shrink-0 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCopy}
            disabled={copying || selected.size === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white transition-colors"
          >
            {copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            Copiar {selected.size} step{selected.size === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CampaignStepsModal({ store, allStores, onClose }) {
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_STEP);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_STEP);
  const [savingAdd, setSavingAdd] = useState(false);
  const [addError, setAddError] = useState('');

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showCopyPicker, setShowCopyPicker] = useState(false);

  const dragIndexRef = useRef(null);
  const [dragOver, setDragOver] = useState(null);
  const reorderTimerRef = useRef(null);
  const [reordering, setReordering] = useState(false);

  const fetchSteps = useCallback(async () => {
    setError('');
    try {
      const res = await api.get(`/admin/remarket/stores/${store.store_id}/steps`);
      setSteps(res.data.items || []);
    } catch {
      setError('Erro ao carregar steps.');
    }
  }, [store.store_id]);

  useEffect(() => {
    setLoading(true);
    fetchSteps().finally(() => setLoading(false));
  }, [fetchSteps]);

  function openEdit(step) {
    setEditingId(step.id);
    setEditForm({
      name: step.name || '',
      delivery_type: step.delivery_type || 'EMAIL',
      template: step.template || '',
      subject: step.subject || '',
      time_trigger_min: step.time_trigger_min ?? '',
      days_cyclic: step.days_cyclic ?? '',
      time_send: step.time_send || '',
      day_send: step.day_send ?? '',
      ord: step.ord ?? '',
    });
    setFormError('');
  }

  async function handleSaveEdit(step) {
    setFormError('');
    if (!editForm.name.trim()) {
      setFormError('Nome do step é obrigatório.');
      return;
    }
    if (!editForm.template.trim()) {
      setFormError('Template é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/admin/remarket/steps/${step.id}`, editForm);
      await fetchSteps();
      setEditingId(null);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Erro ao salvar step.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    setAddError('');
    if (!addForm.name.trim()) {
      setAddError('Nome do step é obrigatório.');
      return;
    }
    if (!addForm.template.trim()) {
      setAddError('Template é obrigatório.');
      return;
    }
    setSavingAdd(true);
    try {
      await api.post(`/admin/remarket/stores/${store.store_id}/steps`, addForm);
      await fetchSteps();
      setAddForm(EMPTY_STEP);
      setShowAdd(false);
    } catch (err) {
      setAddError(err.response?.data?.error || 'Erro ao adicionar step.');
    } finally {
      setSavingAdd(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/remarket/steps/${toDelete.id}`);
      setToDelete(null);
      await fetchSteps();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir step.');
    } finally {
      setDeleting(false);
    }
  }

  function handleDragStart(e, index) {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setDragImage(e.currentTarget, 20, 20);
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (index !== dragIndexRef.current) setDragOver(index);
  }

  function handleDrop(e, dropIndex) {
    e.preventDefault();
    const dragIndex = dragIndexRef.current;
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragOver(null);
      return;
    }
    const newItems = [...steps];
    const [moved] = newItems.splice(dragIndex, 1);
    newItems.splice(dropIndex, 0, moved);
    setSteps(newItems);
    dragIndexRef.current = null;
    setDragOver(null);

    clearTimeout(reorderTimerRef.current);
    reorderTimerRef.current = setTimeout(async () => {
      setReordering(true);
      try {
        await api.post(`/admin/remarket/stores/${store.store_id}/steps/reorder`, {
          ordered_ids: newItems.map((i) => i.id),
        });
        await fetchSteps();
      } catch {
        await fetchSteps();
      } finally {
        setReordering(false);
      }
    }, 400);
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
    setDragOver(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-3xl bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 shrink-0">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Send className="h-4 w-4 text-violet-400" />
            Campanha de remarketing — {store.store_name}
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

          {!loading && error && <p className="text-red-400 text-sm text-center py-4">{error}</p>}

          {!loading && !error && steps.length === 0 && !showAdd && (
            <p className="text-gray-500 text-sm text-center py-6">Nenhum step de remarketing cadastrado.</p>
          )}

          {!loading && !error && steps.length > 1 && (
            <p className="text-[11px] text-gray-500 text-center -mt-1 mb-1">
              <GripVertical className="inline h-3 w-3 mr-0.5 -mt-0.5" />
              Arraste pelo ícone para reordenar a sequência
            </p>
          )}

          {!loading && !error && steps.map((step, index) => (
            <div
              key={step.id}
              draggable={editingId !== step.id}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`border rounded-xl p-3 transition-all ${
                dragOver === index
                  ? 'border-violet-500 bg-violet-500/10 scale-[1.01]'
                  : 'border-gray-700 bg-gray-700/30'
              }`}
            >
              {editingId === step.id ? (
                <div className="flex flex-col gap-3">
                  <StepEditor value={editForm} onChange={setEditForm} />
                  {formError && (
                    <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      {formError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(step)}
                      disabled={saving}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white transition-colors"
                    >
                      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-2 text-xs rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div
                    className="shrink-0 cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 transition-colors px-0.5"
                    title="Arraste para reordenar"
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-gray-500">#{step.ord}</span>
                      <span className="font-medium text-white text-sm truncate">{step.name}</span>
                      <ChannelBadge type={step.delivery_type} />
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">
                      <span className="text-gray-500">Template:</span>{' '}
                      <code className="text-gray-300">{step.template || '—'}</code>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{timingLabel(step)}</div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => openEdit(step)}
                      className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setToDelete(step)}
                      className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {showAdd && !loading && (
            <div className="border border-violet-500/40 rounded-xl p-4 space-y-3 bg-gray-700/20">
              <h3 className="text-sm font-medium text-white">Adicionar novo step</h3>
              <StepEditor value={addForm} onChange={setAddForm} />
              {addError && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {addError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={savingAdd}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white transition-colors"
                >
                  {savingAdd && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Adicionar
                </button>
                <button
                  onClick={() => {
                    setShowAdd(false);
                    setAddError('');
                    setAddForm(EMPTY_STEP);
                  }}
                  className="px-3 py-2 text-xs rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 shrink-0 flex justify-between items-center">
          {!showAdd && !loading ? (
            <div className="flex gap-2">
              <button
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
              >
                <Plus className="h-4 w-4" /> Adicionar Step
              </button>
              <button
                onClick={() => setShowCopyPicker(true)}
                className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                title="Copiar steps de outra loja"
              >
                <Copy className="h-4 w-4" /> Copiar de outra loja
              </button>
            </div>
          ) : (
            <div />
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>

      {showCopyPicker && (
        <CopyStepsPicker
          targetStore={store}
          allStores={allStores}
          onClose={() => setShowCopyPicker(false)}
          onCopied={async () => {
            setShowCopyPicker(false);
            await fetchSteps();
          }}
        />
      )}

      {toDelete && (
        <ConfirmModal
          title="Excluir step"
          message={`Tem certeza que deseja excluir "${toDelete.name}"? Esta ação não pode ser desfeita.`}
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

// ---------------------------------------------------------------------------
// RemarketingCampaigns page
// ---------------------------------------------------------------------------

export default function RemarketingCampaigns() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const fetchStores = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/remarket/stores');
      setStores(res.data.items || []);
    } catch {
      setError('Erro ao carregar lojas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  function handleClose() {
    setSelected(null);
    fetchStores();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-violet-400" />
          Campanhas de Remarketing
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Configure os passos automáticos disparados quando um lead não conclui a compra. Cada loja tem sua própria sequência.
        </p>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        </div>
      )}
      {!loading && error && <p className="text-red-400 text-sm text-center py-8">{error}</p>}
      {!loading && !error && stores.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-16">Nenhuma loja cadastrada.</p>
      )}

      {!loading && !error && stores.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map((s) => (
            <button
              key={s.store_id}
              onClick={() => setSelected(s)}
              className="text-left bg-gray-800 border border-gray-700 hover:border-violet-500 rounded-xl p-4 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-mono text-gray-500">#{s.store_id}</div>
                  <h3 className="font-semibold text-white text-sm leading-tight">{s.store_name}</h3>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-500 group-hover:text-violet-400 shrink-0 mt-1" />
              </div>

              <div className="mt-3 flex items-center gap-3 text-xs">
                <span className="text-gray-400">
                  <span className="font-semibold text-white">{s.step_count || 0}</span> steps
                </span>
                {Number(s.email_steps) > 0 && (
                  <span className="inline-flex items-center gap-1 text-blue-300">
                    <Mail className="h-3 w-3" /> {s.email_steps}
                  </span>
                )}
                {Number(s.whatsapp_steps) > 0 && (
                  <span className="inline-flex items-center gap-1 text-green-300">
                    <MessageCircle className="h-3 w-3" /> {s.whatsapp_steps}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <CampaignStepsModal store={selected} allStores={stores} onClose={handleClose} />
      )}
    </div>
  );
}
