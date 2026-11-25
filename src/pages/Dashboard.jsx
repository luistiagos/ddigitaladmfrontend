import { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Clock, TrendingUp, Megaphone, Wallet, Receipt, DollarSign, AlertCircle, Loader2, XCircle, RotateCcw, ShieldAlert, Store, Percent, Layers, BarChart3, Users, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { formatCurrency, formatDate, todayISO } from '@/utils/format';
import { ERRO_LEAD_UNICO, recorteAusente } from '@/utils/leadUnico';

const FINANCIAL_SERIES = [
  { key: 'approved_total', label: 'Total Bruto', color: '#10b981', bgClass: 'bg-emerald-500' },
  { key: 'approved_total_net', label: 'Receita Líquida', color: '#a855f7', bgClass: 'bg-purple-500' },
  { key: 'fb_spend', label: 'Gasto Meta Ads', color: '#3b82f6', bgClass: 'bg-blue-500' },
  { key: 'mp_fees_total', label: 'Taxas MP', color: '#06b6d4', bgClass: 'bg-cyan-500' },
  { key: 'total_expenses', label: 'Total Despesas', color: '#f59e0b', bgClass: 'bg-amber-500' },
  { key: 'lucro_bruto', label: 'Lucro Bruto', color: '#ec4899', bgClass: 'bg-pink-500' },
];

const VOLUME_SERIES = [
  { key: 'approved_count', label: 'Vendas Aprovadas', color: '#10b981', bgClass: 'bg-emerald-500' },
  { key: 'pending_count', label: 'Vendas Pendentes', color: '#eab308', bgClass: 'bg-yellow-500' },
  { key: 'failed_count', label: 'Pagamentos Falhos', color: '#ef4444', bgClass: 'bg-red-500' },
  { key: 'reverted_count', label: 'Revertidos / Estornos', color: '#f97316', bgClass: 'bg-orange-500' },
  { key: 'chargeback_count', label: 'Chargebacks', color: '#f43f5e', bgClass: 'bg-rose-500' },
];

// Aba "Funil de leads" (EARS-8 da change docs/modules/telemetria/changes/2026-11-21-filtro-lead-unico-nos-dashboards/):
// chaves do `time_series` diário de /admin/leads/dashboard-stats. Cada contagem é "parou em" (último
// status da linha; com o filtro, a etapa mais longe da pessoa) e `total` é a soma das cinco etapas.
// `aproximavel`: topo do funil, marcado "(aproximado)" quando o backend diz `topo_aproximado`.
const LEAD_SERIES = [
  { key: 'total', label: 'Entraram na página', color: '#3b82f6', bgClass: 'bg-blue-500', aproximavel: true },
  { key: 'add_to_cart_count', label: 'Pararam em AddToCart', color: '#a855f7', bgClass: 'bg-purple-500', aproximavel: true },
  { key: 'lead_count', label: 'Pararam em Lead (contato)', color: '#eab308', bgClass: 'bg-yellow-500' },
  { key: 'initiate_checkout_count', label: 'Pararam em InitiateCheckout (PIX gerado)', color: '#f97316', bgClass: 'bg-orange-500' },
  { key: 'purchase_count', label: 'Compraram', color: '#10b981', bgClass: 'bg-emerald-500' },
];

// Aba "PIX pago (%)" (T4 da change docs/modules/telemetria/changes/2026-11-24-taxa-de-pix-pago-de-leads-novos/):
// as duas taxas de cada dia de `por_dia`, a MESMA resposta do cartão. `key` aponta o bloco
// `{num, den, pct}` do dia, e não um número: o ponto é o `pct`, e o `pct` nulo não tem ponto.
const PIX_SERIES = [
  { key: 'por_pix', label: 'Pago por PIX', color: '#10b981', bgClass: 'bg-emerald-500' },
  { key: 'por_lead', label: 'Pago por lead', color: '#3b82f6', bgClass: 'bg-blue-500' },
];

const SERIES_POR_ABA = { financial: FINANCIAL_SERIES, volumes: VOLUME_SERIES, leads: LEAD_SERIES, pix: PIX_SERIES };

function todasAsSeries(series) {
  return Object.fromEntries(series.map((s) => [s.key, true]));
}

const PERIOD_PRESETS = [
  { id: 'today', label: 'Hoje' },
  { id: 'yesterday', label: 'Ontem' },
  { id: '7d', label: 'Últimos 7 dias' },
  { id: '30d', label: 'Últimos 30 dias' },
  { id: 'this_month', label: 'Este Mês' },
  { id: 'last_month', label: 'Mês Anterior' },
];

function getPresetDates(preset) {
  const today = new Date();
  const format = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  if (preset === 'today') {
    const s = format(today);
    return { start: s, end: s };
  }
  if (preset === 'yesterday') {
    const yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    const s = format(yest);
    return { start: s, end: s };
  }
  if (preset === '7d') {
    const past = new Date(today);
    past.setDate(past.getDate() - 6);
    return { start: format(past), end: format(today) };
  }
  if (preset === '30d') {
    const past = new Date(today);
    past.setDate(past.getDate() - 29);
    return { start: format(past), end: format(today) };
  }
  if (preset === 'this_month') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: format(first), end: format(today) };
  }
  if (preset === 'last_month') {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { start: format(first), end: format(last) };
  }
  return { start: format(today), end: format(today) };
}

const COLORS = {
  violet: 'text-violet-400 bg-violet-500/10',
  green:  'text-green-400 bg-green-500/10',
  yellow: 'text-yellow-400 bg-yellow-500/10',
  blue:   'text-blue-400 bg-blue-500/10',
  red:    'text-red-400 bg-red-500/10',
  cyan:   'text-cyan-400 bg-cyan-500/10',
  orange: 'text-orange-400 bg-orange-500/10',
  pink:   'text-pink-400 bg-pink-500/10',
};

