/**
 * HistoryModal — o historico da conversa, com exportacao e telemetria.
 *
 * Extraido de `pages/WhatsAppSessions.jsx` para a tela de Chamados poder agir sobre a MESMA
 * sessao pelos MESMOS portoes, sem criar um caminho de escrita proprio (EARS-16). As props
 * existentes nao mudaram; o que entrou foi o `ticketId` opcional, que diz em qual chamado a
 * acao deve ser auditada (design §10, R9).
 *
 * Spec: docs/modules/chatbot-whatsapp/changes/2026-09-05-painel-de-escalonamentos-do-suporte/
 */
import { useState, useEffect } from 'react';
import { History, X, Download, Loader2, Activity } from 'lucide-react';
import api from '@/services/api';
import { formatUtcDateTime } from '@/utils/format';
import { getAgentLabel, getSessionKey, downloadJson, exportFilename } from './sessionHelpers';
import SessionTelemetryModal from './SessionTelemetryModal';

export default function HistoryModal({ session, agents, anonymizeExport, onClose }) {
  const lid = getSessionKey(session);
  const [messages, setMessages] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [showTelemetry, setShowTelemetry] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api.get(`/admin/wpp/sessions/${encodeURIComponent(lid)}/messages?limit=5000`)
      .then((res) => {
        if (!alive) return;
        setMessages(res.data.items || []);
        setTotal(res.data.total || 0);
      })
      .catch(() => {
        if (alive) setError('Erro ao carregar histórico.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [lid]);

  async function exportSession() {
    setExporting(true);
    setExportError('');
    try {
      const params = new URLSearchParams({
        anonymize: anonymizeExport ? '1' : '0',
        message_limit: '5000',
      });
      const res = await api.get(`/admin/wpp/sessions/${encodeURIComponent(lid)}/export?${params}`);
      downloadJson(res.data, exportFilename('whatsapp_conversa'));
    } catch (err) {
      setExportError(err.response?.data?.error || 'Erro ao exportar conversa.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-3xl max-h-[90vh] bg-gray-800 rounded-xl shadow-2xl border border-gray-700 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-700 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <History className="h-4 w-4 text-green-400" />
              Histórico da conversa
            </h2>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
              <span className="font-mono truncate max-w-[260px]" title={lid}>{lid}</span>
              <span>{session.whatsapp_phone || 'sem telefone'}</span>
              <span>{getAgentLabel(agents, session.current_agent)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTelemetry(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors"
              title="Ver telemetria do agente para esta conversa"
            >
              <Activity className="h-3.5 w-3.5" />
              Telemetria
            </button>
            <button
              type="button"
              onClick={exportSession}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors disabled:opacity-60"
              title="Exportar conversa em JSON"
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              JSON
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
              title="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {exportError && (
          <div className="px-5 py-2 border-b border-gray-700 text-sm text-red-400">
            {exportError}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 bg-gray-900/40">
          {loading && (
            <div className="py-12 flex items-center justify-center text-sm text-gray-400 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando histórico...
            </div>
          )}
          {!loading && error && (
            <div className="py-12 text-center text-sm text-red-400">{error}</div>
          )}
          {!loading && !error && messages.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-500">Nenhuma mensagem encontrada.</div>
          )}
          {!loading && !error && messages.length > 0 && (
            <div className="space-y-3">
              {messages.map((message) => (
                <MessageBubble key={message.id || message.msg_id} message={message} agents={agents} />
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-700 text-xs text-gray-500">
          {messages.length.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')} mensagens
        </div>
      </div>

      {showTelemetry && (
        <SessionTelemetryModal
          lid={lid}
          onClose={() => setShowTelemetry(false)}
        />
      )}
    </div>
  );
}

function MessageBubble({ message, agents }) {
  const role = message.role || '';
  const isCustomer = role === 'customer';
  const isOperator = role === 'user' || role === 'HUMAN_AGENT';
  const alignClass = isCustomer ? 'justify-start' : 'justify-end';
  const bubbleClass = isCustomer
    ? 'bg-gray-800 border-gray-700 text-gray-200'
    : isOperator
      ? 'bg-blue-600/20 border-blue-500/30 text-blue-100'
      : 'bg-green-600/20 border-green-500/30 text-green-100';

  const label = isCustomer
    ? 'Cliente'
    : isOperator
      ? 'Operador'
      : getAgentLabel(agents, role);

  return (
    <div className={`flex ${alignClass}`}>
      <div className={`max-w-[82%] rounded-lg border px-3 py-2 ${bubbleClass}`}>
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className="text-[11px] font-semibold uppercase text-gray-400">{label}</span>
          <span className="text-[11px] text-gray-500 whitespace-nowrap">{formatUtcDateTime(message.dttime)}</span>
        </div>
        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
          {message.message || '—'}
        </p>
      </div>
    </div>
  );
}
