import { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle,
  Save,
  CheckCircle,
  RefreshCw,
  TestTube,
  Power,
  Clock,
  Hash,
  Phone,
} from 'lucide-react';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import { formatDateTime } from '@/utils/format';

const FIELDS = [
  {
    id: 'min_interval_seconds',
    label: 'Intervalo mínimo entre envios (segundos)',
    type: 'number',
    min: 1,
    max: 1200,
    hint: 'O worker espera ao menos este tempo desde o último envio.',
    icon: Clock,
  },
  {
    id: 'max_interval_seconds',
    label: 'Intervalo máximo entre envios (segundos)',
    type: 'number',
    min: 1,
    max: 1200,
    hint: 'O tempo real é sorteado aleatoriamente entre o mínimo e o máximo (limite 1200s).',
    icon: Clock,
  },
  {
    id: 'max_per_day',
    label: 'Quantidade máxima de envios por dia',
    type: 'number',
    min: 1,
    max: 100000,
    hint: 'Após atingir, o workflow dorme até a próxima janela (00:00 BRT).',
    icon: Hash,
  },
];

function NumberField({ field, value, onChange }) {
  const Icon = field.icon;
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{field.label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />}
        <input
          type={field.type}
          value={value}
          min={field.min}
          max={field.max}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-lg bg-gray-700/50 border border-gray-600 ${
            Icon ? 'pl-9' : 'pl-3'
          } pr-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition`}
        />
      </div>
      {field.hint && <p className="text-xs text-gray-500 mt-1">{field.hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label, description }) {
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
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${
          checked ? 'bg-violet-600' : 'bg-gray-600'
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

export default function WhatsAppSenderConfig() {
  const [form, setForm] = useState({
    enabled: false,
    min_interval_seconds: 90,
    max_interval_seconds: 300,
    max_per_day: 30,
    test_mode_enabled: true,
    test_phone: '5541985311304',
    send_access_whatsapp_enabled: true,
  });
  const [stats, setStats] = useState({
    sent_today: 0,
    last_sent_at_iso: null,
    next_window_starts_in_seconds: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/wpp-sender/config');
      setForm({
        enabled: !!data.enabled,
        min_interval_seconds: data.min_interval_seconds ?? 90,
        max_interval_seconds: data.max_interval_seconds ?? 300,
        max_per_day: data.max_per_day ?? 30,
        test_mode_enabled: !!data.test_mode_enabled,
        test_phone: data.test_phone || '',
        send_access_whatsapp_enabled: data.send_access_whatsapp_enabled ?? true,
      });
      setStats({
        sent_today: data.sent_today ?? 0,
        last_sent_at_iso: data.last_sent_at_iso || null,
        next_window_starts_in_seconds: data.next_window_starts_in_seconds ?? 0,
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar configuração');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function setField(id, value) {
    setForm((f) => ({ ...f, [id]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const payload = {
        enabled: !!form.enabled,
        min_interval_seconds: Number(form.min_interval_seconds) || 1,
        max_interval_seconds: Number(form.max_interval_seconds) || 1,
        max_per_day: Number(form.max_per_day) || 1,
        test_mode_enabled: !!form.test_mode_enabled,
        test_phone: (form.test_phone || '').trim(),
        send_access_whatsapp_enabled: !!form.send_access_whatsapp_enabled,
      };
      const { data } = await api.put('/admin/wpp-sender/config', payload);
      setForm({
        enabled: !!data.enabled,
        min_interval_seconds: data.min_interval_seconds,
        max_interval_seconds: data.max_interval_seconds,
        max_per_day: data.max_per_day,
        test_mode_enabled: !!data.test_mode_enabled,
        test_phone: data.test_phone || '',
        send_access_whatsapp_enabled: !!data.send_access_whatsapp_enabled,
      });
      setStats({
        sent_today: data.sent_today ?? 0,
        last_sent_at_iso: data.last_sent_at_iso || null,
        next_window_starts_in_seconds: data.next_window_starts_in_seconds ?? 0,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  function formatWindow(seconds) {
    if (!seconds || seconds <= 0) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-400" />
            WhatsApp — Configuração de Envio
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Controla o pacing aleatório, o limite diário e o modo teste do remarketing via WhatsApp.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-gray-700/50 border border-gray-600 text-gray-200 hover:bg-gray-700 transition"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Recarregar
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Enviados hoje (BRT)</div>
          <div className="text-2xl font-semibold text-white mt-1">
            {stats.sent_today} <span className="text-sm font-normal text-gray-400">/ {form.max_per_day}</span>
          </div>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Último envio</div>
          <div className="text-sm font-medium text-white mt-2">
            {stats.last_sent_at_iso ? formatDateTime(stats.last_sent_at_iso) : '—'}
          </div>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Reset do cap em</div>
          <div className="text-sm font-medium text-white mt-2">
            {formatWindow(stats.next_window_starts_in_seconds)}
          </div>
        </div>
      </div>

      {/* Toggle principal */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-6 mb-5">
        <div className="flex items-center gap-3 mb-2">
          <Power className={`h-5 w-5 ${form.enabled ? 'text-green-400' : 'text-gray-500'}`} />
          <h2 className="text-base font-semibold text-white">Envio de WhatsApp</h2>
          <Badge variant={form.enabled ? 'green' : 'gray'}>
            {form.enabled ? 'Habilitado' : 'Desabilitado'}
          </Badge>
        </div>
        <Toggle
          checked={form.enabled}
          onChange={(v) => setField('enabled', v)}
          label="Habilitar remarketing via WhatsApp"
          description="Quando desligado, todos os steps de WhatsApp dos workflows são pulados (skipped) sem disparar mensagens."
        />
        <div className="border-t border-gray-700/50 my-2"></div>
        <Toggle
          checked={form.send_access_whatsapp_enabled}
          onChange={(v) => setField('send_access_whatsapp_enabled', v)}
          label="Habilitar entrega de produto via WhatsApp"
          description="Quando desligado, o link de acesso ao produto recém-comprado será enviado apenas por e-mail."
        />
      </div>

      {/* Pacing */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-6 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-violet-400" />
          <h2 className="text-base font-semibold text-white">Pacing e Limites</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FIELDS.map((field) => (
            <NumberField
              key={field.id}
              field={field}
              value={form[field.id] ?? ''}
              onChange={(v) => setField(field.id, v)}
            />
          ))}
        </div>
        {Number(form.min_interval_seconds) > Number(form.max_interval_seconds) && (
          <p className="text-xs text-amber-400 mt-3">
            Atenção: mínimo está maior que o máximo. Ao salvar, o máximo será ajustado para igualar o mínimo.
          </p>
        )}
      </div>

      {/* Modo teste */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-6 mb-5">
        <div className="flex items-center gap-3 mb-2">
          <TestTube className={`h-5 w-5 ${form.test_mode_enabled ? 'text-amber-400' : 'text-gray-500'}`} />
          <h2 className="text-base font-semibold text-white">Modo Teste</h2>
          <Badge variant={form.test_mode_enabled ? 'yellow' : 'gray'}>
            {form.test_mode_enabled ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
        <Toggle
          checked={form.test_mode_enabled}
          onChange={(v) => setField('test_mode_enabled', v)}
          label="Redirecionar 100% dos envios para o número de teste"
          description="Enquanto ligado, nenhuma mensagem vai para o número real do lead. Útil para validar o fluxo sem impactar clientes."
        />
        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-400 mb-1.5">
            Telefone de teste (formato internacional sem +)
          </label>
          <div className="relative max-w-sm">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              value={form.test_phone}
              onChange={(e) => setField('test_phone', e.target.value)}
              placeholder="5541985311304"
              className="w-full rounded-lg bg-gray-700/50 border border-gray-600 pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Ex.: 5541985311304 (55 = Brasil, 41 = DDD, número celular).
          </p>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
            saved
              ? 'bg-green-600 text-white'
              : 'bg-violet-600 hover:bg-violet-500 text-white'
          }`}
        >
          {saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar configuração'}
        </button>
      </div>
    </div>
  );
}
