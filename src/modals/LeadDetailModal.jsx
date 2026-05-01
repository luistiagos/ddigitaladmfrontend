import { useState } from 'react';
import { X, Loader2, MessageCircle, Eye } from 'lucide-react';
import api from '@/services/api';
import Badge, { statusVariant } from '@/components/ui/Badge';
import { formatDateTime } from '@/utils/format';

export default function LeadDetailModal({ lead, onClose }) {
  const [remarketing, setRemarketing] = useState(false);
  const [wppError, setWppError] = useState('');

  async function handleOpenWpp() {
    setRemarketing(true);
    setWppError('');
    try {
      const res = await api.get(`/admin/remarket_wpp_lead/${lead.id}`);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-lg bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Eye className="h-4 w-4 text-violet-400" />
            Detalhes do Lead #{lead.id}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-2 gap-3">
            <InfoField label="ID" value={lead.id ?? '—'} />
            <InfoField label="Status">
              <Badge variant={statusVariant(lead.status)}>{lead.status || '—'}</Badge>
            </InfoField>
            <InfoField label="E-mail" value={lead.email || '—'} />
            <InfoField label="Telefone" value={lead.phone || '—'} />
            <InfoField label="Loja" value={lead.store_name || '—'} />
            <InfoField label="Data/Hora" value={formatDateTime(lead.dttime)} />
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
          {lead.phone && (
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
