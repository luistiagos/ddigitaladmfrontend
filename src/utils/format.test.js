/**
 * T13 — máscara de telefone (EARS-24).
 *
 * Spec: docs/modules/chatbot-whatsapp/changes/2026-09-05-painel-de-escalonamentos-do-suporte/
 * Design §12.
 *
 * Rodar:  npx vitest run src/utils/format.test.js
 */
import { describe, it, expect } from 'vitest';
import { formatPhone } from './format';

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
