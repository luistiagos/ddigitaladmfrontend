import { useState, useEffect } from 'react';
import { ShoppingCart, Clock, TrendingUp, Megaphone, Wallet, Receipt, DollarSign, AlertCircle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { formatCurrency, todayISO } from '@/utils/format';
import { getSettings, hasProvider } from '@/utils/settings';

const COLORS = {
  violet: 'text-violet-400 bg-violet-500/10',
  green:  'text-green-400 bg-green-500/10',
  yellow: 'text-yellow-400 bg-yellow-500/10',
  blue:   'text-blue-400 bg-blue-500/10',
  red:    'text-red-400 bg-red-500/10',
  cyan:   'text-cyan-400 bg-cyan-500/10',
  orange: 'text-orange-400 bg-orange-500/10',
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
    <div className="bg-gray-800/40 border border-dashed border-gray-700 rounded-xl p-5 flex flex-col items-center justify-center gap-2 text-center min-h-[120px]">
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
  const [date, setDate] = useState(todayISO);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [fbSpend, setFbSpend] = useState(null);
  const [loadingFb, setLoadingFb] = useState(false);
  const [fbError, setFbError] = useState('');

  const metaOk = hasProvider('meta');
  const mpOk = hasProvider('mp');

  // Fetch DB stats
  useEffect(() => {
    setLoadingStats(true);
    setStats(null);
    api.get(`/admin/dashboard?date=${date}`)
      .then((r) => setStats(r.data))
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false));
  }, [date]);

  // Fetch Facebook Ads spend
  useEffect(() => {
    if (!metaOk) { setFbSpend(null); setFbError(''); return; }
    setLoadingFb(true);
    setFbSpend(null);
    setFbError('');
    const { meta_access_token, meta_ad_account_id } = getSettings();
    const range = encodeURIComponent(JSON.stringify({ since: date, until: date }));
    fetch(
      `https://graph.facebook.com/v19.0/act_${meta_ad_account_id}/insights?fields=spend&time_range=${range}&access_token=${meta_access_token}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error.message);
        setFbSpend(parseFloat(data.data?.[0]?.spend ?? '0'));
      })
      .catch((e) => setFbError(e.message || 'Erro ao buscar dados do Meta'))
      .finally(() => setLoadingFb(false));
  }, [date, metaOk]);

  const approvedTotal = stats?.approved_total || 0;
  const mpFees = mpOk ? approvedTotal * 0.0499 : null;
  const totalExpenses = (fbSpend ?? 0) + (mpFees ?? 0);
  const hasExpenses = metaOk || mpOk;
  const lucroBruto = hasExpenses ? approvedTotal - totalExpenses : null;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">Resumo financeiro do dia</p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="self-start bg-gray-800 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
        />
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
                sub={formatCurrency(approvedTotal)}
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
                label="Receita Total"
                value={formatCurrency(approvedTotal)}
                sub="Apenas aprovadas"
                color="violet"
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
          {metaOk ? (
            loadingFb ? <SkeletonCard /> : (
              fbError ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-red-400 flex-shrink-0" />
                    <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                      Meta Ads — Erro
                    </span>
                  </div>
                  <p className="text-xs text-red-300 break-words">{fbError}</p>
                  <Link to="/configuracoes" className="text-xs text-violet-400 hover:underline mt-1">
                    Revisar configurações →
                  </Link>
                </div>
              ) : (
                <KpiCard
                  icon={<Megaphone className="h-4 w-4" />}
                  label="Gasto Facebook Ads"
                  value={formatCurrency(fbSpend ?? 0)}
                  color="blue"
                />
              )
            )
          ) : (
            <NotConfiguredCard label="Meta Ads" />
          )}

          {/* MercadoPago */}
          {mpOk ? (
            <KpiCard
              icon={<Wallet className="h-4 w-4" />}
              label="Taxas MercadoPago"
              value={loadingStats ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" /> : formatCurrency(mpFees ?? 0)}
              sub="~4,99% das aprovadas"
              color="cyan"
            />
          ) : (
            <NotConfiguredCard label="MercadoPago" />
          )}

          {/* Total Despesas — só quando todos os providers carregaram */}
          {hasExpenses && (!metaOk || !loadingFb || fbError) && !loadingStats && (
            <KpiCard
              icon={<Receipt className="h-4 w-4" />}
              label="Total Despesas"
              value={formatCurrency(totalExpenses)}
              color="orange"
            />
          )}

          {/* Lucro Bruto — só quando todos os providers carregaram */}
          {lucroBruto !== null && (!metaOk || !loadingFb || fbError) && !loadingStats && (
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
    </div>
  );
}

