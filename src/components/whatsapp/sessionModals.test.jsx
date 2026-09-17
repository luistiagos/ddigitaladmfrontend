/**
 * T7 — os modais extraídos, provados nas DUAS telas.
 *
 * A extração só é segura se a tela de sessões continuar exatamente como estava: sem
 * `ticketId`, nenhuma chamada muda de forma (design §10, R9 — "Tela de sessões sem id
 * continua funcionando"). E o horário do histórico passou a ser lido como UTC, porque é isso
 * que `Wpp_proccess.dttime` e `wpp_agent_generations.created_at` guardam.
 *
 * Spec: docs/modules/chatbot-whatsapp/changes/2026-09-05-painel-de-escalonamentos-do-suporte/
 *
 * Rodar:  npx vitest run src/components/whatsapp/sessionModals.test.jsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

import api from '@/services/api';
import AgentModal from './AgentModal';
import HistoryModal from './HistoryModal';
import { getAgentLabel, getSessionKey, exportFilename, FALLBACK_AGENTS } from './sessionHelpers';
import { formatUtcDateTime, formatDateTime } from '@/utils/format';

const SESSAO = { lid: '111@lid', current_agent: 'HUMAN_PENDING', whatsapp_phone: '5511988887777' };

beforeEach(() => {
  vi.clearAllMocks();
  api.patch.mockResolvedValue({ data: { current_agent: 'PS2_AGENT' } });
  api.get.mockResolvedValue({ data: { items: [], total: 0 } });
});

describe('helpers', () => {
  it('a chave da sessão cai para os identificadores alternativos, nesta ordem', () => {
    expect(getSessionKey({ lid: 'a', main_phone: 'b' })).toBe('a');
    expect(getSessionKey({ main_phone: 'b', phone_jid: 'c' })).toBe('b');
    expect(getSessionKey({ phone_jid: 'c' })).toBe('c');
    expect(getSessionKey(null)).toBe('');
  });

  it('o rótulo do agente cai para o próprio valor quando ele não está na lista', () => {
    expect(getAgentLabel(FALLBACK_AGENTS, 'PS2_AGENT')).toBe('PlayStation 2');
    expect(getAgentLabel(FALLBACK_AGENTS, 'AGENTE_NOVO')).toBe('AGENTE_NOVO');
    expect(getAgentLabel(FALLBACK_AGENTS, null)).toBe('Sem agente');
  });

  it('o nome do arquivo de exportação não tem caractere proibido em disco', () => {
    expect(exportFilename('conversa')).toMatch(/^conversa_\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/);
  });
});

describe('AgentModal — a tela de sessões não mudou', () => {
  it('sem ticketId, o corpo é o mesmo de antes da extração', async () => {
    render(<AgentModal session={SESSAO} agents={FALLBACK_AGENTS} onClose={vi.fn()} onSaved={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
      `/admin/wpp/sessions/${encodeURIComponent('111@lid')}/agent`,
      { agent_name: 'HUMAN_PENDING' },
    ));
  });

  it('com ticketId, o contexto do chamado vai junto', async () => {
    render(<AgentModal session={SESSAO} agents={FALLBACK_AGENTS} ticketId={9} onClose={vi.fn()} onSaved={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
      expect.stringContaining('/agent'),
      { agent_name: 'HUMAN_PENDING', ticket_id: 9 },
    ));
  });

  it('erro do backend aparece no modal em vez de fechar calado', async () => {
    api.patch.mockRejectedValue({ response: { data: { error: 'Chamado invalido para esta conversa.' } } });
    const onClose = vi.fn();
    render(<AgentModal session={SESSAO} agents={FALLBACK_AGENTS} ticketId={9} onClose={onClose} onSaved={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
    expect(await screen.findByText('Chamado invalido para esta conversa.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('HistoryModal — horário do histórico', () => {
  it('o horário da mensagem é lido como UTC, não como hora local', async () => {
    api.get.mockResolvedValue({ data: {
      items: [{ id: 1, role: 'customer', message: 'o jogo nao abre', dttime: '2026-09-17 23:17:31' }],
      total: 1,
    } });
    render(<HistoryModal session={SESSAO} agents={FALLBACK_AGENTS} anonymizeExport onClose={vi.fn()} />);

    expect(await screen.findByText('o jogo nao abre')).toBeInTheDocument();
    expect(screen.getByText(formatUtcDateTime('2026-09-17 23:17:31'))).toBeInTheDocument();
    // A diferença só é visível fora do UTC; onde houver fuso, o texto antigo some.
    if (new Date().getTimezoneOffset() !== 0) {
      expect(screen.queryByText(formatDateTime('2026-09-17 23:17:31'))).not.toBeInTheDocument();
    }
  });

  it('o histórico sai da rota de mensagens da sessão, pela chave da sessão', async () => {
    render(<HistoryModal session={SESSAO} agents={FALLBACK_AGENTS} anonymizeExport onClose={vi.fn()} />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(
      `/admin/wpp/sessions/${encodeURIComponent('111@lid')}/messages?limit=5000`,
    ));
  });
});
