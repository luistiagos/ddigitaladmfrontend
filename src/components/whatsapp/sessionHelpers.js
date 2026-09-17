/**
 * Helpers das telas de WhatsApp (sessoes e chamados).
 *
 * Eram locais de `pages/WhatsAppSessions.jsx`; sairam de la junto com os modais que os usam,
 * para as duas telas lerem a mesma definicao de "chave da sessao" e de rotulo de agente.
 *
 * Spec: docs/modules/chatbot-whatsapp/changes/2026-09-05-painel-de-escalonamentos-do-suporte/
 */

export const FALLBACK_AGENTS = [
  { value: '', label: 'Sem agente' },
  { value: 'ROUTER_AGENT', label: 'Roteador' },
  { value: 'MULTIGAMES_AGENT', label: 'Multigames' },
  { value: 'XBOX360_AGENT', label: 'Xbox 360' },
  { value: 'PS2_AGENT', label: 'PlayStation 2' },
  { value: 'HUMAN_PENDING', label: 'Suporte pendente' },
  { value: 'HUMAN_AGENT', label: 'Atendimento humano' },
  { value: 'OWNER_CONSULT', label: 'Consulta ao dono' },
];

export function getAgentLabel(agents, value) {
  if (!value) return 'Sem agente';
  return agents.find((agent) => agent.value === value)?.label || value;
}

export function getSessionKey(session) {
  return session?.lid || session?.main_phone || session?.phone_jid || '';
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function downloadJson(payload, filename) {
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8;',
  }), filename);
}

export function exportFilename(prefix, extension = 'json') {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `${prefix}_${stamp}.${extension}`;
}
