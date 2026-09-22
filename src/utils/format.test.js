/**
 * T13 — máscara de telefone (EARS-24).
 *
 * Spec: docs/modules/chatbot-whatsapp/changes/2026-09-05-painel-de-escalonamentos-do-suporte/
 * Design §12.
 *
 * Rodar:  npx vitest run src/utils/format.test.js
 */
import { describe, it, expect } from 'vitest';
import { formatPhone, formatUtcDateTime } from './format';

// Bug 2026-09-22: a coluna "Aberto em" mostrava "Mon, 14 Sep 2026 14:01:21 GMT". O
// `jsonify` do Flask serializa `datetime` em RFC 1123, e o helper so sabia tratar o
// formato do MySQL -- no RFC ele caia no `return value` e devolvia a string crua.
describe('formatUtcDateTime', () => {
  const emBrasilia = (iso) => new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  it('RFC 1123 do Flask vira dd/mm/aaaa', () => {
    const saida = formatUtcDateTime('Mon, 14 Sep 2026 14:01:21 GMT');
    expect(saida).toBe(emBrasilia('2026-09-14T14:01:21Z'));
    expect(saida).toMatch(/^\d{2}\/\d{2}\/\d{4}/);
  });

  it('datetime do MySQL (sem fuso) continua lido como UTC', () => {
    expect(formatUtcDateTime('2026-09-17 12:45:00')).toBe(emBrasilia('2026-09-17T12:45:00Z'));
  });

  it('ISO com fuso explicito e respeitado', () => {
    expect(formatUtcDateTime('2026-09-17T12:45:00-03:00')).toBe(emBrasilia('2026-09-17T15:45:00Z'));
  });

  it('valor que nao e data devolve o original, sem quebrar a tela', () => {
    expect(formatUtcDateTime('nao e data')).toBe('nao e data');
  });

  it('vazio devolve travessao', () => {
    expect(formatUtcDateTime(null)).toBe('—');
    expect(formatUtcDateTime('')).toBe('—');
  });
});

describe('formatPhone', () => {
  it('celular (11 dígitos) vira (DD) 9XXXX-XXXX', () => {
    expect(formatPhone('5511988887777')).toBe('(11) 98888-7777');
  });

  it('fixo com código do país (55 + 10 dígitos) vira (DD) XXXX-XXXX', () => {
    expect(formatPhone('551133334444')).toBe('(11) 3333-4444');
  });

  it('fixo sem código do país (10 dígitos) vira (DD) XXXX-XXXX', () => {
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
  });

  it('celular sem código do país (11 dígitos) vira (DD) 9XXXX-XXXX', () => {
    expect(formatPhone('11988887777')).toBe('(11) 98888-7777');
  });

  it('numero invalido devolve o valor original, sem inventar dígito', () => {
    expect(formatPhone('123')).toBe('123');
    expect(formatPhone('abc')).toBe('abc');
  });

  it('vazio devolve travessão', () => {
    expect(formatPhone(null)).toBe('—');
    expect(formatPhone('')).toBe('—');
  });
});
