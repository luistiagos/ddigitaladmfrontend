// Filtro "Só leads únicos" (change docs/modules/telemetria/changes/2026-11-21-filtro-lead-unico-nos-dashboards/).
// Dono único, no painel, da recusa de resposta filtrada sem o recorte: usado pelo Dashboard de Leads
// (dashboard-stats e checkout-funnel) e pela aba "Funil de leads" do Dashboard principal.

// Mesmo texto do `lead_unico.ERRO_FILTRO` do backend (corpo do 503): o painel usa-o também quando o
// backend responde sem o bloco `lead_unico`, para nunca mostrar número sem filtro como filtrado.
export const ERRO_LEAD_UNICO = 'nao foi possivel aplicar o filtro de lead unico';

// Filtro pedido e resposta sem `lead_unico.ativo` (backend antigo ou ramo errado): os números
// seriam os sem filtro (EARS-11).
export function recorteAusente(dados, ligado) {
  return Boolean(ligado) && dados?.lead_unico?.ativo !== true;
}
