import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
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

function setupMocks({ stats = mockStats, meta = mockMetaSpend } = {}) {
  api.get.mockImplementation((url) => {
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

  it('aba_funil_de_leads_mostra_etapas_por_dia (EARS-8): séries por etapa e por dia, da mesma fonte do Dashboard de Leads', async () => {
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

  it('lead_unico_no_grafico_principal (EARS-9): o botão manda lead_unico=1 e as séries passam a ser as do filtro', async () => {
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
