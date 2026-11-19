import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag,
  Sparkles,
  Repeat,
  ShoppingCart,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Store,
  Calendar,
} from 'lucide-react';
import api from '@/services/api';
import { formatCurrency } from '@/utils/format';

const PERIOD_PRESETS = [
  { id: 'today', label: 'Hoje' },
  { id: 'yesterday', label: 'Ontem' },
  { id: '7d', label: 'Últimos 7 dias' },
  { id: '30d', label: 'Últimos 30 dias' },
  { id: 'this_month', label: 'Este Mês' },
  { id: 'last_month', label: 'Mês Anterior' },
];

function fmtDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getPresetDates(preset) {
  const today = new Date();
  if (preset === 'today') {
    const s = fmtDateISO(today);
    return { start: s, end: s };
  }
  if (preset === 'yesterday') {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const s = fmtDateISO(y);
    return { start: s, end: s };
  }
  if (preset === '7d') {
    const past = new Date(today);
    past.setDate(past.getDate() - 6);
    return { start: fmtDateISO(past), end: fmtDateISO(today) };
  }
  if (preset === '30d') {
    const past = new Date(today);
    past.setDate(past.getDate() - 29);
    return { start: fmtDateISO(past), end: fmtDateISO(today) };
  }
  if (preset === 'this_month') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: fmtDateISO(first), end: fmtDateISO(today) };
  }
  if (preset === 'last_month') {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { start: fmtDateISO(first), end: fmtDateISO(last) };
  }
  const s = fmtDateISO(today);
  return { start: s, end: s };
}

function formatRate(rate) {
  if (rate == null || Number.isNaN(Number(rate))) return '—';
  return `${Number(rate).toFixed(1).replace('.', ',')}%`;
}

function formatMoney(v) {
  return v != null ? formatCurrency(v) : '—';
}

