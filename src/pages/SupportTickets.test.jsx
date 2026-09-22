/**
 * T6 — a tela de Chamados de suporte.
 *
 * O que estes testes protegem é o PONTO da tela (design §2.6): cada situação tem a sua
 * frase, e as três que afirmam demais nunca podem aparecer no lugar errado —
 * "nenhuma compra" por uma consulta que falhou, "acesso não entregue" por uma leitura que
 * falhou, e "não declarado" por um motivo que ninguém verificou.
 *
 * Spec: docs/modules/chatbot-whatsapp/changes/2026-09-05-painel-de-escalonamentos-do-suporte/
 *
 * Rodar:  npx vitest run src/pages/SupportTickets.test.jsx
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

import api from '@/services/api';
import SupportTickets from './SupportTickets';
import { formatUtcDateTime } from '@/utils/format';

function chamado(extra = {}) {
  return {
    id: 7,
    lid: '111@lid',
    status: 'aberto',
    aberto_em: '2026-09-17 12:45:00',
    origem_agente: 'XBOX360_AGENT',
    msg_abertura: 'o jogo nao abre no pc',
    telefone: '5511988887777',
    email: 'cliente@x.com',
    wa_link: 'https://wa.me/5511988887777',
    compras_status: 'ok',
    compras_busca: 'tel:5511988887777; emails:cliente@x.com',
    pacote_ids: '7',
    pacote_json: '[{"id": 7, "title": "Multijogos Xbox 360"}]',
    acesso_entregue: 1,
    enriquecido_em: '2026-09-17 12:50:00',
    reembolso: 0,
    reembolso_motivo: null,
    reembolso_confirmado: null,
    resumo_status: 'pendente',
    resumo_problema: null,
    resumo_onde: null,
    resumo_motivo_reembolso: null,
    parado: false,
    cliente_esperando: true,
    agente_atual: 'HUMAN_PENDING',
    nao_tocar: false,
    consultas: [],
    consultas_erro: false,
    ...extra,
  };
}

/** Respostas padrão das 4 chamadas que a tela faz ao abrir. */
function montarApi({ items = [chamado()], detalhe = null, eventos = [], config = { enabled: false, daily_cap: 25 } } = {}) {
  api.get.mockImplementation((url) => {
    if (url.startsWith('/admin/items')) return Promise.resolve({ data: { items: [{ id: 7, title: 'Multijogos Xbox 360' }] } });
    if (url.startsWith('/admin/wpp/tickets/summary-config')) return Promise.resolve({ data: config });
    if (/\/admin\/wpp\/tickets\/\d+\/events/.test(url)) return Promise.resolve({ data: { items: eventos } });
    if (/\/admin\/wpp\/tickets\/\d+$/.test(url)) return Promise.resolve({ data: detalhe || items[0] });
    if (url.startsWith('/admin/wpp/tickets?')) return Promise.resolve({ data: { items, total: items.length } });
    return Promise.resolve({ data: {} });
  });
  api.post.mockResolvedValue({ data: {} });
  api.patch.mockResolvedValue({ data: { success: true, auditoria: true } });
}

/** A ULTIMA consulta a fila -- a primeira e a do carregamento inicial, sem filtro. */
function urlDaFila() {
  const chamadas = api.get.mock.calls.map(([u]) => u).filter((u) => u.startsWith('/admin/wpp/tickets?'));
  return new URLSearchParams(chamadas[chamadas.length - 1].split('?')[1]);
}

