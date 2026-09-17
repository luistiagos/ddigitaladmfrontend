/**
 * SessionTelemetryModal — as geracoes do agente nesta conversa.
 *
 * Extraido de `pages/WhatsAppSessions.jsx` para a tela de Chamados poder agir sobre a MESMA
 * sessao pelos MESMOS portoes, sem criar um caminho de escrita proprio (EARS-16). As props
 * existentes nao mudaram; o que entrou foi o `ticketId` opcional, que diz em qual chamado a
 * acao deve ser auditada (design §10, R9).
 *
 * Spec: docs/modules/chatbot-whatsapp/changes/2026-09-05-painel-de-escalonamentos-do-suporte/
 */
import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, BrainCircuit, FileJson, CheckCircle2, AlertTriangle, Terminal, Hash, Activity, Calendar } from 'lucide-react';
import api from '@/services/api';
import { formatUtcDateTime } from '@/utils/format';

export default function SessionTelemetryModal({ lid, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedId, setSelectedId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [activeTab, setActiveTab] = useState('summary');

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/admin/wpp/telemetry?jid=${encodeURIComponent(lid)}&per_page=100`);
      setItems(res.data?.items || []);
    } catch {
      setError('Erro ao carregar telemetria para esta conversa.');
    } finally {
      setLoading(false);
    }
  }, [lid]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const openDetail = async (id) => {
    setSelectedId(id);
    setLoadingDetail(true);
    setDetailError('');
    setDetailData(null);
    setActiveTab('summary');
    try {
      const res = await api.get(`/admin/wpp/telemetry/${id}`);
      setDetailData(res.data);
    } catch {
      setDetailError('Falha ao buscar detalhes da telemetria.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const outcomeBadge = (outcome, fallbackUsed, sanitized) => {
    if (!outcome) return 'bg-gray-700 text-gray-200 border border-gray-600';
    const outLower = outcome.toLowerCase();
    if (outLower.includes('error') || outLower.includes('fail')) {
      return 'bg-red-500/20 text-red-300 border border-red-500/40';
    }
    if (outLower.includes('silent')) {
      return 'bg-amber-500/20 text-amber-300 border border-amber-500/40';
    }
    if (fallbackUsed) {
      return 'bg-blue-500/20 text-blue-300 border border-blue-500/40';
    }
    if (sanitized) {
      return 'bg-violet-500/20 text-violet-300 border border-violet-500/40';
    }
    return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
  };

  const prettyJson = (jsonStr) => {
    if (!jsonStr) return '—';
    try {
      const parsed = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonStr;
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-xl border border-gray-700 bg-gray-900 shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between shrink-0 bg-gray-950/60 rounded-t-xl">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-violet-400" />
              Telemetria da Conversa
            </h2>
            <p className="text-xs text-gray-400 mt-1 font-mono truncate max-w-[500px]" title={lid}>
              JID: {lid}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {selectedId === null ? (
            /* Telemetry List */
            <>
              {loading && (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                  <p className="text-sm text-gray-400">Buscando telemetria desta conversa...</p>
                </div>
              )}

              {error && (
                <div className="py-12 text-center text-red-400 flex flex-col items-center justify-center gap-2">
                  <AlertTriangle className="h-10 w-10 text-red-500" />
                  <p>{error}</p>
                </div>
              )}

              {!loading && !error && items.length === 0 && (
                <div className="py-16 text-center text-gray-500 border border-dashed border-gray-800 rounded-xl">
                  Nenhum log de telemetria encontrado para esta conversa.
                </div>
              )}

              {!loading && !error && items.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900/40">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-800 bg-gray-900/60">
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Agente</th>
                        <th className="px-4 py-3">Modelo</th>
                        <th className="px-4 py-3 text-right">Latência</th>
                        <th className="px-4 py-3">Resultado</th>
                        <th className="px-4 py-3 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row) => (
                        <tr key={row.id} className="border-b border-gray-800/80 hover:bg-gray-800/20 transition-colors align-middle">
                          <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatUtcDateTime(row.created_at)}</td>
                          <td className="px-4 py-3 text-gray-300 font-semibold">{row.agent_name || '—'}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{row.model || '—'}</td>
                          <td className="px-4 py-3 text-right text-gray-300 whitespace-nowrap">
                            {row.latency_ms ? `${(row.latency_ms / 1000).toFixed(2)}s` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${outcomeBadge(row.outcome, row.fallback_used, row.sanitized)}`}>
                              {row.outcome || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openDetail(row.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs transition-colors"
                            >
                              Detalhes
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            /* Telemetry Detail */
            <>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition-colors"
                >
                  ← Voltar para a lista
                </button>
                {detailData && (
                  <span className="text-xs text-violet-400 font-mono">
                    Geração #{selectedId}
                  </span>
                )}
              </div>

              {loadingDetail && (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                  <p className="text-sm text-gray-400">Buscando telemetria completa...</p>
                </div>
              )}

              {detailError && (
                <div className="py-12 text-center text-red-400 flex flex-col items-center justify-center gap-2">
                  <AlertTriangle className="h-10 w-10 text-red-500" />
                  <p>{detailError}</p>
                </div>
              )}

              {detailData && (
                <>
                  {/* Tabs Navigation */}
                  <div className="flex border-b border-gray-800 shrink-0 bg-gray-900/60 p-1 rounded-lg gap-1">
                    {[
                      { id: 'summary', label: 'Resumo', icon: Calendar },
                      { id: 'messages', label: 'Mensagens (Prompt)', icon: FileJson },
                      { id: 'reasoning', label: 'Raciocínio', icon: BrainCircuit },
                      { id: 'raw', label: 'Saída Bruta', icon: Terminal },
                      { id: 'final', label: 'Texto Final', icon: CheckCircle2 }
                    ].map((tab) => {
                      const Icon = tab.icon;
                      const active = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTab(tab.id)}
                          className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-md transition-colors ${
                            active
                              ? 'bg-violet-600 text-white shadow-md'
                              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Summary */}
                  {activeTab === 'summary' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 space-y-4">
                        <div className="bg-gray-950/40 p-4 rounded-xl border border-gray-800/60 space-y-3">
                          <h3 className="text-xs uppercase tracking-wider text-gray-500 font-bold border-b border-gray-800 pb-1.5">
                            Dados da Execução
                          </h3>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <span className="text-gray-400">Agente:</span>
                            <span className="text-gray-200 font-semibold">{detailData.agent_name || '—'}</span>

                            <span className="text-gray-400">Modelo:</span>
                            <span className="text-gray-200 font-mono text-xs">{detailData.model || '—'}</span>

                            <span className="text-gray-400">Temperatura:</span>
                            <span className="text-gray-200">{detailData.temperature ?? '—'}</span>

                            <span className="text-gray-400">Latência do LLM:</span>
                            <span className="text-violet-300 font-semibold">
                              {detailData.latency_ms ? `${(detailData.latency_ms / 1000).toFixed(2)}s (${detailData.latency_ms} ms)` : '—'}
                            </span>

                            <span className="text-gray-400">Resultado / Desfecho:</span>
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold border ${outcomeBadge(detailData.outcome, detailData.fallback_used, detailData.sanitized)}`}>
                              {detailData.outcome || '—'}
                            </span>

                            <span className="text-gray-400">Finish Reason (LLM):</span>
                            <span className="text-gray-200 font-mono text-xs">{detailData.finish_reason || '—'}</span>

                            <span className="text-gray-400">Versão do Prompt:</span>
                            <span className="text-gray-200 font-mono text-xs">{detailData.prompt_version || '—'}</span>

                            <span className="text-gray-400">Arquivos do Prompt:</span>
                            <span className="text-gray-200 font-mono text-xs whitespace-pre-wrap">{detailData.prompt_files || '—'}</span>
                          </div>
                        </div>

                        <div className="bg-gray-950/40 p-4 rounded-xl border border-gray-800/60 space-y-3">
                          <h3 className="text-xs uppercase tracking-wider text-gray-500 font-bold border-b border-gray-800 pb-1.5">
                            Trace de Contexto
                          </h3>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <span className="text-gray-400 flex items-center gap-1.5">
                              <Hash className="h-3.5 w-3.5 text-gray-500" /> ID da Mensagem de Gatilho:
                            </span>
                            <span className="text-gray-300 font-mono text-xs truncate" title={detailData.trigger_msg_id}>
                              {detailData.trigger_msg_id || '—'}
                            </span>

                            <span className="text-gray-400">Linhas de Histórico Lidas:</span>
                            <span className="text-gray-200">{detailData.history_rows ?? '—'}</span>

                            <span className="text-gray-400">Conversas Distintas:</span>
                            <span className={`font-semibold ${detailData.history_conversations > 2 ? 'text-red-400' : 'text-gray-200'}`}>
                              {detailData.history_conversations ?? '—'}
                            </span>

                            <span className="text-gray-400">Aliases Encontrados:</span>
                            <span className="text-gray-200">{detailData.aliases_count ?? '—'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="bg-gray-950/40 p-4 rounded-xl border border-gray-800/60 space-y-3">
                          <h3 className="text-xs uppercase tracking-wider text-gray-500 font-bold border-b border-gray-800 pb-1.5">
                            Flags
                          </h3>
                          <div className="space-y-2.5 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Sanitizado:</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${detailData.sanitized ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' : 'bg-gray-800 text-gray-500'}`}>
                                {detailData.sanitized ? 'SIM' : 'NÃO'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Fallback:</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${detailData.fallback_used ? 'bg-orange-600/20 text-orange-300 border border-orange-500/30' : 'bg-gray-800 text-gray-500'}`}>
                                {detailData.fallback_used ? 'SIM' : 'NÃO'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Retries:</span>
                              <span className="text-gray-200 font-semibold">{detailData.retry_count || 0}</span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Blocos:</span>
                              <span className="text-gray-200 font-semibold">{detailData.blocks_count || 0}</span>
                            </div>
                          </div>
                        </div>

                        {(detailData.incomplete_reason || detailData.outcome?.toLowerCase().includes('error')) && (
                          <div className="bg-red-950/20 border border-red-800/40 p-4 rounded-xl space-y-2">
                            <div className="text-xs uppercase tracking-wider font-bold text-red-400 flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5" /> Rejeição
                            </div>
                            <div className="text-xs text-red-300 font-mono bg-red-950/40 p-2 rounded">
                              {detailData.incomplete_reason || '—'}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Messages */}
                  {activeTab === 'messages' && (
                    <div className="space-y-2">
                      <span className="text-xs uppercase tracking-wide text-gray-500 block">Histórico de Mensagens</span>
                      {detailData.rejected_messages_json ? (
                        <pre className="p-4 bg-gray-950 text-emerald-400 font-mono text-xs rounded-xl border border-gray-800 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[50vh]">
                          {prettyJson(detailData.rejected_messages_json)}
                        </pre>
                      ) : (
                        <div className="py-12 text-center text-gray-500 border border-dashed border-gray-800 rounded-xl">
                          Nenhum histórico registrado.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reasoning */}
                  {activeTab === 'reasoning' && (
                    <div className="space-y-2">
                      <span className="text-xs uppercase tracking-wide text-gray-500 block">Raciocínio (Thought)</span>
                      {detailData.rejected_reasoning_content ? (
                        <div className="p-4 bg-gray-950/60 text-gray-300 rounded-xl border border-gray-800 whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-[50vh] overflow-y-auto">
                          {detailData.rejected_reasoning_content}
                        </div>
                      ) : (
                        <div className="py-12 text-center text-gray-500 border border-dashed border-gray-800 rounded-xl">
                          Nenhum raciocínio registrado.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Raw Output */}
                  {activeTab === 'raw' && (
                    <div className="space-y-2">
                      <span className="text-xs uppercase tracking-wide text-gray-500 block">Saída Bruta</span>
                      {detailData.rejected_raw_content ? (
                        <pre className="p-4 bg-gray-950 text-gray-300 font-mono text-xs rounded-xl border border-gray-800 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[50vh]">
                          {detailData.rejected_raw_content}
                        </pre>
                      ) : (
                        <div className="py-12 text-center text-gray-500 border border-dashed border-gray-800 rounded-xl">
                          Nenhuma resposta bruta registrada.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Final Output */}
                  {activeTab === 'final' && (
                    <div className="space-y-2">
                      <span className="text-xs uppercase tracking-wide text-gray-500 block">Resposta Final</span>
                      {detailData.rejected_response_text ? (
                        <div className="p-4 bg-gray-950/60 text-gray-100 rounded-xl border border-gray-800 whitespace-pre-wrap font-sans text-sm leading-relaxed max-h-[50vh] overflow-y-auto">
                          {detailData.rejected_response_text}
                        </div>
                      ) : (
                        <div className="py-12 text-center text-gray-500 border border-dashed border-gray-800 rounded-xl">
                          Nenhuma resposta final registrada.
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-gray-700 flex justify-end bg-gray-950/30 rounded-b-xl shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-semibold transition-colors"
          >
            Fechar Telemetria
          </button>
        </div>
      </div>
    </div>
  );
}
