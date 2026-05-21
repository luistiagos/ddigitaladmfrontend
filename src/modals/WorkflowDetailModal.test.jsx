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
    await screen.findByText(/Steps enviados/i);

    expect(screen.getByRole('button', { name: BTN.pausar })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: BTN.retomar })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: BTN.confirmar })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: BTN.tentar })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: BTN.cancelar })).toBeInTheDocument();
  });

  it('workflow TERMINAL (completed) esconde 4 botões e mantém só "Tentar novamente"', async () => {
    api.get.mockResolvedValue({ data: makeWorkflow('completed') });
    renderModal();

    await screen.findByText(/Steps enviados/i);

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
      await screen.findByText(/Steps enviados/i);
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

    await screen.findByText(/Steps enviados/i);
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

    await screen.findByText(/Steps enviados/i);
    await userEvent.click(screen.getByRole('button', { name: BTN.tentar }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });
    const url = api.post.mock.calls[0][0];
    expect(url).toContain('/retry-step');
    expect(url).not.toContain('run-planner-for-lead');
  });
});
