import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

import api from '@/services/api';
import Dashboard from './Dashboard';

const mockDailyStats = [
  {
    date: '2026-11-01',
    label: '01/11',
    approved_count: 5,
    approved_total: 500.0,
    approved_total_net: 475.0,
    mp_fees_total: 25.0,
    pending_count: 1,
    failed_count: 0,
    reverted_count: 0,
    chargeback_count: 0,
  },
  {
    date: '2026-11-02',
    label: '02/11',
    approved_count: 10,
    approved_total: 1000.0,
    approved_total_net: 950.0,
    mp_fees_total: 50.0,
    pending_count: 2,
    failed_count: 1,
    reverted_count: 0,
    chargeback_count: 0,
  },
];

const mockStats = {
  approved_count: 15,
  approved_total: 1500.0,
  approved_total_net: 1425.0,
  pending_count: 3,
  failed_count: 1,
  reverted_count: 0,
  chargeback_count: 0,
  mp_fees_total: 75.0,
  stores_with_sales: [],
  sales_by_store: [],
  sales_by_product: [],
  daily_stats: mockDailyStats,
};

const mockMetaSpend = {
  configured: true,
  spend: 200.0,
  daily_spend: {
    '2026-11-01': 80.0,
    '2026-11-02': 120.0,
  },
};

// Rota da taxa de PIX de leads novos. Ela casa `/admin/dashboard` também, então vem ANTES desse
// teste nos mocks. Padrão: rejeitada, que é o cenário da EARS-17 (o resto da tela segue igual).
const pixRejeitada = () => Promise.reject(new Error('rota da taxa fora'));

function respostaPix(pix, url) {
  const r = typeof pix === 'function' ? pix(url) : pix;
  return r instanceof Promise ? r : Promise.resolve({ data: r });
}

function setupMocks({ stats = mockStats, meta = mockMetaSpend, pix = pixRejeitada } = {}) {
  api.get.mockImplementation((url) => {
    if (url.includes('/admin/dashboard/pix-leads-novos')) return respostaPix(pix, url);
    if (url.includes('/admin/dashboard')) {
      return Promise.resolve({ data: stats });
    }
    if (url.includes('/admin/meta/ad-spend')) {
      return Promise.resolve({ data: meta });
    }
    return Promise.reject(new Error(`Rota não mapeada: ${url}`));
  });
}