function KpiCard({ icon, label, value, sub, color = 'violet' }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
        <span className={`p-2 rounded-lg ${COLORS[color] || COLORS.violet}`}>{icon}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 w-24 bg-gray-700 rounded" />
        <div className="h-8 w-8 bg-gray-700 rounded-lg" />
      </div>
      <div className="h-8 w-32 bg-gray-700 rounded" />
      <div className="h-3 w-20 bg-gray-700 rounded mt-2" />
    </div>
  );
}

function NotConfiguredCard({ label }) {
  return (
    <div className="bg-gray-800/40 border border-dashed border-gray-700 rounded-xl p-5 flex flex-col items-center justify-center gap-2 text-center min-h-30">
      <AlertCircle className="h-5 w-5 text-gray-600" />
      <p className="text-xs text-gray-500">{label} não configurado</p>
      <Link
        to="/configuracoes"
        className="text-xs text-violet-400 hover:text-violet-300 transition-colors hover:underline underline-offset-2"
      >
        Configurar →
      </Link>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{children}</h2>
  );
}

// Taxa de PIX pago de leads novos (change docs/modules/telemetria/changes/2026-11-24-taxa-de-pix-pago-de-leads-novos/).
// Mensagem fixa da EARS-16: com o cálculo falho (rota fora, `disponivel: false`, 400), nenhum número.
const ERRO_PIX_LEADS = 'não foi possível calcular a taxa de PIX de leads novos';
const SEM_PIX_CONTADO = 'nenhum PIX de lead novo no período';

