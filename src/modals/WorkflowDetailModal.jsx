import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Loader2,
  Pause,
  Play,
  Ban,
  CheckCircle,
  RotateCw,
  Mail,
  MessageCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';

function workflowStatusVariant(status) {
  const s = (status || '').toLowerCase();
  if (['purchased', 'completed', 'sent'].some((k) => s.includes(k))) return 'green';
  if (['failed', 'canceled', 'cancelled', 'error'].some((k) => s.includes(k))) return 'red';
  if (['paused', 'waiting_manual_review', 'waiting'].some((k) => s.includes(k))) return 'yellow';
  if (['running', 'dispatching', 'started', 'submitted'].some((k) => s.includes(k))) return 'blue';
  if (s === 'skipped' || s === 'no_sequence') return 'gray';
  return 'gray';
}

function stepStatusVariant(status) {
  const s = (status || '').toLowerCase();
  if (s === 'sent') return 'green';
  if (s === 'queued') return 'blue';
  if (s === 'failed') return 'red';
  if (s === 'unknown') return 'yellow';
  return 'gray';
}

// Status em que o workflow já terminou no Temporal — não aceita mais
// signals (pause/resume/cancel/confirm/retry-step), todos retornariam erro.
const TERMINAL_STATUSES = [
  'completed',
  'purchased',
  'canceled',
  'cancelled',
  'error',
  'failed',
  'skipped',
  'no_sequence',
];

function isTerminalStatus(status) {
  return TERMINAL_STATUSES.includes((status || '').toLowerCase());
}

function fmt(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('pt-BR');
  } catch {
    return String(ts);
  }
}

function ChannelIcon({ channel }) {
  const c = (channel || '').toLowerCase();
  if (c === 'whatsapp') return <MessageCircle className="h-3.5 w-3.5 text-green-400" />;
  if (c === 'email') return <Mail className="h-3.5 w-3.5 text-blue-400" />;
  return <Clock className="h-3.5 w-3.5 text-gray-400" />;
}

