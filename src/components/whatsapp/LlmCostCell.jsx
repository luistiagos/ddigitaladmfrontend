import Badge from '@/components/ui/Badge';
import { formatUsd } from '@/utils/format';

/**
 * Custo de IA de uma conversa -- a unica forma de mostrar o `llm_cost` das listas de sessoes
 * e de chamados e do detalhe do chamado (contrato P5 do design do teto por comprador).
 *
 * `cost` e `{total, pos_venda, teto, teto_atingido}`; `null` ou ausente (backend antigo ou
 * custo que falhou) e "custo indisponivel", nunca zero. O componente so le o contrato: quem
 * e comprador e se o teto vale, o servidor ja decidiu.
 *
 * Spec: docs/modules/chatbot-whatsapp/changes/2026-10-16-teto-de-custo-llm-por-comprador/
 */
export default function LlmCostCell({ cost }) {
  if (!cost || typeof cost.total !== 'number') {
    return <span className="text-gray-500" title="custo indisponível">—</span>;
  }
  const comprador = cost.pos_venda != null;
  return (
    <div className="text-xs whitespace-nowrap">
      <div className="text-gray-300">{formatUsd(cost.total)}</div>
      {comprador && (
        <div className={cost.teto_atingido ? 'text-red-400' : 'text-gray-500'}>
          pós-venda {formatUsd(cost.pos_venda)}
          {cost.teto > 0 ? ` de ${formatUsd(cost.teto).replace('US$ ', '')}` : ' · sem teto'}
        </div>
      )}
      {cost.teto_atingido && (
        <div className="mt-1"><Badge variant="red">teto atingido</Badge></div>
      )}
    </div>
  );
}

/** Texto da coluna na exportacao CSV/PDF: o total, vazio quando indisponivel. */
export function textoLlmCost(cost) {
  return cost && typeof cost.total === 'number' ? formatUsd(cost.total) : '';
}
