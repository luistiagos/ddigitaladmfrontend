import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  RefreshCw,
  Eye,
  Activity,
  Calendar,
  Clock,
  User,
  Terminal,
  BrainCircuit,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Hash,
} from 'lucide-react';
import api from '@/services/api';
import Pagination from '@/components/ui/Pagination';
import { EmptyRow, ErrorRow, LoadingRows } from '@/components/ui/TableStates';
import { formatDateTime } from '@/utils/format';

const PER_PAGE = 20;
const INP_CLS = 'w-full bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500 placeholder-gray-500';

function outcomeBadge(outcome, fallbackUsed, sanitized) {
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
}

function prettyJson(jsonStr) {
  if (!jsonStr) return '—';
  try {
    const parsed = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return jsonStr;
  }
}

export default function WhatsAppTelemetry() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [agentOptions, setAgentOptions] = useState([]);
  const [jidFilter, setJidFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');

  const [detailId, setDetailId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [activeTab, setActiveTab] = useState('summary');

  // Load agents list for the dropdown filter
  useEffect(() => {
    api.get('/admin/wpp/agents')
      .then((res) => {
        const options = (res.data?.agents || []).filter((a) => a.value);
        setAgentOptions(options);
      })
      .catch(() => {});
  }, []);

  const loadTelemetry = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(PER_PAGE),
      });
      if (jidFilter.trim()) params.set('jid', jidFilter.trim());
      if (agentFilter) params.set('agent_name', agentFilter);
      if (outcomeFilter) params.set('outcome', outcomeFilter);

      const res = await api.get(`/admin/wpp/telemetry?${params.toString()}`);
      setRows(res.data?.items || []);
      setTotal(Number(res.data?.total || 0));
    } catch {
      setError('Erro ao carregar telemetria do agente.');
    } finally {
      setLoading(false);
    }
  }, [page, jidFilter, agentFilter, outcomeFilter]);

  useEffect(() => {
    loadTelemetry();
  }, [loadTelemetry]);

  // Fetch full details of a specific telemetry entry
  const openDetailModal = async (id) => {
    setDetailId(id);
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

  const closeDetailModal = () => {
    setDetailId(null);
    setDetailData(null);
    setDetailError('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Telemetria do Agente</h1>
          <p className="text-sm text-gray-400">
            Monitore e audite latência, retries, sanitizações, fallbacks e rejeições das gerações dos agentes de IA.
          </p>
        </div>
        <button
          type="button"
          onClick={loadTelemetry}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-100 text-sm transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      {/* Filters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-900/20 p-4 rounded-xl border border-gray-800">
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-wide text-gray-500">Conversa (JID / Telefone)</span>
          <input
            className={INP_CLS}
            placeholder="Ex: 5511999999999..."
            value={jidFilter}
            onChange={(e) => { setPage(1); setJidFilter(e.target.value); }}
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs uppercase tracking-wide text-gray-500">Agente</span>
          <select
            className={INP_CLS}
            value={agentFilter}
            onChange={(e) => { setPage(1); setAgentFilter(e.target.value); }}
          >
            <option value="">Todos</option>
            {agentOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs uppercase tracking-wide text-gray-500">Resultado (Outcome)</span>
          <select
            className={INP_CLS}
            value={outcomeFilter}
            onChange={(e) => { setPage(1); setOutcomeFilter(e.target.value); }}
          >
            <option value="">Todos</option>
            <option value="success">Sucesso (Normal)</option>
            <option value="silent">Silêncio (Silent)</option>
            <option value="error">Erros</option>
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              setJidFilter('');
              setAgentFilter('');
              setOutcomeFilter('');
              setPage(1);
            }}
            className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg border border-gray-700 transition-colors"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-400">
        Registros encontrados: {total}
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900/40">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-800 bg-gray-900/60">
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Cliente (JID)</th>
              <th className="px-4 py-3">Agente</th>
              <th className="px-4 py-3">Modelo</th>
              <th className="px-4 py-3 text-right">Latência</th>
              <th className="px-4 py-3">Resultado</th>
              <th className="px-4 py-3 text-center">Retries / Fallback</th>
              <th className="px-4 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && <LoadingRows cols={8} rows={8} />}
            {!loading && error && <ErrorRow cols={8} message={error} onRetry={loadTelemetry} />}
            {!loading && !error && rows.length === 0 && <EmptyRow cols={8} message="Nenhum log de telemetria encontrado." />}

            {!loading && !error && rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-800/80 hover:bg-gray-800/20 transition-colors align-middle">
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDateTime(row.created_at)}</td>
                <td className="px-4 py-3 font-mono text-xs text-violet-300 max-w-[160px] truncate" title={row.jid}>
                  {row.jid ? row.jid.split('@')[0] : '—'}
                </td>
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
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs">
                    <span className={row.retry_count > 0 ? 'text-amber-400 font-bold' : 'text-gray-500'}>
                      {row.retry_count} retries
                    </span>
                    {row.fallback_used === 1 && (
                      <span className="bg-orange-500/20 text-orange-300 border border-orange-500/30 px-1.5 py-0.2 rounded text-[10px] uppercase font-bold">
                        Fallback
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => openDetailModal(row.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Ver Detalhes
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} perPage={PER_PAGE} total={total} onChange={setPage} />

      {/* Details Modal */}
      {detailId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl rounded-xl border border-gray-700 bg-gray-900 shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between shrink-0 bg-gray-950/60 rounded-t-xl">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity className="h-5 w-5 text-violet-400" />
                  Auditoria de Geração #{detailId}
                </h2>
                {detailData && (
                  <p className="text-xs text-gray-400 mt-1 font-mono">
                    JID: {detailData.jid} | Data: {formatDateTime(detailData.created_at)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeDetailModal}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {loadingDetail && (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                  <p className="text-sm text-gray-400">Buscando telemetria completa no banco de dados...</p>
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
                      { id: 'summary', label: 'Resumo da Resposta', icon: Calendar },
                      { id: 'messages', label: 'Mensagens Enviadas (Prompt)', icon: FileJson },
                      { id: 'reasoning', label: 'Raciocínio (Thought)', icon: BrainCircuit },
                      { id: 'raw', label: 'Saída Bruta (LLM)', icon: Terminal },
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

                  {/* Tab Content: Summary */}
                  {activeTab === 'summary' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Left: General Stats */}
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
                          </div>
                        </div>

                        {/* DB Trace Info */}
                        <div className="bg-gray-950/40 p-4 rounded-xl border border-gray-800/60 space-y-3">
                          <h3 className="text-xs uppercase tracking-wider text-gray-500 font-bold border-b border-gray-800 pb-1.5">
                            Trace de Contexto (Bug 2026-07-03)
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

                            <span className="text-gray-400">Conversas Distintas no Contexto:</span>
                            <span className={`font-semibold ${detailData.history_conversations > 2 ? 'text-red-400 animate-pulse' : 'text-gray-200'}`}>
                              {detailData.history_conversations ?? '—'} 
                              {detailData.history_conversations > 2 && ' (SINAL DE CONTAMINAÇÃO!)'}
                            </span>

                            <span className="text-gray-400">Aliases Encontrados:</span>
                            <span className="text-gray-200">{detailData.aliases_count ?? '—'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Outcomes & Flags */}
                      <div className="space-y-4">
                        <div className="bg-gray-950/40 p-4 rounded-xl border border-gray-800/60 space-y-3">
                          <h3 className="text-xs uppercase tracking-wider text-gray-500 font-bold border-b border-gray-800 pb-1.5">
                            Flags de Processamento
                          </h3>
                          <div className="space-y-2.5 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Sanitizado pelo Chokepoint:</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${detailData.sanitized ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' : 'bg-gray-800 text-gray-500'}`}>
                                {detailData.sanitized ? 'SIM' : 'NÃO'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Usou Resposta de Fallback:</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${detailData.fallback_used ? 'bg-orange-600/20 text-orange-300 border border-orange-500/30' : 'bg-gray-800 text-gray-500'}`}>
                                {detailData.fallback_used ? 'SIM' : 'NÃO'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Número de Tentativas (Retry):</span>
                              <span className={`font-semibold ${detailData.retry_count > 0 ? 'text-amber-400' : 'text-gray-200'}`}>
                                {detailData.retry_count || 0} {detailData.retry_count === 1 ? 'tentativa' : 'tentativas'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Quantidade de Blocos:</span>
                              <span className="text-gray-200 font-semibold">{detailData.blocks_count || 0}</span>
                            </div>
                          </div>
                        </div>

                        {/* Incomplete / Failure Details */}
                        {(detailData.incomplete_reason || detailData.outcome?.toLowerCase().includes('error')) && (
                          <div className="bg-red-950/20 border border-red-800/40 p-4 rounded-xl space-y-2">
                            <div className="flex items-center gap-1.5 text-red-400 text-xs uppercase tracking-wider font-bold">
                              <AlertTriangle className="h-4 w-4" /> Detalhes da Rejeição
                            </div>
                            <div className="text-sm">
                              <div className="text-gray-400">Razão da Incompletude (Prompt):</div>
                              <div className="text-red-300 font-mono text-xs mt-1 bg-red-950/40 p-2 rounded border border-red-900/30">
                                {detailData.incomplete_reason || '—'}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tab Content: Messages */}
                  {activeTab === 'messages' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wide text-gray-500">Histórico de Mensagens Enviado ao Provedor</span>
                        <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">rejected_messages_json</span>
                      </div>
                      {detailData.rejected_messages_json ? (
                        <pre className="p-4 bg-gray-950 text-emerald-400 font-mono text-xs rounded-xl border border-gray-800 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[55vh]">
                          {prettyJson(detailData.rejected_messages_json)}
                        </pre>
                      ) : (
                        <div className="py-12 text-center text-gray-500 border border-dashed border-gray-800 rounded-xl">
                          Nenhum histórico de entrada registrado para esta geração.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab Content: Reasoning */}
                  {activeTab === 'reasoning' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wide text-gray-500">Pensamento Interno (Reasoning Content)</span>
                        <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">rejected_reasoning_content</span>
                      </div>
                      {detailData.rejected_reasoning_content ? (
                        <div className="p-4 bg-gray-950/60 text-gray-300 rounded-xl border border-gray-800 whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-[55vh] overflow-y-auto">
                          {detailData.rejected_reasoning_content}
                        </div>
                      ) : (
                        <div className="py-12 text-center text-gray-500 border border-dashed border-gray-800 rounded-xl">
                          Nenhum conteúdo de raciocínio estruturado (raciocínio-only) foi salvo nesta geração.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab Content: Raw Output */}
                  {activeTab === 'raw' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wide text-gray-500">Saída Bruta Recebida da API do Modelo</span>
                        <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">rejected_raw_content</span>
                      </div>
                      {detailData.rejected_raw_content ? (
                        <pre className="p-4 bg-gray-950 text-gray-300 font-mono text-xs rounded-xl border border-gray-800 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[55vh]">
                          {detailData.rejected_raw_content}
                        </pre>
                      ) : (
                        <div className="py-12 text-center text-gray-500 border border-dashed border-gray-800 rounded-xl">
                          Nenhum conteúdo bruto de resposta registrado para esta geração.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab Content: Final Output */}
                  {activeTab === 'final' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wide text-gray-500">Resposta Final Enviada ou Sanitizada</span>
                        <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">rejected_response_text</span>
                      </div>
                      {detailData.rejected_response_text ? (
                        <div className="p-4 bg-gray-950/60 text-gray-100 rounded-xl border border-gray-800 whitespace-pre-wrap font-sans text-sm leading-relaxed max-h-[55vh] overflow-y-auto">
                          {detailData.rejected_response_text}
                        </div>
                      ) : (
                        <div className="py-12 text-center text-gray-500 border border-dashed border-gray-800 rounded-xl">
                          Nenhum texto final salvo para esta geração (ex: erro técnico antes de compilar resposta).
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-gray-700 flex justify-end bg-gray-950/30 rounded-b-xl shrink-0">
              <button
                type="button"
                onClick={closeDetailModal}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-semibold transition-colors"
              >
                Fechar Auditoria
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