export default function AddonsDashboard() {
  const initialRange = getPresetDates('7d');
  const [preset, setPreset] = useState('7d');
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [storeId, setStoreId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });
      if (storeId) params.set('store_id', storeId);
      const res = await api.get(`/admin/addons-dashboard?${params}`);
      setData(res.data);
    } catch (err) {
      setError(err?.response?.data?.error || 'Erro ao carregar dashboard de adicionais.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, storeId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  function handlePreset(p) {
    setPreset(p);
    const range = getPresetDates(p);
    setStartDate(range.start);
    setEndDate(range.end);
  }

  const summary = data?.summary;
  const checkoutAddon = summary?.checkout_addon || {};
  const areaCliente = summary?.area_cliente || {};
  const recompra = summary?.recompra || {};
  const dailyStats = data?.daily_stats || [];
  const byStore = data?.by_store || [];
  const byAddonProduct = data?.by_addon_product || [];
  const availableStores = data?.available_stores || [];
  const isEmpty = !loading && !error && summary && summary.total_orders === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Adicionais & Área do Cliente</h1>
          <p className="text-sm text-gray-400 mt-1">
            Order bumps do checkout e compras na área do cliente por dia (BRT) e por loja
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {PERIOD_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePreset(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                preset === p.id
                  ? 'bg-violet-600 text-white'
                  : 'bg-gray-900 text-gray-300 hover:bg-gray-700 border border-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Data inicial</span>
            <input
              aria-label="Data inicial"
              type="date"
              value={startDate}
              onChange={(e) => {
                setPreset('custom');
                setStartDate(e.target.value);
              }}
              className="bg-gray-900 border border-gray-600 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Data final</span>
            <input
              aria-label="Data final"
              type="date"
              value={endDate}
              onChange={(e) => {
                setPreset('custom');
                setEndDate(e.target.value);
              }}
              className="bg-gray-900 border border-gray-600 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            <span className="inline-flex items-center gap-1"><Store className="h-3.5 w-3.5" /> Loja</span>
            <select
              aria-label="Loja"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="bg-gray-900 border border-gray-600 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
            >
              <option value="">Todas as lojas</option>
              {availableStores.map((s) => (
                <option key={s.store_id} value={String(s.store_id)}>
                  {s.store_name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Erro com acao de retry */}
      {error && (
        <div
          role="alert"
          className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-red-300 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchDashboard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-xs font-medium transition-colors self-start sm:self-auto"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
          </button>
        </div>
      )}

      {/* Aviso de historico pre-marcador estimado */}
      {!error && data?.has_estimated_history && (
        <div
          role="status"
          className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 text-amber-200 text-xs"
        >
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Histórico pré-marcador estimado: </span>
            este período inclui vendas anteriores ao marcador explícito da Área do Cliente
            {data.marker_cutoff_brt ? ` (${data.marker_cutoff_brt} BRT)` : ''}. A separação entre Área do Cliente e Recompra nessas datas é estimada por dedução.
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-800/60 border border-gray-700 rounded-xl p-5 animate-pulse h-32" />
          ))}
        </div>
      )}

      {/* KPIs principais */}
      {!loading && !error && summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={<ShoppingBag className="h-4 w-4" />}
            color="amber"
            label="Adicionais no Checkout"
            value={formatMoney(checkoutAddon.gross)}
            sub={`Líquido: ${formatMoney(checkoutAddon.net)} · ${checkoutAddon.orders ?? 0} vendas (${formatRate(checkoutAddon.attachment_rate)} anexação) · ${checkoutAddon.items ?? 0} itens`}
          />
          <KpiCard
            icon={<Sparkles className="h-4 w-4" />}
            color="violet"
            label="Área do Cliente"
            value={formatMoney(areaCliente.gross)}
            sub={`Líquido: ${formatMoney(areaCliente.net)} · ${areaCliente.orders ?? 0} vendas (${formatRate(areaCliente.total_share_rate)} do total) · ${areaCliente.items ?? 0} itens`}
          />
          <KpiCard
            icon={<Repeat className="h-4 w-4" />}
            color="cyan"
            label="Recompras (WhatsApp / Checkout)"
            value={formatMoney(recompra.gross)}
            sub={`Líquido: ${formatMoney(recompra.net)} · ${recompra.orders ?? 0} vendas (${formatRate(recompra.total_share_rate)} do total)`}
          />
          <KpiCard
            icon={<ShoppingCart className="h-4 w-4" />}
            color="green"
            label="Vendas Canônicas (Total)"
            value={`${summary.total_orders ?? 0}`}
            sub={`Checkout público: ${summary.checkout_orders ?? 0} · Bruto: ${formatMoney(summary.total_gross)} · Líq.: ${formatMoney(summary.total_net)}`}
          />
        </div>
      )}

      {/* Estado vazio */}
      {isEmpty && (
        <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-8 text-center text-sm text-gray-400">
          Nenhuma venda aprovada encontrada no período e loja selecionados.
        </div>
      )}

      {/* Quebra diaria + por loja + por produto */}
      {!loading && !error && summary && !isEmpty && (
        <>
          {/* Serie diaria continua */}
          <section className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-700">
              <h2 className="text-sm font-semibold text-white">Evolução Diária (BRT)</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Todos os dias do intervalo selecionado, com taxa de anexação e receitas rateadas
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-900/50 text-xs text-gray-400 uppercase">
                  <tr>
                    <th className="px-4 py-3">Dia</th>
                    <th className="px-4 py-3">Checkout</th>
                    <th className="px-4 py-3">C/ Adicional</th>
                    <th className="px-4 py-3">Taxa</th>
                    <th className="px-4 py-3">Itens Bump</th>
                    <th className="px-4 py-3">Bump Bruto</th>
                    <th className="px-4 py-3">Bump Líq.</th>
                    <th className="px-4 py-3">Área Cliente</th>
                    <th className="px-4 py-3">Área Bruto</th>
                    <th className="px-4 py-3">Recompra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/60 text-gray-300">
                  {dailyStats.map((d) => (
                    <tr key={d.date} className="hover:bg-gray-700/20">
                      <td className="px-4 py-2.5 whitespace-nowrap font-medium text-white">{d.label}</td>
                      <td className="px-4 py-2.5">{d.checkout_orders}</td>
                      <td className="px-4 py-2.5">{d.checkout_addon_orders}</td>
                      <td className="px-4 py-2.5">{formatRate(d.attachment_rate)}</td>
                      <td className="px-4 py-2.5">{d.checkout_addon_items}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">{formatMoney(d.checkout_addon_gross)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-emerald-300">{formatMoney(d.checkout_addon_net)}</td>
                      <td className="px-4 py-2.5">{d.area_orders}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">{formatMoney(d.area_gross)}</td>
                      <td className="px-4 py-2.5">{d.recompra_orders}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Por loja */}
            <section className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-700">
                <h2 className="text-sm font-semibold text-white">Por Loja (Checkout / Venda)</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-900/50 text-xs text-gray-400 uppercase">
                    <tr>
                      <th className="px-4 py-3">Loja</th>
                      <th className="px-4 py-3">Checkout</th>
                      <th className="px-4 py-3">C/ Adic.</th>
                      <th className="px-4 py-3">Taxa</th>
                      <th className="px-4 py-3">Bump Bruto</th>
                      <th className="px-4 py-3">Área Cliente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/60 text-gray-300">
                    {byStore.map((s) => (
                      <tr key={s.store_id ?? s.store_name} className="hover:bg-gray-700/20">
                        <td className="px-4 py-2.5 font-medium text-white">{s.store_name}</td>
                        <td className="px-4 py-2.5">{s.checkout_orders}</td>
                        <td className="px-4 py-2.5">{s.checkout_addon_orders}</td>
                        <td className="px-4 py-2.5">{formatRate(s.attachment_rate)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{formatMoney(s.checkout_addon_gross)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {s.area_orders} ({formatMoney(s.area_gross)})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Ranking de produtos adicionais */}
            <section className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-700">
                <h2 className="text-sm font-semibold text-white">Produtos Adicionais Vendidos</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-900/50 text-xs text-gray-400 uppercase">
                    <tr>
                      <th className="px-4 py-3">Produto</th>
                      <th className="px-4 py-3">Canal</th>
                      <th className="px-4 py-3">Qtd</th>
                      <th className="px-4 py-3">Bruto</th>
                      <th className="px-4 py-3">Líquido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/60 text-gray-300">
                    {byAddonProduct.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-gray-500 text-xs">
                          Nenhum adicional vendido no recorte.
                        </td>
                      </tr>
                    ) : (
                      byAddonProduct.map((p) => (
                        <tr key={`${p.channel}-${p.product_id}-${p.title}`} className="hover:bg-gray-700/20">
                          <td className="px-4 py-2.5 font-medium text-white">{p.title}</td>
                          <td className="px-4 py-2.5 text-xs">{p.channel_label}</td>
                          <td className="px-4 py-2.5">{p.items}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap">{formatMoney(p.gross)}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-emerald-300">{formatMoney(p.net)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

const KPI_COLORS = {
  amber: 'text-amber-400 bg-amber-500/10',
  violet: 'text-violet-400 bg-violet-500/10',
  cyan: 'text-cyan-400 bg-cyan-500/10',
  green: 'text-green-400 bg-green-500/10',
};

function KpiCard({ icon, label, value, sub, color = 'violet' }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
        <span className={`p-2 rounded-lg ${KPI_COLORS[color] || KPI_COLORS.violet}`}>{icon}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1.5 leading-relaxed">{sub}</div>}
    </div>
  );
}
