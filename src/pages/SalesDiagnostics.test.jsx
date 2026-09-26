import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

import api from '@/services/api';
import SalesDiagnostics from './SalesDiagnostics';

describe('SalesDiagnostics Component (T7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultContext = {
    context_id: 'ctx-test-123',
    measurement_version: 1,
    filters: {
      start_date: '2026-09-14',
      end_date: '2026-09-18',
      store_id: null,
      comparison_window: {
        start_date: '2026-08-14',
        end_date: '2026-08-18',
        is_available: true,
        reason: null,
      },
      is_today_partial: false,
    },
    commercial_hours: { start_hour: 9, end_hour: 21, version: 1 },
    expires_at: 1726834200,
  };

  const defaultBlocks = {
    magnitude: {
      block: 'magnitude',
      availability: 'complete',
      data: {
        receita_atual: 15420.50,
        receita_anterior: 18200.00,
        variacao_pct: -15.27,
        variacao_nominal: -2779.50,
        pagamentos_atual: 142,
        ranking_90d: { rank: 4, total_windows: 86, z: 1.65 },
        detector: { status: 'inicio_detectado', candidate_start_date: '2026-09-15' },
      },
      limitations: [],
    },
    funnel: {
      block: 'funnel',
      availability: 'complete',
      data: {
        taxas_indicativas: { cart_to_purchase_pct: 14.8 },
        funil_leads: { total: 540, finalizado: 80, pendente: 210, cancelado: 45 },
        ticket_medio: 108.59,
      },
      limitations: [],
    },
    hours: {
      block: 'hours',
      availability: 'complete',
      data: {
        start_hour: 9,
        end_hour: 21,
        receita: { dentro_da_faixa: 12500.00, fora_da_faixa: 2920.50 },
        leads: { dentro_da_faixa: 410, fora_da_faixa: 130 },
      },
      limitations: [],
    },
    cohorts: {
      block: 'cohorts',
      availability: 'complete',
      data: {
        coorte_atual: { conversao_pct: 12.6, maduros: 280 },
        comparacao: {
          inferencia: {
            result: 'evidencia_de_queda',
            diff_pp: -2.6,
            p_value: 0.038,
          },
        },
      },
      limitations: [],
    },
    'origin-ticket': {
      block: 'origin-ticket',
      availability: 'complete',
      data: {
        origem_anuncio: { taxa_com_identificador_pct: 68.4 },
        bumps: { taxa_anexo_pct: 19.2, pedidos_com_bump: 27, total_pedidos: 141 },
      },
      limitations: [],
    },
    ads: {
      block: 'ads',
      availability: 'complete',
      stale: false,
      collected_at: '2026-09-18T18:00:00Z',
      data: {
        spend: 3200.00,
        clicks: 1450,
        ctr: 2.85,
        cpm: 16.40,
        human_edits_count: 3,
        reach: null,
      },
      limitations: [],
    },
    'agent-health': {
      block: 'agent-health',
      availability: 'complete',
      data: {
        truncamento_pct: 1.1,
        fallback_pct: 2.9,
      },
      limitations: [],
    },
    summary: {
      block: 'summary',
      availability: 'complete',
      data: {
        evidencias_queda: ['Receita caiu 15.27% contra o mês anterior', 'Conversão da coorte bot apresentou queda estatística (-2.6 p.p.)'],
        inconclusivos: ['Detector de heurística com histórico parcial'],
        descartados: [],
        limitacoes: ['Janela analisada com dados consolidados'],
      },
      limitations: [],
    },
  };

  function mockApiSuccess(extraBlocks = {}, extraContext = {}) {
    api.get.mockImplementation((url, config) => {
      if (url === '/admin/stores') {
        return Promise.resolve({ data: { stores: [{ id: 600007, name: 'Loja Principal' }] } });
      }
      if (url === '/admin/sales-diagnostics/context') {
        return Promise.resolve({ data: { ...defaultContext, ...extraContext } });
      }
      if (url.startsWith('/admin/sales-diagnostics/blocks/')) {
        const blockName = url.split('/blocks/')[1];
        const res = extraBlocks[blockName] || defaultBlocks[blockName] || { block: blockName, availability: 'unavailable', limitations: [] };
        return Promise.resolve({ data: res });
      }
      if (url === '/admin/sales-diagnostics/settings') {
        return Promise.resolve({ data: { start_hour: 9, end_hour: 21, version: 1 } });
      }
      return Promise.reject(new Error(`Rota nao mockada: ${url}`));
    });
  }

  it('1. Carregamento por bloco: renderiza metricas completas com envelope e rotulos', async () => {
    mockApiSuccess();
    render(<SalesDiagnostics />);

    // Verifica titulo
    expect(screen.getByText('Diagnóstico de Queda de Vendas')).toBeInTheDocument();

    // Aguarda carregar dados do bloco magnitude
    await waitFor(() => {
      expect(screen.getByText('Magnitude e Receita')).toBeInTheDocument();
      expect(screen.getByText('-15.27% (R$ -2779.5) contra mês anterior')).toBeInTheDocument();
    });

    // Funil
    expect(screen.getByText('Taxa indicativa (população não vinculada)')).toBeInTheDocument();
    expect(screen.getByText('14.8%')).toBeInTheDocument();

    // Faixa comercial
    expect(screen.getByText('Faixa Comercial: 09h às 21h')).toBeInTheDocument();

    // Coortes
    expect(screen.getByText('Coorte Bot WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('evidencia_de_queda')).toBeInTheDocument();

    // Origem e rotulo mandatorio
    expect(screen.getByText(/Presença de identificador Meta \(fbc\) indica registro do parâmetro, mas não atribui a origem da sessão atual/i)).toBeInTheDocument();

    // Meta Ads e alcance nao aditivo
    expect(screen.getByText(/Alcance não é aditivo entre contas ou campanhas distintas/i)).toBeInTheDocument();

    // Saude do agente
    expect(screen.getByText(/Métricas restritas ao agente de pré-venda \(vendas\)/i)).toBeInTheDocument();

    // Resumo deterministico
    expect(screen.getByText('Resumo Determinístico')).toBeInTheDocument();
    expect(screen.getByText('Receita caiu 15.27% contra o mês anterior')).toBeInTheDocument();
  });

  it('2. Zero versus Indisponivel: metricas em 0 exibem 0 e bloco com erro exibe Indisponivel', async () => {
    const blocksWithZerosAndFail = {
      ...defaultBlocks,
      magnitude: {
        block: 'magnitude',
        availability: 'unavailable',
        limitations: ['Timeout ao acessar banco de transações.'],
        data: null,
      },
      ads: {
        block: 'ads',
        availability: 'complete',
        data: {
          spend: 0.0,
          clicks: 0,
          ctr: 0.0,
          cpm: 0.0,
          human_edits_count: 0,
        },
      },
    };
    mockApiSuccess(blocksWithZerosAndFail);
    render(<SalesDiagnostics />);

    await waitFor(() => {
      expect(screen.getByText('Timeout ao acessar banco de transações.')).toBeInTheDocument();
      expect(screen.getByText('Indisponível')).toBeInTheDocument();
    });

    // Bloco Ads exibe R$ 0,00 e 0 sem quebrar
    expect(screen.getAllByText('R$ 0,00').length).toBeGreaterThan(0);
    expect(screen.getByText('Alterações Humanas')).toBeInTheDocument();
  });

  it('3. Parcial e Stale: exibe badge de dados em cache desatualizados e momento da coleta', async () => {
    const blocksWithStale = {
      ...defaultBlocks,
      ads: {
        block: 'ads',
        availability: 'complete',
        stale: true,
        collected_at: '2026-09-18T10:30:00Z',
        data: {
          spend: 2100.0,
          clicks: 980,
          human_edits_count: 0,
        },
      },
    };
    mockApiSuccess(blocksWithStale, {
      filters: {
        ...defaultContext.filters,
        is_today_partial: true,
      },
    });
    render(<SalesDiagnostics />);

    await waitFor(() => {
      expect(screen.getByText('Dados em Cache (Desatualizados)')).toBeInTheDocument();
      expect(screen.getByText(/Janela inclui o dia corrente incompleto/i)).toBeInTheDocument();
    });
  });

  it('4. Inconclusivo sem descarte causal: coorte inconclusiva aparece na secao Inconclusivos', async () => {
    const blocksInconclusive = {
      ...defaultBlocks,
      summary: {
        block: 'summary',
        availability: 'complete',
        data: {
          evidencias_queda: [],
          inconclusivos: ['Conversão da coorte bot: variação sem significância estatística.'],
          descartados: ['Nenhuma edição humana detectada.'],
          limitacoes: [],
        },
      },
    };
    mockApiSuccess(blocksInconclusive);
    render(<SalesDiagnostics />);

    await waitFor(() => {
      expect(screen.getByText('Conversão da coorte bot: variação sem significância estatística.')).toBeInTheDocument();
      expect(screen.getByText('Nenhuma edição humana detectada.')).toBeInTheDocument();
    });
  });

  it('5. Persistencia global e CAS com conflito 409 no modal de faixa comercial', async () => {
    mockApiSuccess();
    const user = userEvent.setup();
    render(<SalesDiagnostics />);

    // Abre o modal
    const openBtn = await screen.findByRole('button', { name: /Faixa Comercial/i });
    await user.click(openBtn);

    expect(screen.getByText('Configurar Horário Comercial')).toBeInTheDocument();

    // Simula erro 409 Conflito de versao ao salvar
    api.put.mockRejectedValueOnce({
      response: { status: 409, data: { error: 'conflito_de_versao' } },
    });

    const saveBtn = screen.getByRole('button', { name: /Salvar Alterações/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/alterada por outro usuário em concorrência/i)).toBeInTheDocument();
    });
  });

  it('6. Troca rapida de filtros: resposta de contexto antigo e ignorada', async () => {
    let callCount = 0;
    api.get.mockImplementation((url, config) => {
      if (url === '/admin/stores') {
        return Promise.resolve({ data: { stores: [] } });
      }
      if (url === '/admin/sales-diagnostics/context') {
        callCount++;
        const id = `ctx-${callCount}`;
        return Promise.resolve({
          data: {
            ...defaultContext,
            context_id: id,
          },
        });
      }
      if (url.startsWith('/admin/sales-diagnostics/blocks/')) {
        const reqCtx = config.params?.context_id;
        // Resposta atrasada para ctx-1
        if (reqCtx === 'ctx-1') {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                data: {
                  block: 'magnitude',
                  availability: 'complete',
                  context_id: 'ctx-1',
                  data: { receita_atual: 1111.0 },
                },
              });
            }, 50);
          });
        }
        // Resposta rapida para ctx-2
        return Promise.resolve({
          data: {
            block: 'magnitude',
            availability: 'complete',
            context_id: 'ctx-2',
            data: { receita_atual: 9999.0 },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    const user = userEvent.setup();
    render(<SalesDiagnostics />);

    // Clica em um preset para disparar nova consulta
    const presetBtn = await screen.findByRole('button', { name: '14 dias' });
    await user.click(presetBtn);

    // Aguarda e confirma que prevaleceu o valor do contexto ativo (ctx-2 -> 9999), nao o antigo atrasado (1111)
    await waitFor(() => {
      expect(screen.getByText('R$ 9.999,00')).toBeInTheDocument();
      expect(screen.queryByText('R$ 1.111,00')).not.toBeInTheDocument();
    });
  });

  it('7. Rate limit 429 no refresh do Meta Ads desabilita o botao com cooldown', async () => {
    mockApiSuccess();
    const user = userEvent.setup();
    render(<SalesDiagnostics />);

    await waitFor(() => {
      expect(screen.getByText('Meta Ads')).toBeInTheDocument();
    });

    api.post.mockRejectedValueOnce({
      response: {
        status: 429,
        headers: { 'retry-after': '30' },
        data: {
          block: 'ads',
          availability: 'complete',
          stale: true,
          limitations: ['Limite de requisições ativo.'],
        },
      },
    });

    const refreshBtn = screen.getByRole('button', { name: 'Atualizar' });
    await user.click(refreshBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Aguarde 30s/i })).toBeDisabled();
    });
  });

  it('8. Suporta formato real da API de producao para corte_horario e eventos de funil sem erro React #31', async () => {
    const prodShapeBlocks = {
      ...defaultBlocks,
      hours: {
        block: 'hours',
        availability: 'complete',
        data: {
          start_hour: 9,
          end_hour: 21,
          vendas: {
            na_faixa: { receita: 12500.0, vendas: 80 },
            fora_da_faixa: { receita: 2920.5, vendas: 62 },
          },
          leads: {
            na_faixa: { PageView: 300, AddToCart: 100, Lead: 60, InitiateCheckout: 40, Purchase: 20 },
            fora_da_faixa: { PageView: 80, AddToCart: 25, Lead: 15, InitiateCheckout: 10, Purchase: 5 },
          },
        },
      },
      funnel: {
        block: 'funnel',
        availability: 'complete',
        data: {
          atual: {
            eventos: { PageView: 380, AddToCart: 125, Lead: 75, InitiateCheckout: 50, Purchase: 25 },
            taxas_indicativas: { cart_to_purchase_pct: 20.0 },
            ticket_medio: 110.0,
            vendas_aprovadas: 25,
            receita_aprovada: 2750.0,
          },
          comparacao_disponivel: true,
        },
      },
    };
    mockApiSuccess(prodShapeBlocks);
    render(<SalesDiagnostics />);

    await waitFor(() => {
      expect(screen.getByText('Corte por Faixa Horária')).toBeInTheDocument();
      // Total de leads dentro da faixa (520) e fora da faixa (135)
      expect(screen.getByText('520')).toBeInTheDocument();
      expect(screen.getByText('135')).toBeInTheDocument();
      expect(screen.getByText('20%')).toBeInTheDocument();
    });
  });
});

