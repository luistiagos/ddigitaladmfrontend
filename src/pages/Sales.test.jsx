import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}));

import api from '@/services/api';
import Sales from './Sales';

const VENDAS = [
  {
    id: 101,
    order_id: 5001,
    email: 'combo@exemplo.com',
    phone: '11999990001',
    product_id: 9021111,
    title: 'Sistema Multigames + Sistema Xbox 360',
    gross_amount: 69.0,
    total_fees: 0.69,
    net_amount: 68.31,
    datetime: '2026-11-19T15:00:00Z',
    status: 'approved',
    mpid: '5001',
    payment_id: '188000001',
    has_transaction: true,
    origin_type: 'principal_com_adicional',
    origin_label: 'Principal + Adicionais',
    origin_estimated: false,
    addon_count: 1,
    addon_items: [{ id: 102, product_id: 1000001, title: 'Sistema Xbox 360', gross_amount: 30.0, net_amount: 29.7 }],
    order_items: [
      { id: 101, product_id: 9021111, title: 'Sistema Multigames', gross_amount: 39.0, net_amount: 38.61 },
      { id: 102, product_id: 1000001, title: 'Sistema Xbox 360', gross_amount: 30.0, net_amount: 29.7 },
    ],
  },
  {
    id: 201,
    order_id: 5002,
    email: 'area@exemplo.com',
    phone: '11999990002',
    product_id: 9021118,
    title: 'Plataforma Nintendo Switch',
    gross_amount: 30.0,
    total_fees: 0.3,
    net_amount: 29.7,
    datetime: '2026-11-19T16:00:00Z',
    status: 'approved',
    mpid: '5002',
    payment_id: '188000002',
    has_transaction: true,
    origin_type: 'area_cliente',
    origin_label: 'Área do cliente',
    origin_estimated: false,
    addon_count: 0,
    addon_items: [],
    order_items: [
      { id: 201, product_id: 9021118, title: 'Plataforma Nintendo Switch', gross_amount: 30.0, net_amount: 29.7 },
    ],
  },
];

function chamadasDeVendas() {
  return api.get.mock.calls.map((c) => c[0]).filter((u) => u.startsWith('/admin/transactions?'));
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation(async (url) => {
    if (url.startsWith('/admin/transactions?')) {
      return {
        data: {
          items: VENDAS,
          total: VENDAS.length,
          total_gross: 99.0,
          total_fees: 0.99,
          total_net: 98.01,
        },
      };
    }
    return { data: { items: [], stores: [] } };
  });
});

describe('Sales — composição e adicionais (EARS-3, EARS-10)', () => {
  it('renders_addon_badge_filter_and_items', async () => {
    const user = userEvent.setup();
    render(<Sales />);

    const rowCombo = (await screen.findByText('combo@exemplo.com')).closest('tr');
    expect(rowCombo).toHaveTextContent('Principal + Adicionais');
    expect(rowCombo).toHaveTextContent('+1 adicional: Sistema Xbox 360');

    const rowArea = screen.getByText('area@exemplo.com').closest('tr');
    expect(rowArea).toHaveTextContent('Área do cliente');

    // Abre o modal de detalhes da venda com adicionais e confere lista de itens rateados
    const mpButtons = screen.getAllByRole('button', { name: /Mercado Pago/ });
    await user.click(mpButtons[0]);
    expect(await screen.findByText('Itens do pedido (2)')).toBeInTheDocument();
    expect(screen.getByText(/Principal: Sistema Multigames/)).toBeInTheDocument();
    expect(screen.getByText(/Item: Sistema Xbox 360/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fechar' }));

    // Aplica filtro por composição/origem
    const select = screen.getByLabelText('Composição ou origem');
    await user.selectOptions(select, 'principal_com_adicional');
    await user.click(screen.getByRole('button', { name: /Buscar/ }));

    await waitFor(() => {
      const calls = chamadasDeVendas();
      const last = calls[calls.length - 1];
      const params = new URLSearchParams(last.split('?')[1]);
      expect(params.get('origin_type')).toBe('principal_com_adicional');
    });
  });
});
