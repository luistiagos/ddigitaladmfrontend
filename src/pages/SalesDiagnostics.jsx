import { useState, useEffect, useRef, useCallback } from 'react';
import {
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Clock,
  Settings,
  RefreshCw,
  Calendar,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  XCircle,
  Info,
  DollarSign,
  ShoppingCart,
  Users,
  Bot,
  Layers,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import api from '@/services/api';
import { formatCurrency, formatUtcDateTime, todayISO } from '@/utils/format';

const BLOCK_NAMES = [
  'magnitude',
  'funnel',
  'hours',
  'cohorts',
  'origin-ticket',
  'ads',
  'agent-health',
  'summary',
];

export default function SalesDiagnostics() {
  const [stores, setStores] = useState([]);
  
  // Filtros
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 5);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => todayISO());
  const [storeId, setStoreId] = useState('all');
  const [filterError, setFilterError] = useState('');

  // Contexto ativo
  const [contextData, setContextData] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState('');
  const activeContextIdRef = useRef(null);

  // Estados dos blocos
  const [blocksData, setBlocksData] = useState({});
  const [blocksLoading, setBlocksLoading] = useState({});

  // Rate limit / Refresh do Meta Ads
  const [adsRefreshing, setAdsRefreshing] = useState(false);
  const [adsCooldown, setAdsCooldown] = useState(0);

  // Modal de Faixa Comercial
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [commercialHours, setCommercialHours] = useState({ start_hour: 9, end_hour: 21, version: 1 });
  const [modalStartHour, setModalStartHour] = useState(9);
  const [modalEndHour, setModalEndHour] = useState(21);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Carrega lojas para o select
  useEffect(() => {
    api.get('/admin/stores')
      .then((res) => setStores(res.data?.stores || []))
      .catch(() => {});
  }, []);

  // Timer para countdown do Meta Ads
  useEffect(() => {
    if (adsCooldown <= 0) return;
    const t = setInterval(() => {
      setAdsCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [adsCooldown]);

  // Validacao local de janela
  const validateWindow = (s, e) => {
    if (!s || !e) return 'Datas de início e fim são obrigatórias.';
    const dStart = new Date(`${s}T00:00:00`);
    const dEnd = new Date(`${e}T00:00:00`);
    if (dStart > dEnd) return 'Data inicial deve ser menor ou igual à data final.';
    const diffDays = Math.round((dEnd - dStart) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays < 1 || diffDays > 31) {
      return `Janela de consulta deve ter entre 1 e 31 dias (selecionado: ${diffDays} dias).`;
    }
    return '';
  };

  // Carrega todos os blocos em paralelo com isolamento
  const loadBlocksForContext = useCallback((ctxId) => {
    const initialLoading = {};
    BLOCK_NAMES.forEach((b) => {
      initialLoading[b] = true;
    });
    setBlocksLoading(initialLoading);

    BLOCK_NAMES.forEach(async (blockName) => {
      try {
        const res = await api.get(`/admin/sales-diagnostics/blocks/${blockName}`, {
          params: { context_id: ctxId },
        });

        // EARS-28: Ignora resposta caso o contexto ja tenha mudado
        if (activeContextIdRef.current !== ctxId) return;

        setBlocksData((prev) => ({ ...prev, [blockName]: res.data }));
      } catch (err) {
        if (activeContextIdRef.current !== ctxId) return;
        setBlocksData((prev) => ({
          ...prev,
          [blockName]: {
            block: blockName,
            availability: 'unavailable',
            limitations: [err.response?.data?.error || `Falha na comunicação ao carregar bloco ${blockName}.`],
          },
        }));
      } finally {
        if (activeContextIdRef.current === ctxId) {
          setBlocksLoading((prev) => ({ ...prev, [blockName]: false }));
        }
      }
    });
  }, []);

  // Solicita novo contexto e dispara blocos
  const fetchDiagnostics = useCallback(async (s = startDate, e = endDate, st = storeId) => {
    const err = validateWindow(s, e);
    if (err) {
      setFilterError(err);
      return;
    }
    setFilterError('');
    setContextLoading(true);
    setContextError('');

    try {
      const params = { start_date: s, end_date: e };
      if (st && st !== 'all') params.store_id = st;

      const res = await api.get('/admin/sales-diagnostics/context', { params });
      const ctx = res.data;
      const ctxId = ctx.context_id;

      activeContextIdRef.current = ctxId;
      setContextData(ctx);
      if (ctx.commercial_hours) {
        setCommercialHours(ctx.commercial_hours);
      }

      loadBlocksForContext(ctxId);
    } catch (err) {
      setContextError(err.response?.data?.error || 'Erro ao inicializar contexto de diagnóstico.');
    } finally {
      setContextLoading(false);
    }
  }, [startDate, endDate, storeId, loadBlocksForContext]);

  // Carga inicial
  useEffect(() => {
    fetchDiagnostics();
  }, [fetchDiagnostics]);

  // Presets de data
  const handlePreset = (days) => {
    const end = todayISO();
    const d = new Date();
    d.setDate(d.getDate() - (days - 1));
    const start = d.toISOString().slice(0, 10);
    setStartDate(start);
    setEndDate(end);
    fetchDiagnostics(start, end, storeId);
  };

  // Forca atualizacao de Meta Ads
  const handleRefreshAds = async () => {
    if (!contextData?.context_id || adsCooldown > 0) return;
    setAdsRefreshing(true);
    try {
      const res = await api.post('/admin/sales-diagnostics/ads/refresh', {
        context_id: contextData.context_id,
      });
      setBlocksData((prev) => ({ ...prev, ads: res.data }));
    } catch (err) {
      if (err.response?.status === 429) {
        const retryAfter = parseInt(err.response.headers?.['retry-after'] || '30', 10);
        setAdsCooldown(retryAfter);
      }
      if (err.response?.data) {
        setBlocksData((prev) => ({ ...prev, ads: err.response.data }));
      }
    } finally {
      setAdsRefreshing(false);
    }
  };

  // Abrir modal de configuracao de faixa
  const handleOpenHoursModal = async () => {
    setModalError('');
    setShowHoursModal(true);
    try {
      const res = await api.get('/admin/sales-diagnostics/settings');
      setCommercialHours(res.data);
      setModalStartHour(res.data.start_hour ?? 9);
      setModalEndHour(res.data.end_hour ?? 21);
    } catch (err) {
      setModalError('Não foi possível carregar a faixa atual.');
    }
  };

  // Salvar nova faixa comercial (com optimistic CAS)
  const handleSaveHours = async () => {
    if (modalStartHour >= modalEndHour) {
      setModalError('A hora inicial deve ser estritamente menor que a hora final.');
      return;
    }
    if (modalStartHour < 0 || modalEndHour > 24) {
      setModalError('Horas devem estar no intervalo de 0 a 24.');
      return;
    }
    setModalSaving(true);
    setModalError('');

    try {
      const res = await api.put('/admin/sales-diagnostics/settings', {
        start_hour: modalStartHour,
        end_hour: modalEndHour,
        version: commercialHours.version,
      });
      setCommercialHours(res.data);
      setShowHoursModal(false);
      // Recarrega o diagnostico com a nova faixa global
      fetchDiagnostics();
    } catch (err) {
      if (err.response?.status === 409) {
        setModalError('A configuração foi alterada por outro usuário em concorrência. Recarregando versão mais recente...');
        try {
          const fresh = await api.get('/admin/sales-diagnostics/settings');
          setCommercialHours(fresh.data);
          setModalStartHour(fresh.data.start_hour ?? 9);
          setModalEndHour(fresh.data.end_hour ?? 21);
        } catch { /* ignore */ }
      } else {
        setModalError(err.response?.data?.error || 'Erro ao salvar horário comercial.');
      }
    } finally {
      setModalSaving(false);
    }
  };

  const sumCounts = (obj) => {
    if (obj == null) return 0;
    if (typeof obj === 'number') return obj;
    if (typeof obj === 'object') {
      return Object.values(obj).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
    }
    return 0;
  };

  const magBlock = blocksData.magnitude || {};
  const magData = magBlock.data || {};

  const funnelBlock = blocksData.funnel || {};
  const funnelData = funnelBlock.data || {};
  const funnelAtual = funnelData.atual || funnelData;
  const funnelTaxaCartToPur = funnelAtual.taxas_indicativas?.cart_to_purchase_pct;
  const funnelTotalLeads = funnelAtual.funil_leads?.total ?? sumCounts(funnelAtual.eventos);
  const funnelFinalizados = funnelAtual.funil_leads?.finalizado ?? (typeof funnelAtual.eventos?.Purchase === 'number' ? funnelAtual.eventos.Purchase : 0);
  const funnelPendentes = funnelAtual.funil_leads?.pendente ?? (typeof funnelAtual.eventos?.InitiateCheckout === 'number' ? funnelAtual.eventos.InitiateCheckout : 0);
  const funnelTicketMedio = funnelAtual.ticket_medio ?? 0;

  const hoursBlock = blocksData.hours || {};
  const hoursData = hoursBlock.data || {};
  const horasVendasNaFaixa = hoursData.vendas?.na_faixa?.receita ?? hoursData.receita?.dentro_da_faixa ?? 0;
  const horasVendasForaFaixa = hoursData.vendas?.fora_da_faixa?.receita ?? hoursData.receita?.fora_da_faixa ?? 0;
  const horasLeadsNaFaixa = sumCounts(hoursData.leads?.na_faixa ?? hoursData.leads?.dentro_da_faixa);
  const horasLeadsForaFaixa = sumCounts(hoursData.leads?.fora_da_faixa);

  const cohortsBlock = blocksData.cohorts || {};
  const cohortsData = cohortsBlock.data || {};

  const originBlock = blocksData['origin-ticket'] || {};
  const originData = originBlock.data || {};

  const adsBlock = blocksData.ads || {};
  const adsData = adsBlock.data || {};
  const adsMetrics = adsData.metrics || {};
  const adsActivities = adsData.activities || {};

  const adsSpend = adsData.spend ?? adsMetrics.spend ?? 0;
  const adsClicks = adsData.clicks ?? adsMetrics.clicks ?? 0;
  const adsCtr = adsData.ctr ?? adsMetrics.ctr ?? null;
  const adsCpm = adsData.cpm ?? adsMetrics.cpm ?? 0;
  const adsHumanEdits = adsData.human_edits_count ?? adsActivities.humana ?? 0;
  const adsReach = adsData.reach !== undefined ? adsData.reach : adsMetrics.reach;

  const healthBlock = blocksData['agent-health'] || {};
  const healthData = healthBlock.data || {};

  const summaryBlock = blocksData.summary || {};
  const summaryData = summaryBlock.data || {};

  return (
    <div className="space-y-6">
      {/* Cabecalho e Acoes Globais */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
              <TrendingDown className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-100">Diagnóstico de Queda de Vendas</h1>
              <p className="text-xs text-gray-400">
                Auditoria temporal, causal e comportamental comparada contra o mês anterior
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenHoursModal}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition"
          >
            <Clock className="h-3.5 w-3.5 text-blue-400" />
            Faixa Comercial: {String(commercialHours.start_hour).padStart(2, '0')}h às {String(commercialHours.end_hour).padStart(2, '0')}h
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Início</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Fim</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Loja</label>
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 min-w-[150px]"
            >
              <option value="all">Todas as Lojas</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || `Loja #${s.id}`}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => fetchDiagnostics()}
            disabled={contextLoading}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${contextLoading ? 'animate-spin' : ''}`} />
            Consultar
          </button>

          <div className="h-6 w-px bg-gray-800 mx-1 hidden sm:block" />

          {/* Presets rapidos */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handlePreset(7)}
              className="px-2.5 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium transition"
            >
              7 dias
            </button>
            <button
              type="button"
              onClick={() => handlePreset(14)}
              className="px-2.5 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium transition"
            >
              14 dias
            </button>
            <button
              type="button"
              onClick={() => handlePreset(30)}
              className="px-2.5 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium transition"
            >
              30 dias
            </button>
          </div>
        </div>

        {filterError && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{filterError}</span>
          </div>
        )}

        {contextError && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{contextError}</span>
          </div>
        )}

        {contextData?.filters?.is_today_partial && (
          <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-amber-400" />
            <span>Janela inclui o dia corrente incompleto; comparação e detector são preliminares.</span>
          </div>
        )}

        {contextData?.filters?.comparison_window && !contextData.filters.comparison_window.is_available && (
          <div className="text-xs text-gray-300 bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-blue-400" />
            <span>
              Comparação com mês anterior indisponível: {contextData.filters.comparison_window.reason || 'janela não preserva duração no mês anterior.'}
            </span>
          </div>
        )}
      </div>

      {/* Resumo Deterministico (EARS-16) */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-gray-200">Resumo Determinístico</h2>
            <span className="text-[11px] text-gray-400">Classificação factual sem inferências especulativas</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Evidencias de Queda */}
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-red-400">
              <TrendingDown className="h-4 w-4" />
              <span>Evidências de Queda</span>
            </div>
            <ul className="space-y-1.5 text-gray-300">
              {summaryData.evidencias_queda?.length > 0 ? (
                summaryData.evidencias_queda.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-red-400 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))
              ) : (
                <li className="text-gray-500 italic">Nenhuma evidência estatística de queda.</li>
              )}
            </ul>
          </div>

          {/* Resultados Inconclusivos */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-amber-400">
              <HelpCircle className="h-4 w-4" />
              <span>Inconclusivos</span>
            </div>
            <ul className="space-y-1.5 text-gray-300">
              {summaryData.inconclusivos?.length > 0 ? (
                summaryData.inconclusivos.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))
              ) : (
                <li className="text-gray-500 italic">Nenhum resultado inconclusivo.</li>
              )}
            </ul>
          </div>

          {/* Hipoteses Descartadas */}
          <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-green-400">
              <CheckCircle className="h-4 w-4" />
              <span>Hipóteses Descartadas</span>
            </div>
            <ul className="space-y-1.5 text-gray-300">
              {summaryData.descartados?.length > 0 ? (
                summaryData.descartados.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-green-400 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))
              ) : (
                <li className="text-gray-500 italic">Nenhuma hipótese descartada.</li>
              )}
            </ul>
          </div>

          {/* Limitacoes e Lacunas */}
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-blue-400">
              <Info className="h-4 w-4" />
              <span>Limitações e Lacunas</span>
            </div>
            <ul className="space-y-1.5 text-gray-300">
              {summaryData.limitacoes?.length > 0 ? (
                summaryData.limitacoes.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-blue-400 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))
              ) : (
                <li className="text-gray-500 italic">Nenhuma limitação relatada.</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Grid de Blocos Diagnosticos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {/* Bloco 1: Magnitude da Queda */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Magnitude e Receita</span>
              {magBlock.availability === 'unavailable' && (
                <span className="text-[10px] uppercase font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">Indisponível</span>
              )}
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <div className="text-xs text-gray-400">Receita da Janela</div>
                <div className="text-2xl font-black text-gray-100">
                  {formatCurrency(magData.receita_atual ?? 0)}
                </div>
                {magData.variacao_pct != null ? (
                  <div className={`text-xs mt-1 font-semibold flex items-center gap-1 ${magData.variacao_pct < 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {magData.variacao_pct < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                    <span>{magData.variacao_pct}% (R$ {magData.variacao_nominal}) contra mês anterior</span>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 mt-1">Comparação anterior indisponível</div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-800/60 text-xs">
                <div>
                  <span className="text-gray-400">Vendas Aprovadas</span>
                  <div className="text-sm font-semibold text-gray-200 mt-0.5">
                    {magData.pagamentos_atual ?? 0}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Ranking 90 dias</span>
                  <div className="text-sm font-semibold text-gray-200 mt-0.5">
                    {magData.ranking_90d?.rank != null ? (
                      <span>{magData.ranking_90d.rank}º pior ({magData.ranking_90d.total_windows} j.)</span>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </div>
                </div>
              </div>

              {magData.detector?.status === 'inicio_detectado' && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 text-xs text-red-300">
                  <div className="font-semibold text-red-400">Início de Queda Detectado</div>
                  <div className="mt-0.5">Data candidata: {magData.detector.candidate_start_date}</div>
                </div>
              )}
            </div>
          </div>

          {magBlock.limitations?.length > 0 && (
            <div className="mt-3 text-[11px] text-gray-500 border-t border-gray-800/40 pt-2">
              {magBlock.limitations.join(' ')}
            </div>
          )}
        </div>

        {/* Bloco 2: Funil de Conversao */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Funil de Leads & Ticket</span>
              {funnelBlock.availability === 'unavailable' && (
                <span className="text-[10px] uppercase font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">Indisponível</span>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs text-gray-400">Taxa Cart-to-Purchase</div>
                <div className="text-2xl font-black text-gray-100">
                  {funnelTaxaCartToPur != null
                    ? `${funnelTaxaCartToPur}%`
                    : '—'}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Taxa indicativa (população não vinculada)
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-800/60 text-xs">
                <div>
                  <span className="text-gray-400">Total de Leads</span>
                  <div className="text-sm font-semibold text-gray-200 mt-0.5">
                    {funnelTotalLeads}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Finalizados</span>
                  <div className="text-sm font-semibold text-gray-200 mt-0.5">
                    {funnelFinalizados}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Pendentes</span>
                  <div className="text-sm font-semibold text-gray-200 mt-0.5">
                    {funnelPendentes}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Ticket Médio</span>
                  <div className="text-sm font-semibold text-gray-200 mt-0.5">
                    {formatCurrency(funnelTicketMedio)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {funnelBlock.limitations?.length > 0 && (
            <div className="mt-3 text-[11px] text-gray-500 border-t border-gray-800/40 pt-2">
              {funnelBlock.limitations.join(' ')}
            </div>
          )}
        </div>

        {/* Bloco 3: Horario Comercial */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Corte por Faixa Horária</span>
              <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded font-semibold">
                {hoursData.start_hour ?? 9}h às {hoursData.end_hour ?? 21}h BRT
              </span>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <div className="text-xs text-gray-400">Receita Dentro da Faixa</div>
                <div className="text-xl font-bold text-gray-100">
                  {formatCurrency(horasVendasNaFaixa)}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Fora da faixa: {formatCurrency(horasVendasForaFaixa)}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-800/60 text-xs space-y-1">
                <span className="text-gray-400">Leads por Período</span>
                <div className="flex justify-between items-center text-gray-200 mt-1">
                  <span>Dentro da faixa:</span>
                  <span className="font-semibold">{horasLeadsNaFaixa}</span>
                </div>
                <div className="flex justify-between items-center text-gray-400">
                  <span>Fora da faixa:</span>
                  <span className="font-semibold">{horasLeadsForaFaixa}</span>
                </div>
              </div>
            </div>
          </div>

          {hoursBlock.limitations?.length > 0 && (
            <div className="mt-3 text-[11px] text-gray-500 border-t border-gray-800/40 pt-2">
              {hoursBlock.limitations.join(' ')}
            </div>
          )}
        </div>

        {/* Bloco 4: Coortes Bot WhatsApp */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Coorte Bot WhatsApp</span>
              {cohortsBlock.availability === 'unavailable' && (
                <span className="text-[10px] uppercase font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">Indisponível</span>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs text-gray-400">Conversão da Coorte Madura</div>
                <div className="text-2xl font-black text-gray-100">
                  {cohortsData.coorte_atual?.conversao_pct != null ? `${cohortsData.coorte_atual.conversao_pct}%` : '—'}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  População observada: {cohortsData.coorte_atual?.maduros ?? 0} contatos (72h de maturação)
                </div>
              </div>

              {cohortsData.comparacao?.inferencia && (
                <div className="pt-2 border-t border-gray-800/60 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Teste Inferencial:</span>
                    <span className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                      cohortsData.comparacao.inferencia.result === 'evidencia_de_queda'
                        ? 'bg-red-500/10 text-red-400'
                        : cohortsData.comparacao.inferencia.result === 'evidencia_de_aumento'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-amber-500/10 text-amber-300'
                    }`}>
                      {cohortsData.comparacao.inferencia.result}
                    </span>
                  </div>
                  {cohortsData.comparacao.inferencia.diff_pp != null && (
                    <div className="text-gray-400 flex justify-between">
                      <span>Diferença:</span>
                      <span className="text-gray-200">{cohortsData.comparacao.inferencia.diff_pp} p.p. (p={cohortsData.comparacao.inferencia.p_value})</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {cohortsBlock.limitations?.length > 0 && (
            <div className="mt-3 text-[11px] text-gray-500 border-t border-gray-800/40 pt-2">
              {cohortsBlock.limitations.join(' ')}
            </div>
          )}
        </div>

        {/* Bloco 5: Origem e Bumps */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Origem & Order Bumps</span>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs text-gray-400">Identificador Meta (fbc)</div>
                <div className="text-xl font-bold text-gray-100">
                  {originData.origem_anuncio?.taxa_com_identificador_pct != null
                    ? `${originData.origem_anuncio.taxa_com_identificador_pct}%`
                    : '—'}
                </div>
                <div className="text-[11px] text-amber-400/90 mt-1">
                  Presença de identificador Meta (fbc) indica registro do parâmetro, mas não atribui a origem da sessão atual.
                </div>
              </div>

              <div className="pt-2 border-t border-gray-800/60 text-xs">
                <div className="flex justify-between items-center text-gray-300">
                  <span>Anexo de Order Bumps:</span>
                  <span className="font-semibold text-gray-100">
                    {originData.bumps?.taxa_anexo_pct != null ? `${originData.bumps.taxa_anexo_pct}%` : '—'}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  ({originData.bumps?.pedidos_com_bump ?? 0} de {originData.bumps?.total_pedidos ?? 0} pedidos pagos)
                </div>
              </div>
            </div>
          </div>

          {originBlock.limitations?.length > 0 && (
            <div className="mt-3 text-[11px] text-gray-500 border-t border-gray-800/40 pt-2">
              {originBlock.limitations.join(' ')}
            </div>
          )}
        </div>

        {/* Bloco 6: Campanhas Meta Ads */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Meta Ads</span>
                {adsBlock.availability === 'unavailable' && (
                  <span className="text-[10px] uppercase font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                    Indisponível
                  </span>
                )}
                {adsBlock.availability === 'collecting' && (
                  <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded animate-pulse">
                    Coletando...
                  </span>
                )}
                {adsBlock.stale && (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                    Dados em Cache (Desatualizados)
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleRefreshAds}
                disabled={adsRefreshing || adsCooldown > 0}
                className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 disabled:text-gray-600 flex items-center gap-1 transition"
              >
                <RefreshCw className={`h-3 w-3 ${adsRefreshing ? 'animate-spin' : ''}`} />
                {adsCooldown > 0 ? `Aguarde ${adsCooldown}s` : 'Atualizar'}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs text-gray-400">Investimento (Spend)</div>
                <div className="text-2xl font-black text-gray-100">
                  {formatCurrency(adsSpend)}
                </div>
                {adsBlock.collected_at && (
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    Coletado em: {formatUtcDateTime(adsBlock.collected_at)}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-800/60 text-xs">
                <div>
                  <span className="text-gray-400">Cliques</span>
                  <div className="text-sm font-semibold text-gray-200 mt-0.5">
                    {adsClicks}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">CTR</span>
                  <div className="text-sm font-semibold text-gray-200 mt-0.5">
                    {adsCtr != null ? `${adsCtr}%` : '—'}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">CPM</span>
                  <div className="text-sm font-semibold text-gray-200 mt-0.5">
                    {formatCurrency(adsCpm)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Alterações Humanas</span>
                  <div className="text-sm font-semibold text-gray-200 mt-0.5">
                    {adsHumanEdits}
                  </div>
                </div>
              </div>

              {adsReach === null && (
                <div className="text-[11px] text-gray-500 pt-1 border-t border-gray-800/40">
                  Alcance não é aditivo entre contas ou campanhas distintas.
                </div>
              )}
            </div>
          </div>

          {adsBlock.limitations?.length > 0 && (
            <div className="mt-3 text-[11px] text-gray-500 border-t border-gray-800/40 pt-2">
              {adsBlock.limitations.join(' ')}
            </div>
          )}
        </div>

        {/* Bloco 7: Saude do Agente */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Saúde do Agente de Vendas</span>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs text-gray-400">Taxa de Truncamento</div>
                <div className="text-2xl font-black text-gray-100">
                  {healthData.truncamento_pct != null ? `${healthData.truncamento_pct}%` : '0.0%'}
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  Taxa de Fallback: <span className="font-semibold text-gray-200">{healthData.fallback_pct != null ? `${healthData.fallback_pct}%` : '0.0%'}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-800/60 text-xs text-gray-500">
                Métricas restritas ao agente de pré-venda (vendas). Não inclui agentes de pós-venda ou suporte.
              </div>
            </div>
          </div>

          {healthBlock.limitations?.length > 0 && (
            <div className="mt-3 text-[11px] text-gray-500 border-t border-gray-800/40 pt-2">
              {healthBlock.limitations.join(' ')}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Configuracao de Faixa Comercial (P2) */}
      {showHoursModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-400" />
                <h3 className="text-sm font-bold text-gray-100">Configurar Horário Comercial</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHoursModal(false)}
                className="text-gray-400 hover:text-gray-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-gray-400">
                Esta faixa define a janela em horário de Brasília (BRT) para a segmentação analítica de vendas e leads no diagnóstico.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-gray-300 font-medium mb-1">Hora de Início (0-23)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={modalStartHour}
                    onChange={(e) => setModalStartHour(parseInt(e.target.value, 10))}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-medium mb-1">Hora de Fim (1-24)</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={modalEndHour}
                    onChange={(e) => setModalEndHour(parseInt(e.target.value, 10))}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {modalError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 text-xs text-red-400 flex items-start gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setShowHoursModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveHours}
                disabled={modalSaving}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50 transition"
              >
                {modalSaving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
