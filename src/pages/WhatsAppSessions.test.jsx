/**
 * T8 — coluna "Custo IA" na tela de sessoes do WhatsApp (EARS-29, 34 do teto por comprador).
 *
 * Spec: docs/modules/chatbot-whatsapp/changes/2026-10-16-teto-de-custo-llm-por-comprador/
 *
 * Rodar:  npx vitest run src/pages/WhatsAppSessions.test.jsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

import api from '@/services/api';
import WhatsAppSessions from './WhatsAppSessions';

function sessao(extra = {}) {
  return {
    lid: '233753779650648@lid',
    whatsapp_phone: '5511988887777',
    current_agent: 'XBOX360_AGENT',
    last_dttime: '2026-10-18 12:00:00',
    dont_touch: false,
    ...extra,
  };
}

function montarApi(items) {
  api.get.mockImplementation((url) => {
    if (url.startsWith('/admin/wpp/sessions?')) return Promise.resolve({ data: { items, total: items.length } });
    return Promise.resolve({ data: {} });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('coluna de custo', () => {
  it('coluna_custo', async () => {
    montarApi([
      sessao({ llm_cost: { total: 5.2, pos_venda: 4.17, teto: 4, teto_atingido: true } }),
      sessao({ lid: '222@lid', llm_cost: { total: 0.35, pos_venda: null, teto: 4, teto_atingido: false } }),
      sessao({ lid: '333@lid', llm_cost: null }),
      sessao({ lid: '444@lid' }),
    ]);
    render(<WhatsAppSessions />);

    const linhaComprador = (await screen.findByText('233753779650648@lid')).closest('tr');
    expect(within(linhaComprador).getByText('US$ 5,20')).toBeInTheDocument();
    expect(within(linhaComprador).getByText('pós-venda US$ 4,17 de 4,00')).toBeInTheDocument();
    expect(within(linhaComprador).getByText('teto atingido')).toBeInTheDocument();

    const linhaLead = screen.getByText('222@lid').closest('tr');
    expect(within(linhaLead).getByText('US$ 0,35')).toBeInTheDocument();
    expect(linhaLead.textContent).not.toMatch(/pós-venda/);

    // Custo que falhou e backend sem o campo: "—" na celula, o resto da linha carrega.
    for (const lid of ['333@lid', '444@lid']) {
      const linha = screen.getByText(lid).closest('tr');
      expect(within(linha).getByTitle('custo indisponível')).toHaveTextContent('—');
      expect(within(linha).getByText('Histórico')).toBeInTheDocument();
    }

    // A coluna nao ordena (D5): clicar no cabecalho nao pede outra ordenacao ao servidor.
    const antes = api.get.mock.calls.length;
    await userEvent.click(screen.getByRole('columnheader', { name: /custo ia/i }));
    expect(api.get.mock.calls.length).toBe(antes);
  });
});

describe('modelos que responderam (T9 de 2026-11-13-provedor-de-llm-plugavel)', () => {
  it('mostra_modelos_da_sessao', async () => {
    montarApi([
      sessao({ llm_models: [
        { model: 'deepseek-v4-pro', respostas: 12 },
        { model: 'openrouter:deepseek/deepseek-v4-pro', respostas: 2 },
      ] }),
      sessao({ lid: '222@lid', llm_models: [] }),
      sessao({ lid: '333@lid', llm_models: null }),
      sessao({ lid: '444@lid' }),
    ]);
    render(<WhatsAppSessions />);

    const linha = (await screen.findByText('233753779650648@lid')).closest('tr');
    expect(within(linha).getByText('deepseek-v4-pro')).toBeInTheDocument();
    expect(within(linha).getByText('openrouter:deepseek/deepseek-v4-pro')).toBeInTheDocument();
    expect(within(linha).getByText('× 12')).toBeInTheDocument();
    expect(within(linha).getByText('× 2')).toBeInTheDocument();

    // Lista vazia e "nenhum"; falha e backend sem o campo sao "indisponivel" (EARS-28), e o
    // resto da linha carrega.
    expect(within(screen.getByText('222@lid').closest('tr')).getByText('nenhum')).toBeInTheDocument();
    for (const lid of ['333@lid', '444@lid']) {
      const l = screen.getByText(lid).closest('tr');
      expect(within(l).getByTitle('modelos indisponíveis')).toHaveTextContent('indisponível');
      expect(within(l).getByText('Histórico')).toBeInTheDocument();
    }

    // O cabecalho do historico mostra os mesmos modelos, sem pedir nada novo ao servidor.
    await userEvent.click(within(linha).getByText('Histórico'));
    expect(await screen.findByText(
      'deepseek-v4-pro × 12, openrouter:deepseek/deepseek-v4-pro × 2')).toBeInTheDocument();
  });
});

describe('retomada manual do agente (T2 de 2026-11-15-retomada-manual-do-agente-na-sessao)', () => {
  it('botao_retomar_ia_dispara_retomada_e_atualiza_sessao', async () => {
    montarApi([sessao({ current_agent: 'ROUTER_AGENT', dont_touch: false })]);
    api.post.mockResolvedValueOnce({
      data: { success: true, current_agent: 'MULTIGAMES_AGENT', blocks_sent: 1 },
    });

    render(<WhatsAppSessions />);
    const linha = (await screen.findByText('233753779650648@lid')).closest('tr');
    const botao = within(linha).getByRole('button', { name: /retomar ia/i });
    expect(botao).not.toBeDisabled();

    await userEvent.click(botao);

    expect(api.post).toHaveBeenCalledWith(
      '/admin/wpp/sessions/233753779650648%40lid/resume',
      {},
    );
    expect(await screen.findByText(/IA retomou a conversa/i)).toBeInTheDocument();
  });

  it('botao_retomar_ia_fica_desabilitado_com_nao_tocar_ativo', async () => {
    montarApi([sessao({ current_agent: 'XBOX360_AGENT', dont_touch: true })]);
    render(<WhatsAppSessions />);
    const linha = (await screen.findByText('233753779650648@lid')).closest('tr');
    const botao = within(linha).getByRole('button', { name: /retomar ia/i });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAttribute('title', expect.stringMatching(/Não tocar/i));
  });

  it('botao_retomar_ia_exige_trocar_combo_quando_agente_e_humano', async () => {
    montarApi([
      sessao({ lid: 'h1@lid', current_agent: 'HUMAN_AGENT', dont_touch: false }),
      sessao({ lid: 'h2@lid', current_agent: 'HUMAN_PENDING', dont_touch: false }),
      sessao({ lid: 'h3@lid', current_agent: 'OWNER_CONSULT', dont_touch: false }),
    ]);
    render(<WhatsAppSessions />);
    for (const lid of ['h1@lid', 'h2@lid', 'h3@lid']) {
      const linha = (await screen.findByText(lid)).closest('tr');
      const botao = within(linha).getByRole('button', { name: /retomar ia/i });
      expect(botao).toBeDisabled();
      expect(botao).toHaveAttribute('title', expect.stringMatching(/Troque o combo/i));
    }
  });

  it('retomar_ia_mostra_carregamento_e_exibe_erro_se_falhar', async () => {
    montarApi([sessao({ current_agent: 'XBOX360_AGENT', dont_touch: false })]);
    let rejectReq;
    api.post.mockImplementationOnce(() => new Promise((_, rej) => { rejectReq = rej; }));

    render(<WhatsAppSessions />);
    const linha = (await screen.findByText('233753779650648@lid')).closest('tr');
    const botao = within(linha).getByRole('button', { name: /retomar ia/i });

    await userEvent.click(botao);
    expect(within(linha).getByRole('button', { name: /retomando/i })).toBeDisabled();

    rejectReq({ response: { data: { error: 'Falha simulada no provedor' } } });
    expect(await screen.findByText('Falha simulada no provedor')).toBeInTheDocument();
    expect(within(linha).getByRole('button', { name: /retomar ia/i })).not.toBeDisabled();
  });
});
