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
import ModelModal, { textoModeloSessao } from './ModelModal';
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

describe('AgentModal — fase da conversa', () => {
  // Spec: docs/modules/chatbot-whatsapp/changes/2026-11-25-fase-da-conversa-escolhida-no-painel/
  const URL_FASE = `/admin/wpp/sessions/${encodeURIComponent('111@lid')}/phase`;
  const faseNaRota = (fase) => api.get.mockImplementation((url) => (url === URL_FASE
    ? Promise.resolve({ data: { success: true, lid: '111@lid', fase } })
    : Promise.resolve({ data: {} })));
  const abrir = (props = {}) => render(
    <AgentModal session={SESSAO} agents={FALLBACK_AGENTS} onClose={vi.fn()} onSaved={vi.fn()} {...props} />,
  );
  const comboFase = () => screen.getByLabelText('Fase');

  it('AgentModal mostra a combo de fase com a fase atual', async () => {
    faseNaRota('pos_venda');
    abrir();

    await waitFor(() => expect(comboFase()).not.toBeDisabled());
    expect(api.get).toHaveBeenCalledWith(URL_FASE);
    expect(comboFase()).toHaveValue('pos_venda');
    expect(screen.getByLabelText('Agent')).toBeInTheDocument();
    const opcoes = Array.from(comboFase().options).map((o) => [o.value, o.textContent]);
    expect(opcoes).toEqual([['', 'Automática'], ['pre_venda', 'Pré-venda'], ['pos_venda', 'Pós-venda']]);
  });

  it('sessao sem escolha mostra Automatica selecionada', async () => {
    faseNaRota('');
    abrir();
    await waitFor(() => expect(comboFase()).not.toBeDisabled());
    expect(comboFase()).toHaveValue('');
  });

  it('Salvar envia fase so quando mudou: trocar so a fase', async () => {
    faseNaRota('');
    abrir();
    await waitFor(() => expect(comboFase()).not.toBeDisabled());
    await userEvent.selectOptions(comboFase(), 'pos_venda');
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
      `/admin/wpp/sessions/${encodeURIComponent('111@lid')}/agent`,
      { agent_name: 'HUMAN_PENDING', fase: 'pos_venda' },
    ));
  });

  it('voltar a Automatica envia fase vazia, junto do chamado', async () => {
    faseNaRota('pre_venda');
    abrir({ ticketId: 9 });
    await waitFor(() => expect(comboFase()).not.toBeDisabled());
    await userEvent.selectOptions(comboFase(), '');
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
      expect.stringContaining('/agent'),
      { agent_name: 'HUMAN_PENDING', ticket_id: 9, fase: '' },
    ));
  });

  it('trocar so o agente nao manda fase (nao regrava a escolha nem o autor)', async () => {
    faseNaRota('pos_venda');
    abrir();
    await waitFor(() => expect(comboFase()).not.toBeDisabled());
    await userEvent.selectOptions(screen.getByLabelText('Agent'), 'PS2_AGENT');
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
      expect.stringContaining('/agent'),
      { agent_name: 'PS2_AGENT' },
    ));
  });

  it('GET falhou -> combo desabilitada e Salvar sem fase', async () => {
    api.get.mockRejectedValue({ response: { data: { success: false, error: 'Erro ao ler a fase da conversa.' } } });
    abrir();

    expect(await screen.findByText(/Erro ao ler a fase da conversa\./)).toBeInTheDocument();
    expect(comboFase()).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
      expect.stringContaining('/agent'),
      { agent_name: 'HUMAN_PENDING' },
    ));
  });

  it('resposta sem fase reconhecivel conta como falha, nunca como Automatica', async () => {
    api.get.mockResolvedValue({ data: { success: true, fase: 'outra' } });
    abrir();
    expect(await screen.findByText(/Não foi possível ler a fase/)).toBeInTheDocument();
    expect(comboFase()).toBeDisabled();
  });

  it('falha do agente com a fase gravada diz que a fase ficou e nao fecha', async () => {
    faseNaRota('');
    api.patch.mockRejectedValue({ response: { status: 500, data: {
      success: false, error: 'Erro ao trocar o agente da sessao.', fase_gravada: true,
    } } });
    const onClose = vi.fn();
    abrir({ onClose });
    await waitFor(() => expect(comboFase()).not.toBeDisabled());
    await userEvent.selectOptions(comboFase(), 'pos_venda');
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));

    expect(await screen.findByText(/A fase foi gravada, mas o agent não foi trocado/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    // A fase gravada passa a ser a atual: o novo Salvar nao a reenvia.
    api.patch.mockResolvedValue({ data: { current_agent: 'HUMAN_PENDING' } });
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => expect(api.patch).toHaveBeenLastCalledWith(
      expect.stringContaining('/agent'),
      { agent_name: 'HUMAN_PENDING' },
    ));
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

// T4 de docs/modules/chatbot-whatsapp/changes/2026-11-19-modelo-de-llm-por-sessao/
const OPCOES = [
  { value: '', label: 'Automatico (lista do tipo)', utilizavel: true },
  { value: 'openrouter:xiaomi/mimo-v2.6-pro', label: 'MiMo', utilizavel: true },
  { value: 'deepseek-v4-pro', label: 'v4-pro', utilizavel: false },
];
const MIMO = 'openrouter:xiaomi/mimo-v2.6-pro';
const COM_MIMO = { ...SESSAO, session_model_known: true,
  session_model: { ref: MIMO, label: 'MiMo', existe: true } };

function comOpcoes(models = OPCOES) {
  api.get.mockImplementation((url) => (url === '/admin/wpp/session-models'
    ? Promise.resolve({ data: { success: true, models } })
    : Promise.resolve({ data: {} })));
}

describe('ModelModal', () => {
  it('ModelModal lista automatico e cadastro', async () => {
    comOpcoes();
    render(<ModelModal session={COM_MIMO} onClose={vi.fn()} onSaved={vi.fn()} />);

    const select = await screen.findByLabelText('Modelo');
    const textos = [...select.options].map((o) => o.textContent);
    expect(textos).toEqual(['Automatico (lista do tipo)', 'MiMo', 'v4-pro — sem chave utilizável']);
    expect(select).toHaveValue(MIMO);
    expect(api.get).toHaveBeenCalledWith('/admin/wpp/session-models');
  });

  it('modelo sem chave utilizavel aparece desabilitado', async () => {
    comOpcoes();
    render(<ModelModal session={SESSAO} onClose={vi.fn()} onSaved={vi.fn()} />);
    const select = await screen.findByLabelText('Modelo');
    expect(select).toHaveValue('');
    const [auto, mimo, semChave] = select.options;
    expect(auto.disabled).toBe(false);
    expect(mimo.disabled).toBe(false);
    expect(semChave.disabled).toBe(true);
  });

  it('modelo atual excluido do cadastro continua visivel como removido', async () => {
    comOpcoes();
    const sessao = { ...SESSAO, session_model_known: true,
      session_model: { ref: 'openrouter:velho/x', label: 'openrouter:velho/x', existe: false } };
    render(<ModelModal session={sessao} onClose={vi.fn()} onSaved={vi.fn()} />);
    const select = await screen.findByLabelText('Modelo');
    expect(select).toHaveValue('openrouter:velho/x');
    expect(screen.getByRole('option', { name: 'openrouter:velho/x (removido)' })).toBeInTheDocument();
  });

  it('salvar envia o ref escolhido', async () => {
    comOpcoes();
    api.patch.mockResolvedValue({ data: { success: true, model_ref: MIMO, changed: true } });
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(<ModelModal session={SESSAO} onClose={onClose} onSaved={onSaved} />);

    await userEvent.selectOptions(await screen.findByLabelText('Modelo'), MIMO);
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
      `/admin/wpp/sessions/${encodeURIComponent('111@lid')}/model`, { model_ref: MIMO }));
    expect(onSaved).toHaveBeenCalledWith('111@lid', MIMO);
    expect(onClose).toHaveBeenCalled();
  });

  it('voltar a Automatico envia vazio', async () => {
    comOpcoes();
    api.patch.mockResolvedValue({ data: { success: true, model_ref: null, changed: true } });
    const onSaved = vi.fn();
    render(<ModelModal session={COM_MIMO} onClose={vi.fn()} onSaved={onSaved} />);
    await userEvent.selectOptions(await screen.findByLabelText('Modelo'), '');
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
      expect.stringContaining('/model'), { model_ref: '' }));
    expect(onSaved).toHaveBeenCalledWith('111@lid', null);
  });

  it('erro do backend ao salvar aparece no modal', async () => {
    comOpcoes();
    api.patch.mockRejectedValue({ response: { data: { error: 'modelo fora do cadastro' } } });
    const onClose = vi.fn();
    render(<ModelModal session={SESSAO} onClose={onClose} onSaved={vi.fn()} />);
    await screen.findByLabelText('Modelo');
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
    expect(await screen.findByText('modelo fora do cadastro')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('falha ao carregar as opcoes aparece no modal e bloqueia o salvar', async () => {
    api.get.mockRejectedValue({ response: { data: {
      error: 'falha ao ler o cadastro de modelos (OperationalError)' } } });
    render(<ModelModal session={SESSAO} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(await screen.findByText('falha ao ler o cadastro de modelos (OperationalError)'))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar/i })).toBeDisabled();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('texto da celula cobre automatico, removido, desconhecido e rotulo', () => {
    expect(textoModeloSessao({ session_model_known: true, session_model: null })).toBe('Automático');
    expect(textoModeloSessao({ session_model_known: true,
      session_model: { ref: 'r', label: 'MiMo', existe: true } })).toBe('MiMo');
    expect(textoModeloSessao({ session_model_known: true,
      session_model: { ref: 'r', label: 'r', existe: false } })).toBe('r (removido)');
    expect(textoModeloSessao({ session_model_known: false, session_model: null })).toBe('?');
    expect(textoModeloSessao({})).toBe('?');
  });
});
