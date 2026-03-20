import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Loader2, Tag } from 'lucide-react';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import ConfirmModal from '@/components/ui/ConfirmModal';

const EMPTY_FORM = { name: '', discount: '', product_id: '', valid_date: '' };

export default function Coupons() {
  const [cupons, setCupons] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

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

  function handleSort(column) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }

  function exportCSV() {
    const headers = ['Código', 'Desconto', 'Produto', 'Validade'];
    const rows = cupons.map(cupon => [
      cupon.name,
      `${Math.round((cupon.discount || 0) * 100)}%`,
      cupon.product_title || 'Todos os produtos',
      cupon.valid_date ? new Date(cupon.valid_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem validade'
    ]);
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cupons_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  function exportPDF() {
    window.print();
  }

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

      {/* Table */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <SortableTh column="name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Código</SortableTh>
                <SortableTh column="discount" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Desconto</SortableTh>
                <SortableTh column="product_title" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Produto</SortableTh>
                <SortableTh column="valid_date" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Validade</SortableTh>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-red-400 text-sm">{error}</td>
                </tr>
              )}
              {!loading && !error && cupons.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">Nenhum cupom cadastrado.</td>
                </tr>
              )}
              {!loading && !error && cupons.map((c) => (
                <tr key={c.id} className="border-b border-gray-800/60 hover:bg-gray-700/20 transition-colors">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs bg-gray-700 text-violet-300 px-2 py-1 rounded">
                      <Tag className="h-3 w-3" />{c.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="green">{Math.round((c.discount || 0) * 100)}% OFF</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {c.product_title || <span className="text-gray-500 text-xs">Todos os produtos</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {c.valid_date
                      ? new Date(c.valid_date + 'T00:00:00').toLocaleDateString('pt-BR')
                      : <span className="text-gray-600 text-xs">Sem validade</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(c)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </button>
                      <button
                        onClick={() => setToDelete(c)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-700 bg-gray-800/50">
                <td colSpan="5" className="px-4 py-3 text-sm text-gray-300">
                  Total: {cupons.length} cupom{cupons.length !== 1 ? 's' : ''}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {!loading && !error && cupons.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-700 flex justify-start gap-2">
            <button onClick={exportCSV} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded-lg transition-colors">
              CSV
            </button>
            <button onClick={exportPDF} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded-lg transition-colors">
              PDF
            </button>
          </div>
        )}
      </div>

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

function SortableTh({ children, column, sortColumn, sortDirection, onSort }) {
  const isActive = sortColumn === column;
  return (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-300 select-none"
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {isActive && (
          <span className="text-gray-500">
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  );
}
