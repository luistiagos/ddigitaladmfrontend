import { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw, CheckCircle2, XCircle, MinusCircle, ShieldAlert, X, Loader2, AlertTriangle } from 'lucide-react';
import api from '@/services/api';

const LABELS = {
  db: 'Banco de dados',
  mp_token: 'Mercado Pago — access token',
  mp_public_key: 'Mercado Pago — public key / checkout',
  stripe: 'Stripe',
  sendgrid: 'E-mail (SendGrid)',
  evolution: 'WhatsApp (Evolution)',
  temporal: 'Temporal (Orquestrador/Worker)',
  deepseek: 'Inteligência Artificial (DeepSeek)',
  recent_sales: 'Vendas (sinal de negócio)',
  deployed_checkout_key: 'Checkout publicado (cache)',
};

const ORDER = [
  'recent_sales', 'mp_token', 'mp_public_key', 'deployed_checkout_key',
  'stripe', 'db', 'evolution', 'temporal', 'deepseek', 'sendgrid',
];

function isSkipped(detail) {
  return /pulado|não configurad/i.test(detail || '');
}

function StatusCard({ name, check, onResetWpp }) {
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
        {name === 'evolution' && onResetWpp && (
          <button
            type="button"
            onClick={onResetWpp}
            className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs border border-gray-700 font-semibold transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Resetar Instância
          </button>
        )}
      </div>
    </div>
  );
}

export default function Health() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastFetch, setLastFetch] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [resetLogs, setResetLogs] = useState([]);
  const [showResetModal, setShowResetModal] = useState(false);

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

  const handleResetWpp = async () => {
    setResetting(true);
    setQrCode(null);
    setResetLogs([]);
    try {
      const res = await api.post('/admin/wpp/reset-instance');
      if (res.data.success) {
        setQrCode(res.data.qrcode);
        setResetLogs(res.data.logs || []);
        fetchData();
      } else {
        setError(res.data.error || 'Erro ao resetar instância do WhatsApp.');
        setResetLogs(res.data.logs || []);
      }
    } catch (err) {
      setError('Erro de rede ou permissão ao tentar resetar o WhatsApp.');
    } finally {
      setResetting(false);
    }
  };

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
          <StatusCard 
            key={n} 
            name={n} 
            check={checks[n]} 
            onResetWpp={n === 'evolution' ? () => setShowResetModal(true) : null}
          />
        ))}
      </div>

      {data && (
        <p className="text-xs text-gray-600 mt-6">
          O monitor roda também no servidor a cada ciclo e alerta o dono por WhatsApp + e-mail
          quando um componente crítico cai. Esta tela reflete a checagem ao vivo.
        </p>
      )}

      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl border border-gray-700 p-6">
            <div className="mb-5 flex justify-between items-center">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-violet-400" />
                Resetar Instância do WhatsApp
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowResetModal(false);
                  setQrCode(null);
                  setResetLogs([]);
                }}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {resetting ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                <p className="text-sm text-gray-400">Recriando instância e registrando webhooks...</p>
                <div className="w-full mt-4 max-h-32 overflow-y-auto bg-gray-900 rounded p-2 text-[10px] font-mono text-gray-500">
                  {resetLogs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              </div>
            ) : qrCode ? (
              <div className="flex flex-col items-center justify-center gap-4">
                <p className="text-xs text-green-400 text-center font-semibold">
                  Instância recriada com sucesso! Escaneie o QR Code abaixo com o WhatsApp do suporte:
                </p>
                <div className="bg-white p-2 rounded-lg">
                  <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  Concluir
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-300 mb-4">
                  Esta ação irá apagar a sessão atual do WhatsApp na Evolution API, recriá-la e registrar novamente os webhooks de integração.
                </p>
                <p className="text-xs text-amber-400 mb-6 flex items-start gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                  Será necessário escanear um novo QR Code para parear o aparelho.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="px-4 py-2 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleResetWpp}
                    className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors"
                  >
                    Confirmar Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
