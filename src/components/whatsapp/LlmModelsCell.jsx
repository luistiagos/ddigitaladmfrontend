/**
 * Modelos de IA que responderam ao cliente numa conversa -- a unica forma de mostrar o
 * `llm_models` das listas de sessoes e de chamados, do detalhe do chamado e do cabecalho do
 * historico (contrato P4 do design dos modelos cadastraveis).
 *
 * `models` e `[{model, respostas}]`, ja ordenado e filtrado pelo servidor (so respostas ao
 * cliente de agente de produto e router). `null` ou ausente (backend antigo ou consulta que
 * falhou) e "indisponível", nunca "nenhum" (EARS-28); `[]` e "nenhum": a conversa nao teve
 * resposta de IA.
 *
 * Spec: docs/modules/chatbot-whatsapp/changes/2026-11-13-provedor-de-llm-plugavel/ (T9)
 */
const SEM_NOME = 'modelo não gravado';

export default function LlmModelsCell({ models, inline = false }) {
  if (!Array.isArray(models)) {
    return <span className="text-gray-500" title="modelos indisponíveis">indisponível</span>;
  }
  if (models.length === 0) {
    return <span className="text-gray-500">nenhum</span>;
  }
  if (inline) {
    return <span className="text-gray-300">{textoLlmModels(models)}</span>;
  }
  return (
    <div className="text-xs space-y-0.5">
      {models.map((m) => (
        <div key={m.model ?? SEM_NOME} className="whitespace-nowrap">
          <span className="font-mono text-gray-300">{m.model || SEM_NOME}</span>
          <span className="text-gray-500"> × {m.respostas}</span>
        </div>
      ))}
    </div>
  );
}

/** Texto em uma linha (exportacao CSV/PDF e cabecalho): vazio quando indisponivel. */
export function textoLlmModels(models) {
  if (!Array.isArray(models)) return '';
  return models.map((m) => `${m.model || SEM_NOME} × ${m.respostas}`).join(', ');
}
