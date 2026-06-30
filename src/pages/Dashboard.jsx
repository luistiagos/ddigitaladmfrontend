import { useState, useEffect } from 'react';
import { ShoppingCart, Clock, TrendingUp, Megaphone, Wallet, Receipt, DollarSign, AlertCircle, Loader2, XCircle, RotateCcw, ShieldAlert, Store, Percent } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { formatCurrency, todayISO } from '@/utils/format';

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

export default function Dashboard() {
  const [startDate, setStartDate] = useState(todayISO);
  const [endDate, setEndDate] = useState(todayISO);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [storeOptions, setStoreOptions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [fbSpend, setFbSpend] = useState(null);
  const [loadingFb, setLoadingFb] = useState(true);
  const [fbError, setFbError] = useState('');

  const [metaOk, setMetaOk] = useState(false);

  // Garantir que endDate nunca fique antes de startDate
  function handleStartDate(val) {
    setStartDate(val);
    if (endDate < val) setEndDate(val);
  }
  function handleEndDate(val) {
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
      })
      .catch((e) => {
        // Erro do Meta (502): provider configurado, mas a consulta falhou.
        if (e.response?.data?.configured) setMetaOk(true);
        setFbError(e.response?.data?.error || e.message || 'Erro ao buscar dados do Meta');
      })
      .finally(() => setLoadingFb(false));
  }, [startDate, endDate, selectedStoreId]);

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

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
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
            <option value="">Todos</option>
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
                  </tr>
                </thead>
                <tbody>
                  {stats.sales_by_product.map((row, idx) => (
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
                    </tr>
                  ))}
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
                </tr>
              </thead>
              <tbody>
                {stats.sales_by_store.map((row, idx) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
