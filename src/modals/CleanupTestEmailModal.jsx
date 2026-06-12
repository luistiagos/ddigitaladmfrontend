import { useState } from 'react';
import { X, Search, Trash2, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '@/services/api';

const TABLES_ORDER = [
  ['whatsapp_outbox', 'whatsapp_outbox'],
  ['Outbox', 'Outbox'],
  ['LeadRemarketStore', 'LeadRemarketStore'],
  ['TemporalRemarketingWorkflow', 'TemporalRemarketingWorkflow'],
  ['Lead', 'Lead'],
  ['TransactionPackage', 'TransactionPackage'],
  ['FBPixelTransaction', 'FBPixelTransaction'],
  ['Transaction', 'Transaction'],
  ['UserPackage', 'UserPackage'],
  ['User', 'User'],
  ['Customer', 'Customer'],
  ['MPOrder', 'MPOrder'],
  ['SentCampaign', 'SentCampaign'],
  ['Sent', 'Sent'],
  ['EmailActivity', 'EmailActivity'],
  ['email_retry_queue', 'email_retry_queue'],
];

export default function CleanupTestEmailModal({ onClose, onDone }) {
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | previewing | preview | confirming | done | error
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function runDryRun(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setPhase('previewing');
    setErrorMsg('');
    setPreview(null);
    try {
      const res = await api.post('/admin/leads/cleanup-by-email', {
        email: email.trim(),
        dry_run: true,
      });
      setPreview(res.data);
      setPhase('preview');
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Erro ao verificar dados.');
      setPhase('error');
    }
  }

  async function runCleanup() {
    setPhase('confirming');
    setErrorMsg('');
    try {
      const res = await api.post('/admin/leads/cleanup-by-email', {
        email: email.trim(),
        dry_run: false,
      });
      setResult(res.data);
      setPhase('done');
      onDone?.();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Erro ao limpar dados.');
      setPhase('error');
    }
  }

  const counts = (phase === 'done' ? result?.counts : preview?.counts) || {};
  const totalRows = Object.values(counts).reduce((s, n) => s + (n || 0), 0);
  const hasData = totalRows > 0;

  const summaryData = phase === 'done' ? result : preview;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-lg bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="font-semibold text-white text-sm flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-400" />
              Limpar email de teste
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Remove todos os registros do email para permitir re-testes.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {/* Email input */}
          <form onSubmit={runDryRun} className="flex gap-2">
            <input
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (phase !== 'idle') {
                  setPhase('idle');
                  setPreview(null);
                  setResult(null);
                  setErrorMsg('');
                }
              }}
              disabled={phase === 'previewing' || phase === 'confirming'}
              className="flex-1 bg-gray-900 border border-gray-600 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!email.trim() || phase === 'previewing' || phase === 'confirming'}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              {phase === 'previewing' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Verificar
            </button>
          </form>

          {/* Error */}
          {phase === 'error' && (
            <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {errorMsg}
            </div>
          )}

          {/* Preview / Result */}
          {(phase === 'preview' || phase === 'done' || phase === 'confirming') && summaryData && (
            <>
              {/* IDs encontrados */}
              <div className="bg-gray-900/60 border border-gray-700 rounded-xl px-4 py-3 space-y-1 text-xs">
                <div className="flex gap-2">
                  <span className="text-gray-500 w-28 shrink-0">Lead IDs</span>
                  <span className="text-gray-300">
                    {summaryData.lead_ids?.length
                      ? summaryData.lead_ids.join(', ')
                      : '(nenhum)'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500 w-28 shrink-0">Transaction IDs</span>
                  <span className="text-gray-300">
                    {summaryData.transaction_ids?.length
                      ? summaryData.transaction_ids.join(', ')
                      : '(nenhum)'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500 w-28 shrink-0">User IDs</span>
                  <span className="text-gray-300">
                    {summaryData.user_ids?.length
                      ? summaryData.user_ids.join(', ')
                      : '(nenhum)'}
                  </span>
                </div>
                {summaryData.workflows?.length > 0 && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-28 shrink-0">Workflows</span>
                    <span className="text-gray-300">{summaryData.workflows.length} encontrado(s)</span>
                  </div>
                )}
              </div>

              {/* Contagem por tabela */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                  {phase === 'done' ? 'Registros removidos' : 'Registros a remover'}
                </p>
                <div className="space-y-1">
                  {TABLES_ORDER.map(([key, label]) => {
                    const n = counts[key] ?? 0;
                    return (
                      <div
                        key={key}
                        className={`flex items-center justify-between text-xs px-3 py-1.5 rounded-lg ${
                          n > 0
                            ? 'bg-red-500/8 border border-red-500/15 text-gray-300'
                            : 'bg-gray-700/20 text-gray-500'
                        }`}
                      >
                        <span className="font-mono">{label}</span>
                        <span className={n > 0 ? 'text-red-400 font-semibold' : ''}>
                          {n}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {phase === 'done' && summaryData.temporal_cancelled > 0 && (
                <p className="text-xs text-gray-400">
                  {summaryData.temporal_cancelled} workflow(s) Temporal cancelado(s).
                </p>
              )}
            </>
          )}

          {/* Empty state após verificação */}
          {phase === 'preview' && !hasData && (
            <div className="text-center py-4">
              <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-300">Banco já está limpo para este email.</p>
            </div>
          )}

          {/* Success */}
          {phase === 'done' && (
            <div className="flex items-center gap-2 text-sm text-green-300 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
              <CheckCircle className="h-4 w-4 shrink-0" />
              Pronto — banco limpo para novo teste.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 shrink-0 flex justify-end gap-2">
          {phase === 'done' ? (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
            >
              Fechar
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={phase === 'confirming'}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 text-sm rounded-lg transition-colors"
              >
                Cancelar
              </button>
              {phase === 'preview' && hasData && (
                <button
                  onClick={runCleanup}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Limpar dados
                </button>
              )}
              {phase === 'confirming' && (
                <button
                  disabled
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 opacity-60 text-white text-sm rounded-lg"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Limpando…
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
