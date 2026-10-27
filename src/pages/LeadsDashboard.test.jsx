import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

import api from '@/services/api';
import LeadsDashboard from './LeadsDashboard';

// Forma de `origem_vendas` conferida em leads_sales_origin.py::calcular_origem_vendas (backend d0a43c1):
// chaves de janela em string, faixas únicas (janela de 90), pct null com total 0.
// Change: docs/modules/remarketing/changes/2026-10-12-origem-das-vendas-meta-ou-sem-sinal/ (T3).
function janela(meta, semSinal, semDados, total, vias) {
  const pct = (n) => (total ? Math.round((1000 * n) / total) / 10 : null);
  return {
    meta: { n: meta, pct: pct(meta) },
    sem_sinal: { n: semSinal, pct: pct(semSinal) },
    sem_dados: { n: semDados, pct: pct(semDados) },
    vias,
  };
}

const origemComVendas = {
  disponivel: true,
  total_compradores: 166,
  total_pagamentos: 173,
  janela_padrao: 7,
  por_janela: {
    1: janela(110, 55, 1, 166, { no_checkout: 95, anuncio_whatsapp: 4, visita_anterior: 11 }),
    7: janela(122, 43, 1, 166, { no_checkout: 99, anuncio_whatsapp: 5, visita_anterior: 18 }),
    28: janela(127, 38, 1, 166, { no_checkout: 100, anuncio_whatsapp: 6, visita_anterior: 21 }),
    90: janela(130, 35, 1, 166, { no_checkout: 101, anuncio_whatsapp: 6, visita_anterior: 23 }),
  },
  faixas_atraso: { ate_1d: 113, de_1_a_7d: 9, de_7_a_28d: 5, de_28_a_90d: 3 },
};

const origemSemVendas = {
  disponivel: true,
  total_compradores: 0,
  total_pagamentos: 0,
  janela_padrao: 7,
  por_janela: Object.fromEntries(
    ['1', '7', '28', '90'].map((j) => [j, janela(0, 0, 0, 0, { no_checkout: 0, anuncio_whatsapp: 0, visita_anterior: 0 })]),
  ),
  faixas_atraso: { ate_1d: 0, de_1_a_7d: 0, de_7_a_28d: 0, de_28_a_90d: 0 },
};

function statsCom(origem) {
  const stats = {
    funnel_summary: {
      pageview_count: 1000,
      add_to_cart_count: 400,
      lead_count: 100,
      initiate_checkout_count: 80,
      purchase_count: 150,
      total_captured_contacts: 330,
      total_initiated_checkout: 230,
      total_interactions: 1400,
    },
    rates: {
      pageview_to_cart_pct: 40,
      cart_to_lead_pct: 82.5,
      lead_to_initiate_pct: 69.7,
      initiate_to_purchase_pct: 65.2,
      cart_to_purchase_pct: 37.5,
      overall_conversion_pct: 15,
    },
    time_series: [],
    by_store: [],
    remarketing_summary: { total_workflows: 0, completed: 0, purchased: 0, active: 0, waiting: 0, failed: 0 },
  };
  if (origem !== undefined) stats.origem_vendas = origem;
  return stats;
}

function mockApi(stats) {
  api.get.mockImplementation((url) => {
    if (url.startsWith('/admin/stores')) return Promise.resolve({ data: { stores: [] } });
    if (url.startsWith('/admin/leads/dashboard-stats')) return Promise.resolve({ data: stats });
    return Promise.reject(new Error(`URL inesperada: ${url}`));
  });
}

async function renderBloco(stats) {
  mockApi(stats);
  render(
    <MemoryRouter>
      <LeadsDashboard />
    </MemoryRouter>,
  );
  const bloco = await screen.findByRole('region', { name: 'Origem das vendas' });
  // Espera o fim do carregamento da página inteira.
  await within(bloco).findByText(/Compradores do período|indisponível/);
  return bloco;
}

function cartaoDaClasse(bloco, rotulo) {
  return within(bloco).getByText(rotulo).parentElement;
}

