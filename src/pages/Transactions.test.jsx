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

  it('faz fallback para o método quando issuer_name for nulo', async () => {
    render(<Transactions />);
    const emailCell = await screen.findByText('cliente.sem_banco@exemplo.com');
    const row = emailCell.closest('tr');

    expect(row).toHaveTextContent('Pix');
    expect(row).not.toHaveTextContent('Banco Inter');
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
