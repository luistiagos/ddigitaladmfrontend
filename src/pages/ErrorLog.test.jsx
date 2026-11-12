import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}));

import api from '@/services/api';
import ErrorLog from './ErrorLog';

// Tres formas de linha que o GET /admin/errors devolve (errordao.list_errors):
// conta com e-mail resolvido, conta sem e-mail, e erro sem conta -- este ultimo SEM as
// chaves, como chega quando o backend ainda nao tem as colunas.
const ERROS = [
  {
    id: 9001, file: 'a.cs', method: 'm1', message: 'erro com email', project: 'retrobatnew/es',
    time: '2026-11-11T10:00:00Z', status: 'open', logs_count: 0,
    account_id: '2703', account_email: 'maria_silva@example.com',
  },
  {
    id: 9002, file: 'b.cs', method: 'm2', message: 'erro so id', project: 'retrobatnew/es',
    time: '2026-11-11T10:01:00Z', status: 'open', logs_count: 0,
    account_id: '4410', account_email: null,
  },
  {
    id: 9003, file: 'c.cs', method: 'm3', message: 'erro sem conta', project: 'retrobatnew/es',
    time: '2026-11-11T10:02:00Z', status: 'open', logs_count: 0,
  },
];

function chamadasDaListagem() {
  return api.get.mock.calls.map(c => c[0]).filter(u => u.startsWith('/admin/errors?'));
}

function paramsDaUltimaListagem() {
  const calls = chamadasDaListagem();
  return new URLSearchParams(calls[calls.length - 1].split('?')[1]);
}

function linhaDa(mensagem) {
  return screen.getByText(mensagem).closest('tr');
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation(async (url) => {
    if (url.startsWith('/admin/errors?')) return { data: { items: ERROS, total: ERROS.length } };
    if (url === '/admin/errors/projects') return { data: { projects: ['retrobatnew/es'] } };
    return { data: { items: [] } };
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorLog — cliente do erro', () => {
  it('filtro Cliente', async () => {
    const user = userEvent.setup();
    render(<ErrorLog />);
    await screen.findByText('erro com email');
    expect(paramsDaUltimaListagem().has('account')).toBe(false);

    const campo = screen.getByLabelText('Cliente');
    expect(campo).toHaveAttribute('placeholder', 'e-mail ou id');

    // Parte do e-mail, com espaco nas pontas: vai aparado.
    await user.type(campo, '  maria_s  ');
    await user.click(screen.getByRole('button', { name: /Buscar/ }));
    await waitFor(() => expect(paramsDaUltimaListagem().get('account')).toBe('maria_s'));
    expect(paramsDaUltimaListagem().get('page')).toBe('1');

    // Id da conta: vai como texto, do jeito que foi digitado.
    await user.clear(campo);
    await user.type(campo, '2703');
    await user.click(screen.getByRole('button', { name: /Buscar/ }));
    await waitFor(() => expect(paramsDaUltimaListagem().get('account')).toBe('2703'));

    // "Limpar" zera o campo e tira o parametro.
    await user.click(screen.getByRole('button', { name: /Limpar/ }));
    await waitFor(() => expect(paramsDaUltimaListagem().has('account')).toBe(false));
    expect(campo).toHaveValue('');
  });

  it('filtro Cliente so com espaco nao manda account', async () => {
    const user = userEvent.setup();
    render(<ErrorLog />);
    await screen.findByText('erro com email');
    const antes = chamadasDaListagem().length;

    await user.type(screen.getByLabelText('Cliente'), '   ');
    await user.type(screen.getByPlaceholderText('utils.js'), 'a.cs');
    await user.click(screen.getByRole('button', { name: /Buscar/ }));

    await waitFor(() => expect(chamadasDaListagem().length).toBeGreaterThan(antes));
    const params = paramsDaUltimaListagem();
    expect(params.get('file')).toBe('a.cs');
    expect(params.has('account')).toBe(false);
  });

  it('coluna Cliente', async () => {
    render(<ErrorLog />);
    await screen.findByText('erro com email');

    const header = screen.getByRole('columnheader', { name: 'Cliente' });
    expect(header).toBeInTheDocument();

    // E-mail inteiro, com o id no title.
    const comEmail = within(linhaDa('erro com email')).getByText('maria_silva@example.com');
    expect(comEmail).toHaveAttribute('title', 'conta 2703');

    // So o id quando o e-mail e NULL.
    const soId = linhaDa('erro so id');
    expect(within(soId).getByText('4410')).toBeInTheDocument();
    expect(soId).not.toHaveTextContent('@');

    // "—" sem conta (chaves ausentes).
    const semConta = linhaDa('erro sem conta');
    const celulas = within(semConta).getAllByRole('cell');
    const idx = screen.getAllByRole('columnheader').indexOf(header);
    expect(celulas[idx]).toHaveTextContent(/^—$/);
  });

  it('coluna Cliente nao e ordenavel', async () => {
    const user = userEvent.setup();
    render(<ErrorLog />);
    await screen.findByText('erro com email');
    const antes = chamadasDaListagem().length;

    await user.click(screen.getByRole('columnheader', { name: 'Cliente' }));

    expect(chamadasDaListagem().length).toBe(antes);
  });

  it('exportacao CSV leva a coluna Cliente', async () => {
    const user = userEvent.setup();
    let blob = null;
    URL.createObjectURL = vi.fn((b) => { blob = b; return 'blob:teste'; });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<ErrorLog />);
    await screen.findByText('erro com email');
    await user.click(screen.getByRole('button', { name: /CSV/ }));

    expect(blob).not.toBeNull();
    const linhas = (await blob.text()).replace(/^﻿/, '').split('\n');
    const cabecalho = linhas[0].split(',');
    const col = cabecalho.indexOf('"Cliente"');
    expect(col).toBeGreaterThanOrEqual(0);
    const celula = (linha) => linha.split(',')[col];
    expect(celula(linhas.find(l => l.includes('erro com email')))).toBe('"maria_silva@example.com"');
    expect(celula(linhas.find(l => l.includes('erro so id')))).toBe('"4410"');
    expect(celula(linhas.find(l => l.includes('erro sem conta')))).toBe('""');
  });

  it('modal de detalhe mostra o Cliente', async () => {
    const user = userEvent.setup();
    render(<ErrorLog />);
    await screen.findByText('erro com email');

    await user.click(within(linhaDa('erro com email')).getByRole('button', { name: 'Visualizar' }));
    expect(await screen.findByText('maria_silva@example.com (conta 2703)')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Fechar' })[0]);

    await user.click(within(linhaDa('erro so id')).getByRole('button', { name: 'Visualizar' }));
    const modalSoId = (await screen.findByText('Erro #9002')).closest('div.w-full');
    const rotulo = within(modalSoId).getByText('Cliente');
    expect(rotulo.nextSibling).toHaveTextContent(/^4410$/);
    await user.click(screen.getAllByRole('button', { name: 'Fechar' })[0]);

    await user.click(within(linhaDa('erro sem conta')).getByRole('button', { name: 'Visualizar' }));
    const modalSem = (await screen.findByText('Erro #9003')).closest('div.w-full');
    expect(within(modalSem).getByText('Cliente').nextSibling).toHaveTextContent(/^—$/);
  });
});
