/**
 * AgentModal — troca manual do agente de uma sessao.
 *
 * Extraido de `pages/WhatsAppSessions.jsx` para a tela de Chamados poder agir sobre a MESMA
 * sessao pelos MESMOS portoes, sem criar um caminho de escrita proprio (EARS-16). As props
 * existentes nao mudaram; o que entrou foi o `ticketId` opcional, que diz em qual chamado a
 * acao deve ser auditada (design §10, R9).
 *
 * Spec: docs/modules/chatbot-whatsapp/changes/2026-09-05-painel-de-escalonamentos-do-suporte/
 */
import { useState } from 'react';
import { UserCog, Loader2 } from 'lucide-react';
import api from '@/services/api';
import { getSessionKey } from './sessionHelpers';

export default function AgentModal({ session, agents, onClose, onSaved, ticketId = null }) {
  const lid = getSessionKey(session);
  const [selectedAgent, setSelectedAgent] = useState(session.current_agent || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function saveAgent() {
    setSaving(true);
    setError('');
    try {
      // `ticket_id` so vai quando a acao partiu do detalhe de um chamado: o backend valida
      // o vinculo antes de mexer na sessao e audita NAQUELE chamado, mesmo fechado (R9).
      const res = await api.patch(`/admin/wpp/sessions/${encodeURIComponent(lid)}/agent`, {
        agent_name: selectedAgent,
        ...(ticketId ? { ticket_id: ticketId } : {}),
      });
      onSaved(lid, res.data.current_agent || null);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao trocar agent.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl border border-gray-700 p-6">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <UserCog className="h-4 w-4 text-violet-400" />
            Trocar agent
          </h2>
          <p className="text-xs text-gray-500 mt-1 truncate" title={lid}>{lid}</p>
        </div>

        <label className="block text-xs font-medium text-gray-400 mb-1.5">Agent</label>
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="w-full bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
        >
          {agents.map((agent) => (
            <option key={agent.value || 'none'} value={agent.value}>{agent.label}</option>
          ))}
        </select>

        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={saveAgent}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
