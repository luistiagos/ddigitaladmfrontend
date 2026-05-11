import { useState } from 'react';
import { X, Link, Loader2, CheckCircle, XCircle } from 'lucide-react';
import api from '@/services/api';

export default function SendMemberAreaLinkModal({ onClose }) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  async function handleSend(e) {
    e.preventDefault();
    setError('');

    if (!email && !phone) {
      setError('Informe pelo menos email ou WhatsApp.');
      return;
    }

    setSending(true);
    try {
      const res = await api.post('/admin/send_member_area_link', {
        email: email.trim(),
        phone: phone.trim(),
      });
      setResults(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao enviar.');
    } finally {
      setSending(false);
    }
  }

  const done = !!results;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Link className="h-4 w-4 text-violet-400" />
            Enviar Link da Área de Membros
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          {!done ? (
            <form onSubmit={handleSend} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cliente@exemplo.com"
                  className={INPUT_CLS}
                />
              </Field>

              <Field label="WhatsApp (opcional)">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+5541999999999"
                  className={INPUT_CLS}
                />
              </Field>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold text-white transition-colors"
                >
                  {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {sending ? 'Enviando…' : 'Enviar Link'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {results.email && (
                <ResultRow
                  label="Email"
                  ok={results.email.success}
                  message={results.email.success ? 'Enviado com sucesso' : results.email.error}
                />
              )}
              {results.whats && (
                <ResultRow
                  label="WhatsApp"
                  ok={results.whats.success}
                  message={results.whats.success ? 'Enviado com sucesso' : results.whats.error}
                />
              )}
              {results.link && (
                <div className="rounded-lg bg-gray-700/50 border border-gray-600 px-3 py-2.5 text-xs text-gray-400 break-all">
                  <span className="text-gray-500 mr-1">Link:</span>
                  {results.link}
                </div>
              )}
              <button
                onClick={onClose}
                className="mt-4 w-full px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ResultRow({ label, ok, message }) {
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

const INPUT_CLS = 'w-full rounded-lg bg-gray-700/50 border border-gray-600 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition';