describe('LeadsDashboard — Origem das vendas (T3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('troca a janela e recalcula sobre o mesmo total', async () => {
    const bloco = await renderBloco(statsCom(origemComVendas));

    // Janela padrão (7 dias) vem marcada e com os números dela.
    expect(within(bloco).getByRole('button', { name: '7 dias' })).toHaveAttribute('aria-pressed', 'true');
    expect(cartaoDaClasse(bloco, 'Meta (Facebook/Instagram)')).toHaveTextContent('73,5%');
    expect(cartaoDaClasse(bloco, 'Meta (Facebook/Instagram)')).toHaveTextContent('122 compradores');
    expect(cartaoDaClasse(bloco, 'Sem sinal do Meta')).toHaveTextContent('25,9%');
    expect(within(bloco).getByText('Visita anterior').nextSibling).toHaveTextContent('18');

    await userEvent.click(within(bloco).getByRole('button', { name: '28 dias' }));

    expect(within(bloco).getByRole('button', { name: '28 dias' })).toHaveAttribute('aria-pressed', 'true');
    expect(cartaoDaClasse(bloco, 'Meta (Facebook/Instagram)')).toHaveTextContent('76,5%');
    expect(cartaoDaClasse(bloco, 'Meta (Facebook/Instagram)')).toHaveTextContent('127 compradores');
    expect(cartaoDaClasse(bloco, 'Sem sinal do Meta')).toHaveTextContent('22,9%');
    expect(within(bloco).getByText('Visita anterior').nextSibling).toHaveTextContent('21');
    // Mesmo total, sem nova chamada ao backend.
    expect(within(bloco).getByText('Compradores do período').nextSibling).toHaveTextContent('166');
    const chamadasStats = api.get.mock.calls.filter(([url]) => url.startsWith('/admin/leads/dashboard-stats'));
    expect(chamadasStats).toHaveLength(1);
  });

  it('origem indisponivel nao mostra zero', async () => {
    for (const origem of [{ disponivel: false }, undefined]) {
      const bloco = await renderBloco(statsCom(origem));

      expect(within(bloco).getByText('Origem das vendas indisponível')).toBeInTheDocument();
      expect(bloco).not.toHaveTextContent(/\d/);
      expect(bloco).not.toHaveTextContent('%');
      expect(within(bloco).queryByText('Compradores do período')).not.toBeInTheDocument();
      // O resto do Dashboard continua com os números do funil.
      expect(screen.getAllByText('1.000').length).toBeGreaterThan(0);

      cleanup();
    }
  });

  it('periodo sem vendas', async () => {
    const bloco = await renderBloco(statsCom(origemSemVendas));

    expect(within(bloco).getByText('Nenhuma venda no período')).toBeInTheDocument();
    expect(bloco).not.toHaveTextContent('%');
    expect(within(bloco).queryByText('Meta (Facebook/Instagram)')).not.toBeInTheDocument();
  });

  it('aviso de cobertura visivel', async () => {
    const bloco = await renderBloco(statsCom(origemComVendas));

    const aviso = within(bloco).getByText(/“Sem sinal do Meta” inclui/);
    expect(aviso).toHaveTextContent('outros canais');
    expect(aviso).toHaveTextContent('clique em outro aparelho sem contato informado');
    expect(aviso).toHaveTextContent('visualização sem clique');
    expect(aviso).toHaveTextContent('rastro apagado pelo navegador');
    expect(aviso).toHaveTextContent('não é comparável ao “Purchase” do Gerenciador de Anúncios');
  });

  it('total rotulado como compradores do periodo', async () => {
    const bloco = await renderBloco(statsCom(origemComVendas));

    const rotulo = within(bloco).getByText('Compradores do período');
    expect(rotulo.nextSibling).toHaveTextContent('166');
    expect(rotulo.nextSibling).not.toHaveTextContent('150'); // purchase_count do funil
    expect(within(bloco).getByText(/Cada lead conta uma vez/)).toHaveTextContent(
      'Não é a etapa “Vendas Aprovadas” do funil',
    );
  });
});

// Forma conferida em checkout_funnel.py::calcular (backend 7d98288). Números do período 18-25/10 x
// base 01-17/10 (gabarito (b) e (c) da spec) e da série PIX do gabarito (a).
// Change: docs/modules/telemetria/changes/2026-10-26-funil-do-checkout-por-pessoa-no-dashboard-de-leads/ (T4).
const lado = (num, den, extra = {}) => ({ num, den, pct: den ? Math.round((1000 * num) / den) / 10 : null, ...extra });
const pago = (num, den, aguardando = 0) => lado(num, den, { aguardando, cobertura: 'total' });

const SEMANAS = [
  ['2026-W36', '2026-08-31'], ['2026-W37', '2026-09-07'], ['2026-W38', '2026-09-14'], ['2026-W39', '2026-09-21'],
  ['2026-W40', '2026-09-28'], ['2026-W41', '2026-10-05'], ['2026-W42', '2026-10-12'], ['2026-W43', '2026-10-19'],
];
const PIX_POR_SEMANA = [[80, 95], [90, 101], [85, 102], [104, 122], [74, 86], [100, 117], [91, 103], [75, 98]];

