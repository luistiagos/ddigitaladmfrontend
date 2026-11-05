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
});
