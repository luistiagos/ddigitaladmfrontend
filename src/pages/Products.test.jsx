/**
 * Tela de produtos: estado do cadastro de direito na lista e cadastro de direito do pacote.
 *
 * Cobre EARS-11 (reducao so grava depois de mostrar contas e compras do 409 e confirmar), EARS-12
 * (selo do cadastro por pacote, destaque de "a venda em loja ligada sem cadastro", `direito: null`
 * nao esconde o item), EARS-13 (sem o campo "Metadados/Sub-pacotes" e sem `add_pkg` nos corpos),
 * EARS-4/EARS-5 no painel (vocabulario fora desliga "Salvar"; sistema que saiu do repositorio
 * aparece marcado).
 * Doc: docs/modules/area-membros/changes/2026-10-20-telas-de-vinculos-do-direito/spec.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '@/services/api';
import Products from './Products';

const VOCAB = [
  { mnemonico: 'n64', console: 'Nintendo 64' },
  { mnemonico: 'psx', console: 'PlayStation' },
  { mnemonico: 'snes', console: 'Super Nintendo' },
];

function item(id, direito, extra = {}) {
  return { id, title: `Pacote ${id}`, price: 10, direito, ...extra };
}

function cadastro(id, extra = {}) {
  return {
    package_id: id, configurado: true, sem_conteudo: false,
    sistemas: [], fatias: [], incluidos: [], nome_exibicao: null,
    atualizado_em: '2026-10-21 13:00:00', atualizado_por: 'operador@x.com',
    ...extra,
  };
}

function marcados(mnemonicos) {
  const consoles = Object.fromEntries(VOCAB.map(v => [v.mnemonico, v.console]));
  return mnemonicos.map(m => ({ mnemonico: m, console: consoles[m] ?? null, no_repositorio: m in consoles }));
}

function respostaDireito(c, extra = {}) {
  return {
    cadastro: c, nome_exibicao: c.nome_exibicao, alcance: { contas: 3, compras: 5 },
    vocabulario: VOCAB, vocabulario_erro: null, fatias: ['mods-ptbr'], ...extra,
  };
}

// Cada GET de /direito consome a proxima resposta da fila (a ultima se repete), com latencia: sem
// ela o React junta loading true/false num render so e o teste nao ve a tela durante a releitura.
function dublarApi({ itens, direitos = [] }) {
  const fila = [...direitos];
  api.get.mockImplementation(async (url) => {
    if (url === '/admin/items') return { data: { items: itens, total: itens.length } };
    if (/^\/admin\/items\/\d+\/direito$/.test(url)) {
      const r = fila.length > 1 ? fila.shift() : fila[0];
      await new Promise(ok => setTimeout(ok, 20));
      if (r instanceof Error) throw r;
      return { data: r };
    }
    if (url.startsWith('/admin/items?')) return { data: { items: [{ id: 300, title: 'Arcade' }] } };
    throw new Error(`GET inesperado: ${url}`);
  });
}

function erroHttp(status, data) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });
}

async function abrirCadastro(id) {
  const cartao = await screen.findByRole('listitem', { name: `produto ${id}` });
  await userEvent.click(within(cartao).getByRole('button', { name: /direito do app/i }));
  return screen.getByRole('dialog', { name: 'Direito do app' });
}

beforeEach(() => {
  // reset, nao clear: um `mockRejectedValueOnce` nao consumido vazaria para o teste seguinte.
  vi.resetAllMocks();
});

describe('Products: lista', () => {
  it('estado_do_cadastro_por_pacote', async () => {
    dublarApi({
      itens: [
        item(1, { estado: 'nao_configurado', sistemas: 0, incluidos: 0, a_venda_em_loja_ligada: true }),
        item(2, { estado: 'nao_configurado', sistemas: 0, incluidos: 0, a_venda_em_loja_ligada: false }),
        item(3, { estado: 'sem_conteudo', sistemas: 0, incluidos: 0, a_venda_em_loja_ligada: true }),
        item(4, { estado: 'configurado', sistemas: 5, incluidos: 2, a_venda_em_loja_ligada: true }),
        item(5, null),
      ],
    });
    render(<Products />);

    const aVenda = await screen.findByRole('listitem', { name: 'produto 1' });
    expect(within(aVenda).getByText('não configurado')).toBeInTheDocument();
    expect(within(aVenda).getByText('à venda em loja ligada sem cadastro')).toBeInTheDocument();
    expect(aVenda.className).toMatch(/border-red-500/);

    const foraDaVenda = screen.getByRole('listitem', { name: 'produto 2' });
    expect(within(foraDaVenda).getByText('não configurado')).toBeInTheDocument();
    expect(within(foraDaVenda).queryByText(/à venda em loja ligada/)).toBeNull();
    expect(foraDaVenda.className).not.toMatch(/border-red-500/);

    const semConteudo = screen.getByRole('listitem', { name: 'produto 3' });
    expect(within(semConteudo).getByText('sem conteúdo de app')).toBeInTheDocument();
    expect(within(semConteudo).queryByText(/à venda em loja ligada/)).toBeNull();

    const configurado = screen.getByRole('listitem', { name: 'produto 4' });
    expect(within(configurado).getByText('5 sistemas · 2 incluídos')).toBeInTheDocument();
    expect(within(configurado).queryByText(/à venda em loja ligada/)).toBeNull();

    // Falha do estado no backend: "?" e o produto continua na lista.
    const semEstado = screen.getByRole('listitem', { name: 'produto 5' });
    expect(within(semEstado).getByText('Pacote 5')).toBeInTheDocument();
    expect(within(semEstado).getByText('direito: ?')).toBeInTheDocument();
  });

  it('sem_campo_sub_pacotes', async () => {
    const p = item(7, null, { add_pkg: '[9021115]', purchaselink: 'https://x/compra' });
    dublarApi({ itens: [p] });
    api.put.mockResolvedValue({ data: { success: true } });
    api.post.mockResolvedValue({ data: { id: 8 } });
    render(<Products />);

    const cartao = await screen.findByRole('listitem', { name: 'produto 7' });
    await userEvent.click(within(cartao).getByRole('button', { name: /editar/i }));
    expect(screen.queryByText(/Metadados/)).toBeNull();
    expect(screen.queryByText(/Sub-pacotes/)).toBeNull();
    expect(screen.queryByDisplayValue('[9021115]')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const [url, corpo] = api.put.mock.calls[0];
    expect(url).toBe('/admin/items/7');
    expect(corpo).not.toHaveProperty('add_pkg');

    // Copiar tambem nao carrega o campo.
    await userEvent.click(within(await screen.findByRole('listitem', { name: 'produto 7' }))
      .getByRole('button', { name: /copiar/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post.mock.calls[0][1]).not.toHaveProperty('add_pkg');
  });
});

describe('Products: cadastro de direito', () => {
  it('reducao_pede_confirmacao_com_alcance', async () => {
    const antes = cadastro(10, { sistemas: marcados(['n64', 'psx']) });
    const depois = cadastro(10, { sistemas: marcados(['n64']) });
    dublarApi({
      itens: [item(10, { estado: 'configurado', sistemas: 2, incluidos: 0, a_venda_em_loja_ligada: true })],
      direitos: [respostaDireito(antes)],
    });
    api.put
      .mockRejectedValueOnce(erroHttp(409, {
        error: 'A mudança reduz o alcance do pacote e precisa de confirmação.',
        alcance: { contas: 12, compras: 34 },
      }))
      .mockRejectedValueOnce(erroHttp(409, {
        error: 'A mudança reduz o alcance do pacote e precisa de confirmação.',
        alcance: { contas: 12, compras: 34 },
      }))
      .mockResolvedValueOnce({ data: { cadastro: depois } });
    render(<Products />);

    const dialogo = await abrirCadastro(10);
    await userEvent.click(await within(dialogo).findByRole('checkbox', { name: /^psx/ }));
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar cadastro' }));

    // O painel manda sem confirmar; quem decide que reduz e o servidor.
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(api.put).toHaveBeenLastCalledWith('/admin/items/10/direito', {
      sem_conteudo: false, sistemas: ['n64'], fatias: [], incluidos: [], confirmar_reducao: false,
    });
    const msg = await screen.findByText(/reduz o alcance de Pacote 10 \(#10\)/);
    expect(msg).toHaveTextContent('12 contas e 34 compras aprovadas');

    // Cancelar nao grava nada.
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/reduz o alcance de/)).toBeNull();

    // Confirmar reenvia o mesmo corpo com confirmar_reducao: true.
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar cadastro' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar redução' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(3));
    expect(api.put).toHaveBeenLastCalledWith('/admin/items/10/direito', {
      sem_conteudo: false, sistemas: ['n64'], fatias: [], incluidos: [], confirmar_reducao: true,
    });
    expect(await within(dialogo).findByText('Cadastro salvo.')).toBeInTheDocument();
    expect(within(dialogo).getByText('1 sistema')).toBeInTheDocument();
  });

  it('salvar fica inativo ate o vocabulario chegar e com vocabulario null', async () => {
    const c = cadastro(11, {
      sistemas: [{ mnemonico: 'n64', console: null, no_repositorio: null }],
    });
    dublarApi({
      itens: [item(11, { estado: 'configurado', sistemas: 1, incluidos: 0, a_venda_em_loja_ligada: false })],
      direitos: [respostaDireito(c, { vocabulario: null, vocabulario_erro: 'https://roms/api/mnemonicos: HTTP 503' })],
    });
    render(<Products />);

    const dialogo = await abrirCadastro(11);
    // Carregando: nenhum "Salvar" ativo.
    expect(within(dialogo).getByText(/Carregando o cadastro/)).toBeInTheDocument();
    expect(within(dialogo).queryByRole('button', { name: 'Salvar cadastro' })).toBeNull();

    expect(await within(dialogo).findByText(/Repositório de ROMs indisponível/)).toBeInTheDocument();
    expect(within(dialogo).getByText(/HTTP 503/)).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Salvar cadastro' })).toBeDisabled();
    // O cadastro continua legivel, sem afirmar "fora do repositorio".
    expect(within(dialogo).getByText('Gravados: n64')).toBeInTheDocument();
    expect(within(dialogo).queryByText('fora do repositório')).toBeNull();
    // O nome de exibicao nao depende do vocabulario.
    expect(within(dialogo).getByRole('button', { name: 'Salvar nome' })).toBeEnabled();
  });

  it('sistema que saiu do repositorio aparece marcado, sem sumir', async () => {
    const c = cadastro(12, { sistemas: marcados(['psx', 'velho']) });
    dublarApi({
      itens: [item(12, { estado: 'configurado', sistemas: 2, incluidos: 0, a_venda_em_loja_ligada: false })],
      direitos: [respostaDireito(c)],
    });
    render(<Products />);

    const dialogo = await abrirCadastro(12);
    const velho = await within(dialogo).findByRole('checkbox', { name: /^velho/ });
    expect(velho).toBeChecked();
    expect(velho.closest('label')).toHaveTextContent('fora do repositório');
    expect(within(dialogo).getByRole('checkbox', { name: /^psx/ })).toBeChecked();
    expect(within(dialogo).getByRole('checkbox', { name: /^snes/ })).not.toBeChecked();
  });

  it('erro do servidor mostra os recusados', async () => {
    dublarApi({
      itens: [item(13, { estado: 'nao_configurado', sistemas: 0, incluidos: 0, a_venda_em_loja_ligada: false })],
      direitos: [respostaDireito(cadastro(13, { configurado: false, atualizado_em: null, atualizado_por: null }))],
    });
    api.put.mockRejectedValueOnce(erroHttp(400, {
      error: 'Cadastro recusado: inclusao do proprio pacote ou de pacote inexistente', recusados: [999],
    }));
    render(<Products />);

    const dialogo = await abrirCadastro(13);
    await userEvent.type(await within(dialogo).findByPlaceholderText(/buscar pacote/i), '999');
    await userEvent.click(within(dialogo).getByRole('button', { name: /buscar/i }));
    await userEvent.click(within(dialogo).getByRole('button', { name: 'incluir 999' }));
    expect(within(dialogo).getByRole('listitem', { name: 'incluido 999' })).toBeInTheDocument();

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar cadastro' }));
    expect(await within(dialogo).findByText(/Cadastro recusado/)).toBeInTheDocument();
    expect(within(dialogo).getByText('Recusados: 999')).toBeInTheDocument();
    expect(api.put).toHaveBeenCalledWith('/admin/items/13/direito', {
      sem_conteudo: false, sistemas: [], fatias: [], incluidos: [999], confirmar_reducao: false,
    });
  });

  it('cadastro novo com sistemas, fatia e incluido pela busca, e a lista relida', async () => {
    const vazio = cadastro(14, { configurado: false, atualizado_em: null, atualizado_por: null });
    const salvo = cadastro(14, { sistemas: marcados(['snes']), fatias: ['mods-ptbr'], incluidos: [300] });
    dublarApi({
      itens: [item(14, { estado: 'nao_configurado', sistemas: 0, incluidos: 0, a_venda_em_loja_ligada: true })],
      direitos: [respostaDireito(vazio)],
    });
    api.put.mockResolvedValueOnce({ data: { cadastro: salvo } });
    render(<Products />);

    const dialogo = await abrirCadastro(14);
    // Pacote sem cadastro e um estado mostrado, nao um formulario em branco.
    expect(await within(dialogo).findByText('não configurado')).toBeInTheDocument();
    expect(within(dialogo).queryByRole('button', { name: /remover cadastro/i })).toBeNull();

    await userEvent.type(within(dialogo).getByPlaceholderText(/filtrar sistemas/i), 'super');
    expect(within(dialogo).queryByRole('checkbox', { name: /^n64/ })).toBeNull();
    await userEvent.click(within(dialogo).getByRole('checkbox', { name: /^snes/ }));
    await userEvent.click(within(dialogo).getByRole('checkbox', { name: 'mods-ptbr' }));
    await userEvent.type(within(dialogo).getByPlaceholderText(/buscar pacote/i), 'Arc');
    await userEvent.click(within(dialogo).getByRole('button', { name: /buscar/i }));
    expect(api.get).toHaveBeenCalledWith('/admin/items?title=Arc&per_page=10');
    await userEvent.click(await within(dialogo).findByRole('button', { name: 'incluir 300' }));

    const lidas = api.get.mock.calls.filter(([u]) => u === '/admin/items').length;
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar cadastro' }));
    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/admin/items/14/direito', {
        sem_conteudo: false, sistemas: ['snes'], fatias: ['mods-ptbr'], incluidos: [300],
        confirmar_reducao: false,
      });
    });
    expect(await within(dialogo).findByText('1 sistema · 1 incluído')).toBeInTheDocument();
    await waitFor(() => {
      expect(api.get.mock.calls.filter(([u]) => u === '/admin/items').length).toBe(lidas + 1);
    });
  });

  it('copiar_cadastro_de_outro_pacote', async () => {
    // EARS-33: soma ao que esta marcado, nao copia sistema fora do repositorio nem a inclusao do
    // proprio pacote, e nada vai ao servidor antes de "Salvar cadastro".
    const destino = cadastro(14, { sistemas: marcados(['snes']) });
    const origem = cadastro(21000, {
      sistemas: marcados(['n64', 'psx', 'gba']), fatias: ['mods-ptbr'], incluidos: [300, 14],
    });
    api.get.mockImplementation(async (url) => {
      if (url === '/admin/items') {
        return { data: { items: [item(14, { estado: 'configurado', sistemas: 1, incluidos: 0 })], total: 1 } };
      }
      if (url === '/admin/items/14/direito') return { data: respostaDireito(destino) };
      if (url === '/admin/items/21000/direito') return { data: respostaDireito(origem) };
      if (url.startsWith('/admin/items?')) {
        return { data: { items: [{ id: 14, title: 'Pacote 14' }, { id: 21000, title: 'Multigames + Switch' }] } };
      }
      throw new Error(`GET inesperado: ${url}`);
    });
    api.put.mockResolvedValueOnce({ data: { cadastro: destino } });
    render(<Products />);

    const dialogo = await abrirCadastro(14);
    await within(dialogo).findByRole('checkbox', { name: /^snes/ });
    await userEvent.type(within(dialogo).getByPlaceholderText(/copiar de/i), 'Multi');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Procurar pacote de origem' }));
    // O proprio pacote nao aparece como origem.
    expect(within(dialogo).queryByRole('button', { name: 'copiar de 14' })).toBeNull();
    await userEvent.click(await within(dialogo).findByRole('button', { name: 'copiar de 21000' }));

    expect(await within(dialogo).findByText(/Não copiados: gba \(fora do repositório\), #14 \(o próprio pacote\)/))
      .toBeInTheDocument();
    for (const m of ['snes', 'n64', 'psx']) {
      expect(within(dialogo).getByRole('checkbox', { name: new RegExp(`^${m}`) })).toBeChecked();
    }
    expect(within(dialogo).getByRole('checkbox', { name: 'mods-ptbr' })).toBeChecked();
    expect(within(dialogo).getByRole('listitem', { name: 'incluido 300' })).toBeInTheDocument();
    expect(within(dialogo).queryByRole('listitem', { name: 'incluido 14' })).toBeNull();
    expect(api.put).not.toHaveBeenCalled();

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar cadastro' }));
    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/admin/items/14/direito', {
        sem_conteudo: false, sistemas: ['snes', 'n64', 'psx'], fatias: ['mods-ptbr'], incluidos: [300],
        confirmar_reducao: false,
      });
    });
  });

  it('sem conteudo manda as listas vazias', async () => {
    const c = cadastro(15, { configurado: false, atualizado_em: null, atualizado_por: null });
    dublarApi({
      itens: [item(15, { estado: 'nao_configurado', sistemas: 0, incluidos: 0, a_venda_em_loja_ligada: false })],
      direitos: [respostaDireito(c)],
    });
    api.put.mockResolvedValueOnce({ data: { cadastro: cadastro(15, { sem_conteudo: true }) } });
    render(<Products />);

    const dialogo = await abrirCadastro(15);
    await userEvent.click(await within(dialogo).findByRole('checkbox', { name: /^psx/ }));
    await userEvent.click(within(dialogo).getByRole('checkbox', { name: 'Sem conteúdo de app' }));
    expect(within(dialogo).getByRole('checkbox', { name: /^psx/ })).toBeDisabled();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar cadastro' }));
    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/admin/items/15/direito', {
        sem_conteudo: true, sistemas: [], fatias: [], incluidos: [], confirmar_reducao: false,
      });
    });
  });

  it('remover pede confirmacao com o alcance e volta a nao configurado', async () => {
    const c = cadastro(16, { sistemas: marcados(['n64']) });
    const removido = cadastro(16, { configurado: false, atualizado_em: null, atualizado_por: null });
    dublarApi({
      itens: [item(16, { estado: 'configurado', sistemas: 1, incluidos: 0, a_venda_em_loja_ligada: false })],
      direitos: [respostaDireito(c), respostaDireito(removido)],
    });
    api.delete
      .mockRejectedValueOnce(erroHttp(409, { error: 'precisa de confirmação', alcance: { contas: 1, compras: 0 } }))
      .mockResolvedValueOnce({ data: { anterior: c } });
    render(<Products />);

    const dialogo = await abrirCadastro(16);
    await userEvent.click(await within(dialogo).findByRole('button', { name: /remover cadastro/i }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/admin/items/16/direito'));
    const msg = await screen.findByText(/Remover o cadastro de Pacote 16 \(#16\)\?/);
    expect(msg).toHaveTextContent('1 conta e 0 compras aprovadas');

    await userEvent.click(screen.getByRole('button', { name: 'Remover' }));
    await waitFor(() => {
      expect(api.delete).toHaveBeenLastCalledWith('/admin/items/16/direito?confirmar_reducao=1');
    });
    expect(await within(dialogo).findByText('não configurado')).toBeInTheDocument();
    expect(within(dialogo).getByText(/Cadastro removido/)).toBeInTheDocument();
  });

  it('nome de exibicao grava pela rota propria', async () => {
    dublarApi({
      itens: [item(17, { estado: 'nao_configurado', sistemas: 0, incluidos: 0, a_venda_em_loja_ligada: true })],
      direitos: [respostaDireito(cadastro(17, { configurado: false, nome_exibicao: 'Antigo' }))],
    });
    api.put.mockResolvedValueOnce({ data: { nome_exibicao: 'Multijogos' } });
    render(<Products />);

    const dialogo = await abrirCadastro(17);
    const campo = await within(dialogo).findByRole('textbox', { name: 'Nome de exibição' });
    expect(campo).toHaveValue('Antigo');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Multijogos');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar nome' }));
    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/admin/items/17/nome-exibicao', { nome: 'Multijogos' });
    });
    expect(await within(dialogo).findByText('Nome de exibição salvo.')).toBeInTheDocument();
  });

  it('falha ao ler o cadastro mostra o erro, sem formulario', async () => {
    dublarApi({
      itens: [item(18, { estado: 'nao_configurado', sistemas: 0, incluidos: 0, a_venda_em_loja_ligada: false })],
      direitos: [erroHttp(500, { error: 'Falha ao ler o cadastro de direito' })],
    });
    render(<Products />);

    const dialogo = await abrirCadastro(18);
    expect(await within(dialogo).findByText(/Falha ao ler o cadastro de direito/)).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: /tentar de novo/i })).toBeInTheDocument();
    expect(within(dialogo).queryByRole('button', { name: 'Salvar cadastro' })).toBeNull();
  });
});
