import { useState } from 'react';
import { X, Send, Loader2, CheckCircle, XCircle, Eye, MessageCircle, Pencil, CreditCard } from 'lucide-react';
import api from '@/services/api';
import Badge, { statusVariant } from '@/components/ui/Badge';
import { formatDateTime, formatCurrency } from '@/utils/format';

const REMARKET_STATUSES = ['create', 'pending'];

// Human-readable labels for MercadoPago payment_method_id / payment_type_id
const PAYMENT_METHOD_LABELS = {
  pix: 'Pix',
  bolbradesco: 'Boleto Bradesco',
  pec: 'Boleto (PEC)',
  pagofacil: 'Pago Fácil',
  rapipago: 'Rapipago',
  visa: 'Visa',
  master: 'Mastercard',
  amex: 'American Express',
  elo: 'Elo',
  hipercard: 'Hipercard',
  cabal: 'Cabal',
  naranja: 'Naranja',
  debvisa: 'Visa Débito',
  debmaster: 'Mastercard Débito',
  maestro: 'Maestro',
  melicard: 'Mercado Crédito',
};

const PAYMENT_TYPE_LABELS = {
  bank_transfer: 'Pix / TED',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  ticket: 'Boleto',
  prepaid_card: 'Cartão Pré-pago',
  digital_currency: 'Moeda Digital',
  digital_wallet: 'Carteira Digital',
};

function paymentMethodLabel(methodId, typeId) {
  if (!methodId && !typeId) return null;
  const method = PAYMENT_METHOD_LABELS[methodId] || methodId;
  const type = PAYMENT_TYPE_LABELS[typeId] || typeId;
  if (method && type && method !== type) return `${method} (${type})`;
  return method || type;
}

