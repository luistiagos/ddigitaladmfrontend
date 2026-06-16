import { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle, Settings2, MessageCircle, Power, ShieldCheck } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import api from '@/services/api';

// Provedores de integração. Os SEGREDOS (tokens/secret keys) NÃO ficam mais no
// navegador — vivem apenas no .env do servidor. Esta tela só exibe o status
// (configurado ou não), lido de /admin/integrations/status.
const PROVIDERS = [
  {
    key: 'meta',
    label: 'Meta (Facebook Ads)',
    description: 'Gasto diário com anúncios (Ads Insights), consultado pelo servidor.',
    accentColor: 'text-blue-400',
    borderColorActive: 'border-blue-500/30',
    envHint: 'META_ACCESS_TOKEN, META_AD_ACCOUNT_ID',
  },
  {
    key: 'mercadopago',
    label: 'MercadoPago',
    description: 'Usado para calcular taxas de transações no Dashboard.',
    accentColor: 'text-cyan-400',
    borderColorActive: 'border-cyan-500/30',
    envHint: 'ACCESS_TOKEN',
  },
  {
    key: 'stripe',
    label: 'Stripe',
    description: 'Integração com pagamentos Stripe.',
    accentColor: 'text-violet-400',
    borderColorActive: 'border-violet-500/30',
    envHint: 'STRIPE_API_KEY',
  },
];

function Toggle({ checked, onChange, label, description, disabled }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex-1">
        <div className="text-sm font-medium text-white">{label}</div>
        {description && <div className="text-xs text-gray-500 mt-0.5">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed ${
          checked ? 'bg-green-600' : 'bg-gray-600'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seção de WhatsApp — flag de envio do link de acesso
// ---------------------------------------------------------------------------
function WhatsAppSection() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const savedTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(savedTimerRef.current), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/wpp-sender/config');
      setEnabled(!!data.send_access_whatsapp_enabled);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar configuração de WhatsApp.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(newValue) {
    setSaving(true);
    setError('');
    try {
      const { data } = await api.put('/admin/wpp-sender/config', {
        send_access_whatsapp_enabled: newValue,
      });
      setEnabled(!!data.send_access_whatsapp_enabled);
      setSaved(true);
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar configuração de WhatsApp.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-green-400 flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            WhatsApp — Envio do Link de Acesso
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Controla se o link de acesso à área de membros é enviado também via WhatsApp,
            além do e-mail.
          </p>
        </div>
        <Badge variant={loading ? 'gray' : enabled ? 'green' : 'gray'}>
          {loading ? 'Carregando…' : enabled ? 'Habilitado' : 'Desabilitado'}
        </Badge>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="border-t border-gray-700/50">
        <Toggle
          checked={enabled}
          onChange={handleToggle}
          disabled={loading || saving}
          label="Enviar link de acesso via WhatsApp"
          description={
            enabled
              ? 'Ligado — o link de acesso será enviado por e-mail E por WhatsApp.'
              : 'Desligado — o link de acesso será enviado apenas por e-mail.'
          }
        />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Power className={`h-3.5 w-3.5 ${enabled ? 'text-green-400' : 'text-gray-500'}`} />
        <span className="text-xs text-gray-500">
          {saving
            ? 'Salvando…'
            : saved
            ? 'Salvo com sucesso!'
            : 'A alteração é salva automaticamente ao mover o toggle.'}
        </span>
        {saved && <CheckCircle className="h-3.5 w-3.5 text-green-400" />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seção de Integrações — status read-only (segredos ficam no servidor)
// ---------------------------------------------------------------------------
function IntegrationsSection() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/integrations/status');
      setStatus(data || {});
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar status das integrações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-violet-400 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Integrações de Provedores
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            As chaves e segredos ficam <strong>apenas no servidor</strong> (.env) — não são
            mais armazenados no navegador. Esta tela mostra somente o status.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {PROVIDERS.map((provider) => {
          const connected = !!status?.[provider.key];
          return (
            <div
              key={provider.key}
              className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-4 transition-colors ${
                connected ? provider.borderColorActive : 'border-gray-700'
              }`}
            >
              <div>
                <div className={`text-sm font-semibold ${provider.accentColor}`}>
                  {provider.label}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{provider.description}</div>
                <div className="text-[11px] text-gray-600 mt-1">
                  .env: <code>{provider.envHint}</code>
                </div>
              </div>
              <Badge variant={loading ? 'gray' : connected ? 'green' : 'gray'}>
                {loading ? 'Carregando…' : connected ? 'Configurado' : 'Não configurado'}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------
export default function Settings() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-violet-400" />
          Configurações de Integrações
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Status das integrações. Os segredos ficam no servidor (.env), nunca no navegador.
        </p>
      </div>

      <div className="space-y-5">
        <WhatsAppSection />
        <IntegrationsSection />
      </div>
    </div>
  );
}
