/**
 * T6 — card do teto de custo de IA por comprador na tela /bot.
 *
 * Renderiza a tela inteira (não só o card) para provar que o card está ligado nela. O que
 * estes testes protegem: o vigente vem do servidor ("padrão"/"desligado" pelo que ele diz),
 * o motivo do 400 aparece na tela, e erro na LEITURA bloqueia salvar — nunca mostra o padrão
 * como se tivesse sido lido (EARS-25 a EARS-28).
 *
 * Spec: docs/modules/chatbot-whatsapp/changes/2026-10-16-teto-de-custo-llm-por-comprador/
 *
 * Rodar:  npx vitest run src/pages/BotConfig.test.jsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '@/services/api';
import BotConfig from './BotConfig';

const URL_TETO = '/admin/wpp/llm_budget_cap';

/** `teto`: resposta do GET do teto, ou um erro para rejeitar. Os GETs dos outros cards
 * falham (todos engolem o erro e ficam no estado inicial), para nenhum depender de fixture. */
function montarApi({ teto = { teto: 4.0, padrao: true }, post = null } = {}) {
  api.get.mockImplementation((url) => {
    if (url === URL_TETO) return teto instanceof Error ? Promise.reject(teto) : Promise.resolve({ data: teto });
    return Promise.reject(new Error(`fora do teste: ${url}`));
  });
  api.post.mockImplementation((url, body) => {
    if (url === URL_TETO) return post ? post(body) : Promise.resolve({ data: { success: true, teto: Number(body.teto), padrao: false } });
    return Promise.resolve({ data: {} });
  });
}

function erroHttp(status, error) {
  const e = new Error(`HTTP ${status}`);
  e.response = { status, data: { success: false, error } };
  return e;
}

const vigente = () => screen.findByTestId('teto-vigente');
const campo = () => screen.getByLabelText('Teto em US$');
const salvar = () => screen.getByRole('button', { name: /Salvar teto/ });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('card do teto de custo', () => {
  it('mostra_teto_vigente_padrao_e_desligado', async () => {
    montarApi();
    const { unmount } = render(<BotConfig />);
    let v = await vigente();
    expect(v).toHaveTextContent('US$ 4,00');
    expect(v).toHaveTextContent('padrão');
    expect(v).not.toHaveTextContent('desligado');
    unmount();

    montarApi({ teto: { teto: 0, padrao: false } });
    const r2 = render(<BotConfig />);
    v = await vigente();
    expect(v).toHaveTextContent('US$ 0,00');
    expect(v).toHaveTextContent('desligado');
    expect(v).not.toHaveTextContent('padrão');
    r2.unmount();

    montarApi({ teto: { teto: 5.5, padrao: false } });
    render(<BotConfig />);
    v = await vigente();
    expect(v).toHaveTextContent('US$ 5,50');
    expect(v).not.toHaveTextContent('padrão');
    expect(v).not.toHaveTextContent('desligado');
  });

  it('salva_teto_e_mostra_valor_gravado', async () => {
    // O servidor devolve o valor GRAVADO; a tela mostra esse, não o digitado. A resposta difere
    // do digitado de propósito: com valores iguais, mostrar o digitado passaria.
    montarApi({ post: () => Promise.resolve({ data: { success: true, teto: 7.25, padrao: false } }) });
    render(<BotConfig />);
    await vigente();
    await userEvent.clear(campo());
    await userEvent.type(campo(), '5,50');
    await userEvent.click(salvar());

    expect(api.post).toHaveBeenCalledWith(URL_TETO, { teto: '5,50' });
    await screen.findByText('Teto salvo.');
    const v = await vigente();
    expect(v).toHaveTextContent('US$ 7,25');
    expect(v).not.toHaveTextContent('padrão');
    expect(campo()).toHaveValue('7,25');
  });

  it('valor_invalido_mostra_erro', async () => {
    montarApi({ post: () => Promise.reject(erroHttp(400, 'o teto nao pode ser negativo')) });
    render(<BotConfig />);
    await vigente();
    await userEvent.clear(campo());
    await userEvent.type(campo(), '-1');
    await userEvent.click(salvar());

    await screen.findByText('o teto nao pode ser negativo');
    // O vigente continua o lido, não o recusado.
    expect(await vigente()).toHaveTextContent('US$ 4,00');
    expect(await vigente()).toHaveTextContent('padrão');
  });

  it('erro_na_leitura_bloqueia_salvar', async () => {
    montarApi({ teto: erroHttp(500, 'Falha ao ler o teto de custo') });
    render(<BotConfig />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao ler o teto de custo');
    expect(salvar()).toBeDisabled();
    expect(campo()).toBeDisabled();
    expect(screen.queryByTestId('teto-vigente')).toBeNull();
    expect(screen.queryByText(/US\$ 4,00/)).toBeNull();

    // "Tentar de novo" relê e destrava.
    montarApi();
    await userEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }));
    expect(await vigente()).toHaveTextContent('US$ 4,00');
    await waitFor(() => expect(salvar()).toBeEnabled());
  });
});
