/**
 * Grade de Clientes: coluna "Última compra" (ultima compra APROVADA) e ordenacao padrao por ela.
 * Doc: docs/modules/area-membros/changes/2026-10-22-ultima-compra-na-grade-de-clientes/spec.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '@/services/api';
import Clients from './Clients';
import { formatUtcDateTime } from '@/utils/format';

const CLIENTES = [
  { id: 1, email: 'recompra@x.com', phone: null, active: 1, created_at: '2026-01-10T10:00:00Z',
    last_purchase_at: '2026-10-20T15:30:00Z' },
  { id: 3, email: 'so_recusado@x.com', phone: null, active: 1, created_at: '2026-10-22T01:00:00Z',
    last_purchase_at: null },
];

function chamadasDeClientes() {
  return api.get.mock.calls.map(c => c[0]).filter(u => u.startsWith('/admin/clients?'));
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation(async (url) => {
    if (url.startsWith('/admin/clients?')) return { data: { items: CLIENTES, total: 2 } };
    return { data: { items: [], stores: [] } };
  });
});

describe('Clients — última compra', () => {
  it('abre ordenada pela última compra, da mais recente para a mais antiga', async () => {
    render(<Clients />);
    await screen.findByText('recompra@x.com');

    const params = new URLSearchParams(chamadasDeClientes()[0].split('?')[1]);
    expect(params.get('sort_column')).toBe('last_purchase_at');
    expect(params.get('sort_direction')).toBe('desc');
  });

  it('mostra a data em horário de Brasília e "—" sem compra aprovada', async () => {
    render(<Clients />);
    await screen.findByText('recompra@x.com');

    expect(screen.getByRole('columnheader', { name: /Última compra/ })).toBeInTheDocument();
    const data = formatUtcDateTime('2026-10-20T15:30:00Z');
    expect(data).not.toContain('2026-10-20T');          // formatada, nunca o texto cru da API
    expect(screen.getByText(data)).toBeInTheDocument();
    const linha = screen.getByText('so_recusado@x.com').closest('tr');
    expect(linha).toHaveTextContent('—');
  });

  it('o cabeçalho alterna a direção da ordenação', async () => {
    render(<Clients />);
    await screen.findByText('recompra@x.com');

    await userEvent.click(screen.getByRole('columnheader', { name: /Última compra/ }));
    await waitFor(() => {
      const ultima = chamadasDeClientes().at(-1);
      expect(new URLSearchParams(ultima.split('?')[1]).get('sort_direction')).toBe('asc');
    });
  });
});
