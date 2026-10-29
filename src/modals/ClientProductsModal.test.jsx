/**
 * Ficha do cliente: direito do app, brinde e dispositivos.
 *
 * Cobre EARS-25 (revogar compra v1 pede confirmacao nomeando pacote e compra, e a ficha passa a
 * mostrar o pacote revogado), EARS-26 (pacote so incluido nao tem botao de revogar), EARS-24 no
 * painel (falha do calculo e erro, nunca "sem direito"), EARS-27 (brinde sem loja) e EARS-29/30
 * (dispositivos: vazio, revogar confirmando app e nome).
 * Doc: docs/modules/area-membros/changes/2026-10-20-telas-de-vinculos-do-direito/spec.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import api from '@/services/api';
import ClientProductsModal from './ClientProductsModal';

const CLIENT = { id: 7, email: 'cliente@x.com' };

function pacote(id, origens, extra = {}) {
  return {
    id, titulo: `Pacote ${id}`, nome_exibicao: null, situacao: 'configurado', no_direito: true,
    origens, revogavel: origens.some(o => o.tipo === 'concessao' || o.tipo === 'compra'),
    ...extra,
  };
}

function direito(pacotes, extra = {}) {
  return {
    estado: 'direito', sub: '7', email: CLIENT.email, ativo: true,
    systems: ['n64', 'psx'], slices: [], em_preparacao: [], pacotes, ...extra,
  };
}

// Cada chamada a GET /direito consome a proxima resposta da fila (a ultima se repete).
function dublarApi({ direitos, dispositivos = [], itens = [] }) {
  const fila = [...direitos];
  api.get.mockImplementation(async (url) => {
    if (url === `/admin/clients/${CLIENT.id}/direito`) {
      const r = fila.length > 1 ? fila.shift() : fila[0];
      // Latencia de rede: sem ela o React junta loading true/false num render so e o teste nao
      // ve o que a tela mostra DURANTE a releitura.
      await new Promise(ok => setTimeout(ok, 20));
      if (r instanceof Error) throw r;
      return { data: r };
    }
    if (url === `/admin/clients/${CLIENT.id}/devices`) return { data: { dispositivos } };
    if (url === `/admin/clients/${CLIENT.id}/stores`) return { data: { stores: [] } };
    if (url === '/admin/stores') return { data: { stores: [] } };
    if (url.startsWith('/admin/items?')) return { data: { items: itens } };
    throw new Error(`GET inesperado: ${url}`);
  });
}

function erroHttp(status, error) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status, data: { error } } });
}

function renderModal() {
  return render(<ClientProductsModal client={CLIENT} onClose={vi.fn()} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ClientProductsModal: direito na ficha', () => {
  it('revogar_compra_v1_confirma', async () => {
    const antes = pacote(100, [{ tipo: 'compra', transacao_id: 555 }], { nome_exibicao: 'Multijogos' });
    const depois = pacote(100, [{ tipo: 'revogado', por: 'operador@x.com', em: '2026-10-21 15:00:00' }],
      { nome_exibicao: 'Multijogos', no_direito: false, revogavel: false });
    dublarApi({ direitos: [direito([antes]), direito([depois], { systems: [] })] });
    api.delete.mockResolvedValue({ data: { success: true } });
    renderModal();

    const linha = await screen.findByRole('listitem', { name: 'pacote 100' });
    expect(within(linha).getByText(/compra aprovada #555/)).toBeInTheDocument();

    // Cancelar nao revoga.
    await userEvent.click(within(linha).getByRole('button', { name: /revogar/i }));
    const msg = screen.getByText(/Revogar Multijogos \(#100\) de cliente@x\.com\?/);
    expect(msg).toHaveTextContent('compra aprovada #555');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(api.delete).not.toHaveBeenCalled();

    // Confirmar grava a marca pela rota existente e a ficha relida mostra o pacote revogado.
    await userEvent.click(within(linha).getByRole('button', { name: /revogar/i }));
    const dialogo = screen.getByText('Revogar pacote').closest('div.max-w-sm');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Revogar' }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/admin/clients/7/products/100');
    });
    const relida = await screen.findByText(/revogado por operador@x\.com/);
    const linhaDepois = relida.closest('li');
    expect(within(linhaDepois).getByText('fora do direito')).toBeInTheDocument();
    expect(within(linhaDepois).queryByRole('button', { name: /revogar/i })).toBeNull();
    expect(screen.getByText('sem direito')).toBeInTheDocument();
  });

  it('incluido_sem_botao_de_revogar', async () => {
    dublarApi({
      direitos: [direito([
        pacote(100, [{ tipo: 'concessao', store_id: 600005 }]),
        pacote(110, [{ tipo: 'incluido', por: 100 }]),
      ])],
    });
    renderModal();

    const incluido = await screen.findByRole('listitem', { name: 'pacote 110' });
    expect(within(incluido).getByText('incluído por 100')).toBeInTheDocument();
    expect(within(incluido).queryByRole('button', { name: /revogar/i })).toBeNull();

    const concedido = screen.getByRole('listitem', { name: 'pacote 100' });
    expect(within(concedido).getByText('concessão pela loja 600005')).toBeInTheDocument();
    expect(within(concedido).getByRole('button', { name: /revogar/i })).toBeInTheDocument();
  });

  it('o botao segue o revogavel da resposta, nao a origem', async () => {
    // A regra mora no backend: um `revogavel: false` com origem de compra nao ganha botao.
    dublarApi({
      direitos: [direito([pacote(100, [{ tipo: 'compra', transacao_id: 1 }], { revogavel: false })])],
    });
    renderModal();
    const linha = await screen.findByRole('listitem', { name: 'pacote 100' });
    expect(within(linha).queryByRole('button', { name: /revogar/i })).toBeNull();
  });

  it('falha do calculo mostra o erro, nunca direito vazio', async () => {
    dublarApi({ direitos: [erroHttp(500, 'Falha ao calcular o direito')] });
    renderModal();

    expect(await screen.findByText(/Falha ao calcular o direito/)).toBeInTheDocument();
    expect(screen.queryByText('sem direito')).toBeNull();
    expect(screen.queryByText(/Nenhum pacote/)).toBeNull();
    expect(screen.getByRole('button', { name: /tentar de novo/i })).toBeInTheDocument();
  });

  it('conta sem pacotes no direito mostra sem direito (lista vazia assinada)', async () => {
    dublarApi({ direitos: [direito([], { systems: [] })] });
    renderModal();
    expect(await screen.findByText('sem direito')).toBeInTheDocument();
    expect(screen.getByText(/lista vazia assinada/)).toBeInTheDocument();
  });

  it('brinde concede sem loja e rele o direito', async () => {
    dublarApi({
      direitos: [direito([]), direito([pacote(510, [{ tipo: 'concessao', store_id: null }])])],
      itens: [{ id: 510, title: 'Super Nintendo' }],
    });
    api.post.mockResolvedValue({ data: { success: true, user_package_id: 42 } });
    renderModal();

    await screen.findByText('sem direito');
    await userEvent.type(screen.getByPlaceholderText(/buscar pacote/i), 'Super');
    await userEvent.click(screen.getByRole('button', { name: /buscar/i }));
    expect(api.get).toHaveBeenCalledWith('/admin/items?title=Super&per_page=10');

    await userEvent.click(await screen.findByRole('button', { name: /conceder/i }));
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/admin/clients/7/products', { package_id: 510 });
    });
    const linha = await screen.findByRole('listitem', { name: 'pacote 510' });
    expect(within(linha).getByText('brinde (sem loja)')).toBeInTheDocument();
    // A releitura do direito nao desmonta o formulario: a confirmacao do brinde fica na tela.
    expect(screen.getByText('Brinde concedido: Super Nintendo (#510).')).toBeInTheDocument();
  });
});

describe('ClientProductsModal: dispositivos', () => {
  it('conta sem login mostra "nenhum dispositivo"', async () => {
    dublarApi({ direitos: [direito([])] });
    renderModal();
    expect(await screen.findByText(/Nenhum dispositivo/)).toBeInTheDocument();
  });

  it('revogar confirma app e nome e rele a lista', async () => {
    const ativo = {
      id: 31, app: 'retrobat', device_nome: 'PC da sala', origem: 'qr',
      criado_em: '2026-10-20 12:00:00', ultimo_uso: '2026-10-21 10:00:00', revogado_em: null,
    };
    const revogado = { ...ativo, revogado_em: '2026-10-21 15:00:00' };
    let leituras = 0;
    dublarApi({ direitos: [direito([])] });
    const getBase = api.get.getMockImplementation();
    api.get.mockImplementation(async (url) => {
      if (url === '/admin/clients/7/devices') {
        leituras += 1;
        return { data: { dispositivos: [leituras === 1 ? ativo : revogado] } };
      }
      return getBase(url);
    });
    api.delete.mockResolvedValue({ data: { dispositivo: revogado, ja_revogado: false } });
    renderModal();

    const linha = await screen.findByRole('listitem', { name: 'dispositivo 31' });
    await userEvent.click(within(linha).getByRole('button', { name: /revogar/i }));
    expect(screen.getByText(/Revogar o dispositivo "PC da sala" do app retrobat\?/)).toBeInTheDocument();
    expect(api.delete).not.toHaveBeenCalled();

    const dialogo = screen.getByText('Revogar dispositivo').closest('div.max-w-sm');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Revogar' }));
    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/admin/clients/7/devices/31');
    });
    const depois = await screen.findByText(/revogado em/);
    expect(within(depois.closest('li')).queryByRole('button', { name: /revogar/i })).toBeNull();
  });

  it('falha da lista e erro, nunca "nenhum dispositivo"', async () => {
    dublarApi({ direitos: [direito([])] });
    const getBase = api.get.getMockImplementation();
    api.get.mockImplementation(async (url) => {
      if (url === '/admin/clients/7/devices') throw erroHttp(500, 'Falha ao listar os dispositivos');
      return getBase(url);
    });
    renderModal();
    expect(await screen.findByText('Falha ao listar os dispositivos')).toBeInTheDocument();
    expect(screen.queryByText(/Nenhum dispositivo/)).toBeNull();
  });
});
