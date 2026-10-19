/**
 * T8 — a celula de custo de IA (EARS-32 a 35 do teto por comprador).
 *
 * O que protege: o operador nunca le "US$ 0,00" onde o custo nao foi calculado, nunca le o
 * pos-venda de um lead, e o "teto atingido" so aparece quando o servidor diz que a marca vale.
 *
 * Spec: docs/modules/chatbot-whatsapp/changes/2026-10-16-teto-de-custo-llm-por-comprador/
 *
 * Rodar:  npx vitest run src/components/whatsapp/LlmCostCell.test.jsx
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LlmCostCell, { textoLlmCost } from './LlmCostCell';

describe('LlmCostCell', () => {
  it('comprador_mostra_pos_venda_e_teto', () => {
    const { container, rerender } = render(
      <LlmCostCell cost={{ total: 1.23, pos_venda: 0.8, teto: 4, teto_atingido: false }} />,
    );
    expect(screen.getByText('US$ 1,23')).toBeInTheDocument();
    expect(screen.getByText('pós-venda US$ 0,80 de 4,00')).toBeInTheDocument();
    expect(screen.queryByText('teto atingido')).toBeNull();

    // Lead: so o total, sem linha de pos-venda.
    rerender(<LlmCostCell cost={{ total: 0.5, pos_venda: null, teto: 4, teto_atingido: false }} />);
    expect(screen.getByText('US$ 0,50')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/pós-venda/);

    // Teto desligado: "de 0,00" leria como teto estourado.
    rerender(<LlmCostCell cost={{ total: 2, pos_venda: 1.5, teto: 0, teto_atingido: false }} />);
    expect(screen.getByText('pós-venda US$ 1,50 · sem teto')).toBeInTheDocument();
  });

  it('marca_valida_mostra_teto_atingido', () => {
    const { rerender } = render(
      <LlmCostCell cost={{ total: 5.2, pos_venda: 4.17, teto: 4, teto_atingido: true }} />,
    );
    expect(screen.getByText('teto atingido')).toBeInTheDocument();
    expect(screen.getByText('pós-venda US$ 4,17 de 4,00')).toHaveClass('text-red-400');

    // Passar do teto sem marca valida (ex.: teto subiu) NAO acende o selo: quem decide e o servidor.
    rerender(<LlmCostCell cost={{ total: 5.2, pos_venda: 4.17, teto: 4, teto_atingido: false }} />);
    expect(screen.queryByText('teto atingido')).toBeNull();
  });

  it('indisponivel_mostra_traco', () => {
    const { rerender } = render(<LlmCostCell cost={null} />);
    expect(screen.getByTitle('custo indisponível')).toHaveTextContent('—');

    // Campo ausente (backend sem a T7) e tratado como indisponivel, nunca como zero.
    rerender(<LlmCostCell />);
    expect(screen.getByTitle('custo indisponível')).toHaveTextContent('—');
    expect(screen.queryByText('US$ 0,00')).toBeNull();
    expect(textoLlmCost(null)).toBe('');
    expect(textoLlmCost(undefined)).toBe('');
  });

  it('sem_geracao_mostra_zero', () => {
    render(<LlmCostCell cost={{ total: 0, pos_venda: 0, teto: 4, teto_atingido: false }} />);
    expect(screen.getByText('US$ 0,00')).toBeInTheDocument();
    expect(screen.queryByTitle('custo indisponível')).toBeNull();
    expect(textoLlmCost({ total: 0 })).toBe('US$ 0,00');
  });
});
