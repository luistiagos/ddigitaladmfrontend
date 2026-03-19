import { useState, useEffect } from 'react';
import { X, Mail, MessageCircle, Loader2 } from 'lucide-react';
import api from '@/services/api';
import Badge, { statusVariant } from '@/components/ui/Badge';
import { formatDate, formatCurrency } from '@/utils/format';

export default function ClientProductsModal({ client, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState({}); // { `${product_id}_email`: bool, `${product_id}_whats`: bool }
  const [feedback, setFeedback] = useState({});

  useEffect(() => {
    api.get(`/admin/clients/${client.id}/products`)
      .then((res) => setItems(res.data.items || []))
      .catch(() => setError('Erro ao carregar produtos.'))
      .finally(() => setLoading(false));
  }, [client.id]);

  async function resend(product, via) {
    const key = `${product.product_id}_${via}`;
    setSending((s) => ({ ...s, [key]: true }));
    const payload = { email: client.email, product_id: product.product_id };
    if (via === 'whats') {
      payload.phone = product.phone || client.phone;
    }
    const endpoint = via === 'email' ? '/admin/resend_email' : '/admin/resend_whats';
    try {
      await api.post(endpoint, payload);
      setFeedback((f) => ({ ...f, [key]: 'ok' }));
    } catch {
      setFeedback((f) => ({ ...f, [key]: 'err' }));
    } finally {
      setSending((s) => ({ ...s, [key]: false }));
      setTimeout(() => setFeedback((f) => { const n = { ...f }; delete n[key]; return n; }), 3000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-2xl bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-white">Produtos do cliente</h2>
            <p className="text-xs text-gray-400 mt-0.5">{client.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-gray-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          )}
          {error && <p className="text-center py-12 text-sm text-red-400">{error}</p>}
          {!loading && !error && items.length === 0 && (
            <p className="text-center py-12 text-sm text-gray-500">Nenhum produto vinculado.</p>
          )}
          {!loading && items.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <Th>Produto</Th>
                  <Th>Data da Compra</Th>
                  <Th>Preço</Th>
                  <Th>Status</Th>
                  <Th>Ações</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const emailKey = `${item.product_id}_email`;
                  const whatsKey = `${item.product_id}_whats`;
                  return (
                    <tr key={item.product_id} className="border-b border-gray-800/60 hover:bg-gray-700/20">
                      <td className="px-4 py-3 font-medium text-white">{item.title}</td>
                      <td className="px-4 py-3 text-gray-300">{formatDate(item.purchase_date)}</td>
                      <td className="px-4 py-3 text-gray-300">{formatCurrency(item.price)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(item.transaction_status)}>
                          {item.transaction_status || '—'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ActionBtn
                            icon={<Mail className="h-3.5 w-3.5" />}
                            label="Email"
                            loading={sending[emailKey]}
                            feedback={feedback[emailKey]}
                            onClick={() => resend(item, 'email')}
                          />
                          {(item.phone || client.phone) && (
                            <ActionBtn
                              icon={<MessageCircle className="h-3.5 w-3.5" />}
                              label="WhatsApp"
                              loading={sending[whatsKey]}
                              feedback={feedback[whatsKey]}
                              onClick={() => resend(item, 'whats')}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-700 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-300 transition-colors">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function Th({ children }) {
  return <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{children}</th>;
}

function ActionBtn({ icon, label, loading, feedback, onClick }) {
  const base = 'inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors';
  let cls = base + ' bg-gray-700 hover:bg-gray-600 text-gray-300';
  if (feedback === 'ok') cls = base + ' bg-green-500/20 text-green-400';
  if (feedback === 'err') cls = base + ' bg-red-500/20 text-red-400';
  return (
    <button onClick={onClick} disabled={loading} className={cls + (loading ? ' opacity-60 cursor-not-allowed' : '')}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
}
