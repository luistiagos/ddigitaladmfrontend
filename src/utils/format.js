/**
 * Formatting utilities — dates and currency in Brazilian standard.
 */

export function formatDate(value) {
  if (!value) return '—';
  try {
    const d = new Date(value.includes('T') ? value : value + 'T00:00:00');
    return d.toLocaleDateString('pt-BR');
  } catch {
    return value;
  }
}

export function formatDateTime(value) {
  if (!value) return '—';
  try {
    const d = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return value;
  }
}

/**
 * Igual a `formatDateTime`, mas tratando texto SEM FUSO como UTC.
 *
 * A API admin devolve as datas em UTC e sem fuso ("2026-09-17 12:45:00"). Pela regra do
 * JavaScript, `new Date("2026-09-17T12:45:00")` (sem `Z`) e interpretado como hora LOCAL,
 * entao a tela mostraria 12:45 quando foram 09:45 em Brasilia -- tres horas adiantada.
 *
 * `formatDateTime` NAO muda: outras telas leem fontes cujo fuso nao foi conferido, e
 * "corrigir" todas de uma vez trocaria um erro conhecido por um erro novo.
 */
export function formatUtcDateTime(value) {
  if (!value) return '—';
  try {
    const texto = String(value);
    const temFuso = /(Z|[+-]\d{2}:?\d{2})$/.test(texto);
    const iso = texto.includes('T') ? texto : texto.replace(' ', 'T');
    const d = new Date(temFuso ? iso : `${iso}Z`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export function formatCurrency(value) {
  if (value == null || value === '') return '—';
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/** Return today in YYYY-MM-DD format (local time, not UTC) */
export function todayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
