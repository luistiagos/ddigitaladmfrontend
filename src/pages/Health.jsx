import { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw, CheckCircle2, XCircle, MinusCircle, ShieldAlert } from 'lucide-react';
import api from '@/services/api';

const LABELS = {
  db: 'Banco de dados',
  mp_token: 'Mercado Pago — access token',
  mp_public_key: 'Mercado Pago — public key / checkout',
  stripe: 'Stripe',
  sendgrid: 'E-mail (SendGrid)',
  evolution: 'WhatsApp (Evolution)',
  temporal: 'Temporal (Orquestrador/Worker)',
  recent_sales: 'Vendas (sinal de negócio)',
  deployed_checkout_key: 'Checkout publicado (cache)',
};

const ORDER = [
  'recent_sales', 'mp_token', 'mp_public_key', 'deployed_checkout_key',
  'stripe', 'db', 'evolution', 'temporal', 'sendgrid',
];

function isSkipped(detail) {
  return /pulado|não configurad/i.test(detail || '');
}

function StatusCard({ name, check }) {
  const skipped = check.ok && isSkipped(check.detail);
  const down = !check.ok;
  const Icon = down ? XCircle : skipped ? MinusCircle : CheckCircle2;
  const color = down ? 'text-red-400' : skipped ? 'text-gray-500' : 'text-green-400';
  const border = down ? 'border-red-500/40 bg-red-500/5' : 'border-gray-800 bg-gray-900';

  return (
    <div className={`rounded-xl border ${border} p-4 flex items-start gap-3`}>
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${color}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-100">{LABELS[name] || name}</span>
          {check.critical && (
            <span className="text-[10px] uppercase tracking-wide text-amber-400/80 border border-amber-400/30 rounded px-1.5 py-0.5">
              crítico
            </span>
          )}
        </div>
        <div className={`text-xs mt-1 ${down ? 'text-red-300' : 'text-gray-400'} break-words`}>
          {check.detail || (check.ok ? 'ok' : 'falhou')}
        </div>
        <div className="text-[11px] text-gray-600 mt-1">{check.latency_ms} ms</div>
      </div>
    </div>
  );
}

export default function Health() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastFetch, setLastFetch] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // 503 (degraded) ainda traz o corpo JSON — não é erro de rede.
      const res = await api.get('/admin/health?deep=1', { validateStatus: (s) => s === 200 || s === 503 });
      setData(res.data);
      setLastFetch(new Date());
    } catch {
      setError('Não foi possível consultar a saúde da plataforma.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, [fetchData]);

  const checks = data?.checks || {};
  const names = [...ORDER.filter((n) => n in checks), ...Object.keys(checks).filter((n) => !ORDER.includes(n))];
  const degraded = data?.status === 'degraded';
  const downCount = names.filter((n) => !checks[n].ok && checks[n].critical).length;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-violet-400" />
          <h1 className="text-xl font-bold text-white">Saúde da plataforma</h1>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-300 text-sm mb-4">
          {error}
        </div>
      )}

      {data && (
        <div
          className={`rounded-xl border p-4 mb-6 flex items-center gap-3 ${
            degraded ? 'border-red-500/50 bg-red-500/10' : 'border-green-500/40 bg-green-500/5'
          }`}
        >
          {degraded ? (
            <ShieldAlert className="h-6 w-6 text-red-400 shrink-0" />
          ) : (
            <CheckCircle2 className="h-6 w-6 text-green-400 shrink-0" />
          )}
          <div>
            <div className={`font-semibold ${degraded ? 'text-red-300' : 'text-green-300'}`}>
              {degraded
                ? `${downCount} componente(s) crítico(s) com problema`
                : 'Tudo operacional'}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Última verificação: {lastFetch ? lastFetch.toLocaleTimeString('pt-BR') : '—'}
              {' · '}atualiza automaticamente a cada 30s
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {names.map((n) => (
          <StatusCard key={n} name={n} check={checks[n]} />
        ))}
      </div>

      {data && (
        <p className="text-xs text-gray-600 mt-6">
          O monitor roda também no servidor a cada ciclo e alerta o dono por WhatsApp + e-mail
          quando um componente crítico cai. Esta tela reflete a checagem ao vivo.
        </p>
      )}
    </div>
  );
}