describe('Dashboard — Gráfico de Evolução e Tabela Diária', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders_chart_and_table_when_multiple_days (EARS-1): exibe gráfico e tabela em período de mais de 1 dia', async () => {
    setupMocks();

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    const inputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
    fireEvent.change(inputs[0], { target: { value: '2026-11-01' } });
    fireEvent.change(inputs[1], { target: { value: '2026-11-02' } });

    // Aguarda o bloco de evolução diária carregar
    await waitFor(() => {
      expect(screen.getByText(/Evolução Diária/i)).toBeInTheDocument();
      expect(screen.getByText(/Detalhamento Diário/i)).toBeInTheDocument();
    });

    // Confere se os dias da tabela e do gráfico aparecem
    expect(screen.getAllByText('01/11').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('02/11').length).toBeGreaterThanOrEqual(1);

    // Confere se as séries do gráfico estão presentes
    expect(screen.getByText('Séries no Gráfico:')).toBeInTheDocument();
    expect(screen.getAllByText('Total Bruto').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Receita Líquida').length).toBeGreaterThanOrEqual(1);
  });

  it('hides_chart_and_table_when_single_day (EARS-2): oculta gráfico e tabela quando startDate === endDate', async () => {
    setupMocks();

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Como o padrão inicial é startDate = todayISO e endDate = todayISO (mesmo dia),
    // o gráfico e a tabela NÃO devem estar no documento.
    await waitFor(() => {
      expect(screen.queryByText(/Evolução Diária/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Detalhamento Diário/i)).not.toBeInTheDocument();
    });
  });

  it('toggles_series_and_chart_modes (EARS-5): permite alternar entre Financeiro e Volumes e ativar/desativar séries', async () => {
    setupMocks();
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    const inputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
    fireEvent.change(inputs[0], { target: { value: '2026-11-01' } });
    fireEvent.change(inputs[1], { target: { value: '2026-11-02' } });

    await waitFor(() => {
      expect(screen.getByText(/Evolução Diária/i)).toBeInTheDocument();
    });

    // Clica no modo "Volumes (Qtd)"
    const btnVolumes = screen.getByRole('button', { name: /Volumes \(Qtd\)/i });
    await user.click(btnVolumes);

    // Confere se as séries de volume aparecem
    await waitFor(() => {
      expect(screen.getAllByText('Vendas Aprovadas').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('Pagamentos Falhos').length).toBeGreaterThanOrEqual(1);
    });

    // Clica de volta no modo "Financeiro (R$)"
    const btnFinanceiro = screen.getByRole('button', { name: /Financeiro \(R\$\)/i });
    await user.click(btnFinanceiro);

    await waitFor(() => {
      expect(screen.getAllByText('Total Bruto').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Lucro Bruto').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('handles_meta_spend_failure_gracefully (EARS-7): continua exibindo dados se Meta Ads falhar', async () => {
    setupMocks({
      meta: { configured: false },
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    const inputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
    fireEvent.change(inputs[0], { target: { value: '2026-11-01' } });
    fireEvent.change(inputs[1], { target: { value: '2026-11-02' } });

    await waitFor(() => {
      expect(screen.getByText(/Evolução Diária/i)).toBeInTheDocument();
      expect(screen.getAllByText('01/11').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('activates_multi_day_via_preset_button: ao clicar em Últimos 7 dias, exibe o gráfico e a tabela', async () => {
    setupMocks();
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Inicialmente no mesmo dia, exibe aviso e oculta o gráfico
    expect(screen.queryByText(/Evolução Diária/i)).not.toBeInTheDocument();
    expect(screen.getByText(/O gráfico comparativo e o detalhamento dia a dia são exibidos para filtros de 2 ou mais dias/i)).toBeInTheDocument();

    // Clica no preset "Últimos 7 dias"
    const btn7d = screen.getByRole('button', { name: 'Últimos 7 dias' });
    await user.click(btn7d);

    await waitFor(() => {
      expect(screen.getByText(/Evolução Diária/i)).toBeInTheDocument();
      expect(screen.getByText(/Detalhamento Diário/i)).toBeInTheDocument();
    });
  });
});

// Aba "Funil de leads" e "Só leads únicos" no gráfico principal (T5 da change
// docs/modules/telemetria/changes/2026-11-21-filtro-lead-unico-nos-dashboards/).
function diaLeads(date, label, { pv, cart, lead, init, pur }) {
  return {
    period: date,
    date,
    label,
    pageview_count: pv,
    add_to_cart_count: cart,
    lead_count: lead,
    initiate_checkout_count: init,
    purchase_count: pur,
    total: pv + cart + lead + init + pur,
  };
}

const leadsSemFiltro = {
  time_series: [
    diaLeads('2026-11-01', '01/11', { pv: 100, cart: 30, lead: 6, init: 3, pur: 2 }), // total 141
    diaLeads('2026-11-02', '02/11', { pv: 200, cart: 40, lead: 8, init: 4, pur: 5 }), // total 257
  ],
};

const leadsFiltrado = {
  time_series: [
    diaLeads('2026-11-01', '01/11', { pv: 70, cart: 21, lead: 4, init: 2, pur: 1 }), // total 98
    diaLeads('2026-11-02', '02/11', { pv: 150, cart: 33, lead: 7, init: 3, pur: 4 }), // total 197
  ],
  lead_unico: {
    ativo: true,
    excluidas_compra_anterior: 41,
    excluidas_compra_outra_loja: 0,
    sem_identificacao: 1234,
    pagou_depois: 7,
    topo_aproximado: true,
  },
};

function setupLeads({ leads = (url) => (url.includes('lead_unico=1') ? leadsFiltrado : leadsSemFiltro), stats = mockStats } = {}) {
  api.get.mockImplementation((url) => {
    if (url.includes('/admin/leads/dashboard-stats')) {
      const r = leads(url);
      return r instanceof Promise ? r : Promise.resolve({ data: r });
    }
    if (url.includes('/admin/dashboard/pix-leads-novos')) return pixRejeitada();
    if (url.includes('/admin/dashboard')) return Promise.resolve({ data: stats });
    if (url.includes('/admin/meta/ad-spend')) return Promise.resolve({ data: mockMetaSpend });
    return Promise.reject(new Error(`Rota não mapeada: ${url}`));
  });
}

const chamadasLeads = () => api.get.mock.calls.map(([u]) => u).filter((u) => u.includes('/admin/leads/dashboard-stats'));
const pontos = (container) => Array.from(container.querySelectorAll('svg circle title')).map((t) => t.textContent);

async function abrirPeriodoDeDoisDias() {
  const inputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
  fireEvent.change(inputs[0], { target: { value: '2026-11-01' } });
  fireEvent.change(inputs[1], { target: { value: '2026-11-02' } });
  await waitFor(() => expect(screen.getByText(/Evolução Diária/i)).toBeInTheDocument());
}

describe('Dashboard — aba "Funil de leads" (T5)', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // EARS-8: séries por etapa e por dia, da mesma fonte do Dashboard de Leads.
  it('aba_funil_de_leads_mostra_etapas_por_dia', async () => {
    setupLeads({ stats: { ...mockStats, stores_with_sales: [{ store_id: 7, store_name: 'Loja PS2', count: 1, total: 1 }] } });
    const user = userEvent.setup();
    const { container } = render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await abrirPeriodoDeDoisDias();

    // Financeiro e Volumes não buscam o funil de leads.
    await user.click(screen.getByRole('button', { name: /Volumes \(Qtd\)/i }));
    await waitFor(() => expect(screen.getAllByText('Vendas Aprovadas').length).toBeGreaterThanOrEqual(1));
    expect(chamadasLeads()).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: /Funil de leads/i }));
    await waitFor(() => expect(pontos(container)).toContain('Compraram: 5 (02/11)'));

    const url = chamadasLeads().at(-1);
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('start_date')).toBe('2026-11-01');
    expect(params.get('end_date')).toBe('2026-11-02');
    expect(params.get('group_by')).toBe('daily');
    expect(params.get('tz_offset_minutes')).toBe(String(new Date().getTimezoneOffset()));
    expect(params.has('lead_unico')).toBe(false);
    expect(params.has('store_id')).toBe(false);

    for (const rotulo of ['Entraram na página', 'Pararam em AddToCart', 'Pararam em Lead (contato)',
      'Pararam em InitiateCheckout (PIX gerado)', 'Compraram']) {
      expect(screen.getByRole('button', { name: rotulo })).toBeInTheDocument();
    }
    const p = pontos(container);
    expect(p).toEqual(expect.arrayContaining([
      'Entraram na página: 141 (01/11)', 'Entraram na página: 257 (02/11)',
      'Pararam em AddToCart: 30 (01/11)', 'Pararam em AddToCart: 40 (02/11)',
      'Pararam em Lead (contato): 6 (01/11)', 'Pararam em Lead (contato): 8 (02/11)',
      'Pararam em InitiateCheckout (PIX gerado): 3 (01/11)', 'Pararam em InitiateCheckout (PIX gerado): 4 (02/11)',
      'Compraram: 2 (01/11)', 'Compraram: 5 (02/11)',
    ]));
    expect(p).toHaveLength(10);
    // Sem o filtro, nada de recorte nem de "aproximado".
    expect(screen.queryByText(/Recorte ativo/)).not.toBeInTheDocument();
    expect(screen.queryByText(/aproximado/)).not.toBeInTheDocument();

    // Loja escolhida vai junto, como no Dashboard de Leads.
    fireEvent.change(screen.getByLabelText('Filtrar loja'), { target: { value: '7' } });
    await waitFor(() => expect(new URLSearchParams(chamadasLeads().at(-1).split('?')[1]).get('store_id')).toBe('7'));

    // Financeiro volta inalterado.
    await user.click(screen.getByRole('button', { name: /Financeiro \(R\$\)/i }));
    await waitFor(() => expect(pontos(container).some((t) => t.startsWith('Total Bruto:') && t.endsWith('(01/11)'))).toBe(true));
    expect(screen.queryByRole('button', { name: 'Compraram' })).not.toBeInTheDocument();
    expect(pontos(container).some((t) => t.startsWith('Entraram'))).toBe(false);

    // Um dia só: o gráfico some, como nas outras abas, e nenhuma busca nova.
    await user.click(screen.getByRole('button', { name: /Funil de leads/i }));
    await waitFor(() => expect(pontos(container)).toContain('Compraram: 5 (02/11)'));
    const antes = chamadasLeads().length;
    const inputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
    fireEvent.change(inputs[1], { target: { value: '2026-11-01' } });
    await waitFor(() => expect(screen.queryByText(/Evolução Diária/i)).not.toBeInTheDocument());
    expect(chamadasLeads()).toHaveLength(antes);
  });

  // EARS-9: o botão manda lead_unico=1 e as séries passam a ser as do filtro.
  it('lead_unico_no_grafico_principal', async () => {
    setupLeads();
    const user = userEvent.setup();
    const { container } = render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await abrirPeriodoDeDoisDias();
    await user.click(screen.getByRole('button', { name: /Funil de leads/i }));
    await waitFor(() => expect(pontos(container)).toContain('Entraram na página: 141 (01/11)'));

    const botao = screen.getByRole('button', { name: /Só leads únicos/i });
    expect(botao).toHaveAttribute('aria-pressed', 'false');
    await user.click(botao);

    await waitFor(() => expect(pontos(container)).toContain('Compraram: 4 (02/11)'));
    expect(botao).toHaveAttribute('aria-pressed', 'true');
    expect(new URLSearchParams(chamadasLeads().at(-1).split('?')[1]).get('lead_unico')).toBe('1');
    const p = pontos(container);
    expect(p).toEqual(expect.arrayContaining([
      'Entraram na página (aproximado): 98 (01/11)', 'Entraram na página (aproximado): 197 (02/11)',
      'Pararam em AddToCart (aproximado): 21 (01/11)', 'Pararam em AddToCart (aproximado): 33 (02/11)',
      'Pararam em Lead (contato): 4 (01/11)', 'Pararam em Lead (contato): 7 (02/11)',
      'Pararam em InitiateCheckout (PIX gerado): 2 (01/11)', 'Pararam em InitiateCheckout (PIX gerado): 3 (02/11)',
      'Compraram: 1 (01/11)', 'Compraram: 4 (02/11)',
    ]));
    expect(p).toHaveLength(10);
    expect(p.some((t) => t.includes(': 141 ') || t.includes(': 257 '))).toBe(false);
    expect(screen.getByText(/Recorte ativo: só leads únicos · 41 excluídas por compra anterior · 1\.234 linhas sem identificação/)).toBeInTheDocument();
    // "(aproximado)" só no topo do funil.
    expect(screen.getByRole('button', { name: 'Entraram na página (aproximado)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pararam em AddToCart (aproximado)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Compraram' })).toBeInTheDocument();

    // Desliga: volta ao sem filtro, sem recorte e sem "aproximado".
    await user.click(botao);
    await waitFor(() => expect(pontos(container)).toContain('Entraram na página: 141 (01/11)'));
    expect(new URLSearchParams(chamadasLeads().at(-1).split('?')[1]).has('lead_unico')).toBe(false);
    expect(screen.queryByText(/Recorte ativo/)).not.toBeInTheDocument();
    expect(screen.queryByText(/aproximado/)).not.toBeInTheDocument();
  });

  it('erro do filtro (EARS-11): 503 ou resposta sem o bloco lead_unico mostra o erro e nenhum ponto', async () => {
    for (const falha of [
      () => Promise.reject({ response: { status: 503, data: { error: 'nao foi possivel aplicar o filtro de lead unico' } } }),
      () => ({ time_series: leadsSemFiltro.time_series }),
    ]) {
      cleanup();
      vi.clearAllMocks();
      setupLeads({ leads: (url) => (url.includes('lead_unico=1') ? falha() : leadsSemFiltro) });
      const user = userEvent.setup();
      const { container } = render(<MemoryRouter><Dashboard /></MemoryRouter>);
      await abrirPeriodoDeDoisDias();
      await user.click(screen.getByRole('button', { name: /Funil de leads/i }));
      await waitFor(() => expect(pontos(container)).toContain('Entraram na página: 141 (01/11)'));

      await user.click(screen.getByRole('button', { name: /Só leads únicos/i }));
      await waitFor(() => expect(screen.getByText('nao foi possivel aplicar o filtro de lead unico')).toBeInTheDocument());
      expect(pontos(container)).toHaveLength(0);
      expect(screen.queryByText(/Recorte ativo/)).not.toBeInTheDocument();
    }
  });

  it('resposta atrasada ou de outro estado nunca vira número na tela', async () => {
    let soltarFiltrado;
    const filtradoPendente = new Promise((resolve) => { soltarFiltrado = resolve; });
    setupLeads({ leads: (url) => (url.includes('lead_unico=1') ? filtradoPendente : leadsSemFiltro) });
    const user = userEvent.setup();
    const { container } = render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await abrirPeriodoDeDoisDias();
    await user.click(screen.getByRole('button', { name: /Funil de leads/i }));
    await waitFor(() => expect(pontos(container)).toContain('Entraram na página: 141 (01/11)'));

    // Ligou e a resposta filtrada ainda não chegou: o número sem filtro sai da tela na hora.
    await user.click(screen.getByRole('button', { name: /Só leads únicos/i }));
    expect(pontos(container)).toHaveLength(0);
    expect(screen.getByText(/Carregando gráfico/)).toBeInTheDocument();

    // Desligou antes de a filtrada chegar; ela chega depois e é descartada.
    await user.click(screen.getByRole('button', { name: /Só leads únicos/i }));
    await waitFor(() => expect(pontos(container)).toContain('Entraram na página: 141 (01/11)'));
    soltarFiltrado({ data: leadsFiltrado });
    await new Promise((r) => setTimeout(r, 20));
    expect(pontos(container)).toContain('Entraram na página: 141 (01/11)');
    expect(pontos(container).some((t) => t.includes(': 98 '))).toBe(false);
    expect(screen.queryByText(/Recorte ativo/)).not.toBeInTheDocument();
  });
});

// Cartão "PIX de leads novos" (T3 da change
// docs/modules/telemetria/changes/2026-11-24-taxa-de-pix-pago-de-leads-novos/). A resposta segue a
// porta 1 do design, que é o que `pix_leads_novos.calcular` monta no backend.
function blocoPix({ pix = [0, 0], lead = [0, 0], aguardando = [0, 0], excluidos = 0, semId = 0 } = {}) {
  const t = ([num, den]) => ({ num, den, pct: den ? Math.round((num * 1000) / den) / 10 : null });
  return {
    por_pix: t(pix),
    por_lead: t(lead),
    aguardando: { pix: aguardando[0], leads: aguardando[1] },
    excluidos_compra_anterior: excluidos,
    sem_identificacao: semId,
  };
}

function respostaPixOk({ inicio, fim, desde = '2026-07-01', total, porDia = [] }) {
  return {
    disponivel: true,
    versao_medicao: 'pix-leads-novos-v1',
    periodo: { inicio, fim },
    store_id: null,
    cobertura_desde: desde,
    maturidade_min: 60,
    total,
    por_dia: porDia,
  };
}

// Os totais da medição da spec (10-23/11): 162 de 270 PIX, 169 de 230 leads, em dois dias.
const pixMedido = respostaPixOk({
  inicio: '2026-11-10',
  fim: '2026-11-11',
  total: blocoPix({ pix: [162, 270], lead: [169, 230], aguardando: [4, 3], excluidos: 21, semId: 1 }),
  porDia: [
    { dia: '2026-11-10', ...blocoPix({ pix: [100, 170], lead: [100, 140], aguardando: [4, 3], excluidos: 12, semId: 1 }) },
    { dia: '2026-11-11', ...blocoPix({ pix: [62, 100], lead: [69, 90], excluidos: 9 }) },
  ],
});

const ERRO_PIX = 'não foi possível calcular a taxa de PIX de leads novos';
const chamadasPix = () => api.get.mock.calls.map(([u]) => u).filter((u) => u.includes('/admin/dashboard/pix-leads-novos'));
const paramsDa = (url) => new URLSearchParams(url.split('?')[1]);
const secaoPix = () => screen.getByText('PIX de leads novos').parentElement;

describe('Dashboard — cartão "PIX de leads novos" (T3)', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // EARS-1: taxa por PIX do período e da loja selecionados, com "N de M".
  it('cartao_pix_leads_novos_mostra_taxa_por_pix', async () => {
    setupMocks({
      pix: pixMedido,
      stats: { ...mockStats, stores_with_sales: [{ store_id: 7, store_name: 'Loja PS2', count: 1, total: 1 }] },
    });
    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    await waitFor(() => expect(within(secaoPix()).getByText('60%')).toBeInTheDocument());
    expect(within(secaoPix()).getByText('PIX pago — por PIX')).toBeInTheDocument();
    expect(within(secaoPix()).getByText('162 de 270 PIX')).toBeInTheDocument();

    // Período da tela (Hoje), sem loja.
    const primeira = paramsDa(chamadasPix().at(-1));
    expect(primeira.get('start_date')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(primeira.get('end_date')).toBe(primeira.get('start_date'));
    expect(primeira.has('store_id')).toBe(false);

    // Loja escolhida vai junto.
    await screen.findByRole('option', { name: 'Loja PS2' });
    fireEvent.change(screen.getByLabelText('Filtrar loja'), { target: { value: '7' } });
    await waitFor(() => expect(paramsDa(chamadasPix().at(-1)).get('store_id')).toBe('7'));

    // Outro período: nova busca com as datas novas.
    const inputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
    fireEvent.change(inputs[0], { target: { value: '2026-11-10' } });
    fireEvent.change(inputs[1], { target: { value: '2026-11-11' } });
    await waitFor(() => {
      const p = paramsDa(chamadasPix().at(-1));
      expect([p.get('start_date'), p.get('end_date'), p.get('store_id')]).toEqual(['2026-11-10', '2026-11-11', '7']);
    });
    await waitFor(() => expect(within(secaoPix()).getByText('60%')).toBeInTheDocument());
  });

  // EARS-2: no mesmo cartão, a taxa por lead, com os leads que pagaram e os contados.
  it('cartao_pix_leads_novos_mostra_taxa_por_lead', async () => {
    setupMocks({ pix: pixMedido });
    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    await waitFor(() => expect(within(secaoPix()).getByText('73,5%')).toBeInTheDocument());
    expect(within(secaoPix()).getByText('PIX pago — por lead')).toBeInTheDocument();
    expect(within(secaoPix()).getByText('169 de 230 leads')).toBeInTheDocument();
  });

  // EARS-14: período sem PIX contado mostra "—" e o aviso, nunca 0%.
  it('cartao_pix_leads_novos_vazio_sem_zero', async () => {
    setupMocks({
      pix: respostaPixOk({
        inicio: '2026-11-25',
        fim: '2026-11-25',
        total: blocoPix({ aguardando: [2, 2] }),
        porDia: [{ dia: '2026-11-25', ...blocoPix({ aguardando: [2, 2] }) }],
      }),
    });
    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    await waitFor(() => expect(within(secaoPix()).getAllByText('—')).toHaveLength(2));
    expect(within(secaoPix()).getAllByText('nenhum PIX de lead novo no período')).toHaveLength(2);
    expect(secaoPix().textContent).not.toMatch(/%/);
    expect(secaoPix().textContent).not.toMatch(/0 de 0/);
    // Os PIX ainda aguardando continuam visíveis (EARS-15).
    expect(within(secaoPix()).getByText(/^2 PIX aguardando \(2 leads\)/)).toBeInTheDocument();
  });

  // EARS-16: rota fora (backend antigo), `disponivel: false`, 400 ou resposta sem o bloco: a mensagem
  // fixa, sem número e sem o motivo técnico — no cartão e na aba "PIX pago (%)" do gráfico (T4).
  it('pix_leads_novos_erro_sem_numero', async () => {
    for (const falha of [
      () => Promise.reject({ response: { status: 404, data: {} } }),
      () => ({ disponivel: false, versao_medicao: 'pix-leads-novos-v1', motivo: 'falha no calculo (OperationalError)' }),
      () => Promise.reject({ response: { status: 400, data: { error: 'start_date invalida: use AAAA-MM-DD' } } }),
      () => ({ disponivel: true, versao_medicao: 'pix-leads-novos-v1' }),
    ]) {
      cleanup();
      vi.clearAllMocks();
      setupMocks({ pix: falha });
      const user = userEvent.setup();
      const { container } = render(<MemoryRouter><Dashboard /></MemoryRouter>);

      await waitFor(() => expect(within(secaoPix()).getByText(ERRO_PIX)).toBeInTheDocument());
      expect(secaoPix().textContent).not.toMatch(/\d/);
      expect(secaoPix().textContent).not.toMatch(/OperationalError|invalida/);

      // A aba do gráfico mostra a mesma mensagem, sem ponto e sem dígito.
      await abrirPeriodo('2026-11-10', '2026-11-11');
      await user.click(screen.getByRole('button', { name: /PIX pago \(%\)/ }));
      await waitFor(() => expect(screen.getAllByText(ERRO_PIX)).toHaveLength(2));
      const noGrafico = screen.getAllByText(ERRO_PIX).find((el) => !secaoPix().contains(el));
      expect(noGrafico.parentElement.textContent).not.toMatch(/\d/);
      expect(noGrafico.parentElement.textContent).not.toMatch(/OperationalError|invalida/);
      expect(pontos(container)).toHaveLength(0);
      expect(container.querySelector('svg[aria-label="Evolução Diária"]')).toBeNull();
    }
  });

  // EARS-17: a taxa rejeitada ou pendurada não segura nem derruba os cartões de Vendas.
  it('pix_leads_novos_falha_nao_derruba_os_outros_cartoes', async () => {
    for (const [pix, pendurada] of [[pixRejeitada, false], [() => new Promise(() => {}), true]]) {
      cleanup();
      vi.clearAllMocks();
      setupMocks({ pix });
      render(<MemoryRouter><Dashboard /></MemoryRouter>);

      const rotulo = await screen.findByText('Vendas Aprovadas');
      expect(within(rotulo.closest('.rounded-xl')).getByText('15')).toBeInTheDocument();
      expect(screen.getByText('Pagamentos Falhos')).toBeInTheDocument();
      expect(screen.getByText('Gasto Facebook Ads')).toBeInTheDocument();
      expect(chamadasPix()).toHaveLength(1);
      if (pendurada) {
        // Ainda carregando: os dois esqueletos, nenhum número.
        expect(secaoPix().querySelectorAll('.animate-pulse')).toHaveLength(2);
        expect(secaoPix().textContent).not.toMatch(/\d/);
      } else {
        await waitFor(() => expect(within(secaoPix()).getByText(ERRO_PIX)).toBeInTheDocument());
      }
    }
  });

  // EARS-15 e EARS-18 na tela (as provas declaradas delas são do backend): contadores, e o "desde"
  // só quando a cobertura corta o começo do período.
  it('cobertura parcial e contadores do cartao de PIX de leads novos', async () => {
    const junho = respostaPixOk({
      inicio: '2026-06-20',
      fim: '2026-07-02',
      desde: '2026-07-01',
      total: blocoPix({ pix: [3, 5], lead: [3, 4], excluidos: 1, semId: 1234 }),
    });
    setupMocks({ pix: (url) => (url.includes('start_date=2026-06-20') ? junho : pixMedido) });
    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    await waitFor(() => expect(within(secaoPix()).getByText('60%')).toBeInTheDocument());
    expect(within(secaoPix()).getByText(
      '4 PIX aguardando (3 leads) · 21 fora por compra anterior · 1 sem identificação',
    )).toBeInTheDocument();
    expect(secaoPix().textContent).not.toMatch(/desde/);

    const inputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
    fireEvent.change(inputs[0], { target: { value: '2026-06-20' } });
    fireEvent.change(inputs[1], { target: { value: '2026-07-02' } });
    await waitFor(() => expect(within(secaoPix()).getByText(
      '0 PIX aguardando (0 leads) · 1 fora por compra anterior · 1.234 sem identificação · dados de PIX desde 01/07/2026',
    )).toBeInTheDocument());
    expect(within(secaoPix()).getByText('3 de 5 PIX')).toBeInTheDocument();
  });

  // Concorrência (design, varredura): a resposta atrasada de outro período é descartada pela chave.
  it('resposta atrasada de outro periodo nunca vira numero no cartao de PIX', async () => {
    let soltarHoje;
    const hojePendente = new Promise((resolve) => { soltarHoje = resolve; });
    setupMocks({
      pix: (url) => {
        if (url.includes('end_date=2026-11-12')) return new Promise(() => {});
        return url.includes('start_date=2026-11-10') ? pixMedido : hojePendente;
      },
    });
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await waitFor(() => expect(chamadasPix()).toHaveLength(1));

    const inputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
    fireEvent.change(inputs[0], { target: { value: '2026-11-10' } });
    fireEvent.change(inputs[1], { target: { value: '2026-11-11' } });
    await waitFor(() => expect(within(secaoPix()).getByText('60%')).toBeInTheDocument());

    soltarHoje({ data: respostaPixOk({ inicio: '2026-11-25', fim: '2026-11-25', total: blocoPix({ pix: [1, 10], lead: [1, 10] }) }) });
    await new Promise((r) => setTimeout(r, 20));
    expect(within(secaoPix()).getByText('60%')).toBeInTheDocument();
    expect(secaoPix().textContent).not.toMatch(/10%|1 de 10/);

    // Período novo ainda sem resposta: o número do anterior sai da tela na hora (carregando).
    fireEvent.change(inputs[1], { target: { value: '2026-11-12' } });
    await waitFor(() => expect(secaoPix().querySelectorAll('.animate-pulse')).toHaveLength(2));
    expect(secaoPix().textContent).not.toMatch(/\d/);
  });
});

// Aba "PIX pago (%)" do gráfico "Evolução Diária" (T4 da mesma change): desenha `por_dia` da MESMA
// resposta do cartão.
async function abrirPeriodo(inicio, fim) {
  const inputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
  fireEvent.change(inputs[0], { target: { value: inicio } });
  fireEvent.change(inputs[1], { target: { value: fim } });
  await waitFor(() => expect(screen.getByText(/Evolução Diária/i)).toBeInTheDocument());
}

const abaPix = () => screen.getByRole('button', { name: /PIX pago \(%\)/ });
const grafico = (container) => container.querySelector('svg[aria-label="Evolução Diária"]');
const linhasDaCor = (container, cor) => Array.from(grafico(container).querySelectorAll('polyline'))
  .filter((l) => l.getAttribute('stroke') === cor)
  .map((l) => l.getAttribute('points').split(' '));

describe('Dashboard — aba "PIX pago (%)" do gráfico (T4)', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // EARS-11: as duas taxas de cada dia, com "N de M" de cada ponto, num eixo fixo de 0 a 100%.
  it('aba_pix_leads_novos_mostra_taxa_por_dia', async () => {
    setupMocks({ pix: (url) => (url.includes('end_date=2026-11-12') ? new Promise(() => {}) : pixMedido) });
    const user = userEvent.setup();
    const { container } = render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await abrirPeriodo('2026-11-10', '2026-11-11');
    await waitFor(() => expect(within(secaoPix()).getByText('60%')).toBeInTheDocument());
    const buscas = chamadasPix().length;

    await user.click(abaPix());
    await waitFor(() => expect(pontos(container)).toContain('Pago por PIX: 62% (62 de 100) (11/11)'));
    expect([...pontos(container)].sort()).toEqual([
      'Pago por PIX: 58,8% (100 de 170) (10/11)',
      'Pago por PIX: 62% (62 de 100) (11/11)',
      'Pago por lead: 71,4% (100 de 140) (10/11)',
      'Pago por lead: 76,7% (69 de 90) (11/11)',
    ]);
    // A mesma resposta do cartão: abrir a aba não busca de novo.
    expect(chamadasPix()).toHaveLength(buscas);
    expect(screen.getByRole('button', { name: 'Pago por PIX' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pago por lead' })).toBeInTheDocument();

    // Eixo fixo: 0% a 100%, e o ponto de 62% na altura de 62% (o eixo pelo máximo o poria no topo).
    const textos = Array.from(grafico(container).querySelectorAll('text')).map((t) => t.textContent);
    expect(textos).toEqual(expect.arrayContaining(['0%', '25%', '50%', '75%', '100%', '10/11', '11/11']));
    const ponto62 = Array.from(grafico(container).querySelectorAll('circle'))
      .find((c) => c.querySelector('title').textContent.startsWith('Pago por PIX: 62%'));
    expect(Number(ponto62.getAttribute('cy'))).toBeCloseTo(200 - 0.62 * 180, 5);
    // Sem dia vazio: uma linha por série, com os dois dias.
    expect(linhasDaCor(container, '#10b981').map((l) => l.length)).toEqual([2]);
    expect(linhasDaCor(container, '#3b82f6').map((l) => l.length)).toEqual([2]);

    // Financeiro volta como sempre, sem a taxa e sem "%" no eixo.
    await user.click(screen.getByRole('button', { name: /Financeiro \(R\$\)/i }));
    await waitFor(() => expect(pontos(container).some((t) => t.startsWith('Total Bruto:') && t.endsWith('(01/11)'))).toBe(true));
    expect(pontos(container).some((t) => t.startsWith('Pago por'))).toBe(false);
    expect(Array.from(grafico(container).querySelectorAll('text')).some((t) => t.textContent.endsWith('%'))).toBe(false);
    expect(screen.queryByRole('button', { name: 'Pago por PIX' })).not.toBeInTheDocument();

    // De volta à aba, sem busca nova.
    await user.click(abaPix());
    await waitFor(() => expect(pontos(container)).toHaveLength(4));
    expect(chamadasPix()).toHaveLength(buscas);

    // Período novo ainda sem resposta: os pontos do anterior saem na hora e a aba fica carregando
    // pelo estado da taxa, e não pelo /admin/dashboard: com os cartões de Vendas já de volta, ela segue
    // carregando.
    fireEvent.change(screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/)[1], { target: { value: '2026-11-12' } });
    await waitFor(() => expect(within(screen.getByText('Vendas Aprovadas').closest('.rounded-xl')).getByText('15')).toBeInTheDocument());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByText(/Carregando gráfico/)).toBeInTheDocument();
    expect(pontos(container)).toHaveLength(0);
  });

  // EARS-12: um dia só mostra o cartão e nenhum gráfico da taxa.
  it('pix_leads_novos_um_dia_so_cartao_sem_grafico', async () => {
    setupMocks({ pix: pixMedido });
    const user = userEvent.setup();
    const { container } = render(<MemoryRouter><Dashboard /></MemoryRouter>);

    // "Hoje": cartão com o número, sem gráfico e sem o botão da aba.
    await waitFor(() => expect(within(secaoPix()).getByText('60%')).toBeInTheDocument());
    expect(screen.queryByText(/Evolução Diária/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /PIX pago \(%\)/ })).not.toBeInTheDocument();
    expect(pontos(container)).toHaveLength(0);

    // Vindo de 2 dias com a aba aberta: o gráfico some e o cartão fica.
    await abrirPeriodo('2026-11-10', '2026-11-11');
    await user.click(abaPix());
    await waitFor(() => expect(pontos(container)).toHaveLength(4));
    fireEvent.change(screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/)[1], { target: { value: '2026-11-10' } });
    await waitFor(() => expect(screen.queryByText(/Evolução Diária/i)).not.toBeInTheDocument());
    await waitFor(() => expect(within(secaoPix()).getByText('60%')).toBeInTheDocument());
    expect(pontos(container)).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /PIX pago \(%\)/ })).not.toBeInTheDocument();
  });

  // EARS-13: dia sem PIX contado fica sem ponto, nunca 0%, e a linha se quebra nele. O 0% de verdade
  // (0 de 5) continua sendo ponto.
  it('aba_pix_leads_novos_dia_sem_pix_sem_ponto', async () => {
    const quatroDias = respostaPixOk({
      inicio: '2026-11-10',
      fim: '2026-11-13',
      total: blocoPix({ pix: [8, 19], lead: [4, 12], aguardando: [3, 3] }),
      porDia: [
        { dia: '2026-11-10', ...blocoPix({ pix: [5, 10], lead: [4, 8] }) },
        { dia: '2026-11-11', ...blocoPix({ aguardando: [2, 2] }) },
        { dia: '2026-11-12', ...blocoPix({ pix: [3, 4], aguardando: [1, 1] }) },
        { dia: '2026-11-13', ...blocoPix({ pix: [0, 5], lead: [0, 4] }) },
      ],
    });
    setupMocks({ pix: quatroDias });
    const user = userEvent.setup();
    const { container } = render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await abrirPeriodo('2026-11-10', '2026-11-13');
    await user.click(abaPix());
    await waitFor(() => expect(pontos(container)).toHaveLength(5));

    expect([...pontos(container)].sort()).toEqual([
      'Pago por PIX: 0% (0 de 5) (13/11)',
      'Pago por PIX: 50% (5 de 10) (10/11)',
      'Pago por PIX: 75% (3 de 4) (12/11)',
      'Pago por lead: 0% (0 de 4) (13/11)',
      'Pago por lead: 50% (4 de 8) (10/11)',
    ]);
    expect(pontos(container).some((t) => t.includes('(11/11)'))).toBe(false);

    // Nada no x do dia vazio: nem ponto, nem vértice de linha. O dia segue no eixo.
    const x = (idx) => 50 + (idx / 3) * 730;
    const circulos = Array.from(grafico(container).querySelectorAll('circle')).map((c) => c.getAttribute('cx'));
    expect(circulos).not.toContain(String(x(1)));
    const vertices = Array.from(grafico(container).querySelectorAll('polyline')).flatMap((l) => l.getAttribute('points').split(' '));
    expect(vertices.some((v) => v.startsWith(`${x(1)},`))).toBe(false);
    expect(Array.from(grafico(container).querySelectorAll('text')).map((t) => t.textContent)).toContain('11/11');

    // A linha se quebra: por PIX = [10/11] e [12/11, 13/11]; por lead = [10/11] e [13/11].
    expect(linhasDaCor(container, '#10b981').map((l) => l.length)).toEqual([1, 2]);
    expect(linhasDaCor(container, '#3b82f6').map((l) => l.length)).toEqual([1, 1]);
  });
});
