import { useState, useEffect, useCallback } from 'react';
import { Search, X, History, UserCog, Loader2, MessageCircle, Download } from 'lucide-react';
import api from '@/services/api';
import AdminGrid from '@/components/ui/AdminGrid';
import { PhoneCell } from '@/components/ui/ContactCell';
import useAdminGrid from '@/utils/useAdminGrid';
import { formatDateTime } from '@/utils/format';

const PER_PAGE = 20;

const EMPTY_FILTERS = {
  lid: '',
  phone: '',
  start_datetime: '',
  end_datetime: '',
};

const FALLBACK_AGENTS = [
  { value: '', label: 'Sem agente' },
  { value: 'ROUTER_AGENT', label: 'Roteador' },
  { value: 'MULTIGAMES_AGENT', label: 'Multigames' },
  { value: 'XBOX360_AGENT', label: 'Xbox 360' },
  { value: 'PS2_AGENT', label: 'PlayStation 2' },
  { value: 'HUMAN_PENDING', label: 'Suporte pendente' },
  { value: 'HUMAN_AGENT', label: 'Atendimento humano' },
  { value: 'OWNER_CONSULT', label: 'Consulta ao dono' },
];

const INP_CLS = 'w-full bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500 placeholder-gray-500';

function getAgentLabel(agents, value) {
  if (!value) return 'Sem agente';
  return agents.find((agent) => agent.value === value)?.label || value;
}

function getSessionKey(session) {
  return session?.lid || session?.main_phone || session?.phone_jid || '';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function downloadJson(payload, filename) {
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8;',
  }), filename);
}

function exportFilename(prefix, extension = 'json') {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `${prefix}_${stamp}.${extension}`;
}