export default function WorkflowDetailModal({ workflowId, onClose, onChange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingOn, setActingOn] = useState(null);
  const [actionMsg, setActionMsg] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/admin/remarket/workflows/${encodeURIComponent(workflowId)}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar workflow.');
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function runAction(label, path, body) {
    setActingOn(label);
    setActionMsg('');
    try {
      await api.post(`/admin/remarket/workflows/${encodeURIComponent(workflowId)}/${path}`, body || {});
      setActionMsg(`${label}: OK`);
      await fetchData();
      onChange?.();
    } catch (err) {
      setActionMsg(`${label}: ${err.response?.data?.error || 'falhou'}`);
    } finally {
      setActingOn(null);
    }
  }

  // Re-dispara o workflow do zero para o lead. Usado pelo "Tentar novamente"
  // quando o workflow já terminou — sinalizar um workflow morto dá erro.
  async function reRunWorkflow() {
    if (!data?.lead_id) {
      setActionMsg('Tentar novamente: lead_id indisponível');
      return;
    }
    setActingOn('Tentar novamente');
    setActionMsg('');
    try {
      await api.post('/admin/remarket/run-planner-for-lead', { lead_id: data.lead_id });
      setActionMsg('Tentar novamente: novo workflow disparado');
      await fetchData();
      onChange?.();
    } catch (err) {
      setActionMsg(`Tentar novamente: ${err.response?.data?.error || 'falhou'}`);
    } finally {
      setActingOn(null);
    }
  }

  const state = data?.live_state || data?.last_response_json?.state || null;
  const events = state?.events || [];
  const sentSteps = state?.sent_steps || [];
  const status = state?.status || data?.status || '—';
  const terminal = isTerminalStatus(status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-3xl bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 shrink-0">
          <div className="min-w-0">
            <h2 className="font-semibold text-white text-sm truncate">Workflow {workflowId}</h2>
            <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
              <Badge variant={workflowStatusVariant(status)}>{status}</Badge>
              {data?.live_error && (
                <span className="text-yellow-400 inline-flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> live: {data.live_error}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
            </div>
          )}

          {!loading && error && <p className="text-red-400 text-sm">{error}</p>}

          {!loading && !error && data && (
            <>
              {/* Lead + store info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-gray-500">Lead</div>
                  <div className="text-white">
                    #{data.lead_id} {data.lead_email || ''}
                  </div>
                  <div className="text-xs text-gray-400">{data.lead_phone || ''}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Loja</div>
                  <div className="text-white">{data.store_name || '—'}</div>
                  <div className="text-xs text-gray-400">campanha: {data.campaign_id}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Criado</div>
                  <div className="text-white">{fmt(data.created_at)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Última atualização</div>
                  <div className="text-white">{fmt(data.updated_at)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Ciclo atual</div>
                  <div className="text-white">
                    {state?.current_cycle ?? '—'} / {state?.max_cycles || '∞'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Step atual</div>
                  <div className="text-white">{state?.current_step_id || '—'}</div>
                </div>
              </div>

              {data.last_error && (
                <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <span className="font-semibold">Último erro:</span> {data.last_error}
                </div>
              )}

              {/* Sent steps */}
              <div>
                <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Steps enviados ({sentSteps.length})
                </h3>
                {sentSteps.length === 0 && (
                  <p className="text-xs text-gray-500">Nenhum step enviado ainda.</p>
                )}
                <div className="space-y-1.5">
                  {sentSteps.map((st, i) => (
                    <div
                      key={`${st.step_id}-${st.cycle}-${i}`}
                      className="bg-gray-700/30 border border-gray-700 rounded-lg px-3 py-2 flex items-center gap-3 text-xs"
                    >
                      <ChannelIcon channel={st.channel} />
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium truncate">
                          {st.step_id} <span className="text-gray-500">· ciclo {st.cycle}</span>
                        </div>
                        <div className="text-gray-400 truncate">
                          {fmt(st.sent_at_iso)}
                          {st.provider_message_id && ` · id ${st.provider_message_id}`}
                        </div>
                      </div>
                      <Badge variant={stepStatusVariant(st.status)}>{st.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Events timeline */}
              {events.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    Eventos ({events.length})
                  </h3>
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-2">
                    {events.map((ev, i) => (
                      <div key={i} className="text-xs flex items-start gap-2 py-1 border-b border-gray-700/50 last:border-0">
                        <span className="text-gray-500 font-mono shrink-0">{fmt(ev.at_iso || ev.timestamp_iso)}</span>
                        <span className="text-violet-300 shrink-0">{ev.event || ev.name}</span>
                        {ev.detail && <span className="text-gray-400 truncate">{ev.detail}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action footer */}
        <div className="px-6 py-4 border-t border-gray-700 shrink-0">
          {actionMsg && <div className="text-xs text-gray-300 mb-2">{actionMsg}</div>}
          {terminal && (
            <div className="text-xs text-gray-500 mb-2">
              Workflow finalizado ({status}). Use "Tentar novamente" para disparar um novo ciclo para este lead.
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {/* Pausar / Retomar / Confirmar step / Cancelar só fazem sentido
                enquanto o workflow está ativo — em estado terminal todos
                retornariam erro do Temporal. */}
            {!terminal && (
              <>
                <button
                  onClick={() => runAction('Pausar', 'pause')}
                  disabled={!!actingOn}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300 transition-colors disabled:opacity-60"
                >
                  {actingOn === 'Pausar' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />}
                  Pausar
                </button>
                <button
                  onClick={() => runAction('Retomar', 'resume')}
                  disabled={!!actingOn}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-300 transition-colors disabled:opacity-60"
                >
                  {actingOn === 'Retomar' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  Retomar
                </button>
                <button
                  onClick={() => runAction('Confirmar step', 'confirm-step')}
                  disabled={!!actingOn}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 transition-colors disabled:opacity-60"
                >
                  {actingOn === 'Confirmar step' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="h-3.5 w-3.5" />
                  )}
                  Confirmar step
                </button>
              </>
            )}
            {/* "Tentar novamente": em workflow ativo sinaliza retry do step;
                em workflow terminal re-dispara um novo workflow do zero. */}
            <button
              onClick={() => (terminal ? reRunWorkflow() : runAction('Tentar novamente', 'retry-step'))}
              disabled={!!actingOn}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 transition-colors disabled:opacity-60"
            >
              {actingOn === 'Tentar novamente' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCw className="h-3.5 w-3.5" />
              )}
              Tentar novamente
            </button>
            {!terminal && (
              <button
                onClick={() => runAction('Cancelar', 'cancel')}
                disabled={!!actingOn}
                className="ml-auto inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-60"
              >
                {actingOn === 'Cancelar' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                Cancelar workflow
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