async function abrirDetalhe() {
  await userEvent.click(await screen.findByRole('button', { name: '#7' }));
  return screen.findByText(/Chamado #7/);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Fila
// ---------------------------------------------------------------------------

describe('fila', () => {
  it('lista os não fechados por padrão, sem o operador precisar escolher', async () => {
    montarApi();
    render(<SupportTickets />);
    await screen.findByText('o jogo nao abre no pc');
    expect(urlDaFila().get('status')).toBe('abertos');
    expect(urlDaFila().get('parados')).toBeNull();
  });

  it('mostra com quem a conversa está agora', async () => {
    montarApi({ items: [chamado(), chamado({ id: 8, lid: 'b@lid', msg_abertura: 'outra coisa', agente_atual: null })] });
    render(<SupportTickets />);
    expect(await screen.findByText('HUMAN_PENDING')).toBeInTheDocument();
    expect(screen.getByText('Roteamento automático')).toBeInTheDocument();
  });

  it('o horário é lido como UTC e mostrado no fuso local', async () => {
    montarApi();
    render(<SupportTickets />);
    // 12:45 UTC em Brasília são 09:45 — a conversão vale no fuso de quem roda o teste.
    expect(await screen.findByText(formatUtcDateTime('2026-09-17 12:45:00'))).toBeInTheDocument();
    expect(new Date('2026-09-17T12:45:00Z').toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })).toBe(formatUtcDateTime('2026-09-17 12:45:00'));
  });

  it('os distintivos de parado e esperando saem do campo', async () => {
    montarApi({ items: [chamado({ parado: true, cliente_esperando: false })] });
    render(<SupportTickets />);
    expect(await screen.findByText('Parado')).toBeInTheDocument();
    expect(screen.queryByText('Esperando')).not.toBeInTheDocument();
  });

  it('o telefone aparece mascarado na fila', async () => {
    montarApi();
    render(<SupportTickets />);
    expect(await screen.findByText('(11) 98888-7777')).toBeInTheDocument();
    expect(screen.queryByText('5511988887777')).not.toBeInTheDocument();
  });

  it('o filtro de status, período e parados vai inteiro para a API', async () => {
    montarApi();
    render(<SupportTickets />);
    await screen.findByText('o jogo nao abre no pc');

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'fechado');
    await userEvent.type(screen.getByLabelText('De'), '2026-09-01');
    await userEvent.type(screen.getByLabelText('Até'), '2026-09-17');
    await userEvent.click(screen.getByLabelText('Só os parados'));
    await userEvent.click(screen.getByRole('button', { name: /buscar/i }));

    await waitFor(() => {
      const p = urlDaFila();
      expect(p.get('status')).toBe('fechado');
    });
    const p = urlDaFila();
    expect([p.get('de'), p.get('ate'), p.get('parados')]).toEqual(['2026-09-01', '2026-09-17', '1']);
  });

  it('"Fechar selecionados" manda os ids escolhidos e só depois de confirmar', async () => {
    montarApi({ items: [chamado(), chamado({ id: 8, lid: 'b@lid', msg_abertura: 'quero o reembolso' })] });
    render(<SupportTickets />);
    await screen.findByText('quero o reembolso');

    await userEvent.click(screen.getByLabelText('Selecionar chamado 8'));
    await userEvent.click(screen.getByRole('button', { name: /fechar selecionados \(1\)/i }));
    expect(api.post).not.toHaveBeenCalled();          // o modal ainda está aberto

    await userEvent.click(screen.getByRole('button', { name: /^fechar$/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/wpp/tickets/close-batch', { ids: [8] }));
  });

  it('o interruptor do resumo grava o que a tela mostra', async () => {
    montarApi();
    api.post.mockResolvedValue({ data: { enabled: true, daily_cap: 25 } });
    render(<SupportTickets />);

    await userEvent.click(await screen.findByLabelText('Resumo automático'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      '/admin/wpp/tickets/summary-config', { enabled: true, daily_cap: 25 },
    ));
  });

  // Bug 2026-09-22: o portao do detalhe vive na PRIMEIRA coluna, que e onde a rolagem
  // lateral comeca. Antes ele era um botao "Abrir" na ULTIMA, e abaixo de ~1775px de
  // viewport a tabela estourava o container e essa coluna saia inteira da tela -- com a
  // barra de rolagem horizontal 1300px abaixo da dobra, o dono leu como "tiraram o botao".
  it('o numero do chamado e a primeira coluna, e abre o detalhe', async () => {
    montarApi();
    render(<SupportTickets />);

    const linha = (await screen.findByText('o jogo nao abre no pc')).closest('tr');
    const primeiraComRotulo = within(linha).getAllByRole('cell')[1];
    expect(within(primeiraComRotulo).getByRole('button', { name: '#7' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '#7' }));
    expect(await screen.findByText(/Chamado #7/)).toBeInTheDocument();
  });

  it('nao existe mais botao "Abrir" no fim da linha', async () => {
    montarApi();
    render(<SupportTickets />);
    await screen.findByText('o jogo nao abre no pc');
    expect(screen.queryByRole('button', { name: /^abrir$/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tela estreita (celular) — bug 2026-09-22. A tabela de 9 colunas tem 1100px de rolagem
// lateral num aparelho de 390px: para ler UMA linha o dono arrastaria a tela inteira.
// Abaixo de 1024px a fila vira um cartao por chamado, tirado das MESMAS colunas.
// ---------------------------------------------------------------------------

describe('tela estreita (celular)', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: true, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    delete window.matchMedia;
  });

  it('a fila vira cartao: sem tabela, e o rotulo da coluna vira titulo do campo', async () => {
    montarApi();
    render(<SupportTickets />);
    await screen.findByText('o jogo nao abre no pc');

    // uma superficie so: a tabela nao fica escondida no DOM, ela nao existe
    expect(document.querySelector('table')).toBeNull();
    expect(screen.getByText('Aberto em')).toBeInTheDocument();
    expect(screen.getByText('O que o cliente disse')).toBeInTheDocument();
  });

  it('o numero do chamado fica no topo do cartao, e abre o detalhe', async () => {
    montarApi();
    render(<SupportTickets />);
    await screen.findByText('o jogo nao abre no pc');

    await userEvent.click(screen.getByRole('button', { name: '#7' }));
    expect(await screen.findByText(/Chamado #7/)).toBeInTheDocument();
  });

  it('o seletor de cada chamado sobrevive, entao o fechamento em lote funciona no celular', async () => {
    montarApi();
    render(<SupportTickets />);
    await screen.findByText('o jogo nao abre no pc');

    await userEvent.click(screen.getByLabelText('Selecionar chamado 7'));
    await userEvent.click(screen.getByRole('button', { name: /fechar selecionados/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^fechar$/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      '/admin/wpp/tickets/close-batch', { ids: [7] },
    ));
  });
});

// ---------------------------------------------------------------------------
// Coluna de reembolso (EARS-23) — substitui o badge único; 4 estados, o mais
// avançado prevalece.
// ---------------------------------------------------------------------------

describe('coluna de reembolso (EARS-23)', () => {
  it('vazio quando nao ha reembolso nenhum', async () => {
    montarApi({ items: [chamado()] });
    render(<SupportTickets />);
    await screen.findByText('o jogo nao abre no pc');
    expect(screen.queryByText('Reembolso solicitado')).not.toBeInTheDocument();
    expect(screen.queryByText('Reembolso feito')).not.toBeInTheDocument();
    expect(screen.queryByText('Reembolso contestado')).not.toBeInTheDocument();
  });

  it('"Reembolso solicitado" quando so a interceptacao na conversa ligou', async () => {
    montarApi({ items: [chamado({ reembolso: 1 })] });
    render(<SupportTickets />);
    expect(await screen.findByText('Reembolso solicitado')).toBeInTheDocument();
  });

  it('"Reembolso feito" prevalece sobre "solicitado" quando os dois sao verdade', async () => {
    montarApi({ items: [chamado({ reembolso: 1, reembolso_confirmado: 'refunded' })] });
    render(<SupportTickets />);
    expect(await screen.findByText('Reembolso feito')).toBeInTheDocument();
    expect(screen.queryByText('Reembolso solicitado')).not.toBeInTheDocument();
  });

  it('"Reembolso contestado" para chargeback confirmado', async () => {
    montarApi({ items: [chamado({ reembolso: 1, reembolso_confirmado: 'charged_back' })] });
    render(<SupportTickets />);
    expect(await screen.findByText('Reembolso contestado')).toBeInTheDocument();
  });

  it('o detalhe mostra o mesmo estado que a fila', async () => {
    montarApi({ items: [chamado({ reembolso_confirmado: 'refunded' })] });
    render(<SupportTickets />);
    await abrirDetalhe();
    expect(screen.getAllByText('Reembolso feito').length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Detalhe: cada texto do design §2.6 a partir do campo
// ---------------------------------------------------------------------------

describe('detalhe — compras (EARS-4)', () => {
  it('compra localizada mostra o pacote e por onde se procurou', async () => {
    montarApi();
    render(<SupportTickets />);
    await abrirDetalhe();
    expect(screen.getAllByText('Multijogos Xbox 360').length).toBeGreaterThan(0);
    expect(screen.getByText('tel:5511988887777; emails:cliente@x.com')).toBeInTheDocument();
  });

  it('nenhuma compra diz isso, e continua dizendo por onde procurou', async () => {
    montarApi({ items: [chamado({ compras_status: 'nenhuma', pacote_json: null })] });
    render(<SupportTickets />);
    await abrirDetalhe();
    expect(screen.getAllByText('Nenhuma compra localizada').length).toBeGreaterThan(0);
    expect(screen.getByText('tel:5511988887777; emails:cliente@x.com')).toBeInTheDocument();
  });

  it.each([['erro'], [null], [undefined]])(
    'consulta que falhou (%s) NUNCA vira "nenhuma compra"', async (status) => {
      montarApi({ items: [chamado({ compras_status: status, pacote_json: null })] });
      render(<SupportTickets />);
      await abrirDetalhe();
      expect(screen.getAllByText('Não foi possível consultar as compras').length).toBeGreaterThan(0);
      expect(screen.queryByText('Nenhuma compra localizada')).not.toBeInTheDocument();
    });

  it.each([
    [1, 'Acesso entregue'],
    [0, 'Acesso não entregue'],
    [null, 'Não foi possível saber'],
  ])('acesso_entregue=%s mostra "%s"', async (valor, texto) => {
    montarApi({ items: [chamado({ acesso_entregue: valor })] });
    render(<SupportTickets />);
    await abrirDetalhe();
    expect(screen.getByText(texto)).toBeInTheDocument();
  });
});

describe('detalhe — identificação (EARS-13) e não tocar', () => {
  it('o telefone aparece mascarado no detalhe, sem mudar o link do wa.me', async () => {
    montarApi();
    render(<SupportTickets />);
    await abrirDetalhe();
    // A fila (atrás do modal) e o detalhe mostram o MESMO telefone mascarado — os dois
    // links devem existir e nenhum perdeu o href do wa.me por causa da máscara.
    const links = screen.getAllByRole('link', { name: /98888-7777/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
    links.forEach((link) => {
      expect(link).toHaveTextContent('(11) 98888-7777');
      expect(link).toHaveAttribute('href', 'https://wa.me/5511988887777');
    });
  });

  it('sem telefone e sem e-mail, diz que não localizou — nunca campo em branco', async () => {
    montarApi({ items: [chamado({ telefone: null, email: null, wa_link: null })] });
    render(<SupportTickets />);
    await abrirDetalhe();
    expect(screen.getAllByText('WhatsApp não localizado').length).toBeGreaterThan(0);
    expect(screen.getAllByText('E-mail não localizado').length).toBeGreaterThan(0);
  });

  it.each([
    [true, 'Ligado'],
    [false, 'Desligado'],
    [null, 'Não foi possível saber'],
  ])('não tocar = %s mostra "%s"', async (valor, texto) => {
    montarApi({ items: [chamado({ nao_tocar: valor, acesso_entregue: 1 })] });
    render(<SupportTickets />);
    await abrirDetalhe();
    expect(screen.getByText(texto)).toBeInTheDocument();
  });
});

describe('detalhe — resumo (EARS-6, 8, 9, 11)', () => {
  it('resumo pronto mostra problema e onde', async () => {
    montarApi({ items: [chamado({ resumo_status: 'ok', resumo_problema: 'controle sem fio nao conecta', resumo_onde: 'Xbox 360' })] });
    render(<SupportTickets />);
    await abrirDetalhe();
    expect(screen.getByText('controle sem fio nao conecta')).toBeInTheDocument();
    expect(screen.getByText('Xbox 360')).toBeInTheDocument();
  });

  it.each([
    ['pendente', 'Resumo em alguns minutos'],
    ['desligado', 'Resumo indisponível (desligado)'],
    ['teto', 'Resumo indisponível (teto diário)'],
    ['erro', 'Resumo indisponível (falha, nova tentativa em breve)'],
    ['desistiu', 'Resumo indisponível (falhou 3 vezes)'],
  ])('resumo_status=%s mostra "%s"', async (status, texto) => {
    montarApi({ items: [chamado({ resumo_status: status })] });
    render(<SupportTickets />);
    await abrirDetalhe();
    expect(screen.getByText(texto)).toBeInTheDocument();
  });
});

describe('detalhe — reembolso (EARS-7)', () => {
  it('o motivo do resumo, quando existe, é o que aparece', async () => {
    montarApi({ items: [chamado({ reembolso: 1, reembolso_motivo: 'KNOWN', resumo_status: 'ok', resumo_motivo_reembolso: 'comprou achando que era para PS3' })] });
    render(<SupportTickets />);
    await abrirDetalhe();
    expect(screen.getByText('comprou achando que era para PS3')).toBeInTheDocument();
  });

  it.each([
    ['KNOWN', 'motivo na conversa, resumo pendente'],
    ['UNKNOWN', 'não declarado'],
    ['UNDECIDED', 'motivo não verificado'],
    [null, 'motivo não verificado'],
  ])('sem texto do resumo, o veredito %s vira "%s"', async (veredito, texto) => {
    montarApi({ items: [chamado({ reembolso: 1, reembolso_motivo: veredito })] });
    render(<SupportTickets />);
    await abrirDetalhe();
    expect(screen.getByText(texto)).toBeInTheDocument();
  });

  it('"não verificado" nunca é mostrado como "não declarado"', async () => {
    montarApi({ items: [chamado({ reembolso: 1, reembolso_motivo: 'UNDECIDED' })] });
    render(<SupportTickets />);
    await abrirDetalhe();
    expect(screen.queryByText('não declarado')).not.toBeInTheDocument();
  });

  it('chamado sem reembolso não mostra linha de motivo', async () => {
    montarApi({ items: [chamado({ reembolso: 0, reembolso_motivo: 'UNKNOWN' })] });
    render(<SupportTickets />);
    await abrirDetalhe();
    expect(screen.queryByText('Motivo do reembolso')).not.toBeInTheDocument();
  });
});

describe('detalhe — consultas ao dono (EARS-21) e histórico', () => {
  it('consulta pendente do mesmo cliente aparece no chamado', async () => {
    montarApi({ detalhe: chamado({ consultas: [{ id: 5, question: 'tem para PS3?' }] }) });
    render(<SupportTickets />);
    await abrirDetalhe();
    expect(screen.getByText('tem para PS3?')).toBeInTheDocument();
  });

  it('consulta que não pôde ser lida não vira "nenhuma consulta"', async () => {
    montarApi({ detalhe: chamado({ consultas: null, consultas_erro: true }) });
    render(<SupportTickets />);
    await abrirDetalhe();
    expect(screen.getByText('Não foi possível consultar as pendências.')).toBeInTheDocument();
  });

  it('o histórico mostra quem fez cada mudança', async () => {
    montarApi({ eventos: [
      { id: 1, tipo: 'aberto', de: 'XBOX360_AGENT', para: 'HUMAN_PENDING', autor: 'sistema', criado_em: '2026-09-17 12:45:00' },
      { id: 2, tipo: 'status', de: 'aberto', para: 'fechado', autor: 'luis@x.com', criado_em: '2026-09-17 13:00:00' },
    ] });
    render(<SupportTickets />);
    await abrirDetalhe();
    expect(screen.getByText('por luis@x.com')).toBeInTheDocument();
    expect(screen.getByText('por sistema')).toBeInTheDocument();
  });
});

describe('detalhe — status (EARS-14) e atualizar dados', () => {
  it('fechar manda o status e recarrega a fila', async () => {
    montarApi();
    render(<SupportTickets />);
    await abrirDetalhe();
    await userEvent.click(screen.getByRole('button', { name: /fechar chamado/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/wpp/tickets/7/status', { status: 'fechado' }));
  });

  it('chamado fechado oferece reabrir, e o 409 explica qual chamado impede', async () => {
    montarApi({ items: [chamado({ status: 'fechado' })] });
    api.post.mockRejectedValue({ response: { status: 409, data: { erro: 'conflito', aberto_id: 12 } } });
    render(<SupportTickets />);
    await abrirDetalhe();

    await userEvent.click(screen.getByRole('button', { name: /reabrir/i }));
    expect(await screen.findByText(/chamado #12 aberto/i)).toBeInTheDocument();
  });

  it('"Atualizar dados" que falha avisa e mantém o que está na tela', async () => {
    montarApi();
    api.post.mockRejectedValue({ response: { status: 503, data: { erro: 'x' } } });
    render(<SupportTickets />);
    await abrirDetalhe();

    await userEvent.click(screen.getByRole('button', { name: /atualizar dados/i }));
    expect(await screen.findByText(/continua valendo/i)).toBeInTheDocument();
    expect(screen.getAllByText('Multijogos Xbox 360').length).toBeGreaterThan(0);
  });

  it('o retrato mostrado é o do enriquecimento, com a data dele', async () => {
    montarApi();
    render(<SupportTickets />);
    await abrirDetalhe();
    expect(screen.getByText(`retrato de ${formatUtcDateTime('2026-09-17 12:50:00')}`)).toBeInTheDocument();
  });
});


// ---------------------------------------------------------------------------
// T7 — acoes sobre a sessao a partir do chamado (EARS-15, EARS-16, EARS-16a)
// ---------------------------------------------------------------------------

describe('acoes de sessao pelo chamado', () => {
  it('"Ver conversa" abre o historico da MESMA sessao, sem procurar pelo identificador', async () => {
    montarApi();
    api.get.mockImplementation((url) => {
      if (url.startsWith('/admin/items')) return Promise.resolve({ data: { items: [] } });
      if (url.startsWith('/admin/wpp/tickets/summary-config')) return Promise.resolve({ data: { enabled: false, daily_cap: 25 } });
      if (url.startsWith('/admin/wpp/agents')) return Promise.resolve({ data: { agents: [] } });
      if (/\/admin\/wpp\/tickets\/\d+\/events/.test(url)) return Promise.resolve({ data: { items: [] } });
      if (/\/admin\/wpp\/tickets\/\d+$/.test(url)) return Promise.resolve({ data: chamado() });
      if (url.startsWith('/admin/wpp/tickets?')) return Promise.resolve({ data: { items: [chamado()], total: 1 } });
      if (url.includes('/messages')) return Promise.resolve({ data: { items: [], total: 0 } });
      return Promise.resolve({ data: {} });
    });
    render(<SupportTickets />);
    await abrirDetalhe();

    await userEvent.click(screen.getByRole('button', { name: /ver conversa/i }));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(
      expect.stringContaining(`/admin/wpp/sessions/${encodeURIComponent('111@lid')}/messages`),
    ));
  });

  it('"Trocar agente" usa a rota de sessao e leva o chamado de origem', async () => {
    montarApi();
    render(<SupportTickets />);
    await abrirDetalhe();

    await userEvent.click(screen.getByRole('button', { name: /trocar agente/i }));
    await userEvent.click(await screen.findByRole('button', { name: /salvar/i }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
      `/admin/wpp/sessions/${encodeURIComponent('111@lid')}/agent`,
      expect.objectContaining({ ticket_id: 7 }),
    ));
  });

  it('"Nao tocar" manda lid + ticket_id na mesma rota da tela de sessoes', async () => {
    montarApi();
    render(<SupportTickets />);
    await abrirDetalhe();

    await userEvent.click(screen.getByRole('button', { name: /nao tocar/i }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
      `/admin/wpp/sessions/${encodeURIComponent('111@lid')}/dont-touch`,
      { active: true, ticket_id: 7 },
    ));
  });

  it('acao que valeu mas nao foi auditada avisa em vez de calar', async () => {
    montarApi();
    api.patch.mockResolvedValue({ data: { success: true, auditoria: false } });
    render(<SupportTickets />);
    await abrirDetalhe();

    await userEvent.click(screen.getByRole('button', { name: /nao tocar/i }));
    expect(await screen.findByText(/nao entrou no historico deste chamado/i)).toBeInTheDocument();
  });

  it('o chamado FECHADO continua oferecendo as acoes, e elas auditam nele', async () => {
    montarApi({ items: [chamado({ status: 'fechado' })] });
    render(<SupportTickets />);
    await abrirDetalhe();

    await userEvent.click(screen.getByRole('button', { name: /nao tocar/i }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
      expect.stringContaining('/dont-touch'),
      { active: true, ticket_id: 7 },
    ));
  });
});