function funilOk(sobrescreve = {}) {
  return {
    disponivel: true,
    versao_medicao: 'checkout-funnel-v1',
    periodo: { inicio: '2026-10-18', fim: '2026-10-25' },
    base: { inicio: '2026-10-01', fim: '2026-10-17', padrao: false },
    store_id: null,
    ultima_coleta_mp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    cobertura_mp_desde: '2026-07-01',
    transicoes: [
      {
        id: 'abriu_contato', unidade: 'registro_checkout',
        periodo: lado(206, 701), base: lado(406, 1410), dif_pp: 0.6,
        por_loja: [{ store_id: 600007, periodo: lado(68, 240), base: lado(144, 500), dif_pp: -0.5 }],
      },
      {
        id: 'contato_gerou', unidade: 'registro_com_contato',
        periodo: lado(151, 206), base: lado(325, 405), dif_pp: -6.9,
        por_loja: [
          { store_id: 600004, periodo: lado(51, 73), base: lado(112, 139), dif_pp: -10.7 },
          { store_id: 600007, periodo: lado(47, 68), base: lado(108, 144), dif_pp: -5.9 },
        ],
      },
      {
        id: 'gerou_pagou', unidade: 'pessoa',
        periodo: pago(89, 112, 3), base: pago(442, 503), dif_pp: -8.4,
        por_loja: [{ store_id: 600007, periodo: pago(22, 30), base: pago(74, 84), dif_pp: -14.8 }],
        por_meio: [
          { meio: 'pix', periodo: pago(76, 99, 3), base: pago(368, 427), dif_pp: -9.4 },
          { meio: 'cartao', periodo: pago(9, 9), base: pago(60, 65), dif_pp: 7.7 },
        ],
      },
    ],
    retentativas: {
      periodo: { pagou_depois: 8, valor_menor: 0, episodios: 112, cobertura: 'total' },
      base: { pagou_depois: 52, valor_menor: 8, episodios: 503, cobertura: 'total' },
    },
    combos: { periodo: lado(11, 95, { cobertura: 'total' }), base: lado(67, 458, { cobertura: 'total' }) },
    serie_semanal: SEMANAS.map(([semana, inicio], i) => ({
      semana, inicio, fim: inicio, parcial: i === SEMANAS.length - 1,
      abriu_contato: lado(60 + i, 200), contato_gerou: lado(150 + i, 200),
      gerou_pagou: lado(170 + i, 200, { aguardando: 0, cobertura: 'total' }),
      gerou_pagou_por_meio: {
        pix: lado(...PIX_POR_SEMANA[i], { aguardando: 0, cobertura: 'total' }),
        cartao: lado(9, 10, { aguardando: 0, cobertura: 'total' }),
      },
    })),
    ...sobrescreve,
  };
}

const LOJAS = [{ id: 600004, name: 'Multigames' }, { id: 600007, name: 'Xbox 360' }];

// `funil`: corpo do 200, ou uma função que devolve a Promise da chamada (falha, 400).
function mockApiComFunil(stats, funil) {
  api.get.mockImplementation((url) => {
    if (url.startsWith('/admin/stores')) return Promise.resolve({ data: { stores: LOJAS } });
    if (url.startsWith('/admin/leads/dashboard-stats')) return Promise.resolve({ data: stats });
    if (url.startsWith('/admin/leads/checkout-funnel')) {
      return typeof funil === 'function' ? funil(url) : Promise.resolve({ data: funil });
    }
    return Promise.reject(new Error(`URL inesperada: ${url}`));
  });
}

async function renderFunil(funil, stats = statsCom(origemComVendas)) {
  mockApiComFunil(stats, funil);
  render(
    <MemoryRouter>
      <LeadsDashboard />
    </MemoryRouter>,
  );
  const bloco = await screen.findByRole('region', { name: 'Onde o checkout perde a venda' });
  await waitFor(() => expect(within(bloco).queryByText('Carregando...')).not.toBeInTheDocument());
  // Os blocos antigos também terminam de carregar.
  await within(screen.getByRole('region', { name: 'Origem das vendas' })).findByText(/Compradores do período|indisponível/);
  return bloco;
}

