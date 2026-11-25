/**
 * AgentModal — troca manual do agente de uma sessao e, no mesmo Salvar, da fase da conversa.
 *
 * Extraido de `pages/WhatsAppSessions.jsx` para a tela de Chamados poder agir sobre a MESMA
 * sessao pelos MESMOS portoes, sem criar um caminho de escrita proprio (EARS-16). As props
 * existentes nao mudaram; o que entrou foi o `ticketId` opcional, que diz em qual chamado a
 * acao deve ser auditada (design §10, R9).
 *
 * Spec: docs/modules/chatbot-whatsapp/changes/2026-09-05-painel-de-escalonamentos-do-suporte/
 *
 * Fase (Automatica / Pre-venda / Pos-venda): lida AO ABRIR pela rota `/phase` e enviada como
 * `fase` na MESMA chamada `/agent` (um Salvar so, sem falha parcial entre dois PATCH). Vai no
 * corpo so quando carregou e o admin mudou: um Salvar so de agente nunca regrava a fase nem o
 * autor da escolha. Se a leitura falhou, a combo fica desabilitada e o Salvar troca so o agente
 * (nunca grava uma fase que o admin nao viu).
 *
 * Spec: docs/modules/chatbot-whatsapp/changes/2026-11-25-fase-da-conversa-escolhida-no-painel/
 */
import { useEffect, useState } from 'react';
import { UserCog, Loader2 } from 'lucide-react';
import api from '@/services/api';
import { getSessionKey } from './sessionHelpers';

export const FASES = [
  { value: '', label: 'Automática' },
  { value: 'pre_venda', label: 'Pré-venda' },
  { value: 'pos_venda', label: 'Pós-venda' },
];
const FASES_VALIDAS = new Set(FASES.map((f) => f.value));

export default function AgentModal({ session, agents, onClose, onSaved, ticketId = null }) {
  const lid = getSessionKey(session);
  const [selectedAgent, setSelectedAgent] = useState(session.current_agent || '');
  // `faseAtual === null` = ainda nao carregou (ou falhou): a fase nao vai no corpo.
  const [faseAtual, setFaseAtual] = useState(null);
  const [selectedFase, setSelectedFase] = useState('');
  const [faseError, setFaseError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    api.get(`/admin/wpp/sessions/${encodeURIComponent(lid)}/phase`)
      .then((res) => {
        if (!vivo) return;
        const fase = res.data?.fase;
        // Resposta sem fase reconhecivel e falha, nunca "Automatica" presumida.
        if (typeof fase !== 'string' || !FASES_VALIDAS.has(fase)) {
          setFaseError('Não foi possível ler a fase da conversa.');
          return;
        }
        setFaseAtual(fase);
        setSelectedFase(fase);
      })
      .catch((err) => {
        if (vivo) setFaseError(err.response?.data?.error || 'Não foi possível ler a fase da conversa.');
      });
    return () => { vivo = false; };
  }, [lid]);

  const faseCarregada = faseAtual !== null;

  async function saveAgent() {
    setSaving(true);
    setError('');
    try {
      // `ticket_id` so vai quando a acao partiu do detalhe de um chamado: o backend valida
      // o vinculo antes de mexer na sessao e audita NAQUELE chamado, mesmo fechado (R9).
      const res = await api.patch(`/admin/wpp/sessions/${encodeURIComponent(lid)}/agent`, {
        agent_name: selectedAgent,
        ...(ticketId ? { ticket_id: ticketId } : {}),
        ...(faseCarregada && selectedFase !== faseAtual ? { fase: selectedFase } : {}),
      });
      onSaved(lid, res.data.current_agent || null);
      onClose();
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.error || 'Erro ao trocar agent.';
      if (data?.fase_gravada) {
        // A fase gravada fica (e uma escolha valida por si): o modal nao pode dizer que nada mudou.
        setFaseAtual(selectedFase);
        setError(`A fase foi gravada, mas o agent não foi trocado: ${msg}`);
      } else {
        setError(msg);
      }
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="agent-modal-agent" className="block text-xs font-medium text-gray-400 mb-1.5">Agent</label>
            <select
              id="agent-modal-agent"
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
            >
              {agents.map((agent) => (
                <option key={agent.value || 'none'} value={agent.value}>{agent.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="agent-modal-fase" className="block text-xs font-medium text-gray-400 mb-1.5">Fase</label>
            <select
              id="agent-modal-fase"
              value={selectedFase}
              onChange={(e) => setSelectedFase(e.target.value)}
              disabled={!faseCarregada || saving}
              className="w-full bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500 disabled:opacity-60"
            >
              {FASES.map((f) => (
                <option key={f.value || 'automatica'} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>
        {!faseCarregada && !faseError && (
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Carregando a fase...
          </p>
        )}
        {faseError && (
          <p className="text-xs text-amber-400 mt-2">
            {faseError} A fase não será alterada; o Salvar troca só o agent.
          </p>
        )}
        <p className="text-xs text-gray-500 mt-2">
          Automática: o agente decide pela compra localizada. Pré-venda ou Pós-venda: vale até
          voltar a Automática.
        </p>

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
