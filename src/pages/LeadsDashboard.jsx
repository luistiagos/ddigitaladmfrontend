import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Eye,
  ShoppingCart,
  Users,
  CreditCard,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  RefreshCw,
  Store,
  Calendar,
  Filter,
  BarChart3,
  Activity,
  Layers,
  Percent,
  ListFilter,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import api from '@/services/api';
import { todayISO } from '@/utils/format';

function formatNumber(num) {
  if (num == null) return '0';
  return Number(num).toLocaleString('pt-BR');
}

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

export default function LeadsDashboard() {
  const [preset, setPreset] = useState('this_month');
  const [startDate, setStartDate] = useState(() => getPresetDates('this_month').start);
  const [endDate, setEndDate] = useState(() => getPresetDates('this_month').end);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [groupBy, setGroupBy] = useState('daily');
  const [stores, setStores] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active series toggles for chart
  const [visibleSeries, setVisibleSeries] = useState({
    PageView: true,
    AddToCart: true,
    Lead: true,
    InitiateCheckout: true,
    Purchase: true,
  });

  // Fetch stores list
  useEffect(() => {
    api.get('/admin/stores')
      .then((res) => setStores(res.data.stores || []))
      .catch(() => {});
  }, []);

  // Fetch dashboard stats
  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        group_by: groupBy,
        tz_offset_minutes: String(new Date().getTimezoneOffset()),
      });
      if (selectedStoreId) {
        params.set('store_id', selectedStoreId);
      }
      const res = await api.get(`/admin/leads/dashboard-stats?${params}`);
      setStats(res.data || null);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar métricas do dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [startDate, endDate, selectedStoreId, groupBy]);

  function handlePresetChange(p) {
    setPreset(p);
    const dates = getPresetDates(p);
    setStartDate(dates.start);
    setEndDate(dates.end);
  }

  function handleCustomStart(val) {
    setPreset('custom');
    setStartDate(val);
    if (endDate < val) setEndDate(val);
  }

  function handleCustomEnd(val) {
    setPreset('custom');
    setEndDate(val);
    if (startDate > val) setStartDate(val);
  }

  const funnel = stats?.funnel_summary || {
    pageview_count: 0,
    add_to_cart_count: 0,
    lead_count: 0,
    initiate_checkout_count: 0,
    purchase_count: 0,
    total_captured_contacts: 0,
    total_interactions: 0,
  };

  const rates = stats?.rates || {
    pageview_to_cart_pct: 0,
    cart_to_lead_pct: 0,
    lead_to_initiate_pct: 0,
    initiate_to_purchase_pct: 0,
    cart_to_purchase_pct: 0,
    overall_conversion_pct: 0,
  };

  const timeSeries = stats?.time_series || [];
  const storeList = stats?.by_store || [];
  const remarketing = stats?.remarketing_summary || {
    total_workflows: 0,
    completed: 0,
    purchased: 0,
    active: 0,
    waiting: 0,
    failed: 0,
  };

  // Funnel steps definitions
  const funnelSteps = [
    {
      id: 'PageView',
      label: '1. Visualizações',
      sublabel: 'Acesso à página',
      count: funnel.pageview_count,
      color: 'from-blue-500 to-indigo-600',
      bgColor: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
      icon: Eye,
      nextRate: rates.pageview_to_cart_pct,
      nextLabel: 'Taxa de clique',
      dropOff: funnel.pageview_count > 0 ? Math.max(0, 100 - rates.pageview_to_cart_pct) : 0,
    },
    {
      id: 'AddToCart',
      label: '2. Interesse na Oferta',
      sublabel: 'Clique em Comprar',
      count: funnel.add_to_cart_count,
      color: 'from-purple-500 to-violet-600',
      bgColor: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
      icon: ShoppingCart,
      nextRate: rates.cart_to_lead_pct,
      nextLabel: 'Taxa de contato',
      dropOff: funnel.add_to_cart_count > 0 ? Math.max(0, 100 - rates.cart_to_lead_pct) : 0,
    },
    {
      id: 'Lead',
      label: '3. Contato Capturado',
      sublabel: 'E-mail / WhatsApp',
      count: funnel.lead_count,
      color: 'from-cyan-500 to-teal-600',
      bgColor: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
      icon: Users,
      nextRate: rates.lead_to_initiate_pct,
      nextLabel: 'Taxa checkout',
      dropOff: funnel.lead_count > 0 ? Math.max(0, 100 - rates.lead_to_initiate_pct) : 0,
    },
    {
      id: 'InitiateCheckout',
      label: '4. Submissão Checkout',
      sublabel: 'PIX / Cartão gerado',
      count: funnel.initiate_checkout_count,
      color: 'from-amber-500 to-orange-600',
      bgColor: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
      icon: CreditCard,
      nextRate: rates.initiate_to_purchase_pct,
      nextLabel: 'Taxa pagamento',
      dropOff: funnel.initiate_checkout_count > 0 ? Math.max(0, 100 - rates.initiate_to_purchase_pct) : 0,
    },
    {
      id: 'Purchase',
      label: '5. Venda Concluída',
      sublabel: 'Pagamento aprovado',
      count: funnel.purchase_count,
      color: 'from-emerald-500 to-green-600',
      bgColor: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
      icon: CheckCircle2,
      nextRate: null,
      nextLabel: null,
      dropOff: null,
    },
  ];

  // Chart max value calculation
  const chartMax = useMemo(() => {
    if (!timeSeries.length) return 100;
    let max = 0;
    for (const item of timeSeries) {
      if (visibleSeries.PageView && item.pageview_count > max) max = item.pageview_count;
      if (visibleSeries.AddToCart && item.add_to_cart_count > max) max = item.add_to_cart_count;
      if (visibleSeries.Lead && item.lead_count > max) max = item.lead_count;
      if (visibleSeries.InitiateCheckout && item.initiate_checkout_count > max) max = item.initiate_checkout_count;
      if (visibleSeries.Purchase && item.purchase_count > max) max = item.purchase_count;
    }
    return max > 0 ? max * 1.15 : 100;
  }, [timeSeries, visibleSeries]);

  const seriesMeta = [
    { key: 'PageView', label: 'PageView', color: '#3b82f6', bgClass: 'bg-blue-500' },
    { key: 'AddToCart', label: 'AddToCart', color: '#a855f7', bgClass: 'bg-purple-500' },
    { key: 'Lead', label: 'Lead', color: '#06b6d4', bgClass: 'bg-cyan-500' },
    { key: 'InitiateCheckout', label: 'InitiateCheckout', color: '#f59e0b', bgClass: 'bg-amber-500' },
    { key: 'Purchase', label: 'Purchase', color: '#10b981', bgClass: 'bg-emerald-500' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-violet-600/20 text-violet-400">
              <Layers className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Dashboard de Leads & Funil de Conversão
              </h1>
              <p className="text-xs sm:text-sm text-gray-400">
                Visibilidade analítica de tráfego, intenção, preenchimento de contatos e compras
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/leads"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs sm:text-sm font-medium border border-gray-700 transition-colors"
          >
            <ListFilter className="h-4 w-4 text-violet-400" />
            Ver Tabela de Leads
          </Link>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs sm:text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Control Bar (Filters) */}
      <div className="bg-gray-800/70 border border-gray-700/80 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
        {/* Preset Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-gray-400 font-semibold uppercase tracking-wider text-[11px] mr-1 hidden sm:inline">
            Período:
          </span>
          {[
            { id: 'today', label: 'Hoje' },
            { id: 'yesterday', label: 'Ontem' },
            { id: '7d', label: 'Últimos 7 dias' },
            { id: '30d', label: 'Últimos 30 dias' },
            { id: 'this_month', label: 'Este Mês' },
            { id: 'last_month', label: 'Mês Anterior' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => handlePresetChange(p.id)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                preset === p.id
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-gray-900/60 text-gray-400 hover:bg-gray-700 hover:text-gray-200 border border-gray-700/60'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-gray-700/50">
          {/* Store Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Loja
            </label>
            <div className="relative">
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-xl px-3 py-2 pl-9 focus:outline-none focus:border-violet-500 transition-colors"
              >
                <option value="">Todas as Lojas (Consolidado)</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (ID {s.id})
                  </option>
                ))}
              </select>
              <Store className="absolute left-3 top-2.5 h-4 w-4 text-gray-500 pointer-events-none" />
            </div>
          </div>

          {/* Group By */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Agrupamento Gráfico
            </label>
            <div className="relative">
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-xl px-3 py-2 pl-9 focus:outline-none focus:border-violet-500 transition-colors"
              >
                <option value="daily">Diário (Dia a Dia)</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
              </select>
              <BarChart3 className="absolute left-3 top-2.5 h-4 w-4 text-gray-500 pointer-events-none" />
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Data Inicial
            </label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleCustomStart(e.target.value)}
                max={endDate}
                className="w-full bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-xl px-3 py-2 pl-9 focus:outline-none focus:border-violet-500 transition-colors"
              />
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-500 pointer-events-none" />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Data Final
            </label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleCustomEnd(e.target.value)}
                min={startDate}
                className="w-full bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-xl px-3 py-2 pl-9 focus:outline-none focus:border-violet-500 transition-colors"
              />
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3 text-red-300 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* 1. PageView */}
        <div className="bg-gray-800/60 border border-gray-700/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">PageView</span>
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Eye className="h-4 w-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-white">
              {loading ? '—' : formatNumber(funnel.pageview_count)}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Acessos à página</p>
          </div>
        </div>

        {/* 2. AddToCart */}
        <div className="bg-gray-800/60 border border-gray-700/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">AddToCart</span>
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <ShoppingCart className="h-4 w-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-white">
              {loading ? '—' : formatNumber(funnel.add_to_cart_count)}
            </div>
            <p className="text-[11px] text-purple-400 font-medium mt-1">
              {loading ? '—' : `${rates.pageview_to_cart_pct}% dos acessos`}
            </p>
          </div>
        </div>

        {/* 3. Lead */}
        <div className="bg-gray-800/60 border border-gray-700/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Lead</span>
            <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-white">
              {loading ? '—' : formatNumber(funnel.lead_count)}
            </div>
            <p className="text-[11px] text-cyan-400 font-medium mt-1">
              {loading ? '—' : `${rates.cart_to_lead_pct}% de conversão`}
            </p>
          </div>
        </div>

        {/* 4. InitiateCheckout */}
        <div className="bg-gray-800/60 border border-gray-700/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Checkout</span>
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <CreditCard className="h-4 w-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-white">
              {loading ? '—' : formatNumber(funnel.initiate_checkout_count)}
            </div>
            <p className="text-[11px] text-amber-400 font-medium mt-1">
              {loading ? '—' : `${rates.lead_to_initiate_pct}% de avanço`}
            </p>
          </div>
        </div>

        {/* 5. Purchase */}
        <div className="bg-gray-800/60 border border-gray-700/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Purchase</span>
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-white">
              {loading ? '—' : formatNumber(funnel.purchase_count)}
            </div>
            <p className="text-[11px] text-emerald-400 font-medium mt-1">
              {loading ? '—' : `${rates.initiate_to_purchase_pct}% pagamentos`}
            </p>
          </div>
        </div>

        {/* 6. Overall Conversion */}
        <div className="bg-gradient-to-br from-violet-900/30 to-gray-800/70 border border-violet-500/40 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-violet-300 uppercase tracking-wider">Conversão Geral</span>
            <span className="p-2 rounded-xl bg-violet-500/20 text-violet-300">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-violet-200">
              {loading ? '—' : `${rates.overall_conversion_pct}%`}
            </div>
            <p className="text-[11px] text-gray-300 mt-1">
              {loading ? '—' : `${formatNumber(funnel.total_captured_contacts)} contatos totais`}
            </p>
          </div>
        </div>
      </div>

      {/* Visual Conversion Funnel (Drop-off Analysis) */}
      <div className="bg-gray-800/70 border border-gray-700/80 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-violet-400" />
              Funil de Conversão Etapa por Etapa (Drop-off)
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Análise de retenção de visitantes e gargalos entre as etapas da jornada de compra
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Conversão
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Perda (Drop-off)
            </span>
          </div>
        </div>

        {/* Funnel Steps Layout */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
          {funnelSteps.map((step, idx) => {
            const Icon = step.icon;
            const isFirst = idx === 0;
            const isLast = idx === funnelSteps.length - 1;
            const baseVol = funnel.pageview_count || 1;
            const shareOfTop = funnel.pageview_count > 0 ? ((step.count / baseVol) * 100).toFixed(1) : '0';

            return (
              <div key={step.id} className="flex flex-col relative group">
                <div
                  className={`bg-gray-900/80 border rounded-2xl p-4 flex flex-col justify-between h-full transition-all hover:border-gray-500/50 ${step.bgColor}`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-gray-300">{step.label}</span>
                      <Icon className="h-4 w-4 shrink-0" />
                    </div>
                    <div className="text-2xl font-black text-white tracking-tight">
                      {loading ? '—' : formatNumber(step.count)}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{step.sublabel}</div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-800">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-500">Do topo:</span>
                      <span className="font-bold text-gray-200">{loading ? '—' : `${shareOfTop}%`}</span>
                    </div>

                    {/* Stage volume progress bar */}
                    <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                      <div
                        className={`h-full bg-gradient-to-r ${step.color} transition-all duration-500`}
                        style={{ width: `${Math.min(100, Math.max(2, parseFloat(shareOfTop)))}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Transition badge between steps */}
                {!isLast && (
                  <div className="my-2 md:my-0 md:absolute md:-right-3 md:top-1/2 md:-translate-y-1/2 z-10 flex md:flex-col items-center justify-center">
                    <div className="bg-gray-950 border border-gray-700 px-2 py-1 rounded-lg text-[10px] font-bold shadow-md flex items-center gap-1">
                      <span className="text-emerald-400">
                        {loading ? '—' : `${step.nextRate}%`}
                      </span>
                      <ArrowRight className="h-3 w-3 text-gray-500 hidden md:inline" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Drop-off Callout Bar */}
        <div className="mt-6 bg-gray-900/60 border border-gray-800 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-gray-500 block text-[11px]">Taxa de Clique na Oferta</span>
            <span className="text-sm font-bold text-purple-300">
              {loading ? '—' : `${rates.pageview_to_cart_pct}%`}
            </span>
            <span className="text-[10px] text-gray-500 block">PageView ➔ AddToCart</span>
          </div>
          <div>
            <span className="text-gray-500 block text-[11px]">Taxa de Captura de Lead</span>
            <span className="text-sm font-bold text-cyan-300">
              {loading ? '—' : `${rates.cart_to_lead_pct}%`}
            </span>
            <span className="text-[10px] text-gray-500 block">AddToCart ➔ Lead</span>
          </div>
          <div>
            <span className="text-gray-500 block text-[11px]">Taxa de Início de Checkout</span>
            <span className="text-sm font-bold text-amber-300">
              {loading ? '—' : `${rates.lead_to_initiate_pct}%`}
            </span>
            <span className="text-[10px] text-gray-500 block">Lead ➔ InitiateCheckout</span>
          </div>
          <div>
            <span className="text-gray-500 block text-[11px]">Conversão de Pagamento PIX/Cartão</span>
            <span className="text-sm font-bold text-emerald-300">
              {loading ? '—' : `${rates.initiate_to_purchase_pct}%`}
            </span>
            <span className="text-[10px] text-gray-500 block">InitiateCheckout ➔ Purchase</span>
          </div>
        </div>
      </div>

      {/* Time Series Evolution Chart */}
      <div className="bg-gray-800/70 border border-gray-700/80 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-violet-400" />
              Evolução Temporal dos Estágios ({groupBy === 'daily' ? 'Diário' : groupBy === 'weekly' ? 'Semanal' : 'Mensal'})
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Acompanhamento cronológico do volume de acessos, contatos e conversões
            </p>
          </div>

          {/* Interactive Series Toggles */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {seriesMeta.map((s) => {
              const active = visibleSeries[s.key];
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setVisibleSeries((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                    active
                      ? 'bg-gray-900 border-gray-600 text-gray-200 shadow-sm'
                      : 'bg-gray-900/30 border-gray-800 text-gray-600 opacity-60'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${s.bgClass}`} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* SVG Chart */}
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Carregando gráfico...
          </div>
        ) : !timeSeries.length ? (
          <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
            Nenhum dado registrado para o período selecionado.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <div className="min-w-[640px]">
              <svg viewBox="0 0 800 240" className="w-full h-64 overflow-visible">
                {/* Horizontal Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                  const y = 200 - pct * 180;
                  const val = Math.round(chartMax * pct);
                  return (
                    <g key={i}>
                      <line x1="45" y1={y} x2="790" y2={y} stroke="#374151" strokeDasharray="3 3" strokeWidth="1" />
                      <text x="40" y={y + 3} fill="#9ca3af" fontSize="10" textAnchor="end">
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* Series Lines & Areas */}
                {seriesMeta.map((s) => {
                  if (!visibleSeries[s.key]) return null;
                  const pts = timeSeries.map((item, idx) => {
                    const x = 50 + (idx / Math.max(1, timeSeries.length - 1)) * 730;
                    const val =
                      s.key === 'PageView'
                        ? item.pageview_count
                        : s.key === 'AddToCart'
                        ? item.add_to_cart_count
                        : s.key === 'Lead'
                        ? item.lead_count
                        : s.key === 'InitiateCheckout'
                        ? item.initiate_checkout_count
                        : item.purchase_count;
                    const y = 200 - (val / chartMax) * 180;
                    return `${x},${y}`;
                  });

                  return (
                    <g key={s.key}>
                      <polyline
                        fill="none"
                        stroke={s.color}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={pts.join(' ')}
                      />
                      {timeSeries.map((item, idx) => {
                        const x = 50 + (idx / Math.max(1, timeSeries.length - 1)) * 730;
                        const val =
                          s.key === 'PageView'
                            ? item.pageview_count
                            : s.key === 'AddToCart'
                            ? item.add_to_cart_count
                            : s.key === 'Lead'
                            ? item.lead_count
                            : s.key === 'InitiateCheckout'
                            ? item.initiate_checkout_count
                            : item.purchase_count;
                        const y = 200 - (val / chartMax) * 180;
                        return (
                          <circle
                            key={idx}
                            cx={x}
                            cy={y}
                            r="3"
                            fill={s.color}
                            className="hover:r-5 transition-all cursor-pointer"
                          >
                            <title>{`${s.label}: ${val} (${item.label || item.period})`}</title>
                          </circle>
                        );
                      })}
                    </g>
                  );
                })}

                {/* X Axis Labels */}
                {timeSeries.map((item, idx) => {
                  // Show roughly 8-12 labels max to avoid overlap
                  const step = Math.max(1, Math.floor(timeSeries.length / 10));
                  if (idx % step !== 0 && idx !== timeSeries.length - 1) return null;
                  const x = 50 + (idx / Math.max(1, timeSeries.length - 1)) * 730;
                  return (
                    <text key={idx} x={x} y="222" fill="#9ca3af" fontSize="10" textAnchor="middle">
                      {item.label || item.period}
                    </text>
                  );
                })}
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Store Performance Table & Remarketing Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stores Table (2 Cols) */}
        <div className="lg:col-span-2 bg-gray-800/70 border border-gray-700/80 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Store className="h-5 w-5 text-violet-400" />
                Funil Detalhado por Loja
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Comparativo de captação e taxa de conversão entre as lojas
              </p>
            </div>
            {selectedStoreId && (
              <button
                type="button"
                onClick={() => setSelectedStoreId('')}
                className="text-xs text-violet-400 hover:text-violet-300 underline"
              >
                Limpar filtro de loja
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 font-semibold uppercase tracking-wider">
                  <th className="pb-3 pr-4">Loja</th>
                  <th className="pb-3 px-2 text-right">PageView</th>
                  <th className="pb-3 px-2 text-right">AddToCart</th>
                  <th className="pb-3 px-2 text-right">Lead</th>
                  <th className="pb-3 px-2 text-right">Checkout</th>
                  <th className="pb-3 px-2 text-right">Vendas</th>
                  <th className="pb-3 pl-4 text-right">Conv. Pgto</th>
                  <th className="pb-3 pl-2 text-right">Conv. Geral</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-gray-300">
                {!storeList.length ? (
                  <tr>
                    <td colSpan="8" className="py-6 text-center text-gray-500">
                      Nenhuma atividade registrada por loja neste período.
                    </td>
                  </tr>
                ) : (
                  storeList.map((st) => {
                    const isSelected = String(st.store_id) === String(selectedStoreId);
                    return (
                      <tr
                        key={st.store_id || 'null'}
                        className={`hover:bg-gray-700/30 transition-colors ${
                          isSelected ? 'bg-violet-600/10' : ''
                        }`}
                      >
                        <td className="py-3 pr-4 font-medium text-white">
                          <button
                            type="button"
                            onClick={() => st.store_id && setSelectedStoreId(String(st.store_id))}
                            className="text-left hover:text-violet-300 font-medium transition-colors flex items-center gap-1.5"
                          >
                            <Store className="h-3.5 w-3.5 text-gray-500" />
                            <span>{st.store_name}</span>
                          </button>
                        </td>
                        <td className="py-3 px-2 text-right text-gray-400">
                          {formatNumber(st.pageview_count)}
                        </td>
                        <td className="py-3 px-2 text-right text-purple-300">
                          {formatNumber(st.add_to_cart_count)}
                        </td>
                        <td className="py-3 px-2 text-right text-cyan-300">
                          {formatNumber(st.lead_count)}
                        </td>
                        <td className="py-3 px-2 text-right text-amber-300">
                          {formatNumber(st.initiate_checkout_count)}
                        </td>
                        <td className="py-3 px-2 text-right font-bold text-emerald-400">
                          {formatNumber(st.purchase_count)}
                        </td>
                        <td className="py-3 pl-4 text-right">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                              st.checkout_to_purchase_pct > 15
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : st.checkout_to_purchase_pct > 5
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-gray-700 text-gray-400'
                            }`}
                          >
                            {st.checkout_to_purchase_pct}%
                          </span>
                        </td>
                        <td className="py-3 pl-2 text-right font-semibold text-gray-200">
                          {st.overall_conversion_pct}%
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Remarketing & Automation Summary (1 Col) */}
        <div className="bg-gray-800/70 border border-gray-700/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="h-5 w-5 text-violet-400" />
                Workflows de Remarketing
              </h2>
              <Link
                to="/remarketing/workflows"
                className="text-xs text-violet-400 hover:text-violet-300 inline-flex items-center gap-1"
              >
                Ver tudo <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Status das jornadas temporais disparadas para os leads deste período
            </p>

            <div className="space-y-3 text-xs">
              <div className="bg-gray-900/60 border border-gray-800 p-3 rounded-xl flex items-center justify-between">
                <span className="text-gray-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-violet-500" /> Total de Workflows
                </span>
                <span className="font-bold text-white text-sm">
                  {loading ? '—' : formatNumber(remarketing.total_workflows)}
                </span>
              </div>

              <div className="bg-gray-900/60 border border-gray-800 p-3 rounded-xl flex items-center justify-between">
                <span className="text-gray-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Comprados (Purchased)
                </span>
                <span className="font-bold text-emerald-400 text-sm">
                  {loading ? '—' : formatNumber(remarketing.purchased)}
                </span>
              </div>

              <div className="bg-gray-900/60 border border-gray-800 p-3 rounded-xl flex items-center justify-between">
                <span className="text-gray-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" /> Concluídos (Completed)
                </span>
                <span className="font-bold text-blue-400 text-sm">
                  {loading ? '—' : formatNumber(remarketing.completed)}
                </span>
              </div>

              <div className="bg-gray-900/60 border border-gray-800 p-3 rounded-xl flex items-center justify-between">
                <span className="text-gray-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> Em Espera / Janela
                </span>
                <span className="font-bold text-amber-400 text-sm">
                  {loading ? '—' : formatNumber(remarketing.waiting)}
                </span>
              </div>

              <div className="bg-gray-900/60 border border-gray-800 p-3 rounded-xl flex items-center justify-between">
                <span className="text-gray-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" /> Falhas / Erros
                </span>
                <span className="font-bold text-red-400 text-sm">
                  {loading ? '—' : formatNumber(remarketing.failed)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-800 text-[11px] text-gray-500">
            Automations orquestradas pelo Temporal para recuperação de carrinho e checkout.
          </div>
        </div>
      </div>
    </div>
  );
}
