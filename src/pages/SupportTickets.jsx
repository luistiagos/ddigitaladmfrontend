/**
 * Chamados de suporte — a fila de quem pediu atendimento humano.
 *
 * O chamado é DURÁVEL: ele sobrevive à volta da conversa para o bot e só fecha por gente.
 * Spec, design e tasks:
 * docs/modules/chatbot-whatsapp/changes/2026-09-05-painel-de-escalonamentos-do-suporte/
 *
 * Os textos de compras, acesso, identificação, resumo e reembolso vêm do design §2.6 e são
 * o ponto da tela: "não foi possível consultar" nunca pode virar "sem compra", e "não
 * verificado" nunca pode virar "não declarado" — o segundo afirma algo sobre o cliente.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LifeBuoy, Search, X, RefreshCw, Loader2, History, MessageCircle, Mail, AlertTriangle,
  CheckCircle2, Clock, Undo2, Sparkles, UserCog, Bell, BellOff,
} from 'lucide-react';
import api from '@/services/api';
import AdminGrid from '@/components/ui/AdminGrid';
import Badge, { statusVariant } from '@/components/ui/Badge';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { ComboboxSelect } from '@/components/ui/ComboboxSelect';
import { formatUtcDateTime, formatPhone } from '@/utils/format';
import AgentModal from '@/components/whatsapp/AgentModal';
import HistoryModal from '@/components/whatsapp/HistoryModal';
import { FALLBACK_AGENTS } from '@/components/whatsapp/sessionHelpers';

const PER_PAGE = 20;

const EMPTY_FILTERS = { status: 'abertos', de: '', ate: '', pacote: '', parados: false };

const STATUS_OPTS = [
  { value: 'abertos', label: 'Em aberto (padrão)' },
  { value: 'aberto', label: 'Aberto' },
  { value: 'em_atendimento', label: 'Em atendimento' },
  { value: 'fechado', label: 'Fechado' },
  { value: 'todos', label: 'Todos' },
];

const STATUS_LABEL = {
  aberto: 'Aberto',
  em_atendimento: 'Em atendimento',
  fechado: 'Fechado',
};

const STATUS_VARIANT = { aberto: 'yellow', em_atendimento: 'blue', fechado: 'gray' };

const INP_CLS = 'w-full bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500 placeholder-gray-500';

// ---------------------------------------------------------------------------
// Os textos do design §2.6. Funções puras, num lugar só: a fila e o detalhe mostram a
// MESMA frase para o mesmo dado.
// ---------------------------------------------------------------------------

export function textoCompras(ticket) {
  const status = ticket?.compras_status;
  if (status === 'ok') {
    const pacotes = pacotesDoTicket(ticket);
    return pacotes.length ? pacotes.join(', ') : 'Compra localizada';
  }
  if (status === 'nenhuma') return 'Nenhuma compra localizada';
  // 'erro', null e qualquer outra coisa: NUNCA dizer "sem compra" por uma consulta que falhou.
  return 'Não foi possível consultar as compras';
}

export function textoAcesso(ticket) {
  const valor = ticket?.acesso_entregue;
  if (valor === 1 || valor === true) return 'Acesso entregue';
  if (valor === 0 || valor === false) return 'Acesso não entregue';
  return 'Não foi possível saber';
}

export function textoResumo(ticket) {
  switch (ticket?.resumo_status) {
    case 'ok': return null;                       // os campos do resumo aparecem no lugar
    case 'teto': return 'Resumo indisponível (teto diário)';
    case 'erro': return 'Resumo indisponível (falha, nova tentativa em breve)';
    case 'desistiu': return 'Resumo indisponível (falhou 3 vezes)';
    case 'desligado': return 'Resumo indisponível (desligado)';
    default: return 'Resumo em alguns minutos';
  }
}

export function textoMotivoReembolso(ticket) {
  if (!ticket?.reembolso) return null;
  if (ticket.resumo_motivo_reembolso) return ticket.resumo_motivo_reembolso;
  switch (ticket.reembolso_motivo) {
    case 'KNOWN': return 'motivo na conversa, resumo pendente';
    case 'UNKNOWN': return 'não declarado';
    // UNDECIDED e NULL: não se conseguiu verificar. Dizer "não declarado" aqui afirmaria
    // sobre o cliente uma coisa que ninguém checou.
    default: return 'motivo não verificado';
  }
}

export function pacotesDoTicket(ticket) {
  try {
    const bruto = JSON.parse(ticket?.pacote_json || '[]');
    return (Array.isArray(bruto) ? bruto : [])
      .map((c) => c?.title || c?.TITLE || (c?.id != null ? `#${c.id}` : ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

// Coluna própria de reembolso (EARS-23), substitui o badge único que só distinguia
// solicitado/nada: agora "feito"/"contestado" (confirmados pelo provedor de pagamento,
// EARS-22/22a) prevalecem sobre "solicitado" (interceptado na conversa, EARS-7).
export function estadoReembolso(ticket) {
  if (ticket?.reembolso_confirmado === 'refunded') {
    return { texto: 'Reembolso feito', variant: statusVariant('refunded') };
  }
  if (ticket?.reembolso_confirmado === 'charged_back') {
    return { texto: 'Reembolso contestado', variant: statusVariant('charged_back') };
  }
  if (ticket?.reembolso) {
    return { texto: 'Reembolso solicitado', variant: 'yellow' };
  }
  return null;
}

function labelWhatsApp(ticket) {
  return ticket?.telefone ? formatPhone(ticket.telefone) : 'WhatsApp não localizado';
}

function labelEmail(ticket) {
  return ticket?.email || 'E-mail não localizado';
}

// ---------------------------------------------------------------------------

export default function SupportTickets() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selecionados, setSelecionados] = useState([]);
  const [confirmarLote, setConfirmarLote] = useState(false);
  const [fechandoLote, setFechandoLote] = useState(false);
  const [detalheId, setDetalheId] = useState(null);
  const [pacotes, setPacotes] = useState([]);
  const [resumoCfg, setResumoCfg] = useState(null);

  useEffect(() => {
    api.get('/admin/items?per_page=200')
      .then((res) => setPacotes((res.data?.items || []).map((i) => ({
        value: String(i.id), label: i.title || `#${i.id}`,
      }))))
      .catch(() => {});
    api.get('/admin/wpp/tickets/summary-config')
      .then((res) => setResumoCfg(res.data))
      .catch(() => {});
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) });
      if (applied.status) params.set('status', applied.status);
      if (applied.de) params.set('de', applied.de);
      if (applied.ate) params.set('ate', applied.ate);
      if (applied.pacote) params.set('pacote', applied.pacote);
      if (applied.parados) params.set('parados', '1');
      const res = await api.get(`/admin/wpp/tickets?${params}`);
      setData({ items: res.data?.items || [], total: res.data?.total || 0 });
    } catch {
      setError('Erro ao carregar os chamados.');
    } finally {
      setLoading(false);
    }
  }, [page, applied]);

  useEffect(() => { carregar(); }, [carregar]);

  function aplicar(e) {
    e.preventDefault();
    setPage(1);
    setSelecionados([]);
    setApplied({ ...filters });
  }

  function limpar() {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setSelecionados([]);
    setPage(1);
  }

  function alternar(id) {
    setSelecionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const idsVisiveis = useMemo(() => data.items.map((t) => t.id), [data.items]);
  const todosMarcados = idsVisiveis.length > 0 && idsVisiveis.every((id) => selecionados.includes(id));

  async function fecharSelecionados() {
    setFechandoLote(true);
    setError('');
    try {
      await api.post('/admin/wpp/tickets/close-batch', { ids: selecionados });
      setSelecionados([]);
      setConfirmarLote(false);
      carregar();
    } catch {
      setError('Erro ao fechar os chamados selecionados.');
      setConfirmarLote(false);
    } finally {
      setFechandoLote(false);
    }
  }

  async function salvarResumo(mudanca) {
    const proximo = { ...resumoCfg, ...mudanca };
    setResumoCfg(proximo);
    try {
      const res = await api.post('/admin/wpp/tickets/summary-config', {
        enabled: proximo.enabled, daily_cap: proximo.daily_cap,
      });
      setResumoCfg({ enabled: res.data?.enabled, daily_cap: res.data?.daily_cap });
    } catch {
      setError('Erro ao salvar a configuração do resumo.');
    }
  }

  const columns = [
    {
      key: 'sel',
      label: '',
      className: 'px-4 py-3',
      headerRender: () => (
        <input
          type="checkbox"
          aria-label="Selecionar todos"
          checked={todosMarcados}
          onChange={() => setSelecionados(todosMarcados ? [] : idsVisiveis)}
          className="h-4 w-4 accent-violet-500"
        />
      ),
      render: (row) => (
        <input
          type="checkbox"
          aria-label={`Selecionar chamado ${row.id}`}
          checked={selecionados.includes(row.id)}
          onChange={() => alternar(row.id)}
          className="h-4 w-4 accent-violet-500"
        />
      ),
      csvValue: () => '',
    },
    {
      key: 'aberto_em',
      label: 'Aberto em',
      className: 'px-4 py-3 text-gray-400 whitespace-nowrap',
      render: (row) => formatUtcDateTime(row.aberto_em),
      csvValue: (row) => row.aberto_em ?? '',
    },
    {
      key: 'cliente',
      label: 'Cliente',
      className: 'px-4 py-3 text-gray-300',
      render: (row) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm">
            <MessageCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />
            {row.wa_link
              ? <a href={row.wa_link} target="_blank" rel="noreferrer" className="text-green-400 hover:underline truncate">{labelWhatsApp(row)}</a>
              : <span className={row.telefone ? '' : 'text-gray-500 italic'}>{labelWhatsApp(row)}</span>}
          </div>
          <div className="flex items-center gap-1.5 text-xs mt-0.5">
            <Mail className="h-3 w-3 text-gray-500 shrink-0" />
            <span className={row.email ? 'text-gray-400 truncate' : 'text-gray-500 italic'}>{labelEmail(row)}</span>
          </div>
        </div>
      ),
      csvValue: (row) => `${labelWhatsApp(row)} / ${labelEmail(row)}`,
    },
    {
      key: 'msg_abertura',
      label: 'O que o cliente disse',
      className: 'px-4 py-3 text-gray-300',
      render: (row) => (
        <span className="block max-w-[320px] truncate" title={row.msg_abertura || ''}>
          {row.msg_abertura || <span className="text-gray-500 italic">—</span>}
        </span>
      ),
      csvValue: (row) => row.msg_abertura ?? '',
    },
    {
      key: 'compras_status',
      label: 'Compras',
      className: 'px-4 py-3 text-gray-300 text-xs',
      render: (row) => (
        <span className={row.compras_status === 'ok' ? '' : 'text-gray-400'}>{textoCompras(row)}</span>
      ),
      csvValue: (row) => textoCompras(row),
    },
    {
      key: 'status',
      label: 'Status',
      className: 'px-4 py-3 whitespace-nowrap',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={STATUS_VARIANT[row.status] || 'gray'}>{STATUS_LABEL[row.status] || row.status}</Badge>
          {row.parado ? <Badge variant="red">Parado</Badge> : null}
          {row.cliente_esperando ? <Badge variant="green">Esperando</Badge> : null}
        </div>
      ),
      csvValue: (row) => STATUS_LABEL[row.status] || row.status,
    },
    {
      key: 'reembolso',
      label: 'Reembolso',
      className: 'px-4 py-3 whitespace-nowrap',
      render: (row) => {
        const estado = estadoReembolso(row);
        return estado ? <Badge variant={estado.variant}>{estado.texto}</Badge> : null;
      },
      csvValue: (row) => estadoReembolso(row)?.texto || '',
    },
    {
      key: 'agente_atual',
      label: 'Agora com',
      className: 'px-4 py-3 text-gray-400 text-xs whitespace-nowrap',
      render: (row) => row.agente_atual || 'Roteamento automático',
      csvValue: (row) => row.agente_atual || 'Roteamento automático',
    },
    {
      key: 'acoes',
      label: 'Chamado',
      className: 'px-4 py-3 whitespace-nowrap',
      render: (row) => (
        <button
          type="button"
          onClick={() => setDetalheId(row.id)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-700 hover:bg-violet-600 text-gray-200 text-xs transition-colors"
        >
          <History className="h-3.5 w-3.5" /> Abrir
        </button>
      ),
      csvValue: () => '',
    },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-amber-400" />
            Chamados de suporte
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Quem pediu atendimento humano. O chamado sobrevive à volta da conversa para o bot
            e só fecha por aqui.
          </p>
        </div>
        {resumoCfg && (
          <div className="flex items-center gap-3 bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-2.5">
            <Sparkles className="h-4 w-4 text-violet-400" />
            <label className="inline-flex items-center gap-2 text-xs text-gray-300">
              <input
                type="checkbox"
                aria-label="Resumo automático"
                checked={!!resumoCfg.enabled}
                onChange={(e) => salvarResumo({ enabled: e.target.checked })}
                className="h-4 w-4 accent-violet-500"
              />
              Resumo automático
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-gray-400">
              Teto/dia
              <input
                type="number"
                min="0"
                aria-label="Teto diário do resumo"
                value={resumoCfg.daily_cap ?? 25}
                onChange={(e) => setResumoCfg({ ...resumoCfg, daily_cap: Number(e.target.value) })}
                onBlur={(e) => salvarResumo({ daily_cap: Number(e.target.value) })}
                className="w-16 bg-gray-900 border border-gray-600 text-gray-300 text-xs rounded-lg px-2 py-1"
              />
            </label>
          </div>
        )}
      </div>

      <form onSubmit={aplicar} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Status</span>
            <select
              value={filters.status}
              aria-label="Status"
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className={INP_CLS}
            >
              {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">De</span>
            <input
              type="date"
              aria-label="De"
              value={filters.de}
              onChange={(e) => setFilters((f) => ({ ...f, de: e.target.value }))}
              className={INP_CLS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Até</span>
            <input
              type="date"
              aria-label="Até"
              value={filters.ate}
              onChange={(e) => setFilters((f) => ({ ...f, ate: e.target.value }))}
              className={INP_CLS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Pacote comprado</span>
            <ComboboxSelect
              options={pacotes}
              value={filters.pacote}
              onChange={(v) => setFilters((f) => ({ ...f, pacote: v ? String(v) : '' }))}
              placeholder="Todos os pacotes"
              inputClassName={INP_CLS}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors">
            <Search className="h-4 w-4" /> Buscar
          </button>
          <button type="button" onClick={limpar} className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors">
            <X className="h-4 w-4" /> Limpar
          </button>
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900/60 border border-gray-700 text-xs text-gray-400">
            <input
              type="checkbox"
              aria-label="Só os parados"
              checked={filters.parados}
              onChange={(e) => setFilters((f) => ({ ...f, parados: e.target.checked }))}
              className="h-4 w-4 accent-violet-500"
            />
            Só os parados (48 h sem o cliente)
          </label>
          {selecionados.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmarLote(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" /> Fechar selecionados ({selecionados.length})
            </button>
          )}
        </div>
      </form>

      <AdminGrid
        columns={columns}
        data={data}
        loading={loading}
        error={error}
        emptyMessage="Nenhum chamado encontrado."
        page={page}
        perPage={PER_PAGE}
        onPageChange={setPage}
        sortColumn=""
        sortDirection="asc"
        onSort={() => {}}
        totalLabel="chamado"
        title="Chamados de suporte"
      />

      {confirmarLote && (
        <ConfirmModal
          title="Fechar chamados"
          message={`Fechar ${selecionados.length} chamado(s)? Cada um fica registrado com o seu e-mail e a data.`}
          confirmLabel="Fechar"
          destructive
          loading={fechandoLote}
          onCancel={() => setConfirmarLote(false)}
          onConfirm={fecharSelecionados}
        />
      )}

      {detalheId && (
        <TicketDetail
          ticketId={detalheId}
          onClose={() => setDetalheId(null)}
          onChanged={carregar}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detalhe
// ---------------------------------------------------------------------------

export function TicketDetail({ ticketId, onClose, onChanged }) {
  const [ticket, setTicket] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [agents, setAgents] = useState(FALLBACK_AGENTS);
  const [verConversa, setVerConversa] = useState(false);
  const [trocarAgente, setTrocarAgente] = useState(false);

  useEffect(() => {
    api.get('/admin/wpp/agents')
      .then((res) => {
        const opcoes = res.data?.agents || [];
        if (opcoes.length) setAgents(opcoes);
      })
      .catch(() => {});
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [det, evs] = await Promise.all([
        api.get(`/admin/wpp/tickets/${ticketId}`),
        api.get(`/admin/wpp/tickets/${ticketId}/events`),
      ]);
      setTicket(det.data);
      setEventos(evs.data?.items || []);
    } catch {
      setError('Erro ao carregar o chamado.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function mudarStatus(novo) {
    setOcupado(novo);
    setAviso('');
    try {
      await api.post(`/admin/wpp/tickets/${ticketId}/status`, { status: novo });
      await carregar();
      onChanged?.();
    } catch (err) {
      const corpo = err.response?.data || {};
      if (corpo.erro === 'conflito') {
        setAviso(`Este cliente já tem o chamado #${corpo.aberto_id} aberto — feche-o antes de reabrir este.`);
      } else if (corpo.erro === 'status_mudou') {
        setAviso('Alguém mudou o status enquanto esta tela estava aberta. Recarregue o chamado.');
      } else {
        setAviso('Não foi possível mudar o status.');
      }
    } finally {
      setOcupado('');
    }
  }

  async function atualizarDados() {
    setOcupado('refresh');
    setAviso('');
    try {
      const res = await api.post(`/admin/wpp/tickets/${ticketId}/refresh`);
      setTicket(res.data);
      onChanged?.();
    } catch {
      setAviso('Não foi possível atualizar os dados agora. O que está na tela continua valendo.');
    } finally {
      setOcupado('');
    }
  }

  async function alternarNaoTocar() {
    const proximo = !ticket.nao_tocar;
    setOcupado('nao_tocar');
    setAviso('');
    try {
      // Mesma rota da tela de sessoes (EARS-16): nenhum caminho de escrita proprio. O
      // `ticket_id` diz onde auditar -- neste chamado, mesmo fechado (EARS-16a).
      const res = await api.patch(`/admin/wpp/sessions/${encodeURIComponent(ticket.lid)}/dont-touch`, {
        active: proximo, ticket_id: ticket.id,
      });
      setTicket((t) => ({ ...t, nao_tocar: proximo }));
      if (res.data && res.data.auditoria === false) {
        setAviso('A flag mudou, mas o registro nao entrou no historico deste chamado.');
      } else {
        await carregarEventos();
      }
    } catch {
      setAviso('Nao foi possivel mudar a flag "nao tocar".');
    } finally {
      setOcupado('');
    }
  }

  async function carregarEventos() {
    try {
      const evs = await api.get(`/admin/wpp/tickets/${ticketId}/events`);
      setEventos(evs.data?.items || []);
    } catch {
      /* o historico continua mostrando o que ja estava */
    }
  }

  const resumoIndisponivel = ticket ? textoResumo(ticket) : null;
  const motivo = ticket ? textoMotivoReembolso(ticket) : null;
  const reembolsoTicket = ticket ? estadoReembolso(ticket) : null;
  const sessao = ticket ? { lid: ticket.lid, current_agent: ticket.agente_atual, whatsapp_phone: ticket.telefone } : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-3xl max-h-[90vh] bg-gray-800 rounded-xl shadow-2xl border border-gray-700 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-700 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-amber-400" />
              Chamado #{ticketId}
            </h2>
            {ticket && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <Badge variant={STATUS_VARIANT[ticket.status] || 'gray'}>
                  {STATUS_LABEL[ticket.status] || ticket.status}
                </Badge>
                <span>aberto em {formatUtcDateTime(ticket.aberto_em)}</span>
                {ticket.parado ? <Badge variant="red">Parado</Badge> : null}
                {reembolsoTicket ? <Badge variant={reembolsoTicket.variant}>{reembolsoTicket.texto}</Badge> : null}
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} title="Fechar" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading && (
            <div className="py-12 flex items-center justify-center text-sm text-gray-400 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando chamado...
            </div>
          )}
          {!loading && error && <div className="py-12 text-center text-sm text-red-400">{error}</div>}

          {!loading && !error && ticket && (
            <>
              {aviso && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {aviso}
                </div>
              )}

              <Secao titulo="Quem é">
                <Linha rotulo="WhatsApp">
                  {ticket.wa_link
                    ? <a href={ticket.wa_link} target="_blank" rel="noreferrer" className="text-green-400 hover:underline">{labelWhatsApp(ticket)}</a>
                    : <span className={ticket.telefone ? 'text-gray-300' : 'text-gray-500 italic'}>{labelWhatsApp(ticket)}</span>}
                </Linha>
                <Linha rotulo="E-mail">
                  <span className={ticket.email ? 'text-gray-300' : 'text-gray-500 italic'}>{labelEmail(ticket)}</span>
                </Linha>
                <Linha rotulo="Agora com">{ticket.agente_atual || 'Roteamento automático'}</Linha>
                <Linha rotulo="Não tocar">
                  {ticket.nao_tocar === true ? 'Ligado'
                    : ticket.nao_tocar === false ? 'Desligado'
                      : 'Não foi possível saber'}
                </Linha>
              </Secao>

              <Secao titulo="Compras">
                <Linha rotulo="Situação">{textoCompras(ticket)}</Linha>
                {ticket.compras_busca && (
                  <Linha rotulo="Procurado por">{ticket.compras_busca}</Linha>
                )}
                <Linha rotulo="Acesso">{textoAcesso(ticket)}</Linha>
              </Secao>

              <Secao titulo="O que o cliente disse">
                <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">
                  {ticket.msg_abertura || <span className="text-gray-500 italic">Mensagem de abertura não localizada</span>}
                </p>
              </Secao>

              <Secao titulo="Resumo">
                {resumoIndisponivel
                  ? <p className="text-sm text-gray-500">{resumoIndisponivel}</p>
                  : (
                    <>
                      <Linha rotulo="Problema">{ticket.resumo_problema || '—'}</Linha>
                      <Linha rotulo="Onde">{ticket.resumo_onde || '—'}</Linha>
                    </>
                  )}
                {motivo && <Linha rotulo="Motivo do reembolso">{motivo}</Linha>}
              </Secao>

              {ticket.consultas_erro && (
                <Secao titulo="Consultas ao dono">
                  <p className="text-sm text-gray-500">Não foi possível consultar as pendências.</p>
                </Secao>
              )}
              {!ticket.consultas_erro && (ticket.consultas || []).length > 0 && (
                <Secao titulo="Consultas ao dono pendentes">
                  <ul className="space-y-1.5">
                    {ticket.consultas.map((c) => (
                      <li key={c.id} className="text-sm text-gray-300">
                        <span className="text-gray-500 text-xs mr-2">#{c.id}</span>{c.question}
                      </li>
                    ))}
                  </ul>
                </Secao>
              )}

              <Secao titulo="Histórico">
                <ul className="space-y-1.5">
                  {eventos.map((e) => (
                    <li key={e.id} className="text-xs text-gray-400 flex flex-wrap gap-x-2">
                      <span className="text-gray-500">{formatUtcDateTime(e.criado_em)}</span>
                      <span className="text-gray-200">{e.tipo}</span>
                      {e.de || e.para ? <span>{e.de || '—'} → {e.para || '—'}</span> : null}
                      <span className="text-gray-500">por {e.autor}</span>
                    </li>
                  ))}
                  {eventos.length === 0 && <li className="text-xs text-gray-500">Sem eventos.</li>}
                </ul>
              </Secao>
            </>
          )}
        </div>

        {!loading && !error && ticket && (
          <div className="px-5 py-3 border-t border-gray-700 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={atualizarDados}
              disabled={!!ocupado}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors disabled:opacity-60"
            >
              {ocupado === 'refresh' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Atualizar dados
            </button>
            <button
              type="button"
              onClick={() => setVerConversa(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
            >
              <History className="h-3.5 w-3.5" /> Ver conversa
            </button>
            <button
              type="button"
              onClick={() => setTrocarAgente(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
            >
              <UserCog className="h-3.5 w-3.5" /> Trocar agente
            </button>
            <button
              type="button"
              onClick={alternarNaoTocar}
              disabled={!!ocupado}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-60 ${
                ticket.nao_tocar === true ? 'bg-red-600/80 hover:bg-red-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {ocupado === 'nao_tocar'
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : ticket.nao_tocar === true ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
              {ticket.nao_tocar === true ? 'Nao tocar: ligado' : 'Nao tocar'}
            </button>
            <span className="text-[11px] text-gray-500">
              retrato de {formatUtcDateTime(ticket.enriquecido_em)}
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              {ticket.status !== 'em_atendimento' && ticket.status !== 'fechado' && (
                <BotaoStatus onClick={() => mudarStatus('em_atendimento')} ocupado={ocupado === 'em_atendimento'} icone={Clock}>
                  Em atendimento
                </BotaoStatus>
              )}
              {ticket.status === 'fechado' ? (
                <BotaoStatus onClick={() => mudarStatus('aberto')} ocupado={ocupado === 'aberto'} icone={Undo2}>
                  Reabrir
                </BotaoStatus>
              ) : (
                <BotaoStatus onClick={() => mudarStatus('fechado')} ocupado={ocupado === 'fechado'} icone={CheckCircle2} destaque>
                  Fechar chamado
                </BotaoStatus>
              )}
            </div>
          </div>
        )}
      </div>

      {verConversa && sessao && (
        <HistoryModal
          session={sessao}
          agents={agents}
          anonymizeExport
          onClose={() => setVerConversa(false)}
        />
      )}
      {trocarAgente && sessao && (
        <AgentModal
          session={sessao}
          agents={agents}
          ticketId={ticket.id}
          onClose={() => setTrocarAgente(false)}
          onSaved={(_lid, agente) => {
            setTicket((t) => ({ ...t, agente_atual: agente }));
            carregarEventos();
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}

function BotaoStatus({ onClick, ocupado, icone: Icone, destaque, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={ocupado}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-60 ${
        destaque ? 'bg-violet-600 hover:bg-violet-500 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
      }`}
    >
      {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icone className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

function Secao({ titulo, children }) {
  return (
    <section className="bg-gray-900/40 border border-gray-700/60 rounded-lg px-4 py-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{titulo}</h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Linha({ rotulo, children }) {
  return (
    <div className="flex flex-wrap gap-x-2 text-sm">
      <span className="text-gray-500 min-w-[130px]">{rotulo}</span>
      <span className="text-gray-300 break-words">{children}</span>
    </div>
  );
}
