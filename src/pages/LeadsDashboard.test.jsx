import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
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