export default function WhatsAppSessions() {
  const [agents, setAgents] = useState(FALLBACK_AGENTS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [anonymizeExport, setAnonymizeExport] = useState(true);
  const [historySession, setHistorySession] = useState(null);
  const [agentSession, setAgentSession] = useState(null);

  const { page, setPage, sortColumn, sortDirection, handleSort } =
    useAdminGrid({ defaultSort: 'last_dttime', defaultDir: 'desc' });

  useEffect(() => {
    api.get('/admin/wpp/agents')
      .then((res) => {
        const options = res.data?.agents || [];
        if (options.length) setAgents(options);
      })
      .catch(() => {});
  }, []);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page,
        per_page: PER_PAGE,
        sort_column: sortColumn,
        sort_direction: sortDirection,
      });
      if (applied.lid) params.set('lid', applied.lid);
      if (applied.phone) params.set('phone', applied.phone.replace(/\D/g, ''));
      if (applied.start_datetime) params.set('start_datetime', applied.start_datetime);
      if (applied.end_datetime) params.set('end_datetime', applied.end_datetime);

      const res = await api.get(`/admin/wpp/sessions?${params}`);
      setData({ items: res.data.items || [], total: res.data.total || 0 });
    } catch {
      setError('Erro ao carregar sessões do WhatsApp.');
    } finally {
      setLoading(false);
    }
  }, [page, applied, sortColumn, sortDirection]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  function applyFilters(e) {
    e.preventDefault();
    setPage(1);
    setApplied({ ...filters });
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  }

  function buildExportParams() {
    const params = new URLSearchParams({
      anonymize: anonymizeExport ? '1' : '0',
      batch_size: '200',
      message_limit: '5000',
      sort_column: sortColumn,
      sort_direction: sortDirection,
    });
    if (filters.lid) params.set('lid', filters.lid);
    if (filters.phone) params.set('phone', filters.phone.replace(/\D/g, ''));
    if (filters.start_datetime) params.set('start_datetime', filters.start_datetime);
    if (filters.end_datetime) params.set('end_datetime', filters.end_datetime);
    return params;
  }

  async function exportCurrentSessions() {
    setExporting(true);
    setExportError('');
    try {
      // Pega um token curto e deixa o NAVEGADOR baixar nativamente (Content-Disposition).
      // Download via XHR/blob falha em iOS Safari e pode ser bloqueado por extensoes/proxy.
      const { data } = await api.get('/admin/wpp/sessions/export-token');
      const token = data?.token;
      if (!token) throw new Error('Token de download ausente');
      const base = api.defaults.baseURL || '';
      const url = `${base}/admin/wpp/sessions/export.zip?${buildExportParams()}&token=${encodeURIComponent(token)}`;
      window.location.href = url;
    } catch (err) {
      setExportError(err.response?.data?.error || 'Erro ao exportar ZIP.');
    } finally {
      setExporting(false);
    }
  }

  function handleAgentSaved(lid, currentAgent) {
    setData((prev) => ({
      ...prev,
      items: prev.items.map((item) => (
        getSessionKey(item) === lid ? { ...item, current_agent: currentAgent } : item
      )),
    }));
    fetchSessions();
  }

  const columns = [
    {
      key: 'last_dttime',
      label: 'Horário',
      sortable: true,
      className: 'px-4 py-3 text-gray-400 whitespace-nowrap',
      render: (row) => formatDateTime(row.last_dttime),
      csvValue: (row) => row.last_dttime ?? '',
    },
    {
      key: 'lid',
      label: 'LID',
      sortable: true,
      className: 'px-4 py-3 text-gray-300',
      render: (row) => (
        <span className="block max-w-[220px] truncate font-mono text-xs" title={row.lid || ''}>
          {row.lid || '—'}
        </span>
      ),
      csvValue: (row) => row.lid ?? '',
    },
    {
      key: 'whatsapp_phone',
      label: 'WhatsApp',
      sortable: true,
      fullCell: true,
      render: (row) => <PhoneCell phone={row.whatsapp_phone} />,
      csvValue: (row) => row.whatsapp_phone ?? '',
    },
    {
      key: 'current_agent',
      label: 'Agent',
      sortable: true,
      className: 'px-4 py-3 text-gray-300',
      render: (row) => (
        <button
          type="button"
          onClick={() => setAgentSession(row)}
          title="Trocar agent"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-700 hover:bg-violet-600 text-gray-200 text-xs transition-colors"
        >
          <UserCog className="h-3.5 w-3.5" />
          {getAgentLabel(agents, row.current_agent)}
        </button>
      ),
      csvValue: (row) => getAgentLabel(agents, row.current_agent),
    },
    {
      key: 'actions',
      label: 'Histórico',
      className: 'px-4 py-3 whitespace-nowrap',
      render: (row) => (
        <button
          type="button"
          onClick={() => setHistorySession(row)}
          title="Ver histórico"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
        >
          <History className="h-3.5 w-3.5" />
          Histórico
        </button>
      ),
      csvValue: () => '',
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-green-400" />
          Sessões WhatsApp
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Conversas atendidas pelo bot e pelos agents
          {data.total > 0 && !loading && (
            <span className="ml-2 text-gray-500">({data.total.toLocaleString('pt-BR')} sessões)</span>
          )}
        </p>
      </div>

      <form onSubmit={applyFilters} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="LID">
            <input
              type="text"
              value={filters.lid}
              onChange={(e) => setFilters((f) => ({ ...f, lid: e.target.value }))}
              placeholder="5511999999999@lid"
              className={INP_CLS}
            />
          </Field>
          <Field label="WhatsApp">
            <input
              type="tel"
              value={filters.phone}
              onChange={(e) => setFilters((f) => ({ ...f, phone: e.target.value }))}
              placeholder="5511999999999"
              className={INP_CLS}
            />
          </Field>
          <Field label="De">
            <input
              type="datetime-local"
              value={filters.start_datetime}
              onChange={(e) => setFilters((f) => ({ ...f, start_datetime: e.target.value }))}
              className={INP_CLS}
            />
          </Field>
          <Field label="Até">
            <input
              type="datetime-local"
              value={filters.end_datetime}
              onChange={(e) => setFilters((f) => ({ ...f, end_datetime: e.target.value }))}
              className={INP_CLS}
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors"
          >
            <Search className="h-4 w-4" /> Buscar
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
          >
            <X className="h-4 w-4" /> Limpar
          </button>
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900/60 border border-gray-700 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={anonymizeExport}
              onChange={(e) => setAnonymizeExport(e.target.checked)}
              className="h-4 w-4 accent-violet-500"
            />
            Anonimizar JSON
          </label>
          <button
            type="button"
            onClick={exportCurrentSessions}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors disabled:opacity-60"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? 'Exportando...' : 'Exportar ZIP'}
          </button>
        </div>
        {exportError && <p className="text-sm text-red-400 mt-3">{exportError}</p>}
      </form>

      <AdminGrid
        columns={columns}
        data={data}
        loading={loading}
        error={error}
        emptyMessage="Nenhuma sessão do WhatsApp encontrada."
        page={page}
        perPage={PER_PAGE}
        onPageChange={setPage}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        totalLabel="sessão"
        title="Sessões WhatsApp"
      />

      {historySession && (
        <HistoryModal
          session={historySession}
          agents={agents}
          anonymizeExport={anonymizeExport}
          onClose={() => setHistorySession(null)}
        />
      )}
      {agentSession && (
        <AgentModal
          session={agentSession}
          agents={agents}
          onClose={() => setAgentSession(null)}
          onSaved={handleAgentSaved}
        />
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function AgentModal({ session, agents, onClose, onSaved }) {
  const lid = getSessionKey(session);
  const [selectedAgent, setSelectedAgent] = useState(session.current_agent || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function saveAgent() {
    setSaving(true);
    setError('');
    try {
      const res = await api.patch(`/admin/wpp/sessions/${encodeURIComponent(lid)}/agent`, {
        agent_name: selectedAgent,
      });
      onSaved(lid, res.data.current_agent || null);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao trocar agent.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl border border-gray-700 p-6">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <UserCog className="h-4 w-4 text-violet-400" />
            Trocar agent
          </h2>
          <p className="text-xs text-gray-500 mt-1 truncate" title={lid}>{lid}</p>
        </div>

        <label className="block text-xs font-medium text-gray-400 mb-1.5">Agent</label>
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="w-full bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
        >
          {agents.map((agent) => (
            <option key={agent.value || 'none'} value={agent.value}>{agent.label}</option>
          ))}
        </select>

        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={saveAgent}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryModal({ session, agents, anonymizeExport, onClose }) {
  const lid = getSessionKey(session);
  const [messages, setMessages] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api.get(`/admin/wpp/sessions/${encodeURIComponent(lid)}/messages?limit=5000`)
      .then((res) => {
        if (!alive) return;
        setMessages(res.data.items || []);
        setTotal(res.data.total || 0);
      })
      .catch(() => {
        if (alive) setError('Erro ao carregar histórico.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [lid]);

  async function exportSession() {
    setExporting(true);
    setExportError('');
    try {
      const params = new URLSearchParams({
        anonymize: anonymizeExport ? '1' : '0',
        message_limit: '5000',
      });
      const res = await api.get(`/admin/wpp/sessions/${encodeURIComponent(lid)}/export?${params}`);
      downloadJson(res.data, exportFilename('whatsapp_conversa'));
    } catch (err) {
      setExportError(err.response?.data?.error || 'Erro ao exportar conversa.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-3xl max-h-[90vh] bg-gray-800 rounded-xl shadow-2xl border border-gray-700 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-700 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <History className="h-4 w-4 text-green-400" />
              Histórico da conversa
            </h2>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
              <span className="font-mono truncate max-w-[260px]" title={lid}>{lid}</span>
              <span>{session.whatsapp_phone || 'sem telefone'}</span>
              <span>{getAgentLabel(agents, session.current_agent)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportSession}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors disabled:opacity-60"
              title="Exportar conversa em JSON"
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              JSON
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
              title="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {exportError && (
          <div className="px-5 py-2 border-b border-gray-700 text-sm text-red-400">
            {exportError}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 bg-gray-900/40">
          {loading && (
            <div className="py-12 flex items-center justify-center text-sm text-gray-400 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando histórico...
            </div>
          )}
          {!loading && error && (
            <div className="py-12 text-center text-sm text-red-400">{error}</div>
          )}
          {!loading && !error && messages.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-500">Nenhuma mensagem encontrada.</div>
          )}
          {!loading && !error && messages.length > 0 && (
            <div className="space-y-3">
              {messages.map((message) => (
                <MessageBubble key={message.id || message.msg_id} message={message} agents={agents} />
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-700 text-xs text-gray-500">
          {messages.length.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')} mensagens
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, agents }) {
  const role = message.role || '';
  const isCustomer = role === 'customer';
  const isOperator = role === 'user' || role === 'HUMAN_AGENT';
  const alignClass = isCustomer ? 'justify-start' : 'justify-end';
  const bubbleClass = isCustomer
    ? 'bg-gray-800 border-gray-700 text-gray-200'
    : isOperator
      ? 'bg-blue-600/20 border-blue-500/30 text-blue-100'
      : 'bg-green-600/20 border-green-500/30 text-green-100';

  const label = isCustomer
    ? 'Cliente'
    : isOperator
      ? 'Operador'
      : getAgentLabel(agents, role);

  return (
    <div className={`flex ${alignClass}`}>
      <div className={`max-w-[82%] rounded-lg border px-3 py-2 ${bubbleClass}`}>
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className="text-[11px] font-semibold uppercase text-gray-400">{label}</span>
          <span className="text-[11px] text-gray-500 whitespace-nowrap">{formatDateTime(message.dttime)}</span>
        </div>
        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
          {message.message || '—'}
        </p>
      </div>
    </div>
  );
}
