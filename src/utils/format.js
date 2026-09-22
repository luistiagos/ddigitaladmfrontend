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
    const texto = String(value).trim();
    // Duas familias de entrada chegam aqui, e so a PRIMEIRA precisa de conserto:
    //
    // 1. sem fuso -- "2026-09-17 12:45:00" / "2026-09-17T12:45". O banco grava em UTC,
    //    entao o `Z` e obrigatorio: sem ele o navegador leria como hora LOCAL e a coluna
    //    atrasaria 3h.
    // 2. com fuso -- ISO com offset e, sobretudo, o RFC 1123 que o `jsonify` do Flask usa
    //    para serializar `datetime` ("Mon, 14 Sep 2026 14:01:21 GMT"), que e o que a API
    //    manda em `aberto_em`. Esse formato o `new Date` ja entende inteiro; mexer nele
    //    e que o quebrava (o `replace(' ', 'T')` produzia "Mon,T14 Sep ...", data
    //    invalida, e a tela mostrava a string crua em ingles no lugar de dd/mm/aaaa).
    const semFuso = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(texto);
    const d = new Date(semFuso ? `${texto.replace(' ', 'T')}Z` : texto);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return value;
  }
}

/**
 * Mascara de telefone BR: (DD) 9XXXX-XXXX (celular) ou (DD) XXXX-XXXX (fixo).
 *
 * Padrao NOVO -- 18/09, tela de Chamados de suporte. Nenhuma outra tela do painel mascara
 * telefone hoje (Transactions.jsx mostra o numero cru via PhoneCell); fica restrito aqui
 * por decisao do dono (design §12).
 *
 * Numero que nao se encaixa (poucos digitos, formato internacional, identificador que nao
 * e telefone) devolve o valor ORIGINAL sem quebrar a tela nem inventar digito.
 */
export function formatPhone(value) {
  if (!value) return '—';
  const digits = String(value).replace(/\D/g, '');
  const nacional = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
  if (nacional.length === 11) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`;
  }
  if (nacional.length === 10) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`;
  }
  return value;
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