export default function TransactionDetailModal({ transaction: initialTx, onClose, onSaveSuccess }) {
  const [tx, setTx] = useState(initialTx);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState(null);
  const [remarketing, setRemarketing] = useState(false); // loading wpp link
  const [wppError, setWppError] = useState(''); // error message for wpp recovery

  const [isEditing, setIsEditing] = useState(false);
  const [editEmail, setEditEmail] = useState(initialTx.email || '');
  const [editPhone, setEditPhone] = useState(initialTx.phone || '');
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  const [simulatingStripe, setSimulatingStripe] = useState(false);
  const [stripeResult, setStripeResult] = useState(null);

  const showRemarketing = REMARKET_STATUSES.includes(tx.status) && tx.phone;
  // Transações Stripe gravam o Checkout Session ('cs_...') no campo mpid.
  const isStripe = typeof tx.mpid === 'string' && tx.mpid.startsWith('cs_');

  async function handleSaveDetails() {
    setDetailsError('');
    if (!editEmail.trim()) {
      setDetailsError('E-mail é obrigatório.');
      return;
    }
    setSavingDetails(true);
    try {
      await api.put(`/admin/transactions/${tx.id}`, {
        email: editEmail.trim(),
        phone: editPhone.trim() || null,
      });
      setTx(prev => ({
        ...prev,
        email: editEmail.trim(),
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

  async function handleOpenWpp() {
    setRemarketing(true);
    setWppError('');
    try {
      const res = await api.get(`/admin/remarket_wpp/${tx.id}`);
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

  async function handleSend() {
    if (tx.status !== 'approved' && !isStripe) {
      if (!window.confirm('A compra não foi paga. Gostaria de enviar mesmo assim (simulando notificação de pagamento)?')) {
        return;
      }
      setSending(true);
      setResults(null);
      setWppError('');
      
      try {
        const prefId = tx.preference_id || tx.mpid;
        const res = await api.get(`/simulate_notification_v2?preference_id=${prefId}`);
        setResults({
          email: { success: true, data: res.data },
          whats: null
        });
      } catch (err) {
        setResults({
          email: { success: false, error: err.response?.data?.error || 'Erro ao simular notificação.' },
          whats: null
        });
      } finally {
        setSending(false);
      }
      return;
    }

    setSending(true);
    setResults(null);
    setWppError('');

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

  async function handleSimulateStripe(force = false) {
    setSimulatingStripe(true);
    setStripeResult(null);
    setWppError('');
    try {
      const res = await api.post(`/admin/simulate_stripe/${tx.id}`, { force });
      const data = res.data || {};

      // Sessão ainda não 'paid' ou não recuperável no Stripe → oferece forçar.
      if (!data.ok && data.tip && !force) {
        if (window.confirm(`${data.tip}\n\nForçar a entrega mesmo assim?`)) {
          return await handleSimulateStripe(true);
        }
        setStripeResult({ success: false, message: data.tip });
        return;
      }

      if (data.ok) {
        setStripeResult({
          success: true,
          message: `Entrega disparada (status: ${data.payment_status || '—'}${data.forced ? ', forçado' : ''}).`,
        });
        if (onSaveSuccess) onSaveSuccess();
      } else {
        setStripeResult({ success: false, message: data.error || data.tip || 'Falha na simulação.' });
      }
    } catch (err) {
      setStripeResult({ success: false, message: err.response?.data?.error || 'Erro ao simular notificação Stripe.' });
    } finally {
      setSimulatingStripe(false);
    }
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
        <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            <InfoField label="ID" value={tx.id ?? '—'} />
            <InfoField label="Status">
              <Badge variant={statusVariant(tx.status)}>{tx.status || '—'}</Badge>
            </InfoField>
            {isEditing ? (
              <div className="col-span-2 grid grid-cols-2 gap-3 border border-violet-500/30 bg-violet-500/5 p-3 rounded-lg">
                <div className="col-span-2 text-xs font-semibold text-violet-400">Editar Dados do Cliente</div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-400 mb-1">E-mail *</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full rounded-md bg-gray-700 border border-gray-600 px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    required
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
                      setEditEmail(tx.email || '');
                      setEditPhone(tx.phone || '');
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
                    <span className="text-sm text-gray-200 break-all">{tx.email || '—'}</span>
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
                <InfoField label="Telefone" value={tx.phone || '—'} />
              </>
            )}
            <InfoField label="Produto" value={tx.title || '—'} />
            <InfoField label="Valor" value={formatCurrency(tx.value)} />
            <InfoField label="Data/Hora" value={formatDateTime(tx.datetime)} />
            <InfoField label="Loja" value={tx.store_name || '—'} />
            <InfoField label="MP ID (mpid)" value={tx.mpid || '—'} />
            <InfoField label="Payment ID" value={tx.payment_id || '—'} />
            <InfoField label="Preference ID" value={tx.preference_id || '—'} />
            <InfoField label="Campanha" value={tx.campaign || '—'} />
            {(tx.payment_method_id || tx.payment_type_id) && (
              <InfoField label="Meio de Pagamento">
                <PaymentBadge methodId={tx.payment_method_id} typeId={tx.payment_type_id} />
              </InfoField>
            )}
            {tx.issuer_name && (
              <InfoField label="Banco / Emissor" value={tx.issuer_name} />
            )}
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

          {/* Stripe simulation result */}
          {stripeResult && (
            <div className="pt-1">
              <ResultRow
                label="Simulação Stripe"
                result={stripeResult}
                message={stripeResult.message}
              />
            </div>
          )}
        </div>

        {/* WA Recovery error — outside scroll area so always visible */}
        {wppError && (
          <div className="mx-6 mt-3 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400">
            {wppError}
          </div>
        )}

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
          {isStripe && (
            <button
              type="button"
              onClick={() => handleSimulateStripe(false)}
              disabled={simulatingStripe}
              title="Simular notificação de pagamento aprovado do Stripe (re-dispara a entrega)"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold text-white transition-colors"
            >
              {simulatingStripe ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {simulatingStripe ? 'Simulando…' : 'Simular Stripe'}
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

function PaymentBadge({ methodId, typeId }) {
  const label = paymentMethodLabel(methodId, typeId);
  let color = 'bg-gray-600 text-gray-200';
  if (methodId === 'pix' || typeId === 'bank_transfer') color = 'bg-teal-600/30 text-teal-300';
  else if (typeId === 'credit_card') color = 'bg-blue-600/30 text-blue-300';
  else if (typeId === 'debit_card') color = 'bg-indigo-600/30 text-indigo-300';
  else if (typeId === 'ticket') color = 'bg-orange-600/30 text-orange-300';
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {label || '—'}
    </span>
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
