import { useState } from 'react';
import { X, Loader2, UserRoundPen } from 'lucide-react';
import api from '@/services/api';

export default function EditClientModal({ client, onClose, onSaveSuccess }) {
  const [email, setEmail] = useState(client.email || '');
  const [phone, setPhone] = useState(client.phone || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e) {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('E-mail é obrigatório.');
      return;
    }

    setSaving(true);
    try {
      await api.put(`/admin/clients/${client.id}`, {
        email: email.trim(),
        phone: phone.trim() || null,
      });
      if (onSaveSuccess) {
        onSaveSuccess();
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <UserRoundPen className="h-4 w-4 text-violet-400" />
            Editar Dados do Cliente
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              E-mail *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@exemplo.com"
              className={INPUT_CLS}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Telefone
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex: +5541999999999"
              className={INPUT_CLS}
            />
          </div>

          {/* Footer */}
          <div className="flex gap-2 pt-2 border-t border-gray-700/50 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold text-white transition-colors"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const INPUT_CLS =
  'w-full rounded-lg bg-gray-700/50 border border-gray-600 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition';
