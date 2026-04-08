import { useState } from 'react';
import { X, Send, Loader2, CheckCircle, XCircle, Eye, MessageCircle } from 'lucide-react';
import api from '@/services/api';
import Badge, { statusVariant } from '@/components/ui/Badge';
import { formatDateTime, formatCurrency } from '@/utils/format';

const REMARKET_STATUSES = ['create', 'pending'];

export default function TransactionDetailModal({ transaction: tx, onClose }) {
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState(null);
  const [remarketing, setRemarketing] = useState(false); // loading wpp link

  const showRemarketing = REMARKET_STATUSES.includes(tx.status) && tx.phone;

  async function handleOpenWpp() {
    setRemarketing(true);
    try {
      const res = await api.get(`/admin/remarket_wpp/${tx.id}`);
      const url = res.data?.wpp_url;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // silently ignore
    } finally {
      setRemarketing(false);
    }
  }

  async function handleSend() {
    setSending(true);
    setResults(null);

    const emailPayload = {
      email: tx.email,
      product_id: tx.product_id,
      ...(tx.mpid ? { mp_order_id: String(tx.mpid) } : {}),
    };
    const whatsPayload = {
      email: tx.email,
      phone: tx.phone || '',
      product_id: tx.product_id,
      ...(tx.mpid ? { mp_order_id: String(tx.mpid) } : {}),
    };

    const emailResult = await api.post('/admin/manualdeliver_v2', emailPayload)
      .then((r) => ({ success: true, data: r.data }))
      .catch((err) => ({ success: false, error: err.response?.data?.error || 'Erro ao enviar email.' }));

    let whatsResult = null;
    if (tx.phone) {
      whatsResult = await api.post('/admin/manualdeliver_whats_v2', whatsPayload)
        .then((r) => ({ success: true, data: r.data }))
        .catch((err) => ({ success: false, error: err.response?.data?.error || 'Erro ao enviar WhatsApp.' }));
    }

    setSending(false);
    setResults({ email: emailResult, whats: whatsResult });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-lg bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Eye className="h-4 w-4 text-violet-400" />
            Detalhes da Transação #{tx.id}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            <InfoField label="ID" value={tx.id ?? '—'} />
            <InfoField label="Status">
              <Badge variant={statusVariant(tx.status)}>{tx.status || '—'}</Badge>
            </InfoField>
            <InfoField label="E-mail" value={tx.email || '—'} />
            <InfoField label="Telefone" value={tx.phone || '—'} />
            <InfoField label="Produto" value={tx.title || '—'} />
            <InfoField label="Valor" value={formatCurrency(tx.value)} />
            <InfoField label="Data/Hora" value={formatDateTime(tx.datetime)} />
            <InfoField label="Loja" value={tx.store_name || '—'} />
            <InfoField label="MP ID (mpid)" value={tx.mpid || '—'} />
            <InfoField label="Payment ID" value={tx.payment_id || '—'} />
            <InfoField label="Preference ID" value={tx.preference_id || '—'} />
            <InfoField label="Campanha" value={tx.campaign || '—'} />
            <InfoField label="Cidade" value={tx.cidade ? `${tx.cidade}${tx.uf ? ` / ${tx.uf}` : ''}` : '—'} />
            <InfoField label="Estado" value={tx.uf_nome || '—'} />
            <InfoField label="CEP" value={tx.zipcode || '—'} />
          </div>

          {/* Send results */}
          {results && (
            <div className="space-y-2 pt-1">
              <ResultRow
                label="Email"
                result={results.email}
                message={results.email?.success ? 'Enviado com sucesso' : results.email?.error}
              />
              {results.whats && (
                <ResultRow
                  label="WhatsApp"
                  result={results.whats}
                  message={results.whats?.success ? 'Enviado com sucesso' : results.whats?.error}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap gap-2 px-6 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-300 transition-colors"
          >
            Fechar
          </button>
          {showRemarketing && (
            <button
              type="button"
              onClick={handleOpenWpp}
              disabled={remarketing}
              title={`Abrir WhatsApp Web com mensagem de recuperação (${tx.status})`}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold text-white transition-colors"
            >
              {remarketing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              {remarketing ? 'Gerando…' : 'WA Recovery'}
            </button>
          )}
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !!results}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold text-white transition-colors"
          >
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Send className="h-4 w-4" />
            {sending ? 'Enviando…' : 'Enviar'}
          </button>
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

function ResultRow({ label, result, message }) {
  const ok = result?.success;
  return (
    <div className={`flex items-start gap-3 rounded-lg p-3 ${ok ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
      {ok
        ? <CheckCircle className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
        : <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
      }
      <div>
        <div className={`text-xs font-semibold ${ok ? 'text-green-300' : 'text-red-300'}`}>{label}</div>
        <div className="text-xs text-gray-400 mt-0.5">{message}</div>
      </div>
    </div>
  );
}
