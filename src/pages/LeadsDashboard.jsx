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
import { todayISO, formatDate, formatUtcDateTime } from '@/utils/format';

function formatNumber(num) {
  if (num == null) return '0';
  return Number(num).toLocaleString('pt-BR');
}

function calculateMovingAverage(items, windowSize, getValue) {
  if (!items || !items.length) return [];
  if (!windowSize || windowSize <= 1) {
    return items.map((item) => getValue(item));
  }

  return items.map((item, idx) => {
    const startIdx = Math.max(0, idx - windowSize + 1);
    let sum = 0;
    let count = 0;
    for (let k = startIdx; k <= idx; k++) {
      const v = getValue(items[k]);
      if (typeof v === 'number' && !isNaN(v)) {
        sum += v;
        count++;
      }
    }
    if (count === 0) return 0;
    const avg = sum / count;
    return Math.round(avg * 10) / 10;
  });
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

// Origem das vendas (docs/modules/remarketing/changes/2026-10-12-origem-das-vendas-meta-ou-sem-sinal/).
// O backend calcula as 4 janelas; a tela só escolhe uma (EARS-10). Números só com
// `disponivel === true`: campo ausente ou falso é "indisponível", nunca zero (EARS-13).
const ORIGEM_JANELAS = [1, 7, 28, 90];

const ORIGEM_CLASSES = [
  { key: 'meta', label: 'Meta (Facebook/Instagram)', bar: 'bg-blue-500', text: 'text-blue-300' },
  { key: 'sem_sinal', label: 'Sem sinal do Meta', bar: 'bg-gray-400', text: 'text-gray-200' },
  { key: 'sem_dados', label: 'Sem dados para classificar', bar: 'bg-amber-500', text: 'text-amber-300' },
];

const ORIGEM_VIAS = [
  { key: 'no_checkout', label: 'No checkout' },
  { key: 'visita_anterior', label: 'Visita anterior' },
  { key: 'anuncio_whatsapp', label: 'Anúncio para WhatsApp' },
];

const ORIGEM_FAIXAS = [
  { key: 'ate_1d', label: 'Até 1 dia' },
  { key: 'de_1_a_7d', label: '1 a 7 dias' },
  { key: 'de_7_a_28d', label: '7 a 28 dias' },
  { key: 'de_28_a_90d', label: '28 a 90 dias' },
];

function formatPct(pct) {
  return `${Number(pct).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function OrigemVendas({ origem, loading }) {
  const [janelaEscolhida, setJanelaEscolhida] = useState(null);
  const disponivel = origem?.disponivel === true;
  const janela = janelaEscolhida ?? origem?.janela_padrao ?? 7;
  const bloco = disponivel ? origem.por_janela?.[String(janela)] : null;
  const total = disponivel ? origem.total_compradores : null;

  let corpo;
  if (loading) {
    corpo = <div className="py-6 text-center text-gray-500 text-sm">Carregando...</div>;
  } else if (!disponivel || !bloco) {
    corpo = (
      <div className="py-6 flex items-center justify-center gap-2 text-gray-400 text-sm">
        <AlertCircle className="h-4 w-4 text-amber-400" />
        Origem das vendas indisponível
      </div>
    );
  } else {
    corpo = (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Compradores do período
            </div>
            <div className="text-2xl font-black text-white">{formatNumber(total)}</div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Cada lead conta uma vez ({formatNumber(origem.total_pagamentos)} pagamentos). Não é a etapa
              “Vendas Aprovadas” do funil.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs flex-wrap">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mr-1">
              Janela do clique:
            </span>
            {ORIGEM_JANELAS.map((j) => (
              <button
                key={j}
                type="button"
                aria-pressed={j === janela}
                onClick={() => setJanelaEscolhida(j)}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                  j === janela
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-gray-900/60 text-gray-400 hover:bg-gray-700 hover:text-gray-200 border border-gray-700/60'
                }`}
              >
                {j === 1 ? '1 dia' : `${j} dias`}
              </button>
            ))}
          </div>
        </div>

        {total === 0 ? (
          <div className="py-4 text-center text-gray-400 text-sm">Nenhuma venda no período</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {ORIGEM_CLASSES.map((c) => {
                const item = bloco[c.key] || {};
                return (
                  <div key={c.key} className="bg-gray-900/70 border border-gray-800 rounded-xl p-3">
                    <div className="text-[11px] text-gray-400 font-medium">{c.label}</div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className={`text-xl font-black ${c.text}`}>{formatPct(item.pct)}</span>
                      <span className="text-xs text-gray-400">{formatNumber(item.n)} {item.n === 1 ? 'comprador' : 'compradores'}</span>
                    </div>
                    <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden mt-2">
                      <div className={`h-full ${c.bar}`} style={{ width: `${Math.min(100, item.pct || 0)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3">
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Vendas Meta por via (janela de {janela === 1 ? '1 dia' : `${janela} dias`})
                </div>
                {ORIGEM_VIAS.map((v) => (
                  <div key={v.key} className="flex items-center justify-between py-0.5">
                    <span className="text-gray-400">{v.label}</span>
                    <span className="font-bold text-gray-200">{formatNumber(bloco.vias?.[v.key])}</span>
                  </div>
                ))}
              </div>
              <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3">
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Tempo entre o clique e a compra (até 90 dias)
                </div>
                {ORIGEM_FAIXAS.map((f) => (
                  <div key={f.key} className="flex items-center justify-between py-0.5">
                    <span className="text-gray-400">{f.label}</span>
                    <span className="font-bold text-gray-200">{formatNumber(origem.faixas_atraso?.[f.key])}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <p className="text-[11px] text-gray-500 leading-relaxed border-t border-gray-800 pt-3">
          “Sem sinal do Meta” inclui outros canais (TikTok, Google, indicação), clique em outro aparelho sem
          contato informado, visualização sem clique e rastro apagado pelo navegador. O total não é comparável
          ao “Purchase” do Gerenciador de Anúncios.
        </p>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="origem-vendas-titulo"
      className="bg-gray-800/70 border border-gray-700/80 rounded-2xl p-5 shadow-lg"
    >
      <div className="mb-4">
        <h2 id="origem-vendas-titulo" className="text-base font-bold text-white flex items-center gap-2">
          <Percent className="h-5 w-5 text-violet-400" />
          Origem das vendas
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Que parte dos compradores clicou num anúncio ou post do Facebook/Instagram antes de comprar
        </p>
      </div>
      {corpo}
    </section>
  );
}

// Onde o checkout perde a venda (docs/modules/telemetria/changes/2026-10-26-funil-do-checkout-por-pessoa-no-dashboard-de-leads/).
// Fetch próprio em /admin/leads/checkout-funnel: a falha dele não derruba os blocos antigos.
// Números só com `disponivel === true`; falha é "indisponível", nunca zero (EARS-21).
const FUNIL_TRANSICOES = [
  { id: 'abriu_contato', label: 'Abriu o checkout ➔ preencheu contato', unidade: 'registro do checkout', color: '#06b6d4', bgClass: 'bg-cyan-500' },
  { id: 'contato_gerou', label: 'Preencheu contato ➔ gerou pagamento', unidade: 'registro com contato', color: '#f59e0b', bgClass: 'bg-amber-500' },
  { id: 'gerou_pagou', label: 'Gerou pagamento ➔ pagou', unidade: 'pessoa', color: '#10b981', bgClass: 'bg-emerald-500' },
];

const FUNIL_MEIOS = [
  { key: 'pix', label: 'PIX' },
  { key: 'cartao', label: 'Cartão' },
];

const COLETA_ATRASADA_MS = 60 * 60 * 1000;

function formatPp(dif) {
  if (dif == null) return 'sem dados';
  const s = Number(dif).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${dif > 0 ? '+' : ''}${s} pp`;
}

function LadoFunil({ lado, desde }) {
  if (!lado || lado.cobertura === 'nenhuma') return <span className="text-gray-500">sem cobertura</span>;
  if (lado.pct == null) return <span className="text-gray-500">sem dados</span>;
  return (
    <span>
      <span className="font-bold text-gray-100">{formatPct(lado.pct)}</span>{' '}
      <span className="text-gray-500">({formatNumber(lado.num)}/{formatNumber(lado.den)})</span>
      {lado.aguardando > 0 && (
        <span className="block text-[10px] text-gray-500">{formatNumber(lado.aguardando)} aguardando 24 h</span>
      )}
      {lado.cobertura === 'parcial' && (
        <span className="block text-[10px] text-amber-400">cobertura só desde {formatDate(desde)}</span>
      )}
    </span>
  );
}

function DifFunil({ dif }) {
  const cor = dif == null ? 'text-gray-500' : dif < 0 ? 'text-red-400' : dif > 0 ? 'text-emerald-400' : 'text-gray-300';
  return <span className={`font-bold whitespace-nowrap ${cor}`}>{formatPp(dif)}</span>;
}

function DetalheFunil({ titulo, linhas, rotulo, desde }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{titulo}</div>
      <table className="w-full text-xs">
        <tbody>
          {linhas.map((l) => (
            <tr key={rotulo(l)} className="border-t border-gray-800">
              <td className="py-1 pr-3 text-gray-300">{rotulo(l)}</td>
              <td className="py-1 pr-3"><LadoFunil lado={l.periodo} desde={desde} /></td>
              <td className="py-1 pr-3"><LadoFunil lado={l.base} desde={desde} /></td>
              <td className="py-1"><DifFunil dif={l.dif_pp} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GraficoSemanalFunil({ serie, meio }) {
  const valor = (semana, id) => (id === 'gerou_pagou' && meio ? semana.gerou_pagou_por_meio?.[meio] : semana[id]);
  const x = (idx) => 50 + (idx / Math.max(1, serie.length - 1)) * 730;
  const y = (pct) => 200 - (pct / 100) * 180;

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[560px]">
        <svg viewBox="0 0 800 250" className="w-full h-64 overflow-visible" role="img" aria-label="Taxa semanal por transição">
          {[0, 25, 50, 75, 100].map((pct) => (
            <g key={pct}>
              <line x1="45" y1={y(pct)} x2="790" y2={y(pct)} stroke="#374151" strokeDasharray="3 3" strokeWidth="1" />
              <text x="40" y={y(pct) + 3} fill="#9ca3af" fontSize="10" textAnchor="end">{pct}%</text>
            </g>
          ))}

          {FUNIL_TRANSICOES.map((t) => (
            <g key={t.id}>
              {serie.map((semana, idx) => {
                if (idx === 0) return null;
                const a = valor(serie[idx - 1], t.id);
                const b = valor(semana, t.id);
                if (a?.pct == null || b?.pct == null) return null;
                return (
                  <line
                    key={idx}
                    x1={x(idx - 1)}
                    y1={y(a.pct)}
                    x2={x(idx)}
                    y2={y(b.pct)}
                    stroke={t.color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={semana.parcial ? '5 4' : undefined}
                  />
                );
              })}
              {serie.map((semana, idx) => {
                const v = valor(semana, t.id);
                if (v?.pct == null) return null;
                return (
                  <circle
                    key={idx}
                    cx={x(idx)}
                    cy={y(v.pct)}
                    r="3.5"
                    fill={semana.parcial ? '#1f2937' : t.color}
                    stroke={t.color}
                    strokeWidth="2"
                    data-parcial={semana.parcial ? 'true' : 'false'}
                  >
                    <title>
                      {`${t.label}: ${formatPct(v.pct)} (${formatNumber(v.num)}/${formatNumber(v.den)}) • ${semana.semana}${semana.parcial ? ' (parcial)' : ''}`}
                    </title>
                  </circle>
                );
              })}
            </g>
          ))}

          {serie.map((semana, idx) => (
            <g key={semana.semana}>
              <text x={x(idx)} y="222" fill="#9ca3af" fontSize="10" textAnchor="middle">
                {formatDate(semana.inicio).slice(0, 5)}
              </text>
              {semana.parcial && (
                <text x={x(idx)} y="236" fill="#fbbf24" fontSize="10" textAnchor="middle">parcial</text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function FunilCheckout({ startDate, endDate, storeId, stores, recarga }) {
  const [estado, setEstado] = useState({ carregando: true });
  const [baseInicio, setBaseInicio] = useState('');
  const [baseFim, setBaseFim] = useState('');
  const [aberta, setAberta] = useState(null);
  const [meioGrafico, setMeioGrafico] = useState('');
  // A base escolhida só vai ao backend com as duas datas; senão vale a padrão (4 janelas).
  const baseEscolhida = baseInicio && baseFim ? `${baseInicio}|${baseFim}` : '';

  useEffect(() => {
    let ativo = true;
    setEstado({ carregando: true });
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    if (storeId) params.set('store_id', storeId);
    if (baseEscolhida) {
      const [ini, fim] = baseEscolhida.split('|');
      params.set('base_start', ini);
      params.set('base_end', fim);
    }
    api.get(`/admin/leads/checkout-funnel?${params}`)
      .then((res) => {
        if (ativo) setEstado({ dados: res.data });
      })
      .catch((err) => {
        if (!ativo) return;
        const erro400 = err.response?.status === 400 ? err.response.data?.error : null;
        setEstado({ erro: erro400 });
      });
    return () => {
      ativo = false;
    };
  }, [startDate, endDate, storeId, baseEscolhida, recarga]);

  const nomeLoja = (id) => {
    if (id == null) return 'Sem loja';
    const loja = stores.find((s) => String(s.id) === String(id));
    return loja ? loja.name : `Loja ${id}`;
  };

  const dados = estado.dados;
  const disponivel = dados?.disponivel === true;

  let corpo;
  if (estado.carregando) {
    corpo = <div className="py-6 text-center text-gray-500 text-sm">Carregando...</div>;
  } else if (estado.erro) {
    corpo = (
      <div className="py-6 flex items-center justify-center gap-2 text-amber-300 text-sm">
        <AlertCircle className="h-4 w-4" />
        {estado.erro}
      </div>
    );
  } else if (!disponivel) {
    corpo = (
      <div className="py-6 flex items-center justify-center gap-2 text-gray-400 text-sm">
        <AlertCircle className="h-4 w-4 text-amber-400" />
        Funil do checkout indisponível
      </div>
    );
  } else {
    const desde = dados.cobertura_mp_desde;
    const ultima = dados.ultima_coleta_mp ? new Date(dados.ultima_coleta_mp) : null;
    const atrasada = !ultima || Date.now() - ultima.getTime() > COLETA_ATRASADA_MS;
    const porId = Object.fromEntries((dados.transicoes || []).map((t) => [t.id, t]));
    const ret = dados.retentativas || {};
    const combos = dados.combos || {};
    const serie = dados.serie_semanal || [];

    corpo = (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="text-gray-400">
            Período <span className="text-gray-200 font-semibold">{formatDate(dados.periodo?.inicio)} a {formatDate(dados.periodo?.fim)}</span>
            {' '}x base <span className="text-gray-200 font-semibold">{formatDate(dados.base?.inicio)} a {formatDate(dados.base?.fim)}</span>
            {dados.base?.padrao && <span className="text-gray-500"> (as 4 janelas anteriores)</span>}
          </div>
          <div className={`flex items-center gap-1.5 ${atrasada ? 'text-amber-300' : 'text-gray-400'}`}>
            <Clock className="h-3.5 w-3.5" />
            {ultima ? (
              <span>Última coleta do Mercado Pago: {formatUtcDateTime(dados.ultima_coleta_mp)}</span>
            ) : (
              <span>Nenhuma coleta do Mercado Pago registrada</span>
            )}
            {atrasada && <span className="font-semibold">• Coleta atrasada (mais de 1 hora)</span>}
          </div>
        </div>

        {/* `relative`: sem ele o `sr-only` do cabeçalho (position: absolute) escapa da rolagem
            da tabela e faz a página inteira rolar de lado no celular. */}
        <div className="relative w-full overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-[11px] text-gray-400 uppercase tracking-wider text-left">
                <th className="py-2 pr-3 font-semibold">Transição</th>
                <th className="py-2 pr-3 font-semibold">Unidade</th>
                <th className="py-2 pr-3 font-semibold">Período</th>
                <th className="py-2 pr-3 font-semibold">Base</th>
                <th className="py-2 pr-3 font-semibold">Diferença</th>
                <th className="py-2 font-semibold"><span className="sr-only">Detalhe</span></th>
              </tr>
            </thead>
            <tbody>
              {FUNIL_TRANSICOES.map((meta) => {
                const t = porId[meta.id];
                if (!t) return null;
                const expandida = aberta === meta.id;
                return (
                  <FragmentoTransicao
                    key={meta.id}
                    meta={meta}
                    t={t}
                    expandida={expandida}
                    alternar={() => setAberta(expandida ? null : meta.id)}
                    nomeLoja={nomeLoja}
                    desde={desde}
                  />
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Retentativas</div>
            {['periodo', 'base'].map((lado) => {
              const r = ret[lado];
              return (
                <div key={lado} className="flex items-center justify-between py-0.5">
                  <span className="text-gray-400">{lado === 'periodo' ? 'Período' : 'Base'}</span>
                  {!r || r.cobertura === 'nenhuma' ? (
                    <span className="text-gray-500">sem cobertura</span>
                  ) : (
                    <span className="text-gray-200">
                      <span className="font-bold">{formatNumber(r.pagou_depois)}</span> de {formatNumber(r.episodios)} pagaram depois
                      {' '}• {formatNumber(r.valor_menor)} com valor menor
                    </span>
                  )}
                </div>
              );
            })}
            <p className="text-[10px] text-gray-500 mt-1">
              Episódios em que o primeiro pagamento não foi aprovado e um posterior foi; “valor menor” = pagou menos que o
              primeiro (tirou o combo).
            </p>
          </div>
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Combos</div>
            {['periodo', 'base'].map((lado) => (
              <div key={lado} className="flex items-center justify-between py-0.5">
                <span className="text-gray-400">{lado === 'periodo' ? 'Período' : 'Base'}</span>
                <LadoFunil lado={combos[lado]} desde={desde} />
              </div>
            ))}
            <p className="text-[10px] text-gray-500 mt-1">Pagamentos aprovados com mais de um produto, sobre os aprovados.</p>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-gray-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Taxa semanal (semanas de segunda a domingo)
            </div>
            <div className="flex items-center gap-1.5 text-xs flex-wrap">
              <span className="text-[11px] text-gray-400 mr-1">Gerou ➔ pagou:</span>
              {[{ key: '', label: 'Todos os meios' }, ...FUNIL_MEIOS].map((m) => (
                <button
                  key={m.key || 'todos'}
                  type="button"
                  aria-pressed={meioGrafico === m.key}
                  onClick={() => setMeioGrafico(m.key)}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                    meioGrafico === m.key
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-gray-900/60 text-gray-400 hover:bg-gray-700 hover:text-gray-200 border border-gray-700/60'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap text-[11px] text-gray-400">
            {FUNIL_TRANSICOES.map((t) => (
              <span key={t.id} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${t.bgClass}`} />
                {t.label}
              </span>
            ))}
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full border border-gray-400 inline-block" />
              ponto vazado = semana parcial
            </span>
          </div>
          {serie.length ? (
            <GraficoSemanalFunil serie={serie} meio={meioGrafico} />
          ) : (
            <div className="py-6 text-center text-gray-500 text-sm">Sem semanas para mostrar.</div>
          )}
        </div>

        <p className="text-[11px] text-gray-500 leading-relaxed border-t border-gray-800 pt-3">
          As duas primeiras transições vêm do último status de cada registro do checkout, não da pessoa: a tabela de
          leads guarda só o último status e a última data de cada registro, e uma abertura anônima conta uma vez por
          navegador. “Gerou ➔ pagou” conta pessoas (mesmo e-mail, telefone ou pedido) por episódio de 24 h: pago se
          algum pagamento foi aprovado em até 24 h do primeiro; episódios com menos de 24 h ficam fora da taxa, como
          “aguardando”. As fontes não são a mesma população.
        </p>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="funil-checkout-titulo"
      className="bg-gray-800/70 border border-gray-700/80 rounded-2xl p-5 shadow-lg"
    >
      <div className="mb-4 flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <h2 id="funil-checkout-titulo" className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-violet-400" />
            Onde o checkout perde a venda
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Taxa de cada etapa do checkout no período contra a base</p>
        </div>
        <div className="flex items-end gap-2 text-xs flex-wrap">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Base de</span>
            <input
              type="date"
              aria-label="Início da base"
              value={baseInicio}
              onChange={(e) => setBaseInicio(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-violet-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">até</span>
            <input
              type="date"
              aria-label="Fim da base"
              value={baseFim}
              onChange={(e) => setBaseFim(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-violet-500"
            />
          </label>
          {(baseInicio || baseFim) && (
            <button
              type="button"
              onClick={() => {
                setBaseInicio('');
                setBaseFim('');
              }}
              className="text-[11px] text-violet-400 hover:text-violet-300 underline pb-1.5"
            >
              Usar a base padrão
            </button>
          )}
        </div>
      </div>
      {corpo}
    </section>
  );
}

function FragmentoTransicao({ meta, t, expandida, alternar, nomeLoja, desde }) {
  return (
    <>
      <tr className="border-t border-gray-700/60 align-top">
        <td className="py-2 pr-3 text-gray-200 font-medium">
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${meta.bgClass}`} />
            {meta.label}
          </span>
        </td>
        <td className="py-2 pr-3 text-xs text-gray-400">{meta.unidade}</td>
        <td className="py-2 pr-3 text-xs"><LadoFunil lado={t.periodo} desde={desde} /></td>
        <td className="py-2 pr-3 text-xs"><LadoFunil lado={t.base} desde={desde} /></td>
        <td className="py-2 pr-3 text-xs"><DifFunil dif={t.dif_pp} /></td>
        <td className="py-2 text-right">
          <button
            type="button"
            aria-expanded={expandida}
            aria-label={`Detalhe de ${meta.label}`}
            onClick={alternar}
            className="text-[11px] text-violet-400 hover:text-violet-300 underline whitespace-nowrap"
          >
            {expandida ? 'Fechar' : 'Detalhe'}
          </button>
        </td>
      </tr>
      {expandida && (
        <tr>
          <td colSpan={6} className="pb-3">
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3 space-y-3">
              <DetalheFunil
                titulo="Por loja"
                linhas={t.por_loja || []}
                rotulo={(l) => nomeLoja(l.store_id)}
                desde={desde}
              />
              {t.por_meio && (
                <>
                  <DetalheFunil
                    titulo="Por meio"
                    linhas={t.por_meio}
                    rotulo={(l) => FUNIL_MEIOS.find((m) => m.key === l.meio)?.label || l.meio}
                    desde={desde}
                  />
                  <p className="text-[10px] text-gray-500">
                    Uma pessoa que gerou PIX e cartão no mesmo episódio aparece nos dois; os meios não somam o total.
                  </p>
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
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
  // "Atualizar" também recarrega o bloco do funil do checkout, que tem fetch próprio.
  const [recargaFunil, setRecargaFunil] = useState(0);

  // Chart view mode: 'rates' (Taxas de Conversão %) | 'volumes' (Volume dos Estágios)
  const [chartTab, setChartTab] = useState('rates');

  // Active series toggles for volumes chart
  const [visibleSeries, setVisibleSeries] = useState({
    PageView: true,
    AddToCart: true,
    Lead: true,
    InitiateCheckout: true,
    Purchase: true,
  });

  // Active rate series toggles for conversion rates chart
  const [visibleRateSeries, setVisibleRateSeries] = useState({
    pageview_to_cart_pct: true,
    cart_to_lead_pct: true,
    lead_to_initiate_pct: true,
    initiate_to_purchase_pct: true,
    overall_conversion_pct: true,
  });

  // Moving average state (checkbox & window)
  const [enableMovingAverage, setEnableMovingAverage] = useState(false);
  const [movingAverageWindow, setMovingAverageWindow] = useState(7);

  // Keep window adapted when groupBy changes
  useEffect(() => {
    if (groupBy === 'weekly') {
      setMovingAverageWindow(4);
    } else if (groupBy === 'monthly') {
      setMovingAverageWindow(3);
    } else {
      setMovingAverageWindow(7);
    }
  }, [groupBy]);

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
      label: '3. Contatos Capturados',
      sublabel: `${formatNumber(funnel.lead_count)} pararam nesta etapa`,
      count: funnel.total_captured_contacts,
      color: 'from-cyan-500 to-teal-600',
      bgColor: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
      icon: Users,
      nextRate: rates.lead_to_initiate_pct,
      nextLabel: 'Taxa checkout',
      dropOff: funnel.total_captured_contacts > 0 ? Math.max(0, 100 - rates.lead_to_initiate_pct) : 0,
    },
    {
      id: 'InitiateCheckout',
      label: '4. Checkouts Iniciados',
      sublabel: `${formatNumber(funnel.initiate_checkout_count)} pendentes / abandonados`,
      count: funnel.total_initiated_checkout ?? (funnel.initiate_checkout_count + funnel.purchase_count),
      color: 'from-amber-500 to-orange-600',
      bgColor: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
      icon: CreditCard,
      nextRate: rates.initiate_to_purchase_pct,
      nextLabel: 'Taxa pagamento',
      dropOff: (funnel.total_initiated_checkout || (funnel.initiate_checkout_count + funnel.purchase_count)) > 0
        ? Math.max(0, 100 - rates.initiate_to_purchase_pct)
        : 0,
    },
    {
      id: 'Purchase',
      label: '5. Vendas Aprovadas',
      sublabel: 'Pagamento concluído',
      count: funnel.purchase_count,
      color: 'from-emerald-500 to-green-600',
      bgColor: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
      icon: CheckCircle2,
      nextRate: null,
      nextLabel: null,
      dropOff: null,
    },
  ];

  const seriesMeta = [
    { key: 'PageView', label: 'PageView', color: '#3b82f6', bgClass: 'bg-blue-500' },
    { key: 'AddToCart', label: 'AddToCart', color: '#a855f7', bgClass: 'bg-purple-500' },
    { key: 'Lead', label: 'Lead (Contatos)', color: '#06b6d4', bgClass: 'bg-cyan-500' },
    { key: 'InitiateCheckout', label: 'Checkout', color: '#f59e0b', bgClass: 'bg-amber-500' },
    { key: 'Purchase', label: 'Purchase', color: '#10b981', bgClass: 'bg-emerald-500' },
  ];

  const rateSeriesMeta = [
    { key: 'pageview_to_cart_pct', label: 'Taxa de Clique na Oferta (PV ➔ Cart)', shortLabel: 'Clique na Oferta', color: '#a855f7', bgClass: 'bg-purple-500' },
    { key: 'cart_to_lead_pct', label: 'Taxa de Captura de Lead (Cart ➔ Lead)', shortLabel: 'Captura de Lead', color: '#06b6d4', bgClass: 'bg-cyan-500' },
    { key: 'lead_to_initiate_pct', label: 'Taxa de Início de Checkout (Lead ➔ Checkout)', shortLabel: 'Início de Checkout', color: '#f59e0b', bgClass: 'bg-amber-500' },
    { key: 'initiate_to_purchase_pct', label: 'Conversão de Pagamento (Checkout ➔ Purchase)', shortLabel: 'Conv. Pagamento', color: '#10b981', bgClass: 'bg-emerald-500' },
    { key: 'overall_conversion_pct', label: 'Conversão Geral (PV ➔ Purchase)', shortLabel: 'Conversão Geral', color: '#8b5cf6', bgClass: 'bg-violet-500' },
  ];

  function getSeriesValue(item, key) {
    if (!item) return 0;
    if (key === 'PageView') return item.pageview_count || 0;
    if (key === 'AddToCart') return item.add_to_cart_count || 0;
    if (key === 'Lead') return item.total_captured_contacts ?? item.lead_count ?? 0;
    if (key === 'InitiateCheckout') {
      return item.total_initiated_checkout ?? ((item.initiate_checkout_count || 0) + (item.purchase_count || 0));
    }
    if (key === 'Purchase') return item.purchase_count || 0;
    return 0;
  }

  function getRateSeriesValue(item, key) {
    if (!item) return 0;
    const v = item[key];
    return typeof v === 'number' ? v : 0;
  }

  // Chart max value calculation for volumes
  const chartMax = useMemo(() => {
    if (!timeSeries.length) return 100;
    let max = 0;
    for (const item of timeSeries) {
      for (const s of seriesMeta) {
        if (visibleSeries[s.key]) {
          const val = getSeriesValue(item, s.key);
          if (val > max) max = val;
        }
      }
    }
    return max > 0 ? max * 1.15 : 100;
  }, [timeSeries, visibleSeries]);

  // Chart max value calculation for rates (%)
  const rateChartMax = useMemo(() => {
    if (!timeSeries.length) return 100;
    let max = 0;
    for (const item of timeSeries) {
      for (const s of rateSeriesMeta) {
        if (visibleRateSeries[s.key]) {
          const val = getRateSeriesValue(item, s.key);
          if (val > max) max = val;
        }
      }
    }
    return Math.max(100, Math.ceil((max * 1.1) / 10) * 10);
  }, [timeSeries, visibleRateSeries]);

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
            onClick={() => {
              fetchStats();
              setRecargaFunil((n) => n + 1);
            }}
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

        {/* 3. Contatos Capturados (Lead Total) */}
        <div className="bg-gray-800/60 border border-gray-700/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Contatos</span>
            <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-white">
              {loading ? '—' : formatNumber(funnel.total_captured_contacts)}
            </div>
            <p className="text-[11px] text-cyan-400 font-medium mt-1">
              {loading ? '—' : `${rates.cart_to_lead_pct}% de AddToCart`}
            </p>
          </div>
        </div>

        {/* 4. InitiateCheckout (Total Checkouts) */}
        <div className="bg-gray-800/60 border border-gray-700/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Checkout</span>
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <CreditCard className="h-4 w-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-white">
              {loading
                ? '—'
                : formatNumber(funnel.total_initiated_checkout ?? (funnel.initiate_checkout_count + funnel.purchase_count))}
            </div>
            <p className="text-[11px] text-amber-400 font-medium mt-1">
              {loading ? '—' : `${rates.lead_to_initiate_pct}% dos contatos`}
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
              {loading ? '—' : `${rates.initiate_to_purchase_pct}% pagamentos aprovados`}
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
              {loading ? '—' : `${formatNumber(funnel.total_captured_contacts)} contatos no total`}
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

        {/* Drop-off Callout Bar (Interactive) */}
        <div className="mt-6 bg-gray-900/60 border border-gray-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <button
            type="button"
            onClick={() => {
              setChartTab('rates');
              setVisibleRateSeries({
                pageview_to_cart_pct: true,
                cart_to_lead_pct: false,
                lead_to_initiate_pct: false,
                initiate_to_purchase_pct: false,
                overall_conversion_pct: false,
              });
            }}
            className="text-left p-2.5 rounded-xl border border-transparent hover:border-purple-500/40 hover:bg-gray-800/60 transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-gray-400 font-medium block text-[11px]">Taxa de Clique na Oferta</span>
              <span className="text-[10px] text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">Ver gráfico →</span>
            </div>
            <div className="text-base sm:text-lg font-black text-purple-300 mt-0.5">
              {loading ? '—' : `${rates.pageview_to_cart_pct}%`}
            </div>
            <span className="text-[10px] text-gray-500 block mt-0.5">PageView ➔ AddToCart</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setChartTab('rates');
              setVisibleRateSeries({
                pageview_to_cart_pct: false,
                cart_to_lead_pct: true,
                lead_to_initiate_pct: false,
                initiate_to_purchase_pct: false,
                overall_conversion_pct: false,
              });
            }}
            className="text-left p-2.5 rounded-xl border border-transparent hover:border-cyan-500/40 hover:bg-gray-800/60 transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-gray-400 font-medium block text-[11px]">Taxa de Captura de Lead</span>
              <span className="text-[10px] text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">Ver gráfico →</span>
            </div>
            <div className="text-base sm:text-lg font-black text-cyan-300 mt-0.5">
              {loading ? '—' : `${rates.cart_to_lead_pct}%`}
            </div>
            <span className="text-[10px] text-gray-500 block mt-0.5">AddToCart ➔ Lead</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setChartTab('rates');
              setVisibleRateSeries({
                pageview_to_cart_pct: false,
                cart_to_lead_pct: false,
                lead_to_initiate_pct: true,
                initiate_to_purchase_pct: false,
                overall_conversion_pct: false,
              });
            }}
            className="text-left p-2.5 rounded-xl border border-transparent hover:border-amber-500/40 hover:bg-gray-800/60 transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-gray-400 font-medium block text-[11px]">Taxa de Início de Checkout</span>
              <span className="text-[10px] text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">Ver gráfico →</span>
            </div>
            <div className="text-base sm:text-lg font-black text-amber-300 mt-0.5">
              {loading ? '—' : `${rates.lead_to_initiate_pct}%`}
            </div>
            <span className="text-[10px] text-gray-500 block mt-0.5">Lead ➔ InitiateCheckout</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setChartTab('rates');
              setVisibleRateSeries({
                pageview_to_cart_pct: false,
                cart_to_lead_pct: false,
                lead_to_initiate_pct: false,
                initiate_to_purchase_pct: true,
                overall_conversion_pct: false,
              });
            }}
            className="text-left p-2.5 rounded-xl border border-transparent hover:border-emerald-500/40 hover:bg-gray-800/60 transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-gray-400 font-medium block text-[11px]">Conversão de Pagamento PIX/Cartão</span>
              <span className="text-[10px] text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">Ver gráfico →</span>
            </div>
            <div className="text-base sm:text-lg font-black text-emerald-300 mt-0.5">
              {loading ? '—' : `${rates.initiate_to_purchase_pct}%`}
            </div>
            <span className="text-[10px] text-gray-500 block mt-0.5">InitiateCheckout ➔ Purchase</span>
          </button>
        </div>
      </div>

      <OrigemVendas origem={stats?.origem_vendas} loading={loading} />

      <FunilCheckout
        startDate={startDate}
        endDate={endDate}
        storeId={selectedStoreId}
        stores={stores}
        recarga={recargaFunil}
      />

      {/* Time Series Evolution Chart */}
      <div className="bg-gray-800/70 border border-gray-700/80 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-violet-400" />
              {chartTab === 'rates' ? 'Evolução das Taxas de Conversão (%)' : 'Evolução dos Volumes dos Estágios'}{' '}
              <span className="text-xs font-normal text-gray-400">
                ({groupBy === 'daily' ? 'Diário' : groupBy === 'weekly' ? 'Semanal' : 'Mensal'})
                {enableMovingAverage && (
                  <span className="text-violet-300 font-medium ml-1">
                    • Média Móvel ({movingAverageWindow} {groupBy === 'daily' ? 'dias' : groupBy === 'weekly' ? 'sem.' : 'meses'})
                  </span>
                )}
              </span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {chartTab === 'rates'
                ? 'Acompanhamento cronológico do percentual de avanço entre cada etapa do funil'
                : 'Acompanhamento cronológico da quantidade de acessos, contatos e conversões'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0 self-start lg:self-center">
            {/* Checkbox Média Móvel */}
            <div className="flex items-center bg-gray-900/90 p-1 rounded-xl border border-gray-700/70">
              <label
                htmlFor="toggle-moving-average"
                className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none transition-all ${
                  enableMovingAverage ? 'text-violet-300' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <input
                  type="checkbox"
                  id="toggle-moving-average"
                  checked={enableMovingAverage}
                  onChange={(e) => setEnableMovingAverage(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 text-violet-600 focus:ring-0 focus:ring-offset-0 h-4 w-4 cursor-pointer"
                />
                <span>Média Móvel</span>
              </label>

              {enableMovingAverage && (
                <select
                  id="select-moving-average-window"
                  value={movingAverageWindow}
                  onChange={(e) => setMovingAverageWindow(Number(e.target.value))}
                  aria-label="Janela da média móvel"
                  className="bg-gray-800 border border-gray-700 text-violet-300 text-xs font-medium rounded-lg px-2 py-1 mr-1 focus:ring-1 focus:ring-violet-500 focus:outline-none cursor-pointer"
                >
                  {groupBy === 'daily' && (
                    <>
                      <option value={7}>7 dias</option>
                      <option value={14}>14 dias</option>
                      <option value={30}>30 dias</option>
                    </>
                  )}
                  {groupBy === 'weekly' && (
                    <>
                      <option value={4}>4 semanas</option>
                      <option value={8}>8 semanas</option>
                    </>
                  )}
                  {groupBy === 'monthly' && (
                    <>
                      <option value={3}>3 meses</option>
                      <option value={6}>6 meses</option>
                    </>
                  )}
                </select>
              )}
            </div>

            {/* Mode Switcher Tabs (Rates vs Volumes) */}
            <div className="flex items-center bg-gray-900/90 p-1 rounded-xl border border-gray-700/70">
              <button
                type="button"
                onClick={() => setChartTab('rates')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  chartTab === 'rates'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Percent className="h-3.5 w-3.5" />
                Taxas de Conversão (%)
              </button>
              <button
                type="button"
                onClick={() => setChartTab('volumes')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  chartTab === 'volumes'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                Volume dos Estágios (Qtd)
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Series Toggles */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-gray-700/50">
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mr-1">
              Séries no Gráfico:
            </span>
            {chartTab === 'rates'
              ? rateSeriesMeta.map((s) => {
                  const active = visibleRateSeries[s.key];
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setVisibleRateSeries((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                        active
                          ? 'bg-gray-900 border-gray-600 text-gray-200 shadow-sm'
                          : 'bg-gray-900/30 border-gray-800 text-gray-600 opacity-60'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${s.bgClass}`} />
                      {s.shortLabel}
                    </button>
                  );
                })
              : seriesMeta.map((s) => {
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

          <div className="flex items-center gap-3">
            {enableMovingAverage && (
              <div className="flex items-center gap-2.5 text-[11px] text-gray-400 bg-gray-900/60 px-2 py-0.5 rounded-lg border border-gray-800">
                <span className="flex items-center gap-1">
                  <span className="w-3.5 h-0.5 bg-violet-400 inline-block rounded" />
                  Média móvel
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3.5 h-0 border-b border-dashed border-gray-400 inline-block opacity-60" />
                  Dados reais
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                if (chartTab === 'rates') {
                  setVisibleRateSeries({
                    pageview_to_cart_pct: true,
                    cart_to_lead_pct: true,
                    lead_to_initiate_pct: true,
                    initiate_to_purchase_pct: true,
                    overall_conversion_pct: true,
                  });
                } else {
                  setVisibleSeries({
                    PageView: true,
                    AddToCart: true,
                    Lead: true,
                    InitiateCheckout: true,
                    Purchase: true,
                  });
                }
              }}
              className="text-[11px] text-violet-400 hover:text-violet-300 underline"
            >
              Ativar todas as séries
            </button>
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
                  const maxVal = chartTab === 'rates' ? rateChartMax : chartMax;
                  const val = Math.round(maxVal * pct);
                  return (
                    <g key={i}>
                      <line x1="45" y1={y} x2="790" y2={y} stroke="#374151" strokeDasharray="3 3" strokeWidth="1" />
                      <text x="40" y={y + 3} fill="#9ca3af" fontSize="10" textAnchor="end">
                        {chartTab === 'rates' ? `${val}%` : val}
                      </text>
                    </g>
                  );
                })}

                {/* Series Lines & Areas for Rates View */}
                {chartTab === 'rates' &&
                  rateSeriesMeta.map((s) => {
                    if (!visibleRateSeries[s.key]) return null;
                    const rawValues = timeSeries.map((item) => getRateSeriesValue(item, s.key));
                    const maValues = enableMovingAverage
                      ? calculateMovingAverage(timeSeries, movingAverageWindow, (item) => getRateSeriesValue(item, s.key))
                      : rawValues;

                    const pts = maValues.map((val, idx) => {
                      const x = 50 + (idx / Math.max(1, timeSeries.length - 1)) * 730;
                      const y = 200 - (val / rateChartMax) * 180;
                      return `${x},${y}`;
                    });

                    const rawPts = rawValues.map((val, idx) => {
                      const x = 50 + (idx / Math.max(1, timeSeries.length - 1)) * 730;
                      const y = 200 - (val / rateChartMax) * 180;
                      return `${x},${y}`;
                    });

                    return (
                      <g key={s.key}>
                        {enableMovingAverage && (
                          <polyline
                            fill="none"
                            stroke={s.color}
                            strokeWidth="1.2"
                            strokeDasharray="3 3"
                            strokeOpacity="0.3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={rawPts.join(' ')}
                          />
                        )}
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
                          const val = maValues[idx];
                          const rawVal = rawValues[idx];
                          const y = 200 - (val / rateChartMax) * 180;
                          const titleText = enableMovingAverage
                            ? `${s.label}: ${val}% (Média móvel ${movingAverageWindow}${groupBy === 'daily' ? 'd' : 'p'}) • Real: ${rawVal}% (${item.label || item.period})`
                            : `${s.label}: ${val}% (${item.label || item.period})`;

                          return (
                            <circle
                              key={idx}
                              cx={x}
                              cy={y}
                              r="3.5"
                              fill={s.color}
                              className="hover:r-5 transition-all cursor-pointer"
                            >
                              <title>{titleText}</title>
                            </circle>
                          );
                        })}
                      </g>
                    );
                  })}

                {/* Series Lines & Areas for Volumes View */}
                {chartTab === 'volumes' &&
                  seriesMeta.map((s) => {
                    if (!visibleSeries[s.key]) return null;
                    const rawValues = timeSeries.map((item) => getSeriesValue(item, s.key));
                    const maValues = enableMovingAverage
                      ? calculateMovingAverage(timeSeries, movingAverageWindow, (item) => getSeriesValue(item, s.key))
                      : rawValues;

                    const pts = maValues.map((val, idx) => {
                      const x = 50 + (idx / Math.max(1, timeSeries.length - 1)) * 730;
                      const y = 200 - (val / chartMax) * 180;
                      return `${x},${y}`;
                    });

                    const rawPts = rawValues.map((val, idx) => {
                      const x = 50 + (idx / Math.max(1, timeSeries.length - 1)) * 730;
                      const y = 200 - (val / chartMax) * 180;
                      return `${x},${y}`;
                    });

                    return (
                      <g key={s.key}>
                        {enableMovingAverage && (
                          <polyline
                            fill="none"
                            stroke={s.color}
                            strokeWidth="1.2"
                            strokeDasharray="3 3"
                            strokeOpacity="0.3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={rawPts.join(' ')}
                          />
                        )}
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
                          const val = maValues[idx];
                          const rawVal = rawValues[idx];
                          const y = 200 - (val / chartMax) * 180;
                          const titleText = enableMovingAverage
                            ? `${s.label}: ${formatNumber(val)} (Média móvel ${movingAverageWindow}${groupBy === 'daily' ? 'd' : 'p'}) • Real: ${formatNumber(rawVal)} (${item.label || item.period})`
                            : `${s.label}: ${formatNumber(val)} (${item.label || item.period})`;

                          return (
                            <circle
                              key={idx}
                              cx={x}
                              cy={y}
                              r="3.5"
                              fill={s.color}
                              className="hover:r-5 transition-all cursor-pointer"
                            >
                              <title>{titleText}</title>
                            </circle>
                          );
                        })}
                      </g>
                    );
                  })}

                {/* X Axis Labels */}
                {timeSeries.map((item, idx) => {
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
                  <th className="pb-3 px-2 text-right">Contatos</th>
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
                          {formatNumber(st.total_captured_contacts ?? (st.lead_count + (st.initiate_checkout_count || 0) + (st.purchase_count || 0)))}
                        </td>
                        <td className="py-3 px-2 text-right text-amber-300">
                          {formatNumber(st.total_initiated_checkout ?? ((st.initiate_checkout_count || 0) + (st.purchase_count || 0)))}
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
