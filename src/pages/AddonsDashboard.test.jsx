import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}));

import api from '@/services/api';
import AddonsDashboard from './AddonsDashboard';

const SAMPLE_RESPONSE = {
  start_date: '2026-11-13',
  end_date: '2026-11-19',
  store_id: null,
  marker_cutoff_brt: null,
  has_estimated_history: false,
  available_stores: [
    { store_id: 600004, store_name: 'Multigames' },
    { store_id: 600006, store_name: 'Playstation 2' },
  ],
  summary: {
    total_orders: 10,
    total_gross: 450.0,
    total_net: 440.0,
    checkout_orders: 8,
    checkout_addon: {
      orders: 3,
      items: 4,
      gross: 110.0,
      net: 108.9,
      attachment_rate: 37.5,
      total_share_rate: 30.0,
    },
    area_cliente: {
      orders: 2,
      items: 3,
      gross: 85.0,
      net: 84.15,
      total_share_rate: 20.0,
    },
    recompra: {
      orders: 1,
      gross: 39.0,
      net: 38.61,
      total_share_rate: 10.0,
    },
    net_incomplete_orders: 0,
  },
  daily_stats: [
    {
      date: '2026-11-18',
      label: '18/11',
      total_orders: 0,
      checkout_orders: 0,
      checkout_addon_orders: 0,
      attachment_rate: null,
      checkout_addon_items: 0,
      checkout_addon_gross: 0,
      checkout_addon_net: 0,
      area_orders: 0,
      area_gross: 0,
      recompra_orders: 0,
    },
    {
      date: '2026-11-19',
      label: '19/11',
      total_orders: 10,
      checkout_orders: 8,
      checkout_addon_orders: 3,
      attachment_rate: 37.5,
      checkout_addon_items: 4,
      checkout_addon_gross: 110.0,
      checkout_addon_net: 108.9,
      area_orders: 2,
      area_gross: 85.0,
      recompra_orders: 1,
    },
  ],
  by_store: [
    {
      store_id: 600004,
      store_name: 'Multigames',
      total_orders: 6,
      checkout_orders: 5,
      checkout_addon_orders: 2,
      attachment_rate: 40.0,
      checkout_addon_items: 3,
      checkout_addon_gross: 80.0,
      area_orders: 1,
      area_gross: 45.0,
    },
  ],
  by_addon_product: [
    {
      product_id: 1000001,
      title: 'Sistema Xbox 360',
      channel: 'adicional_checkout',
      channel_label: 'Adicional (Checkout)',
      items: 3,
      gross: 90.0,
      net: 89.1,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AddonsDashboard', () => {
  it('renders_summary_kpis_and_rates', async () => {
    api.get.mockResolvedValue({ data: SAMPLE_RESPONSE });
    render(<AddonsDashboard />);

    expect(await screen.findByText('Adicionais no Checkout')).toBeInTheDocument();
    expect(screen.getByText(/37,5% anexação/)).toBeInTheDocument();
    expect(screen.getByText(/4 itens/)).toBeInTheDocument();
    expect(screen.getByText('Área do Cliente')).toBeInTheDocument();
    expect(screen.getByText('Recompras (WhatsApp / Checkout)')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders_daily_store_and_product_breakdowns', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({ data: SAMPLE_RESPONSE });
    render(<AddonsDashboard />);

    expect(await screen.findByText('Evolução Diária (BRT)')).toBeInTheDocument();
    expect(screen.getByText('18/11')).toBeInTheDocument();
    expect(screen.getByText('19/11')).toBeInTheDocument();
    expect(screen.getByText('Por Loja (Checkout / Venda)')).toBeInTheDocument();
    expect(screen.getByText('Sistema Xbox 360')).toBeInTheDocument();

    // Seleciona filtro de loja e verifica parametro enviado ao backend
    const storeSelect = screen.getByLabelText('Loja');
    await user.selectOptions(storeSelect, '600004');
    await waitFor(() => {
      const lastUrl = api.get.mock.calls[api.get.mock.calls.length - 1][0];
      expect(lastUrl).toContain('store_id=600004');
    });
  });

  it('shows_pre_marker_estimated_notice', async () => {
    api.get.mockResolvedValue({
      data: {
        ...SAMPLE_RESPONSE,
        has_estimated_history: true,
        marker_cutoff_brt: '2026-11-19 21:00',
      },
    });
    render(<AddonsDashboard />);

    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent(/Histórico pré-marcador estimado/);
    expect(banner).toHaveTextContent(/2026-11-19 21:00 BRT/);
  });

  it('renders_empty_state_with_dash_rate', async () => {
    api.get.mockResolvedValue({
      data: {
        ...SAMPLE_RESPONSE,
        summary: {
          total_orders: 0,
          total_gross: 0,
          total_net: 0,
          checkout_orders: 0,
          checkout_addon: { orders: 0, items: 0, gross: 0, net: 0, attachment_rate: null, total_share_rate: null },
          area_cliente: { orders: 0, items: 0, gross: 0, net: 0, total_share_rate: null },
          recompra: { orders: 0, gross: 0, net: 0, total_share_rate: null },
        },
        daily_stats: [],
        by_store: [],
        by_addon_product: [],
      },
    });
    render(<AddonsDashboard />);

    expect(await screen.findByText(/Nenhuma venda aprovada encontrada/)).toBeInTheDocument();
    expect(screen.getByText(/— anexação/)).toBeInTheDocument();
  });

  it('renders_error_state_with_retry', async () => {
    const user = userEvent.setup();
    api.get
      .mockRejectedValueOnce({ response: { data: { error: 'Falha temporária no servidor' } } })
      .mockResolvedValueOnce({ data: SAMPLE_RESPONSE });

    render(<AddonsDashboard />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Falha temporária no servidor');

    await user.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    expect(await screen.findByText('Evolução Diária (BRT)')).toBeInTheDocument();
  });
});
