/**
 * T7 — tela "Modelos de IA" (/modelos-ia).
 *
 * O que estes testes protegem: o aviso `:free` aparece ANTES de salvar (EARS-11); sem cadastro,
 * os 8 tipos aparecem "usando o .env" com o modelo de cada um; a lista recusada pelo servidor
 * mostra o `error` da rota; a chave digitada nunca aparece inteira na tela nem volta do servidor;
 * desabilitar a última chave útil de um modelo em lista avisa que ele sai da cadeia.
 *
 * Spec: docs/modules/chatbot-whatsapp/changes/2026-11-13-provedor-de-llm-plugavel/
 *
 * Rodar:  npx vitest run src/pages/LlmModels.test.jsx
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '@/services/api';
import LlmModels from './LlmModels';

const TIPOS = ['vendas', 'pos_venda', 'consulta', 'router', 'classificador', 'resumo_chamado',
  'standalone', 'recuperacao'];
const ESTRUTURADOS = ['router', 'classificador', 'consulta', 'resumo_chamado'];
const CHAVE = 'sk-or-v1-abcdefghijklmnopqrstuvwxyz0123456789SEGREDO';

const tiposVazios = () => TIPOS.map((tipo) => ({
  tipo, modelo_env: tipo === 'router' ? 'deepseek-v4-flash' : 'deepseek-v4-pro',
  usando_env: true, estruturado: ESTRUTURADOS.includes(tipo), itens: [],
}));

const MODELO = {
  id: 7, provider: 'openrouter', base_url: null, model_id: 'xiaomi/mimo-v2.6-pro',
  ref: 'openrouter:xiaomi/mimo-v2.6-pro', label: 'MiMo', price_hit: '0.0500',
  price_miss: '0.4000', price_out: '1.6000', peak_pricing: false, json_ok: true,
};
const CHAVE_PUBLICA = {
  id: 3, model_pk: 7, fingerprint: 'a1b2c3d4', label: 'principal', last4: '6789', enabled: true,
  position: 1, test_ok_at: '2026-11-14 10:00:00', test_result: '{"aprovado": true}',
  cooldown_until: null, last_error: null, last_error_at: null,
};

function montarApi({ modelos = [], chaves = {}, tipos = tiposVazios(), put = null } = {}) {
  const ok = (data) => Promise.resolve({ data: { success: true, ...data } });
  api.get.mockImplementation((url) => {
    if (url === '/admin/llm/models') return ok({ models: modelos });
    if (url === '/admin/llm/chains') return ok({ tipos });
    const m = url.match(/^\/admin\/llm\/models\/(\d+)\/keys$/);
    if (m) return ok({ keys: chaves[m[1]] || [] });
    return Promise.reject(new Error(`fora do teste: ${url}`));
  });
  api.put.mockImplementation((url, body) => (put ? put(body) : ok({ tipo: body.tipo, itens: [] })));
  api.post.mockImplementation(() => ok({}));
  api.patch.mockImplementation(() => ok({}));
  api.delete.mockImplementation(() => ok({}));
}

function erroHttp(status, error) {
  const e = new Error(`HTTP ${status}`);
  e.response = { status, data: { success: false, error } };
  return e;
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('LlmModels', () => {
  it('avisa_modelo_free: aviso de avaliacao e limite diario aparece antes de salvar', async () => {
    montarApi();
    const user = userEvent.setup();
    render(<LlmModels />);
    await user.click(await screen.findByRole('button', { name: /novo modelo/i }));

    const campoModelo = screen.getByPlaceholderText('xiaomi/mimo-v2.6-pro');
    await user.type(campoModelo, 'nvidia/nemotron-ultra');
    expect(screen.queryByTestId('aviso-free')).toBeNull();

    await user.type(campoModelo, ':free');
    const aviso = screen.getByTestId('aviso-free');
    expect(aviso).toHaveTextContent(/avaliação/);
    expect(aviso).toHaveTextContent(/1\.000 req\/dia/);
    expect(api.post).not.toHaveBeenCalled();   // aviso veio antes de qualquer gravacao
  });

  it('estado vazio: os 8 tipos aparecem usando o .env com o modelo de cada um', async () => {
    montarApi();
    render(<LlmModels />);
    expect(await screen.findByText(/nenhum modelo cadastrado/i)).toBeInTheDocument();
    for (const tipo of TIPOS) {
      const cartao = screen.getByTestId(`tipo-${tipo}`);
      const modelo = tipo === 'router' ? 'deepseek-v4-flash' : 'deepseek-v4-pro';
      expect(within(cartao).getByText(`usando o .env (${modelo})`)).toBeInTheDocument();
    }
    expect(within(screen.getByTestId('tipo-router')).getByText(/exige json/i)).toBeInTheDocument();
    expect(within(screen.getByTestId('tipo-vendas')).queryByText(/exige json/i)).toBeNull();
  });

  it('lista recusada mostra o error da rota e nao some com a ordem escolhida', async () => {
    const msg = 'sem chave habilitada aprovada no teste de contrato: openrouter:xiaomi/mimo-v2.6-pro'
      + ' -- teste uma chave do modelo antes de coloca-lo na lista';
    montarApi({ modelos: [MODELO], chaves: { 7: [] }, put: () => Promise.reject(erroHttp(400, msg)) });
    const user = userEvent.setup();
    render(<LlmModels />);
    const cartao = await screen.findByTestId('tipo-vendas');

    await user.selectOptions(within(cartao).getByLabelText('Adicionar modelo em vendas'), '7');
    await user.click(within(cartao).getByRole('button', { name: /adicionar/i }));
    await user.click(within(cartao).getByRole('button', { name: /salvar lista/i }));

    expect(await within(cartao).findByRole('alert')).toHaveTextContent(msg);
    expect(api.put).toHaveBeenCalledWith('/admin/llm/chains', { tipo: 'vendas', modelos: [7] });
    expect(within(cartao).getByText(MODELO.ref)).toBeInTheDocument();
  });

  it('evidencia do novo principal vai no PUT so quando preenchida (opcional, D8)', async () => {
    montarApi({ modelos: [MODELO], chaves: { 7: [CHAVE_PUBLICA] } });
    const user = userEvent.setup();
    render(<LlmModels />);
    const cartao = await screen.findByTestId('tipo-pos_venda');
    await user.selectOptions(within(cartao).getByLabelText('Adicionar modelo em pos_venda'), '7');
    await user.click(within(cartao).getByRole('button', { name: /adicionar/i }));
    await user.type(within(cartao).getByLabelText(/evidência de homologação/i), 'suite 2026-11-14 verde');
    await user.click(within(cartao).getByRole('button', { name: /salvar lista/i }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/llm/chains', {
      tipo: 'pos_venda', modelos: [7], evidencia: 'suite 2026-11-14 verde',
    }));
  });

  it('chave nunca aparece inteira: testar antes de salvar nao grava e o campo e senha', async () => {
    montarApi({ modelos: [MODELO], chaves: { 7: [CHAVE_PUBLICA] } });
    api.post.mockImplementation((url) => Promise.resolve({ data: {
      success: true, aprovado: true, json_ok: true, chamadas: 5,
      verificacoes: [{ nome: 'texto', ok: true, detalhe: null }],
    } }));
    const user = userEvent.setup();
    const { container } = render(<LlmModels />);

    const campoChave = await screen.findByLabelText(`Nova chave de ${MODELO.ref}`);
    expect(campoChave).toHaveAttribute('type', 'password');
    await user.type(campoChave, CHAVE);
    await user.click(screen.getByRole('button', { name: /testar antes de salvar/i }));

    expect(await screen.findByText(/teste de contrato aprovado/i)).toHaveTextContent(/nada foi salvo/);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/admin/llm/models/7/test', { api_key: CHAVE });
    // A chave cadastrada aparece so mascarada; a digitada nao aparece em texto em lugar nenhum.
    expect(screen.getByTestId('chave-3')).toHaveTextContent('a1b2c3d4 · ****6789');
    expect(container.textContent).not.toContain(CHAVE);
    expect(container.textContent).not.toContain('SEGREDO');

    await user.click(screen.getByRole('button', { name: /salvar chave/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/llm/models/7/keys',
      { api_key: CHAVE, label: null }));
    await waitFor(() => expect(campoChave).toHaveValue(''));
  });

  it('desabilitar a ultima chave util de modelo em lista avisa que ele sai da cadeia', async () => {
    const tipos = tiposVazios().map((t) => (t.tipo === 'vendas'
      ? { ...t, usando_env: false, itens: [{ position: 1, model_pk: 7, ref: MODELO.ref }] } : t));
    montarApi({ modelos: [MODELO], chaves: { 7: [CHAVE_PUBLICA] }, tipos });
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<LlmModels />);

    await user.click(await within(await screen.findByTestId('chave-3')).findByRole('button', { name: 'Desabilitar' }));
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(confirmar.mock.calls[0][0]).toMatch(/sai da cadeia/);
    expect(confirmar.mock.calls[0][0]).toMatch(/vendas/);
    expect(api.patch).not.toHaveBeenCalled();   // recusou o aviso: nada mudou

    confirmar.mockReturnValue(true);
    await user.click(within(screen.getByTestId('chave-3')).getByRole('button', { name: 'Desabilitar' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/llm/keys/3', { enabled: false }));
  });

  it('excluir modelo em lista mostra os tipos que o servidor devolve', async () => {
    montarApi({ modelos: [MODELO], chaves: { 7: [] } });
    const msg = 'o modelo esta nas listas de: vendas -- tire-o das listas antes de excluir';
    api.delete.mockImplementation(() => Promise.reject(erroHttp(400, msg)));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<LlmModels />);
    await user.click(await screen.findByRole('button', { name: `Excluir modelo ${MODELO.ref}` }));
    expect(await within(screen.getByTestId('modelo-7')).findByRole('alert')).toHaveTextContent(msg);
  });
});
