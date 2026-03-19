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
