import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Save, CheckCircle, Settings2 } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { getSettings, saveSettings, hasProvider } from '@/utils/settings';

const PROVIDERS = [
  {
    key: 'meta',
    label: 'Meta (Facebook Ads)',
    description: 'Busca o gasto diário com anúncios direto na Ads Insights API.',
    accentColor: 'text-blue-400',
    borderColorActive: 'border-blue-500/30',
    fields: [
      {
        id: 'meta_access_token',
        label: 'Access Token',
        placeholder: 'EAABsbCS...',
        hint: 'Token com permissão ads_read — gere em Business Manager → Usuários do Sistema',
        secret: true,
      },
      {
        id: 'meta_ad_account_id',
        label: 'Ad Account ID',
        placeholder: '123456789',
        hint: 'Apenas o número sem prefixo act_ — encontrado em Business Manager → Contas de Anúncio',
        secret: false,
      },
    ],
  },
  {
    key: 'mp',
    label: 'MercadoPago',
    description: 'Usado para calcular taxas de transações no Dashboard.',
    accentColor: 'text-cyan-400',
    borderColorActive: 'border-cyan-500/30',
    fields: [
      {
        id: 'mp_access_token',
        label: 'Access Token',
        placeholder: 'APP_USR-...',
        hint: 'Token de produção do MercadoPago',
        secret: true,
      },
    ],
  },
  {
    key: 'stripe',
    label: 'Stripe',
    description: 'Integração com pagamentos Stripe para futuras funcionalidades.',
    accentColor: 'text-violet-400',
    borderColorActive: 'border-violet-500/30',
    fields: [
      {
        id: 'stripe_api_key',
        label: 'Secret Key',
        placeholder: 'sk_live_...',
        hint: 'Chave secreta de produção — Stripe Dashboard → Developers → API keys',
        secret: true,
      },
    ],
  },
];

function TokenField({ field, value, onChange, showState, onToggleShow }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{field.label}</label>
      <div className="relative">
        <input
          type={field.secret && !showState ? 'password' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          autoComplete="off"
          className={`w-full rounded-lg bg-gray-700/50 border border-gray-600 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition ${field.secret ? 'pr-10' : ''}`}
        />
        {field.secret && (
          <button
            type="button"
            onClick={onToggleShow}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition"
          >
            {showState ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {field.hint && <p className="text-xs text-gray-500 mt-1">{field.hint}</p>}
    </div>
  );
}

export default function Settings() {
  const [form, setForm] = useState(getSettings);
  const [show, setShow] = useState({});
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef(null);

  useEffect(() => () => { clearTimeout(savedTimerRef.current); }, []);

  function toggleShow(id) {
    setShow((s) => ({ ...s, [id]: !s[id] }));
  }

  function setField(id, value) {
    setForm((f) => ({ ...f, [id]: value }));
  }

  function handleSave() {
    saveSettings(form);
    setSaved(true);
    clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-violet-400" />
          Configurações de Integrações
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Tokens e chaves salvas localmente no navegador. Setados uma única vez.
        </p>
      </div>

      <div className="space-y-5">
        {PROVIDERS.map((provider) => {
          const connected = hasProvider(provider.key);
          return (
            <div
              key={provider.key}
              className={`bg-gray-800/60 border rounded-xl p-6 transition-colors ${
                connected ? provider.borderColorActive : 'border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className={`text-base font-semibold ${provider.accentColor}`}>
                    {provider.label}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">{provider.description}</p>
                </div>
                <Badge variant={connected ? 'green' : 'gray'}>
                  {connected ? 'Conectado' : 'Não configurado'}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {provider.fields.map((field) => (
                  <TokenField
                    key={field.id}
                    field={field}
                    value={form[field.id] || ''}
                    onChange={(v) => setField(field.id, v)}
                    showState={show[field.id]}
                    onToggleShow={() => toggleShow(field.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            saved
              ? 'bg-green-600 text-white'
              : 'bg-violet-600 hover:bg-violet-500 text-white'
          }`}
        >
          {saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? 'Salvo com sucesso!' : 'Salvar configurações'}
        </button>
        {saved && (
          <span className="text-xs text-gray-400">
            Navegue até o Dashboard para ver as mudanças aplicadas.
          </span>
        )}
      </div>
    </div>
  );
}