// O rótulo da transição também está na legenda do gráfico: a linha é a do que está numa <tr>.
function linhaDe(bloco, rotulo) {
  const linhas = within(bloco).getAllByText(rotulo).map((el) => el.closest('tr')).filter(Boolean);
  expect(linhas).toHaveLength(1);
  return linhas[0];
}

// `getByTitle` só acha <title> filho direto do <svg>; os pontos têm o <title> dentro do <circle>.
function titulosDosPontos(grafico) {
  return [...grafico.querySelectorAll('circle > title')].map((t) => t.textContent);
}

describe('LeadsDashboard — Onde o checkout perde a venda (T4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bloco novo nao altera os existentes', async () => {
    // Texto da página inteira sem o bloco novo: igual com o bloco cheio e com ele indisponível.
    const textoSemOBloco = () => {
      const copia = document.body.cloneNode(true);
      copia.querySelector('[aria-labelledby="funil-checkout-titulo"]').remove();
      return copia.textContent;
    };

    const bloco = await renderFunil(funilOk());
    expect(within(bloco).getByText('Transição')).toBeInTheDocument();
    const comBloco = textoSemOBloco();
    const urlsComBloco = api.get.mock.calls.map(([u]) => u).filter((u) => u.startsWith('/admin/leads/dashboard-stats'));
    cleanup();
    vi.clearAllMocks();

    await renderFunil({ disponivel: false });
    expect(textoSemOBloco()).toBe(comBloco);
    const urlsSemBloco = api.get.mock.calls.map(([u]) => u).filter((u) => u.startsWith('/admin/leads/dashboard-stats'));
    expect(urlsSemBloco).toEqual(urlsComBloco);
    expect(urlsComBloco).toHaveLength(1);

    // Ordem: depois do "Origem das vendas", antes do "Evolução das Taxas".
    const origem = screen.getByRole('region', { name: 'Origem das vendas' });
    const novo = screen.getByRole('region', { name: 'Onde o checkout perde a venda' });
    const evolucao = screen.getByText(/Evolução das Taxas de Conversão/);
    expect(origem.compareDocumentPosition(novo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(novo.compareDocumentPosition(evolucao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('tabela de periodo contra base com numerador, denominador e diferenca', async () => {
    const bloco = await renderFunil(funilOk());

    const contato = linhaDe(bloco, 'Preencheu contato ➔ gerou pagamento');
    expect(contato).toHaveTextContent('73,3% (151/206)');
    expect(contato).toHaveTextContent('80,2% (325/405)');
    expect(contato).toHaveTextContent('-6,9 pp');

    const pagou = linhaDe(bloco, 'Gerou pagamento ➔ pagou');
    expect(pagou).toHaveTextContent('79,5% (89/112)');
    expect(pagou).toHaveTextContent('3 aguardando 24 h');
    expect(pagou).toHaveTextContent('87,9% (442/503)');
    expect(pagou).toHaveTextContent('-8,4 pp');

    // A chamada leva o filtro da tela e não manda base (padrão).
    const url = api.get.mock.calls.map(([u]) => u).find((u) => u.startsWith('/admin/leads/checkout-funnel'));
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('start_date')).toBeTruthy();
    expect(params.get('end_date')).toBeTruthy();
    expect(params.has('base_start')).toBe(false);
  });

  it('grafico semanal marca semana parcial', async () => {
    const bloco = await renderFunil(funilOk());
    const grafico = within(bloco).getByRole('img', { name: 'Taxa semanal por transição' });

    // Só a última semana é parcial: um rótulo e um ponto vazado por transição.
    expect(within(grafico).getAllByText('parcial')).toHaveLength(1);
    expect(grafico.querySelectorAll('circle[data-parcial="true"]')).toHaveLength(3);
    expect(grafico.querySelectorAll('circle[data-parcial="false"]')).toHaveLength(21);
    expect(titulosDosPontos(grafico)).toContain('Gerou pagamento ➔ pagou: 88,5% (177/200) • 2026-W43 (parcial)');

    // Corte PIX: a série do gabarito (a).
    await userEvent.click(within(bloco).getByRole('button', { name: 'PIX' }));
    const titulos = titulosDosPontos(grafico);
    expect(titulos).toContain('Gerou pagamento ➔ pagou: 85,2% (104/122) • 2026-W39');
    expect(titulos).toContain('Gerou pagamento ➔ pagou: 76,5% (75/98) • 2026-W43 (parcial)');
    expect(titulos).not.toContain('Gerou pagamento ➔ pagou: 88,5% (177/200) • 2026-W43 (parcial)');
  });

  it('detalhe por loja e por meio', async () => {
    const bloco = await renderFunil(funilOk());
    expect(within(bloco).queryByText('Por loja')).not.toBeInTheDocument();

    await userEvent.click(within(bloco).getByRole('button', { name: 'Detalhe de Preencheu contato ➔ gerou pagamento' }));
    const xbox = linhaDe(bloco, 'Xbox 360');
    expect(xbox).toHaveTextContent('69,1% (47/68)');
    expect(xbox).toHaveTextContent('75,0% (108/144)');
    expect(xbox).toHaveTextContent('-5,9 pp');
    expect(linhaDe(bloco, 'Multigames')).toHaveTextContent('69,9% (51/73)');
    expect(within(bloco).queryByText('Por meio')).not.toBeInTheDocument();

    await userEvent.click(within(bloco).getByRole('button', { name: 'Detalhe de Gerou pagamento ➔ pagou' }));
    expect(within(bloco).getAllByText('Por loja')).toHaveLength(1);
    expect(linhaDe(bloco, 'Xbox 360')).toHaveTextContent('-14,8 pp');
    expect(within(bloco).getByText('Por meio')).toBeInTheDocument();
    const pix = within(bloco).getAllByText('PIX').map((el) => el.closest('tr')).find(Boolean);
    expect(pix).toHaveTextContent('76,8% (76/99)');
    expect(pix).toHaveTextContent('86,2% (368/427)');
    expect(pix).toHaveTextContent('-9,4 pp');
    expect(within(bloco).getAllByText('Cartão').map((el) => el.closest('tr')).find(Boolean)).toHaveTextContent('+7,7 pp');
  });

  it('unidade de cada transicao visivel', async () => {
    const bloco = await renderFunil(funilOk());

    expect(linhaDe(bloco, 'Abriu o checkout ➔ preencheu contato')).toHaveTextContent('registro do checkout');
    expect(linhaDe(bloco, 'Preencheu contato ➔ gerou pagamento')).toHaveTextContent('registro com contato');
    expect(linhaDe(bloco, 'Gerou pagamento ➔ pagou')).toHaveTextContent('pessoa');
    const nota = within(bloco).getByText(/As duas primeiras transições/);
    expect(nota).toHaveTextContent('vêm do último status de cada registro do checkout, não da pessoa');
    expect(nota).toHaveTextContent('As fontes não são a mesma população');
  });

  it('coleta atrasada avisa', async () => {
    let bloco = await renderFunil(funilOk());
    expect(within(bloco).getByText(/Última coleta do Mercado Pago/)).toBeInTheDocument();
    expect(within(bloco).queryByText(/Coleta atrasada/)).not.toBeInTheDocument();
    cleanup();

    bloco = await renderFunil(funilOk({ ultima_coleta_mp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() }));
    expect(within(bloco).getByText(/Última coleta do Mercado Pago/)).toBeInTheDocument();
    expect(within(bloco).getByText(/Coleta atrasada/)).toBeInTheDocument();
    cleanup();

    bloco = await renderFunil(funilOk({ ultima_coleta_mp: null }));
    expect(within(bloco).getByText('Nenhuma coleta do Mercado Pago registrada')).toBeInTheDocument();
    expect(within(bloco).getByText(/Coleta atrasada/)).toBeInTheDocument();
  });

  it('funil do checkout indisponivel nao mostra zero', async () => {
    const falhas = [
      { disponivel: false, versao_medicao: 'checkout-funnel-v1', motivo: 'falha no calculo (OperationalError)' },
      () => Promise.reject(Object.assign(new Error('500'), { response: { status: 500, data: {} } })),
      () => Promise.reject(new Error('Network Error')),
    ];
    for (const funil of falhas) {
      const bloco = await renderFunil(funil);

      expect(within(bloco).getByText('Funil do checkout indisponível')).toBeInTheDocument();
      expect(bloco).not.toHaveTextContent(/\d/);
      expect(bloco).not.toHaveTextContent('%');
      expect(within(bloco).queryByText('Transição')).not.toBeInTheDocument();
      // O resto do Dashboard continua normal.
      expect(screen.getAllByText('1.000').length).toBeGreaterThan(0);
      expect(within(screen.getByRole('region', { name: 'Origem das vendas' })).getByText('Compradores do período')).toBeInTheDocument();

      cleanup();
    }
  });

  it('sem denominador e sem cobertura nao viram zero', async () => {
    const funil = funilOk();
    funil.transicoes[1] = { ...funil.transicoes[1], periodo: lado(0, 0), dif_pp: null };
    funil.transicoes[2] = {
      ...funil.transicoes[2],
      base: { num: null, den: null, pct: null, aguardando: null, cobertura: 'nenhuma' },
      dif_pp: null,
    };
    const bloco = await renderFunil(funil);

    const contato = linhaDe(bloco, 'Preencheu contato ➔ gerou pagamento');
    expect(contato).toHaveTextContent('sem dados');
    expect(contato).not.toHaveTextContent('0,0%');
    const pagou = linhaDe(bloco, 'Gerou pagamento ➔ pagou');
    expect(pagou).toHaveTextContent('sem cobertura');
    expect(pagou).not.toHaveTextContent('0,0%');
  });

  it('base escolhida vai ao backend e erro 400 mostra a mensagem', async () => {
    const urls = [];
    const bloco = await renderFunil((url) => {
      urls.push(url);
      if (url.includes('base_start=2026-04-01')) {
        return Promise.reject({ response: { status: 400, data: { error: 'periodo + base somam 210 dias (maximo 180): escolha uma base menor' } } });
      }
      return Promise.resolve({ data: funilOk() });
    });

    // Só uma data da base: nada muda.
    await userEvent.type(within(bloco).getByLabelText('Início da base'), '2026-04-01');
    expect(urls.filter((u) => u.includes('base_start'))).toHaveLength(0);

    await userEvent.type(within(bloco).getByLabelText('Fim da base'), '2026-10-17');
    expect(await within(bloco).findByText(/escolha uma base menor/)).toBeInTheDocument();
    const ultima = new URLSearchParams(urls[urls.length - 1].split('?')[1]);
    expect(ultima.get('base_start')).toBe('2026-04-01');
    expect(ultima.get('base_end')).toBe('2026-10-17');

    await userEvent.click(within(bloco).getByRole('button', { name: 'Usar a base padrão' }));
    expect(await within(bloco).findByText('Transição')).toBeInTheDocument();
    expect(new URLSearchParams(urls[urls.length - 1].split('?')[1]).has('base_start')).toBe(false);
  });

  it('filtro de loja vai ao bloco novo', async () => {
    const bloco = await renderFunil(funilOk());
    await userEvent.selectOptions(screen.getByDisplayValue('Todas as Lojas (Consolidado)'), '600007');
    await within(bloco).findByText('Transição');

    const urls = api.get.mock.calls.map(([u]) => u).filter((u) => u.startsWith('/admin/leads/checkout-funnel'));
    expect(new URLSearchParams(urls[urls.length - 1].split('?')[1]).get('store_id')).toBe('600007');
  });
});

describe('LeadsDashboard — Média Móvel no Gráfico', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const timeSeriesMock = [
    { period: '2026-10-01', label: '01/10', initiate_to_purchase_pct: 50, pageview_to_cart_pct: 20 },
    { period: '2026-10-02', label: '02/10', initiate_to_purchase_pct: 100, pageview_to_cart_pct: 40 },
    { period: '2026-10-03', label: '03/10', initiate_to_purchase_pct: 60, pageview_to_cart_pct: 30 },
  ];

  it('inicia com o checkbox de média móvel desmarcado e o ativa ao clicar', async () => {
    const stats = statsCom(origemComVendas);
    stats.time_series = timeSeriesMock;
    mockApi(stats);

    render(
      <MemoryRouter>
        <LeadsDashboard />
      </MemoryRouter>,
    );

    const checkbox = await screen.findByRole('checkbox', { name: /Média Móvel/i });
    expect(checkbox).not.toBeChecked();
    expect(screen.queryByLabelText('Janela da média móvel')).not.toBeInTheDocument();
    expect(screen.queryByText(/• Média Móvel/i)).not.toBeInTheDocument();

    // Ativa o checkbox
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    // Seletor de janela aparece com 7 dias padrão
    const select = screen.getByLabelText('Janela da média móvel');
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('7');
    expect(screen.getByText(/• Média Móvel \(7 dias\)/i)).toBeInTheDocument();
    expect(screen.getByText('Dados reais')).toBeInTheDocument();

    // Troca para 14 dias
    await userEvent.selectOptions(select, '14');
    expect(select).toHaveValue('14');
    expect(screen.getByText(/• Média Móvel \(14 dias\)/i)).toBeInTheDocument();

    // Desmarca o checkbox
    await userEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(screen.queryByLabelText('Janela da média móvel')).not.toBeInTheDocument();
    expect(screen.queryByText(/• Média Móvel/i)).not.toBeInTheDocument();
  });
});
