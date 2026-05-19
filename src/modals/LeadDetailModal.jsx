import { useState } from 'react';
import { X, Loader2, MessageCircle, Eye, Pencil } from 'lucide-react';
import api from '@/services/api';
import Badge, { statusVariant } from '@/components/ui/Badge';
import { formatDateTime } from '@/utils/format';

export default function LeadDetailModal({ lead: initialLead, onClose, onSaveSuccess }) {
  const [ld, setLd] = useState(initialLead);
  const [remarketing, setRemarketing] = useState(false);
  const [wppError, setWppError] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [editEmail, setEditEmail] = useState(initialLead.email || '');
  const [editPhone, setEditPhone] = useState(initialLead.phone || '');
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  async function handleOpenWpp() {
    setRemarketing(true);
    setWppError('');
    try {
      const res = await api.get(`/admin/remarket_wpp_lead/${ld.id}`);
      const url = res.data?.wpp_url;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        setWppError('Não foi possível gerar o link — telefone não encontrado.');
      }
    } catch (err) {
      setWppError(err.response?.data?.error || 'Erro ao gerar link de remarketing.');
    } finally {
      setRemarketing(false);
    }
  }

  async function handleSaveDetails() {
    setDetailsError('');
    setSavingDetails(true);
    try {
      await api.put(`/admin/leads/${ld.id}`, {
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
      });
      setLd(prev => ({
        ...prev,
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null
      }));
      setIsEditing(false);
      if (onSaveSuccess) {
        onSaveSuccess();
      }
    } catch (err) {
      setDetailsError(err.response?.data?.error || 'Erro ao salvar alterações.');
    } finally {
      setSavingDetails(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-lg bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Eye className="h-4 w-4 text-violet-400" />
            Detalhes do Lead #{ld.id}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-2 gap-3">
            <InfoField label="ID" value={ld.id ?? '—'} />
            <InfoField label="Status">
              <Badge variant={statusVariant(ld.status)}>{ld.status || '—'}</Badge>
            </InfoField>
            {isEditing ? (
              <div className="col-span-2 grid grid-cols-2 gap-3 border border-violet-500/30 bg-violet-500/5 p-3 rounded-lg">
                <div className="col-span-2 text-xs font-semibold text-violet-400">Editar Dados do Cliente</div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-400 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full rounded-md bg-gray-700 border border-gray-600 px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-400 mb-1">Telefone</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full rounded-md bg-gray-700 border border-gray-600 px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
                {detailsError && (
                  <div className="col-span-2 text-xs text-red-400 bg-red-500/10 p-1.5 rounded border border-red-500/20">{detailsError}</div>
                )}
                <div className="col-span-2 flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setEditEmail(ld.email || '');
                      setEditPhone(ld.phone || '');
                      setDetailsError('');
                    }}
                    className="px-2.5 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDetails}
                    disabled={savingDetails}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-60"
                  >
                    {savingDetails && <Loader2 className="h-3 w-3 animate-spin" />}
                    Salvar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <InfoField label="E-mail">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-200 break-all">{ld.email || '—'}</span>
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="text-violet-400 hover:text-violet-300 p-0.5"
                      title="Editar e-mail e telefone"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </InfoField>
                <InfoField label="Telefone" value={ld.phone || '—'} />
              </>
            )}
            <InfoField label="Loja" value={ld.store_name || '—'} />
            <InfoField label="Data/Hora" value={formatDateTime(ld.dttime)} />
          </div>
        </div>

        {/* WA error */}
        {wppError && (
          <div className="mx-6 mt-3 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400">
            {wppError}
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-wrap gap-2 px-6 pb-5 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-300 transition-colors"
          >
            Fechar
          </button>
          {ld.phone && (
            <button
              type="button"
              onClick={handleOpenWpp}
              disabled={remarketing}
              title="Abrir WhatsApp Web com mensagem de recuperação"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold text-white transition-colors"
            >
              {remarketing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              {remarketing ? 'Gerando…' : 'WA Recovery'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value, children }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-0.5 font-medium">{label}</div>
      {children ?? <div className="text-sm text-gray-200 break-all">{value}</div>}
    </div>
  );
}