const contagem = (n) => Number(n || 0).toLocaleString('pt-BR');
// `pct` vem do backend com 1 casa, ou `null` com den 0, que vira "—" e nunca 0% (EARS-14).
const taxa = (t) => (t?.pct == null ? '—' : `${Number(t.pct).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);

// `por_dia` da porta 1 -> pontos da aba "PIX pago (%)". Rótulo `DD/MM` recortado do texto `AAAA-MM-DD`
// (sem `Date`, sem fuso). Lista ausente ou dia sem bloco vira lista vazia ou dia sem ponto, nunca
// exceção: uma exceção no render derrubaria a tela inteira (EARS-17).
function diasPix(porDia) {
  if (!Array.isArray(porDia)) return [];
  return porDia.map((d) => {
    const dia = String(d?.dia ?? '');
    return { date: dia, label: `${dia.slice(8, 10)}/${dia.slice(5, 7)}`, por_pix: d?.por_pix, por_lead: d?.por_lead };
  });
}

// `estado`: null = carregando; `{erro}`; `{dados}` = resposta da porta 1 do design, já do período e da
// loja atuais. Mostra o `total` (a soma dos dias, para bater com a aba do gráfico).
function PixLeadsNovos({ estado }) {
  if (!estado) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SkeletonCard /><SkeletonCard />
      </div>
    );
  }
  if (estado.erro) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
        <p className="text-xs text-red-300">{estado.erro}</p>
      </div>
    );
  }
  const { total, periodo, cobertura_desde: desde } = estado.dados;
  const semPix = !total.por_pix?.den;
  const detalhes = [
    `${contagem(total.aguardando?.pix)} PIX aguardando (${contagem(total.aguardando?.leads)} leads)`,
    `${contagem(total.excluidos_compra_anterior)} fora por compra anterior`,
    `${contagem(total.sem_identificacao)} sem identificação`,
  ];
  // O backend manda a cobertura sempre; só importa quando corta o começo do período (EARS-18).
  if (desde && periodo?.inicio && desde > periodo.inicio) detalhes.push(`dados de PIX desde ${formatDate(desde)}`);
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard
          icon={<Percent className="h-4 w-4" />}
          label="PIX pago — por PIX"
          value={taxa(total.por_pix)}
          sub={semPix ? SEM_PIX_CONTADO : `${contagem(total.por_pix.num)} de ${contagem(total.por_pix.den)} PIX`}
          color="green"
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="PIX pago — por lead"
          value={taxa(total.por_lead)}
          sub={semPix ? SEM_PIX_CONTADO : `${contagem(total.por_lead?.num)} de ${contagem(total.por_lead?.den)} leads`}
          color="blue"
        />
      </div>
      <p className="text-xs text-gray-500 mt-2">{detalhes.join(' · ')}</p>
    </>
  );
}

export default function Dashboard() {
  const [startDate, setStartDate] = useState(todayISO);
  const [endDate, setEndDate] = useState(todayISO);
  const [preset, setPreset] = useState('today');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [storeOptions, setStoreOptions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [fbSpend, setFbSpend] = useState(null);
  const [fbDailySpend, setFbDailySpend] = useState({});
  const [loadingFb, setLoadingFb] = useState(true);
  const [fbError, setFbError] = useState('');

  const [metaOk, setMetaOk] = useState(false);

  // Controles do Gráfico Diário
  const [chartTab, setChartTab] = useState('financial'); // 'financial' | 'volumes' | 'leads' | 'pix'
  const [visibleFinancial, setVisibleFinancial] = useState(() => todasAsSeries(FINANCIAL_SERIES));
  const [visibleVolumes, setVisibleVolumes] = useState(() => todasAsSeries(VOLUME_SERIES));
  const [visibleLeads, setVisibleLeads] = useState(() => todasAsSeries(LEAD_SERIES));
  const [visiblePix, setVisiblePix] = useState(() => todasAsSeries(PIX_SERIES));
  // "Só leads únicos" da aba "Funil de leads": começa desligado a cada visita (EARS-9).
  const [leadUnico, setLeadUnico] = useState(false);
  // Resposta do funil de leads com a chave (parâmetros) que a pediu: só a do estado atual vira número.
  const [funilLeads, setFunilLeads] = useState(null);
  // Taxa de PIX de leads novos, no mesmo formato `{chave, dados|erro}`. Fica aqui, e não no cartão,
  // porque a aba "PIX pago (%)" do gráfico desenha a mesma resposta.
  const [pixLeads, setPixLeads] = useState(null);

  function handlePresetChange(p) {
    setPreset(p);
    const dates = getPresetDates(p);
    setStartDate(dates.start);
    setEndDate(dates.end);
  }

  // Garantir que endDate nunca fique antes de startDate
  function handleStartDate(val) {
    setPreset('custom');
    setStartDate(val);
    if (endDate < val) setEndDate(val);
  }
  function handleEndDate(val) {
    setPreset('custom');
    setEndDate(val);
    if (startDate > val) setStartDate(val);
  }

  // Fetch DB stats
  useEffect(() => {
    setLoadingStats(true);
    setStats(null);
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    if (selectedStoreId) params.set('store_id', selectedStoreId);
    api.get(`/admin/dashboard?${params}`)
      .then((r) => {
        const nextStats = r.data || {};
        const nextStores = nextStats.stores_with_sales || [];
        setStoreOptions(nextStores);
        if (selectedStoreId && !nextStores.some((store) => String(store.store_id) === String(selectedStoreId))) {
          setSelectedStoreId('');
        }
        setStats(nextStats);
      })
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false));
  }, [startDate, endDate, selectedStoreId]);

  // Fetch Meta (Facebook Ads) spend via proxy do backend — o token fica no
  // servidor (.env), nunca no navegador. metaOk é derivado da resposta.
  useEffect(() => {
    setLoadingFb(true);
    setFbSpend(null);
    setFbDailySpend({});
    setFbError('');
    const params = new URLSearchParams({ since: startDate, until: endDate });
    if (selectedStoreId) params.set('store_id', selectedStoreId);
    api.get(`/admin/meta/ad-spend?${params}`)
      .then((r) => {
        const data = r.data || {};
        if (!data.configured) { setMetaOk(false); return; }
        setMetaOk(true);
        if (data.error) throw new Error(data.error);
        setFbSpend(parseFloat(data.spend ?? 0));
        setFbDailySpend(data.daily_spend || {});
      })
      .catch((e) => {
        // Erro do Meta (502): provider configurado, mas a consulta falhou.
        if (e.response?.data?.configured) setMetaOk(true);
        setFbError(e.response?.data?.error || e.message || 'Erro ao buscar dados do Meta');
      })
      .finally(() => setLoadingFb(false));
  }, [startDate, endDate, selectedStoreId]);

  // Taxa de PIX pago de leads novos: rota e estado próprios, então a falha ou a demora dela nunca
  // segura os cartões de Vendas (EARS-17). A resposta de outro período ou loja é descartada pela chave.
  const paramsPix = useMemo(() => {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    if (selectedStoreId) params.set('store_id', selectedStoreId);
    return params.toString();
  }, [startDate, endDate, selectedStoreId]);

  useEffect(() => {
    let ativo = true;
    const chave = paramsPix;
    api.get(`/admin/dashboard/pix-leads-novos?${chave}`)
      .then((r) => {
        if (!ativo) return;
        const dados = r.data;
        // Só `disponivel: true` com o bloco vira número; o resto é a mensagem fixa (EARS-16).
        setPixLeads(dados?.disponivel === true && dados.total ? { chave, dados } : { chave, erro: ERRO_PIX_LEADS });
      })
      .catch(() => {
        if (ativo) setPixLeads({ chave, erro: ERRO_PIX_LEADS });
      });
    return () => {
      ativo = false;
    };
  }, [paramsPix]);

  const pixLeadsAtual = pixLeads?.chave === paramsPix ? pixLeads : null;

  const approvedTotal = stats?.approved_total || 0;                       // bruto
  const approvedNet = stats?.approved_total_net ?? stats?.approved_total ?? 0; // líquido
  const mpFees = stats?.mp_fees_total ?? null;
  const fbFee = metaOk ? (fbSpend ?? 0) * 0.15 : null;
  const totalExpenses = (fbSpend ?? 0) + (fbFee ?? 0);
  const hasExpenses = metaOk;
  const fbReady = metaOk && !loadingFb && !fbError;
  // Lucro com base no líquido (já descontadas as taxas do MP) menos despesas.
  const lucroBruto = hasExpenses && fbReady && stats !== null ? approvedNet - totalExpenses : null;
  const selectedStore = storeOptions.find((store) => String(store.store_id) === String(selectedStoreId));
  const isStoreDashboard = Boolean(selectedStoreId);
  const isSingleDay = startDate === endDate;

  // Aba "Funil de leads": a MESMA fonte e os MESMOS parâmetros do Dashboard de Leads (dashboard-stats
  // diário), para as duas telas baterem (verificação (c) da spec). Busca só com a aba aberta.
  const paramsFunilLeads = useMemo(() => {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      group_by: 'daily',
      tz_offset_minutes: String(new Date().getTimezoneOffset()),
    });
    if (selectedStoreId) params.set('store_id', selectedStoreId);
    if (leadUnico) params.set('lead_unico', '1');
    return params.toString();
  }, [startDate, endDate, selectedStoreId, leadUnico]);

  useEffect(() => {
    if (chartTab !== 'leads' || isSingleDay) return undefined;
    let ativo = true;
    const chave = paramsFunilLeads;
    api.get(`/admin/leads/dashboard-stats?${chave}`)
      .then((r) => {
        if (!ativo) return;
        const dados = r.data || null;
        if (recorteAusente(dados, leadUnico)) {
          setFunilLeads({ chave, erro: ERRO_LEAD_UNICO });
          return;
        }
        setFunilLeads({ chave, dados });
      })
      .catch((err) => {
        if (!ativo) return;
        setFunilLeads({ chave, erro: err.response?.data?.error || 'Erro ao carregar o funil de leads.' });
      });
    return () => {
      ativo = false;
    };
  }, [chartTab, isSingleDay, paramsFunilLeads]);

  // Resposta de outro estado (outro filtro ou período) conta como carregando, nunca como número.
  const funilLeadsAtual = funilLeads?.chave === paramsFunilLeads ? funilLeads : null;
  const leadsDailyData = funilLeadsAtual?.dados?.time_series || [];
  // O backend so manda `lead_unico` com o filtro ligado, e a chave garante que a resposta e do estado
  // atual: nao ha segunda checagem de `leadUnico` aqui (dono unico).
  const recorteLeads = funilLeadsAtual?.dados?.lead_unico || null;
  const topoAproximado = recorteLeads?.topo_aproximado === true;

  // Mescla dados diários do banco com gasto diário do Meta Ads
  const combinedDailyData = useMemo(() => {
    const raw = stats?.daily_stats || [];
    return raw.map((item) => {
      const fb = (metaOk && fbDailySpend?.[item.date] != null) ? Number(fbDailySpend[item.date]) : 0;
      const fee = metaOk ? fb * 0.15 : 0;
      const totExp = item.mp_fees_total + fb + fee;
      const lucro = metaOk && fbSpend !== null
        ? item.approved_total_net - (fb + fee)
        : item.approved_total_net;
      return {
        ...item,
        fb_spend: fb,
        fb_fee: fee,
        total_expenses: totExp,
        lucro_bruto: lucro,
      };
    });
  }, [stats?.daily_stats, fbDailySpend, metaOk, fbSpend]);

  // Aba "PIX pago (%)": os dias da MESMA resposta do cartão (sem segunda busca), então o carregando e
  // o erro dela são os do cartão (EARS-16).
  const pixDailyData = useMemo(() => diasPix(pixLeadsAtual?.dados?.por_dia), [pixLeadsAtual]);

  const activeSeriesMeta = SERIES_POR_ABA[chartTab];
  const [activeVisibility, setActiveVisibility] = {
    financial: [visibleFinancial, setVisibleFinancial],
    volumes: [visibleVolumes, setVisibleVolumes],
    leads: [visibleLeads, setVisibleLeads],
    pix: [visiblePix, setVisiblePix],
  }[chartTab];
  // [dados, carregando, erro] de cada aba; Financeiro e Volumes leem o /admin/dashboard.
  const [chartData, chartLoading, chartErro] = {
    leads: [leadsDailyData, !funilLeadsAtual, funilLeadsAtual?.erro || ''],
    pix: [pixDailyData, !pixLeadsAtual, pixLeadsAtual?.erro || ''],
  }[chartTab] || [combinedDailyData, loadingStats, ''];
  const rotuloSerie = (s) => (s.aproximavel && topoAproximado ? `${s.label} (aproximado)` : s.label);
  // Valor do ponto. Na aba de PIX, `pct` nulo (dia sem PIX contado) é `null`: sem ponto, e a linha se
  // quebra ali (EARS-13). Nas outras abas, vazio continua 0, como sempre foi.
  const valorDoPonto = (item, s) => {
    if (chartTab !== 'pix') return Number(item[s.key] || 0);
    const pct = item[s.key]?.pct;
    return pct == null ? null : Number(pct);
  };
  const textoDoPonto = (item, s, val) => {
    if (chartTab === 'pix') {
      const t = item[s.key];
      return `${s.label}: ${taxa(t)} (${contagem(t.num)} de ${contagem(t.den)}) (${item.label})`;
    }
    const displayVal = chartTab === 'financial' ? formatCurrency(val) : val;
    return `${rotuloSerie(s)}: ${displayVal} (${item.label || item.date})`;
  };

  const { chartMin, chartMax } = useMemo(() => {
    // Taxa: eixo fixo de 0 a 100%, para 60% e 62% não parecerem um tombo.
    if (chartTab === 'pix') return { chartMin: 0, chartMax: 100 };
    if (!chartData.length) return { chartMin: 0, chartMax: 100 };
    let max = 0;
    let min = 0;
    for (const item of chartData) {
      for (const s of activeSeriesMeta) {
        if (activeVisibility[s.key]) {
          const val = Number(item[s.key] || 0);
          if (val > max) max = val;
          if (val < min) min = val;
        }
      }
    }
    if (chartTab === 'financial') {
      if (max === 0 && min === 0) return { chartMin: 0, chartMax: 100 };
      const top = max > 0 ? Math.ceil((max * 1.15) / 10) * 10 : 0;
      const bottom = min < 0 ? Math.floor((min * 1.15) / 10) * 10 : 0;
      return { chartMin: bottom, chartMax: Math.max(top, bottom + 10) };
    }
    return { chartMin: 0, chartMax: Math.max(10, Math.ceil(max * 1.2)) };
  }, [chartData, activeSeriesMeta, activeVisibility, chartTab]);

  const chartRange = Math.max(1, chartMax - chartMin);
  const getY = (val) => 200 - ((val - chartMin) / chartRange) * 180;

  // Totais da tabela diária no rodapé
  const tableTotals = useMemo(() => {
    return combinedDailyData.reduce(
      (acc, d) => ({
        approved_count: acc.approved_count + (d.approved_count || 0),
        approved_total: acc.approved_total + (d.approved_total || 0),
        approved_total_net: acc.approved_total_net + (d.approved_total_net || 0),
        mp_fees_total: acc.mp_fees_total + (d.mp_fees_total || 0),
        fb_spend: acc.fb_spend + (d.fb_spend || 0),
        total_expenses: acc.total_expenses + (d.total_expenses || 0),
        lucro_bruto: acc.lucro_bruto + (d.lucro_bruto || 0),
        pending_count: acc.pending_count + (d.pending_count || 0),
        failures_count: acc.failures_count + (d.failed_count || 0) + (d.reverted_count || 0) + (d.chargeback_count || 0),
      }),
      {
        approved_count: 0,
        approved_total: 0,
        approved_total_net: 0,
        mp_fees_total: 0,
        fb_spend: 0,
        total_expenses: 0,
        lucro_bruto: 0,
        pending_count: 0,
        failures_count: 0,
      }
    );
  }, [combinedDailyData]);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-white">
              {isStoreDashboard ? `Dashboard - ${selectedStore?.store_name || 'Loja'}` : 'Dashboard'}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {isStoreDashboard
                ? 'Resumo financeiro filtrado pela loja'
                : isSingleDay ? 'Resumo financeiro do dia' : 'Resumo financeiro do período'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 self-start">
            <select
              aria-label="Filtrar loja"
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="bg-gray-800 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
            >
              <option value="">Todas as lojas</option>
              {storeOptions.map((store) => (
                <option key={store.store_id} value={store.store_id}>{store.store_name}</option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => handleStartDate(e.target.value)}
                className="bg-gray-800 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
              />
              <span className="text-gray-500 text-sm">até</span>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => handleEndDate(e.target.value)}
                className="bg-gray-800 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>
        </div>

        {/* Botões de Período Rápido */}
        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-gray-800">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mr-1">
            Período:
          </span>
          {PERIOD_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePresetChange(p.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                preset === p.id
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 border border-gray-700/70'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vendas — sempre visível */}
      <div className="mb-6">
        <SectionTitle>Vendas</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loadingStats ? (
            <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
          ) : (
            <>
              <KpiCard
                icon={<ShoppingCart className="h-4 w-4" />}
                label="Vendas Aprovadas"
                value={stats?.approved_count ?? '—'}
                sub={`${formatCurrency(approvedTotal)} bruto`}
                color="green"
              />
              <KpiCard
                icon={<Clock className="h-4 w-4" />}
                label="Vendas Pendentes"
                value={stats?.pending_count ?? '—'}
                color="yellow"
              />
              <KpiCard
                icon={<TrendingUp className="h-4 w-4" />}
                label="Receita Líquida"
                value={formatCurrency(approvedNet)}
                sub={`${formatCurrency(approvedTotal)} bruto · após taxas MP`}
                color="violet"
              />
            </>
          )}
        </div>
      </div>

      {/* PIX de leads novos — carrega sozinho, sem esperar nem segurar o /admin/dashboard */}
      <div className="mb-6">
        <SectionTitle>PIX de leads novos</SectionTitle>
        <PixLeadsNovos estado={pixLeadsAtual} />
      </div>

      {/* Falhas / Estornos */}
      <div className="mb-6">
        <SectionTitle>Falhas &amp; Estornos</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loadingStats ? (
            <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
          ) : (
            <>
              <KpiCard
                icon={<XCircle className="h-4 w-4" />}
                label="Pagamentos Falhos"
                value={stats?.failed_count ?? '—'}
                sub="payment_failed"
                color="red"
              />
              <KpiCard
                icon={<RotateCcw className="h-4 w-4" />}
                label="Revertidos / Estornados"
                value={stats?.reverted_count ?? '—'}
                sub="reverted + refunded"
                color="orange"
              />
              <KpiCard
                icon={<ShieldAlert className="h-4 w-4" />}
                label="Chargebacks"
                value={stats?.chargeback_count ?? '—'}
                sub="charged_back + mediação"
                color="red"
              />
            </>
          )}
        </div>
      </div>

      {/* Despesas — condicional por provider */}
      <div>
        <SectionTitle>Despesas</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Facebook Ads */}
          {loadingFb ? (
            <SkeletonCard />
          ) : !metaOk ? (
            <NotConfiguredCard label="Meta Ads" />
          ) : fbError ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-red-400 shrink-0" />
                <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                  Meta Ads — Erro
                </span>
              </div>
              <p className="text-xs text-red-300 wrap-break-word">{fbError}</p>
              <Link to="/configuracoes" className="text-xs text-violet-400 hover:underline mt-1">
                Revisar configurações →
              </Link>
            </div>
          ) : (
            <>
              <KpiCard
                icon={<Megaphone className="h-4 w-4" />}
                label="Gasto Facebook Ads"
                value={formatCurrency(fbSpend ?? 0)}
                color="blue"
              />
              <KpiCard
                icon={<Percent className="h-4 w-4" />}
                label="Taxa Facebook"
                value={formatCurrency(fbFee ?? 0)}
                sub="15% do Gasto Facebook Ads"
                color="pink"
              />
            </>
          )}

          {/* MercadoPago */}
          <KpiCard
            icon={<Wallet className="h-4 w-4" />}
            label="Taxas MercadoPago"
            value={loadingStats ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" /> : formatCurrency(mpFees ?? 0)}
            sub="já deduzidas da receita"
            color="cyan"
          />

          {/* Total Despesas — só quando todos os providers carregaram com sucesso */}
          {hasExpenses && fbReady && !loadingStats && (
            <KpiCard
              icon={<Receipt className="h-4 w-4" />}
              label="Total Despesas"
              value={formatCurrency(totalExpenses)}
              color="orange"
            />
          )}

          {/* Lucro Bruto — só quando todos os providers carregaram com sucesso */}
          {lucroBruto !== null && !loadingStats && (
            <KpiCard
              icon={<DollarSign className="h-4 w-4" />}
              label="Lucro Bruto"
              value={formatCurrency(lucroBruto)}
              sub={lucroBruto >= 0 ? 'Receita − Despesas' : 'Prejuízo no período'}
              color={lucroBruto >= 0 ? 'green' : 'red'}
            />
          )}

        </div>
      </div>

      {/* Evolução Diária & Detalhamento Diário — Oculto se for filtro de mesmo dia (isSingleDay) */}
      {isSingleDay ? (
        <div className="mt-8 bg-gray-800/40 border border-dashed border-gray-700/70 rounded-xl p-4 text-center text-xs text-gray-400">
          <p>
            O gráfico comparativo e o detalhamento dia a dia são exibidos para filtros de 2 ou mais dias.
            {' '}
            <button
              type="button"
              onClick={() => handlePresetChange('7d')}
              className="text-violet-400 hover:text-violet-300 underline font-medium cursor-pointer"
            >
              Ver últimos 7 dias
            </button>
            {' · '}
            <button
              type="button"
              onClick={() => handlePresetChange('this_month')}
              className="text-violet-400 hover:text-violet-300 underline font-medium cursor-pointer"
            >
              Ver este mês
            </button>
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {/* Card do Gráfico */}
          <div className="bg-gray-800/70 border border-gray-700/80 rounded-2xl p-5 shadow-lg space-y-4">
            {/* Com 4 abas, título e abas só dividem a linha a partir de xl: abaixo disso a barra roubava a
                largura do título e quebrava o texto dentro dos botões. */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-violet-400" />
                  Evolução Diária
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Acompanhamento cronológico diário de receitas, despesas, lucro, contagens e funil de leads
                </p>
              </div>

              {/* Alternador de Modo (Financeiro vs Volumes) */}
              <div className="flex flex-wrap items-center bg-gray-900/90 p-1 rounded-xl border border-gray-700/70 self-start xl:self-auto xl:shrink-0">
                <button
                  type="button"
                  onClick={() => setChartTab('financial')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    chartTab === 'financial'
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  Financeiro (R$)
                </button>
                <button
                  type="button"
                  onClick={() => setChartTab('volumes')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    chartTab === 'volumes'
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  Volumes (Qtd)
                </button>
                <button
                  type="button"
                  onClick={() => setChartTab('leads')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    chartTab === 'leads'
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  Funil de leads
                </button>
                <button
                  type="button"
                  onClick={() => setChartTab('pix')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    chartTab === 'pix'
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Percent className="h-3.5 w-3.5" />
                  PIX pago (%)
                </button>
              </div>
            </div>

            {/* Pílulas de Seleção de Séries no Gráfico */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-gray-700/50">
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mr-1">
                  Séries no Gráfico:
                </span>
                {activeSeriesMeta.map((s) => {
                  const active = activeVisibility[s.key];
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setActiveVisibility((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                        active
                          ? 'bg-gray-900 border-gray-600 text-gray-200 shadow-sm'
                          : 'bg-gray-900/30 border-gray-800 text-gray-600 opacity-60'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${s.bgClass}`} />
                      {rotuloSerie(s)}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setActiveVisibility(todasAsSeries(activeSeriesMeta))}
                className="text-[11px] text-violet-400 hover:text-violet-300 underline cursor-pointer"
              >
                Ativar todas as séries
              </button>
            </div>

            {chartTab === 'leads' && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
                <button
                  type="button"
                  aria-pressed={leadUnico}
                  onClick={() => setLeadUnico((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
                    leadUnico
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-gray-900/60 text-gray-400 hover:bg-gray-700 hover:text-gray-200 border border-gray-700/60'
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Só leads únicos
                </button>
                <span className="text-gray-500">
                  {recorteLeads
                    ? `Recorte ativo: só leads únicos · ${Number(recorteLeads.excluidas_compra_anterior || 0).toLocaleString('pt-BR')} excluídas por compra anterior · ${Number(recorteLeads.sem_identificacao || 0).toLocaleString('pt-BR')} linhas sem identificação`
                    : 'Cada pessoa conta uma vez, na etapa mais longe do período; quem já tinha compra aprovada fica de fora.'}
                </span>
              </div>
            )}

            {chartTab === 'pix' && (
              <p className="text-xs text-gray-500">
                Só PIX de leads novos, pelo dia da geração; dia sem PIX contado fica sem ponto.
              </p>
            )}

            {/* Renderização do Gráfico SVG */}
            {chartLoading ? (
              <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando gráfico...
              </div>
            ) : chartErro ? (
              <div className="h-64 flex items-center justify-center gap-2 text-red-300 text-sm">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
                <span>{chartErro}</span>
              </div>
            ) : !chartData.length ? (
              <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
                Nenhum dado registrado para o período selecionado.
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <div className="min-w-[640px]">
                  <svg viewBox="0 0 800 240" className="w-full h-64 overflow-visible" role="img" aria-label="Evolução Diária">
                    {/* Linhas de Grade Horizontais */}
                    {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                      const y = 200 - pct * 180;
                      const val = chartMin + pct * chartRange;
                      const formattedVal = chartTab === 'financial'
                        ? formatCurrency(val)
                        : chartTab === 'pix' ? `${Math.round(val)}%` : Math.round(val);
                      return (
                        <g key={i}>
                          <line x1="45" y1={y} x2="790" y2={y} stroke="#374151" strokeDasharray="3 3" strokeWidth="1" />
                          <text x="40" y={y + 3} fill="#9ca3af" fontSize="10" textAnchor="end">
                            {formattedVal}
                          </text>
                        </g>
                      );
                    })}

                    {/* Linhas das Séries */}
                    {activeSeriesMeta.map((s) => {
                      if (!activeVisibility[s.key]) return null;
                      const xDoDia = (idx) => 50 + (idx / Math.max(1, chartData.length - 1)) * 730;
                      // Um valor nulo fecha o segmento: a linha se quebra no dia sem valor. Só a aba de
                      // PIX tem nulo; nas outras sai um segmento só, com os mesmos pontos de sempre.
                      const segmentos = [];
                      let atual = [];
                      chartData.forEach((item, idx) => {
                        const val = valorDoPonto(item, s);
                        if (val === null) {
                          if (atual.length) segmentos.push(atual);
                          atual = [];
                          return;
                        }
                        atual.push(`${xDoDia(idx)},${getY(val)}`);
                      });
                      if (atual.length) segmentos.push(atual);

                      return (
                        <g key={s.key}>
                          {segmentos.map((pts, i) => (
                            <polyline
                              key={i}
                              fill="none"
                              stroke={s.color}
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              points={pts.join(' ')}
                            />
                          ))}
                          {chartData.map((item, idx) => {
                            const val = valorDoPonto(item, s);
                            if (val === null) return null;
                            return (
                              <circle
                                key={idx}
                                cx={xDoDia(idx)}
                                cy={getY(val)}
                                r="3.5"
                                fill={s.color}
                                className="hover:r-5 transition-all cursor-pointer"
                              >
                                <title>{textoDoPonto(item, s, val)}</title>
                              </circle>
                            );
                          })}
                        </g>
                      );
                    })}

                    {/* Labels do Eixo X */}
                    {chartData.map((item, idx) => {
                      const step = Math.max(1, Math.floor(chartData.length / 10));
                      if (idx % step !== 0 && idx !== chartData.length - 1) return null;
                      const x = 50 + (idx / Math.max(1, chartData.length - 1)) * 730;
                      return (
                        <text key={idx} x={x} y="222" fill="#9ca3af" fontSize="10" textAnchor="middle">
                          {item.label || item.date}
                        </text>
                      );
                    })}
                  </svg>
                </div>
              </div>
            )}
          </div>

          {/* Tabela Analítica Diária */}
          <div className="bg-gray-800/70 border border-gray-700/80 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-violet-400" />
                  Detalhamento Diário
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Valores individuais e despesas registradas por dia no período
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400 font-semibold uppercase tracking-wider">
                    <th className="pb-3 pr-4">Data</th>
                    <th className="pb-3 px-2 text-right">Vendas</th>
                    <th className="pb-3 px-2 text-right">Total Bruto</th>
                    <th className="pb-3 px-2 text-right">Receita Líquida</th>
                    <th className="pb-3 px-2 text-right">Taxas MP</th>
                    <th className="pb-3 px-2 text-right">Meta Ads</th>
                    <th className="pb-3 px-2 text-right">Total Despesas</th>
                    <th className="pb-3 px-2 text-right">Lucro Bruto</th>
                    <th className="pb-3 px-2 text-right">Pendentes</th>
                    <th className="pb-3 pl-2 text-right">Falhas/Estornos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 text-gray-300">
                  {loadingStats ? (
                    <tr>
                      <td colSpan="10" className="py-6 text-center text-gray-500">
                        Carregando tabela diária...
                      </td>
                    </tr>
                  ) : !combinedDailyData.length ? (
                    <tr>
                      <td colSpan="10" className="py-6 text-center text-gray-500">
                        Nenhum registro para o período.
                      </td>
                    </tr>
                  ) : (
                    combinedDailyData.map((d) => {
                      const failures = (d.failed_count || 0) + (d.reverted_count || 0) + (d.chargeback_count || 0);
                      return (
                        <tr key={d.date} className="hover:bg-gray-700/30 transition-colors">
                          <td className="py-2.5 pr-4 font-medium text-white">
                            <span className="font-semibold">{d.label}</span>
                            <span className="text-[10px] text-gray-500 ml-1.5">({d.date})</span>
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            <span className="inline-flex items-center justify-center min-w-6 h-5 rounded-full bg-green-500/15 text-green-400 text-[11px] font-bold px-1.5">
                              {d.approved_count}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-right text-gray-200 font-medium">
                            {formatCurrency(d.approved_total)}
                          </td>
                          <td className="py-2.5 px-2 text-right text-violet-300 font-medium">
                            {formatCurrency(d.approved_total_net)}
                          </td>
                          <td className="py-2.5 px-2 text-right text-cyan-400">
                            {formatCurrency(d.mp_fees_total)}
                          </td>
                          <td className="py-2.5 px-2 text-right text-blue-400">
                            {metaOk ? formatCurrency(d.fb_spend) : '—'}
                          </td>
                          <td className="py-2.5 px-2 text-right text-amber-400 font-medium">
                            {formatCurrency(d.total_expenses)}
                          </td>
                          <td className={`py-2.5 px-2 text-right font-bold ${d.lucro_bruto >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatCurrency(d.lucro_bruto)}
                          </td>
                          <td className="py-2.5 px-2 text-right text-yellow-400">
                            {d.pending_count > 0 ? d.pending_count : '—'}
                          </td>
                          <td className="py-2.5 pl-2 text-right text-red-400">
                            {failures > 0 ? failures : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {combinedDailyData.length > 0 && !loadingStats && (
                  <tfoot className="border-t-2 border-gray-700 bg-gray-900/60 font-bold text-gray-200">
                    <tr>
                      <td className="py-3 pr-4 text-white uppercase tracking-wider text-[11px]">
                        Totais do Período
                      </td>
                      <td className="py-3 px-2 text-right text-green-400">
                        {tableTotals.approved_count}
                      </td>
                      <td className="py-3 px-2 text-right text-white">
                        {formatCurrency(tableTotals.approved_total)}
                      </td>
                      <td className="py-3 px-2 text-right text-violet-300">
                        {formatCurrency(tableTotals.approved_total_net)}
                      </td>
                      <td className="py-3 px-2 text-right text-cyan-400">
                        {formatCurrency(tableTotals.mp_fees_total)}
                      </td>
                      <td className="py-3 px-2 text-right text-blue-400">
                        {metaOk ? formatCurrency(tableTotals.fb_spend) : '—'}
                      </td>
                      <td className="py-3 px-2 text-right text-amber-400">
                        {formatCurrency(tableTotals.total_expenses)}
                      </td>
                      <td className={`py-3 px-2 text-right ${tableTotals.lucro_bruto >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(tableTotals.lucro_bruto)}
                      </td>
                      <td className="py-3 px-2 text-right text-yellow-400">
                        {tableTotals.pending_count}
                      </td>
                      <td className="py-3 pl-2 text-right text-red-400">
                        {tableTotals.failures_count}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Vendas por Loja / Produtos */}
      <div className="mt-6">
        <SectionTitle>{isStoreDashboard ? 'Produtos' : 'Vendas por Loja'}</SectionTitle>
        {loadingStats ? (
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5 animate-pulse">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="h-3 w-32 bg-gray-700 rounded" />
                  <div className="h-3 w-16 bg-gray-700 rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : isStoreDashboard ? (
          !stats?.sales_by_product?.length ? (
            <div className="bg-gray-800/40 border border-dashed border-gray-700 rounded-xl p-5 flex items-center gap-2 text-gray-500 text-sm">
              <ShoppingCart className="h-4 w-4 shrink-0" />
              <span>Nenhum produto vendido para esta loja neste período.</span>
            </div>
          ) : (
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">Produto</th>
                    <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">Vendas</th>
                    <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">Total Bruto</th>
                    <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">Total Despesas</th>
                    <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">Lucro Bruto</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.sales_by_product.map((row, idx) => {
                    const mpFee = row.total - row.total_net;
                    // Force rebuild/redeploy to trigger GitHub Pages build
                    const fbTotal = (fbSpend ?? 0) + (fbFee ?? 0);
                    const storeTotalRevenue = stats.sales_by_product.reduce((s, p) => s + p.total, 0);
                    const productFbShare = storeTotalRevenue > 0 ? (row.total / storeTotalRevenue) * fbTotal : 0;
                    const totalDespesas = mpFee + productFbShare;
                    const lucroBruto = row.total - totalDespesas;
                    return (
                    <tr
                      key={row.product_id ?? idx}
                      className="border-b border-gray-700/50 last:border-0 hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="px-5 py-3 text-gray-200">
                        <span className="flex items-center gap-2">
                          <ShoppingCart className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                          {row.product_name}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="inline-flex items-center justify-center min-w-7 h-6 rounded-full bg-green-500/15 text-green-400 text-xs font-bold px-2">
                          {row.count}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-200 font-medium">
                        {formatCurrency(row.total)}
                      </td>
                      <td className="px-5 py-3 text-right text-red-400">
                        {formatCurrency(totalDespesas)}
                      </td>
                      <td className={`px-5 py-3 text-right font-medium ${lucroBruto >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(lucroBruto)}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : !stats?.sales_by_store?.length ? (
          <div className="bg-gray-800/40 border border-dashed border-gray-700 rounded-xl p-5 flex items-center gap-2 text-gray-500 text-sm">
            <Store className="h-4 w-4 shrink-0" />
            <span>Nenhuma venda registrada para este período.</span>
          </div>
        ) : (
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">Loja</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">Vendas</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">Total Bruto</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">Total Despesas</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">Lucro Bruto</th>
                </tr>
              </thead>
              <tbody>
                {stats.sales_by_store.map((row, idx) => {
                  const totalDespesas = (row.total_mp_fees || 0) + (row.total_fb_spend || 0) + (row.total_fb_fee || 0);
                  const lucroBruto = row.total - totalDespesas;
                  return (
                  <tr
                    key={idx}
                    className="border-b border-gray-700/50 last:border-0 hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="px-5 py-3 text-gray-200">
                      <button
                        type="button"
                        disabled={!row.store_id}
                        onClick={() => row.store_id && setSelectedStoreId(String(row.store_id))}
                        className="flex items-center gap-2 text-left hover:text-violet-300 disabled:hover:text-gray-200 disabled:cursor-default transition-colors"
                        title={row.store_id ? 'Abrir dashboard desta loja' : undefined}
                      >
                        <Store className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                        {row.store_name}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex items-center justify-center min-w-7 h-6 rounded-full bg-green-500/15 text-green-400 text-xs font-bold px-2">
                        {row.count}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-200 font-medium">
                      {formatCurrency(row.total)}
                    </td>
                    <td className="px-5 py-3 text-right text-red-400">
                      {formatCurrency(totalDespesas)}
                    </td>
                    <td className={`px-5 py-3 text-right font-medium ${lucroBruto >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(lucroBruto)}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
