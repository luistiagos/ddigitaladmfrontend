/**
 * Camada 6 — testes de frontend do WorkflowDetailModal.
 *
 * Cobre MON-08 (workflow ativo mostra 5 botões), MON-09 (workflow terminal
 * esconde 4 botões) e SIG-06 ("Tentar novamente" em terminal re-dispara via
 * run-planner-for-lead).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// O modal importa o axios `api` — mockado para não fazer HTTP real.
vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import api from '@/services/api';
import WorkflowDetailModal from './WorkflowDetailModal';

function makeWorkflow(status) {
  return {
    workflow_id: 'wf-1',
    lead_id: 123,
    lead_email: 'emuladores.emuladores@gmail.com',
    lead_phone: '(41) 98531-1304',
    store_name: 'Plataforma Multigames',
    campaign_id: 'lead-remarketing-store-600004',
    created_at: '2026-05-20T12:00:00Z',
    updated_at: '2026-05-20T12:05:00Z',
    status,
    live_state: {
      status,
      current_cycle: 1,
      current_step_id: 'rs-12',
      events: [],
      sent_steps: [],
    },
  };
}

function renderModal() {
  return render(
    <WorkflowDetailModal workflowId="wf-1" onClose={vi.fn()} onChange={vi.fn()} />
  );
}

const BTN = {
  pausar: /pausar/i,
  retomar: /retomar/i,
  confirmar: /confirmar step/i,
  tentar: /tentar novamente/i,
  cancelar: /cancelar workflow/i,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WorkflowDetailModal — botões por estado do workflow', () => {
  it('workflow ATIVO (running) mostra os 5 botões', async () => {
    api.get.mockResolvedValue({ data: makeWorkflow('running') });
    renderModal();

    // Espera o carregamento terminar.
    await screen.findByText(/^Steps \(\d+\)$/i);

    expect(screen.getByRole('button', { name: BTN.pausar })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: BTN.retomar })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: BTN.confirmar })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: BTN.tentar })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: BTN.cancelar })).toBeInTheDocument();
  });

  it('workflow TERMINAL (completed) esconde 4 botões e mantém só "Tentar novamente"', async () => {
    api.get.mockResolvedValue({ data: makeWorkflow('completed') });
    renderModal();

    await screen.findByText(/^Steps \(\d+\)$/i);

    // Os 4 botões de controle não devem existir.
    expect(screen.queryByRole('button', { name: BTN.pausar })).toBeNull();
    expect(screen.queryByRole('button', { name: BTN.retomar })).toBeNull();
    expect(screen.queryByRole('button', { name: BTN.confirmar })).toBeNull();
    expect(screen.queryByRole('button', { name: BTN.cancelar })).toBeNull();

    // "Tentar novamente" continua visível.
    expect(screen.getByRole('button', { name: BTN.tentar })).toBeInTheDocument();
    // Mensagem de workflow finalizado.
    expect(screen.getByText(/Workflow finalizado/i)).toBeInTheDocument();
  });

  it.each(['purchased', 'canceled', 'error', 'failed'])(
    'workflow terminal "%s" também esconde os 4 botões',
    async (status) => {
      api.get.mockResolvedValue({ data: makeWorkflow(status) });
      renderModal();
      await screen.findByText(/^Steps \(\d+\)$/i);
      expect(screen.queryByRole('button', { name: BTN.cancelar })).toBeNull();
      expect(screen.getByRole('button', { name: BTN.tentar })).toBeInTheDocument();
    }
  );
});

describe('WorkflowDetailModal — "Tentar novamente"', () => {
  it('em workflow TERMINAL chama run-planner-for-lead com o lead_id', async () => {
    api.get.mockResolvedValue({ data: makeWorkflow('completed') });
    api.post.mockResolvedValue({ data: { success: true } });
    renderModal();

    await screen.findByText(/^Steps \(\d+\)$/i);
    await userEvent.click(screen.getByRole('button', { name: BTN.tentar }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/admin/remarket/run-planner-for-lead',
        { lead_id: 123 }
      );
    });
  });

  it('em workflow ATIVO chama o signal retry-step (não run-planner-for-lead)', async () => {
    api.get.mockResolvedValue({ data: makeWorkflow('running') });
    api.post.mockResolvedValue({ data: { success: true } });
    renderModal();

    await screen.findByText(/^Steps \(\d+\)$/i);
    await userEvent.click(screen.getByRole('button', { name: BTN.tentar }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });
    const url = api.post.mock.calls[0][0];
    expect(url).toContain('/retry-step');
    expect(url).not.toContain('run-planner-for-lead');
  });
});

// Bug docs/modules/remarketing/bugs/2026-11-24-detalhe-do-workflow-mostra-email-como-enviado-sem-destinatario-nem-motivo.md (T3)
function withSteps(sentSteps, events = []) {
  const wf = makeWorkflow('completed');
  wf.live_state.sent_steps = sentSteps;
  wf.live_state.events = events;
  return wf;
}

function step(over) {
  return {
    step_id: 'rs-1',
    channel: 'email',
    cycle: 1,
    status: 'sent',
    idempotency_key: 'k',
    sent_at_iso: '2026-11-25T14:20:00+00:00',
    provider_message_id: null,
    metadata: {},
    ...over,
  };
}

describe('WorkflowDetailModal — steps com destino e motivo', () => {
  it('step skipped com reason mostra o motivo traduzido e o destinatario', async () => {
    api.get.mockResolvedValue({
      data: withSteps([
        step({ status: 'skipped', reason: 'user_has_purchase', recipient: 'cliente@exemplo.com' }),
      ]),
    });
    renderModal();
    await screen.findByText(/^Steps \(1\)$/i);
    expect(screen.getByText('não enviado: lead já comprou')).toBeInTheDocument();
    expect(screen.getByText(/para cliente@exemplo\.com/)).toBeInTheDocument();
    expect(screen.getByText('skipped')).toBeInTheDocument();
    expect(screen.queryByText(/override de teste/i)).toBeNull();
  });

  it('historico antigo: status sent com metadata.sent=false aparece como nao enviado com o motivo do metadata', async () => {
    api.get.mockResolvedValue({
      data: withSteps([
        step({ status: 'sent', metadata: { ok: true, sent: false, reason: 'already_sent_dedup' } }),
      ]),
    });
    renderModal();
    await screen.findByText(/^Steps \(1\)$/i);
    expect(screen.getByText('não enviado')).toBeInTheDocument();
    expect(screen.queryByText('sent')).toBeNull();
    expect(screen.getByText('não enviado: já enviado antes para este destino')).toBeInTheDocument();
  });

  it('step sent de verdade nao mostra motivo', async () => {
    api.get.mockResolvedValue({
      data: withSteps([
        step({
          status: 'sent',
          reason: 'sent',
          metadata: { ok: true, sent: true, reason: 'sent' },
          recipient: 'a@b.com',
        }),
      ]),
    });
    renderModal();
    await screen.findByText(/^Steps \(1\)$/i);
    expect(screen.getByText('sent')).toBeInTheDocument();
    expect(screen.queryByText(/não enviado/)).toBeNull();
  });

  it('recipient_overridden mostra a marca de override de teste', async () => {
    api.get.mockResolvedValue({
      data: withSteps([
        step({ status: 'sent', recipient: 'dono@exemplo.com', recipient_overridden: true }),
      ]),
    });
    renderModal();
    await screen.findByText(/^Steps \(1\)$/i);
    expect(screen.getByText(/para dono@exemplo\.com/)).toBeInTheDocument();
    expect(screen.getByText(/override de teste/i)).toBeInTheDocument();
  });

  it.each([
    ['checkout_pending', 'checkout_in_progress', 'não enviado: cliente no checkout (PIX aberto)'],
    ['conversation_active', 'customer_in_conversation', 'não enviado: cliente em conversa com o agente'],
    ['failed', 'sendmail_failed', 'falha no envio (vai para a fila de retentativa)'],
    ['failed', 'http 400', 'http 400'],
  ])('status %s com reason %s mostra "%s"', async (status, reason, texto) => {
    api.get.mockResolvedValue({ data: withSteps([step({ channel: 'whatsapp', status, reason })]) });
    renderModal();
    await screen.findByText(/^Steps \(1\)$/i);
    expect(screen.getByText(texto)).toBeInTheDocument();
  });

  it('timeline le event_type e message gravados pelo Temporal', async () => {
    api.get.mockResolvedValue({
      data: withSteps(
        [],
        [
          {
            event_type: 'step_dispatched',
            message: 'email step rs-1 skipped — user_has_purchase',
            at_iso: '2026-11-25T14:20:00+00:00',
            metadata: {},
          },
        ]
      ),
    });
    renderModal();
    await screen.findByText(/^Steps \(0\)$/i);
    expect(screen.getByText('step_dispatched')).toBeInTheDocument();
    expect(screen.getByText('email step rs-1 skipped — user_has_purchase')).toBeInTheDocument();
  });
});
