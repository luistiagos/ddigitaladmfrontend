import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}));

import api from '@/services/api';
import Transactions from './Transactions';

const TRANSACOES = [
  {
    id: 101,
    email: 'cliente.pix@exemplo.com',
    phone: '11999990001',
    product_id: 1,
    title: 'Plataforma Completa',
    value: 47.0,
    datetime: '2026-11-06T18:00:00Z',
    status: 'approved',
    payment_method_id: 'pix',
    payment_type_id: 'bank_transfer',
    issuer_name: 'Banco Inter S.A.',
  },
  {
    id: 102,
    email: 'cliente.cartao@exemplo.com',
    phone: '11999990002',
    product_id: 1,
    title: 'Plataforma Completa',
    value: 47.0,
    datetime: '2026-11-06T18:05:00Z',
    status: 'approved',
    payment_method_id: 'master',
    payment_type_id: 'credit_card',
    issuer_name: 'Nubank',
  },
  {
    id: 103,
    email: 'cliente.sem_banco@exemplo.com',
    phone: '11999990003',
    product_id: 2,
    title: 'Adicional',
    value: 10.0,
    datetime: '2026-11-06T18:10:00Z',
    status: 'pending',
    payment_method_id: 'pix',
    payment_type_id: 'bank_transfer',
    issuer_name: null,
  },
  {
    id: 104,
    email: 'cliente.account_money@exemplo.com',
    phone: '11999990004',
    product_id: 1,
    title: 'Plataforma Completa',
    value: 47.0,
    datetime: '2026-11-06T18:15:00Z',
    status: 'approved',
    payment_method_id: 'account_money',
    payment_type_id: 'account_money',
    issuer_name: 'account_money',
  },
  {
    id: 105,
    email: 'cliente.pix_legado@exemplo.com',
    phone: '11999990005',
    product_id: 1,
    title: 'Plataforma Completa',
    value: 47.0,
    datetime: '2026-11-06T18:20:00Z',
    status: 'pending',
    payment_method_id: 'pix',
    payment_type_id: 'bank_transfer',
    issuer_name: 'pix',
  },
];

function chamadasDeTransacoes() {
  return api.get.mock.calls.map(c => c[0]).filter(u => u.startsWith('/admin/transactions_all?'));
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation(async (url) => {
    if (url.startsWith('/admin/transactions_all?')) {
      return { data: { items: TRANSACOES, total: 3, total_value: 104.0 } };
    }
    return { data: { items: [], stores: [] } };
  });
});

describe('Transactions — coluna Banco na grid', () => {
  it('exibe o cabeçalho de coluna Banco ordenável', async () => {
    render(<Transactions />);
    await screen.findByText('cliente.pix@exemplo.com');

    const header = screen.getByRole('columnheader', { name: /Banco/ });
    expect(header).toBeInTheDocument();
  });

  it('renderiza o nome do banco e o método para transação Pix', async () => {
    render(<Transactions />);
    const emailCell = await screen.findByText('cliente.pix@exemplo.com');
    const row = emailCell.closest('tr');

    expect(row).toHaveTextContent('Banco Inter S.A.');
    expect(row).toHaveTextContent('Pix');
  });

  it('renderiza o emissor do cartão de crédito', async () => {
    render(<Transactions />);
    const emailCell = await screen.findByText('cliente.cartao@exemplo.com');
    const row = emailCell.closest('tr');

    expect(row).toHaveTextContent('Nubank');
    expect(row).toHaveTextContent('Mastercard');
  });

    it('exibe travessão quando issuer_name for nulo, sem exibir o método no lugar do banco', async () => {
      render(<Transactions />);
      const emailCell = await screen.findByText('cliente.sem_banco@exemplo.com');
      const row = emailCell.closest('tr');

      expect(row).toHaveTextContent('—');
      expect(row).not.toHaveTextContent('Banco Inter');
    });

    it('resolve account_money para Mercado Pago na coluna Banco', async () => {
      render(<Transactions />);
      const emailCell = await screen.findByText('cliente.account_money@exemplo.com');
      const row = emailCell.closest('tr');

      expect(row).toHaveTextContent('Mercado Pago');
    });

    it('rejeita tipos genéricos como pix no issuer_name exibindo travessão', async () => {
      render(<Transactions />);
      const emailCell = await screen.findByText('cliente.pix_legado@exemplo.com');
      const row = emailCell.closest('tr');

      expect(row).toHaveTextContent('—');
    });

    it('permite ordenar por issuer_name ao clicar no cabeçalho Banco', async () => {
      const user = userEvent.setup();
      render(<Transactions />);
      await screen.findByText('cliente.pix@exemplo.com');

      const header = screen.getByRole('columnheader', { name: /Banco/ });
      await user.click(header);

      await waitFor(() => {
        const calls = chamadasDeTransacoes();
        const lastCall = calls[calls.length - 1];
        const params = new URLSearchParams(lastCall.split('?')[1]);
        expect(params.get('sort_column')).toBe('issuer_name');
      });
    });
  });

describe('Transactions — papel e origem (EARS-2, EARS-10)', () => {
  it('renders_origin_badge_and_filter', async () => {
    const user = userEvent.setup();
    api.get.mockImplementation(async (url) => {
      if (url.startsWith('/admin/transactions_all?')) {
        return {
          data: {
            items: [
              { ...TRANSACOES[0], origin_type: 'principal', origin_label: 'Principal', origin_estimated: false },
              { ...TRANSACOES[2], origin_type: 'adicional_checkout', origin_label: 'Adicional (Checkout)', origin_estimated: false },
              {
                id: 106, email: 'membro@exemplo.com', phone: '11999990006', product_id: 3,
                title: 'Switch', value: 25.0, datetime: '2026-11-06T18:25:00Z', status: 'approved',
                origin_type: 'area_cliente', origin_label: 'Área do cliente', origin_estimated: true,
              },
              {
                id: 107, email: 'recompra@exemplo.com', phone: '11999990007', product_id: 1,
                title: 'Plataforma Completa', value: 39.0, datetime: '2026-11-06T18:30:00Z', status: 'approved',
                origin_type: 'recompra', origin_label: 'Recompra', origin_estimated: false,
              },
            ],
            total: 4,
            total_value: 121.0,
          },
        };
      }
      return { data: { items: [], stores: [] } };
    });

    render(<Transactions />);
    const rowBump = (await screen.findByText('cliente.sem_banco@exemplo.com')).closest('tr');
    expect(rowBump).toHaveTextContent('Adicional (Checkout)');

    const rowArea = screen.getByText('membro@exemplo.com').closest('tr');
    expect(rowArea).toHaveTextContent('Área do cliente');
    expect(rowArea).toHaveTextContent('(est.)');

    const rowRecompra = screen.getByText('recompra@exemplo.com').closest('tr');
    expect(rowRecompra).toHaveTextContent('Recompra');

    const select = screen.getByLabelText('Tipo ou origem');
    await user.selectOptions(select, 'adicional_checkout');
    await user.click(screen.getByRole('button', { name: /Buscar/ }));

    await waitFor(() => {
      const calls = chamadasDeTransacoes();
      const last = calls[calls.length - 1];
      const params = new URLSearchParams(last.split('?')[1]);
      expect(params.get('origin_type')).toBe('adicional_checkout');
    });
  });
});
