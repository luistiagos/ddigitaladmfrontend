/**
 * T7 — tela "Campanhas de Remarketing": marcar "contar o atraso a partir do step anterior".
 *
 * O que estes testes protegem (EARS-11): o checkbox do formulario manda
 * `delay_from_previous` BOOLEANO no POST e no PUT (o backend recusa a string "true"); a lista
 * mostra "Nmin apos o step anterior" no step relativo e "Nmin a partir do lead" nos antigos;
 * editar um step antigo manda `false`, sem marcar nada sozinho.
 *
 * Spec: docs/modules/remarketing/changes/2026-11-27-step-de-cupom-uma-hora-depois-do-whatsapp/
 *
 * Rodar:  npx vitest run src/pages/RemarketingCampaigns.test.jsx
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '@/services/api';
import RemarketingCampaigns from './RemarketingCampaigns';

const LOJA = {
  store_id: 600006, store_name: 'Plataforma PS2', step_count: 2, email_steps: 1,
  whatsapp_steps: 1, window_start_hour: 9, window_end_hour: 20,
};

// Formato de remarketdao._step_row_to_dict depois do T4 (steps 26 e 27 de producao).
const STEP_EMAIL = {
  id: 26, name: 'PS2 — Abandono 01', delivery_type: 'EMAIL', template: 'remarket/email.html',
  subject: 'Oi', ord: 1, time_trigger_min: null, days_cyclic: null, time_send: null,
  day_send: null, delay_from_previous: false, created_at: null,
};
const STEP_WPP = {
  ...STEP_EMAIL, id: 27, name: 'PS2 — WhatsApp', delivery_type: 'WHATSAPP',
  template: 'remarket/wpp_remarket_ai_ps2.txt', subject: null, ord: 2, time_trigger_min: 1,
};
const STEP_CUPOM = {
  ...STEP_WPP, id: 40, name: 'PS2 — Cupom', template: 'remarket/wpp_remarket_cupom_ps2.txt',
  ord: 3, time_trigger_min: 60, delay_from_previous: true, created_at: '2026-11-28T15:00:00Z',
};

function montarApi(steps) {
  const ok = (data) => Promise.resolve({ data: { success: true, ...data } });
  api.get.mockImplementation((url) => {
    if (url === '/admin/remarket/stores') return ok({ items: [LOJA] });
    if (url === `/admin/remarket/stores/${LOJA.store_id}/steps`) return ok({ items: steps });
    return Promise.reject(new Error(`fora do teste: ${url}`));
  });
  api.post.mockImplementation(() => ok({}));
  api.put.mockImplementation(() => ok({}));
}

async function abrirLoja(user) {
  render(<RemarketingCampaigns />);
  await user.click(await screen.findByText(LOJA.store_name));
  await screen.findByText(STEP_EMAIL.name);
}

function cartaoDoStep(nome) {
  return screen.getByText(nome).closest('[draggable]');
}

describe('RemarketingCampaigns — atraso relativo ao step anterior', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it('marca atraso relativo ao step anterior', async () => {
    const user = userEvent.setup();
    montarApi([STEP_EMAIL, STEP_WPP, STEP_CUPOM]);
    await abrirLoja(user);

    // Resumo da lista: o relativo diz a base; os antigos, "a partir do lead".
    expect(within(cartaoDoStep(STEP_CUPOM.name)).getByText('60min após o step anterior')).toBeTruthy();
    expect(within(cartaoDoStep(STEP_WPP.name)).getByText('1min a partir do lead')).toBeTruthy();
    expect(within(cartaoDoStep(STEP_EMAIL.name)).getByText('0min a partir do lead')).toBeTruthy();

    // Criar: o checkbox manda booleano true.
    await user.click(screen.getByRole('button', { name: /Adicionar Step/ }));
    const form = screen.getByText('Adicionar novo step').parentElement;
    await user.type(within(form).getByPlaceholderText(/Abandono 01/), 'PS2 — Cupom');
    await user.selectOptions(within(form).getByRole('combobox'), 'WHATSAPP');
    await user.type(within(form).getByPlaceholderText(/wpp_remarket_ai_multigames/),
      'remarket/wpp_remarket_cupom_ps2.txt');
    expect(within(form).getByText('Atraso após o lead (min)')).toBeTruthy();
    await user.click(within(form).getByLabelText('Contar o atraso a partir do step anterior'));
    expect(within(form).getByText('Atraso após o step anterior (min)')).toBeTruthy();
    await user.type(within(form).getByPlaceholderText('ex: 15'), '60');
    await user.click(within(form).getByRole('button', { name: /^Adicionar$/ }));

    expect(api.post).toHaveBeenCalledTimes(1);
    const [url, body] = api.post.mock.calls[0];
    expect(url).toBe(`/admin/remarket/stores/${LOJA.store_id}/steps`);
    expect(body.delay_from_previous).toBe(true);
    expect(body.time_trigger_min).toBe('60');
    expect(body.delivery_type).toBe('WHATSAPP');
  });

  it('criar sem marcar manda false', async () => {
    const user = userEvent.setup();
    montarApi([STEP_EMAIL]);
    await abrirLoja(user);

    await user.click(screen.getByRole('button', { name: /Adicionar Step/ }));
    const form = screen.getByText('Adicionar novo step').parentElement;
    await user.type(within(form).getByPlaceholderText(/Abandono 01/), 'Outro');
    await user.type(within(form).getByPlaceholderText(/wpp_remarket_ai_multigames/), 'remarket/x.html');
    await user.click(within(form).getByRole('button', { name: /^Adicionar$/ }));

    expect(api.post.mock.calls[0][1].delay_from_previous).toBe(false);
  });

  it('editar step antigo manda false e editar o relativo mantem true; desmarcar manda false', async () => {
    const user = userEvent.setup();
    montarApi([STEP_EMAIL, STEP_WPP, STEP_CUPOM]);
    await abrirLoja(user);

    // Step antigo: abre desmarcado e o PUT leva false (o valor que ele ja tem).
    await user.click(within(cartaoDoStep(STEP_WPP.name)).getAllByRole('button')[0]);
    let caixa = screen.getByLabelText('Contar o atraso a partir do step anterior');
    expect(caixa.checked).toBe(false);
    await user.click(screen.getByRole('button', { name: /^Salvar$/ }));
    expect(api.put).toHaveBeenLastCalledWith(`/admin/remarket/steps/${STEP_WPP.id}`,
      expect.objectContaining({ delay_from_previous: false }));

    // Step relativo: abre marcado; salvar sem mexer mantem true.
    await user.click(within(cartaoDoStep(STEP_CUPOM.name)).getAllByRole('button')[0]);
    caixa = screen.getByLabelText('Contar o atraso a partir do step anterior');
    expect(caixa.checked).toBe(true);
    await user.click(screen.getByRole('button', { name: /^Salvar$/ }));
    expect(api.put).toHaveBeenLastCalledWith(`/admin/remarket/steps/${STEP_CUPOM.id}`,
      expect.objectContaining({ delay_from_previous: true }));

    // Desmarcar e salvar manda false.
    await user.click(within(cartaoDoStep(STEP_CUPOM.name)).getAllByRole('button')[0]);
    await user.click(screen.getByLabelText('Contar o atraso a partir do step anterior'));
    await user.click(screen.getByRole('button', { name: /^Salvar$/ }));
    expect(api.put).toHaveBeenLastCalledWith(`/admin/remarket/steps/${STEP_CUPOM.id}`,
      expect.objectContaining({ delay_from_previous: false }));
  });
});
