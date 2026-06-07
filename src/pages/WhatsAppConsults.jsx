import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MessageSquareQuote, RefreshCw, Send } from 'lucide-react';
import api from '@/services/api';
import Pagination from '@/components/ui/Pagination';
import { EmptyRow, ErrorRow, LoadingRows } from '@/components/ui/TableStates';
import { formatDateTime } from '@/utils/format';

const PER_PAGE = 20;
const INP_CLS = 'w-full bg-gray-900 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500 placeholder-gray-500';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Não respondidas' },
  { value: 'answered', label: 'Respondidas' },
];

function statusBadge(status) {
  if (status === 'pending') return 'bg-amber-500/20 text-amber-300 border border-amber-500/40';
  if (status === 'answered') return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
  return 'bg-gray-700 text-gray-200 border border-gray-600';
}

function statusLabel(status) {
  if (status === 'pending') return 'Não respondida';
  if (status === 'answered') return 'Respondida';
  return status || '—';
}

export default function WhatsAppConsults() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [agentOptions, setAgentOptions] = useState([]);
  const [status, setStatus] = useState('pending');
  const [agentName, setAgentName] = useState('');
  const [search, setSearch] = useState('');

  const [answering, setAnswering] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    api.get('/admin/wpp/agents')
      .then((res) => {
        const options = (res.data?.agents || []).filter((a) => a.value);
        setAgentOptions(options);
      })
      .catch(() => {});
  }, []);

  const loadConsults = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(PER_PAGE),
        status,
      });
      if (agentName) params.set('agent_name', agentName);
      if (search.trim()) params.set('search', search.trim());

      const res = await api.get(`/admin/wpp/consults?${params.toString()}`);
      setRows(res.data?.items || []);
      setTotal(Number(res.data?.total || 0));
    } catch {
      setError('Erro ao carregar consultas do WhatsApp.');
    } finally {
      setLoading(false);
    }
  }, [page, status, agentName, search]);

  useEffect(() => {
    loadConsults();
  }, [loadConsults]);

  const summary = useMemo(() => {
    const pending = rows.filter((r) => r.status === 'pending').length;
    const answered = rows.filter((r) => r.status === 'answered').length;
    return { pending, answered };
  }, [rows]);

  function openAnswerModal(row) {
    setAnswering(row);
    setAnswerText(row.owner_response || '');
    setSaveError('');
  }

  function closeAnswerModal() {
    if (saving) return;
    setAnswering(null);
    setAnswerText('');
    setSaveError('');
  }

  async function submitAnswer(e) {
    e.preventDefault();
    if (!answering) return;
    if (!answerText.trim()) {
      setSaveError('Digite uma resposta para continuar.');
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      await api.post(`/admin/wpp/consults/${answering.id}/answer`, {
        answer: answerText.trim(),
      });
      closeAnswerModal();
      await loadConsults();
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Falha ao salvar resposta.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Consultas dos Agents</h1>
          <p className="text-sm text-gray-400">
            Salve respostas revisadas para alimentar a base de conhecimento dos agents.
          </p>
        </div>
        <button
          type="button"
          onClick={loadConsults}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-100 text-sm"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-wide text-gray-500">Status</span>
          <select
            className={INP_CLS}
            value={status}
            onChange={(e) => { setPage(1); setStatus(e.target.value); }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs uppercase tracking-wide text-gray-500">Agent</span>
          <select
            className={INP_CLS}
            value={agentName}
            onChange={(e) => { setPage(1); setAgentName(e.target.value); }}
          >
            <option value="">Todos</option>
            {agentOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1 md:col-span-2">
          <span className="text-xs uppercase tracking-wide text-gray-500">Busca</span>
          <input
            className={INP_CLS}
            placeholder="Pergunta, resposta, jid..."
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          />
        </label>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span>Total da página: {rows.length}</span>
        <span>Não respondidas: {summary.pending}</span>
        <span>Respondidas: {summary.answered}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900/40">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-800">
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Agent</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Pergunta</th>
              <th className="px-4 py-3">Resposta</th>
              <th className="px-4 py-3">Criada em</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && <LoadingRows cols={7} rows={8} />}
            {!loading && error && <ErrorRow cols={7} message={error} onRetry={loadConsults} />}
            {!loading && !error && rows.length === 0 && <EmptyRow cols={7} message="Nenhuma consulta encontrada." />}

            {!loading && !error && rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-800 align-top">
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusBadge(row.status)}`}>
                    {statusLabel(row.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-300">{row.agent_name || '—'}</td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{row.client_jid || '—'}</td>
                <td className="px-4 py-3 text-gray-200 max-w-95">
                  <p className="line-clamp-4 whitespace-pre-wrap">{row.question || '—'}</p>
                </td>
                <td className="px-4 py-3 text-gray-300 max-w-95">
                  <p className="line-clamp-4 whitespace-pre-wrap">{row.owner_response || '—'}</p>
                </td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDateTime(row.created_at)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => openAnswerModal(row)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs"
                  >
                    <MessageSquareQuote className="h-3.5 w-3.5" />
                    {row.status === 'answered' ? 'Editar' : 'Adicionar resposta'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} perPage={PER_PAGE} total={total} onChange={setPage} />

      {answering && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">
                {answering.status === 'answered' ? 'Editar conhecimento' : 'Salvar conhecimento'} #{answering.id}
              </h2>
              <p className="text-sm text-gray-400 mt-1 whitespace-pre-wrap">{answering.question}</p>
            </div>

            <form onSubmit={submitAnswer} className="p-5 space-y-4">
              <label className="block space-y-1">
                <span className="text-xs uppercase tracking-wide text-gray-500">Conhecimento validado</span>
                <textarea
                  className={`${INP_CLS} min-h-32.5`}
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Digite a resposta que os agents devem usar como conhecimento confirmado..."
                  disabled={saving}
                />
              </label>

              {saveError ? <p className="text-sm text-red-400">{saveError}</p> : null}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeAnswerModal}
                  className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm disabled:opacity-60"
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {answering.status === 'answered' ? 'Atualizar conhecimento' : 'Salvar conhecimento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
