/**
 * ModelModal — escolha do modelo de LLM de uma sessao (irmao do `AgentModal`).
 *
 * "Automatico" (`value: ''`) volta para a lista do tipo do cadastro; qualquer outro valor e o
 * `ref` de um modelo do cadastro, que passa a responder primeiro nesta conversa (vendas e
 * pos-venda). As opcoes sao lidas AO ABRIR, nao no mount da pagina: `utilizavel` muda com o
 * estado das chaves. Modelo sem chave utilizavel aparece e nao e selecionavel (D4).
 *
 * Spec: docs/modules/chatbot-whatsapp/changes/2026-11-19-modelo-de-llm-por-sessao/
 */
import { useEffect, useState } from 'react';
import { Cpu, Loader2 } from 'lucide-react';
import api from '@/services/api';
import { getSessionKey } from './sessionHelpers';

/** Texto da celula "Modelo" da grade (render e CSV, fonte unica). */
export function textoModeloSessao(row) {
  if (!row || row.session_model_known !== true) return '?';
  const escolha = row.session_model;
  if (!escolha) return 'Automático';
  if (escolha.existe === false) return `${escolha.ref} (removido)`;
  return escolha.label || escolha.ref;
}

export default function ModelModal({ session, onClose, onSaved }) {
  const lid = getSessionKey(session);
  const atual = session.session_model?.ref || '';
  const [options, setOptions] = useState(null);
  const [selected, setSelected] = useState(atual);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    api.get('/admin/wpp/session-models')
      .then((res) => { if (vivo) setOptions(res.data?.models || []); })
      .catch((err) => {
        if (vivo) setLoadError(err.response?.data?.error || 'Erro ao carregar os modelos.');
      });
    return () => { vivo = false; };
  }, []);

  // O modelo atual pode ter sido excluido do cadastro: continua visivel, como "(removido)".
  const lista = options || [];
  const comAtual = (atual && options && !lista.some((o) => o.value === atual))
    ? [...lista, { value: atual, label: `${atual} (removido)`, utilizavel: false }]
    : lista;

  async function saveModel() {
    setSaving(true);
    setError('');
    try {
      const res = await api.patch(`/admin/wpp/sessions/${encodeURIComponent(lid)}/model`, {
        model_ref: selected,
      });
      onSaved(lid, res.data?.model_ref || null);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao trocar o modelo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl border border-gray-700 p-6">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Cpu className="h-4 w-4 text-violet-400" />
            Modelo de IA da sessão
          </h2>
          <p className="text-xs text-gray-500 mt-1 truncate" title={lid}>{lid}</p>
        </div>

        <label htmlFor="model-modal-select" className="block text-xs font-medium text-gray-400 mb-1.5">
          Modelo
        </label>
        {options === null && !loadError ? (
          <p className="text-sm text-gray-400 flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando modelos...
          </p>
        ) : (
          <select
            id="model-modal-select"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={!!loadError}
            className="w-full bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500 disabled:opacity-60"
          >
            {comAtual.map((o) => (
              <option
                key={o.value || 'automatico'}
                value={o.value}
                disabled={!o.utilizavel && o.value !== atual}
              >
                {o.utilizavel || o.label.endsWith('(removido)')
                  ? o.label
                  : `${o.label} — sem chave utilizável`}
              </option>
            ))}
          </select>
        )}
        <p className="text-xs text-gray-500 mt-2">
          Vale para as respostas do agente (vendas e pós-venda). Se o modelo falhar, a lista
          automática responde.
        </p>

        {loadError && <p className="text-sm text-red-400 mt-3">{loadError}</p>}
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
            onClick={saveModel}
            disabled={saving || options === null || !!loadError}
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
