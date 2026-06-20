import { useState, useEffect } from 'react';
import { Bot, Play, CheckCircle2, XCircle, Loader2, PhoneCall, Webhook, RefreshCw, AlertTriangle, Eye, Activity, KeyRound, Save } from 'lucide-react';
import api from '@/services/api';

function DiagStep({ step }) {
  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-gray-700/50 last:border-0">
      <div className="shrink-0 mt-0.5">
        {step.ok === true ? (
          <CheckCircle2 className="h-5 w-5 text-green-400" />
        ) : step.ok === false ? (
          <XCircle className="h-5 w-5 text-red-400" />
        ) : (
          <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${
          step.ok === true ? 'text-green-300' :
          step.ok === false ? 'text-red-300' : 'text-gray-300'
        }`}>
          {step.label}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{step.message}</p>
        {step.detail && (
          <pre className="mt-1.5 text-xs text-gray-500 bg-gray-900/60 rounded p-2 overflow-x-auto max-h-24 whitespace-pre-wrap break-all">
            {step.detail}
          </pre>
        )}
      </div>
    </div>
  );
}

export default function BotConfig() {
  const [botEnabled, setBotEnabled] = useState(true);
  const [botStatus, setBotStatus] = useState('idle'); // idle | saving | saved | error

  const [phone, setPhone] = useState('');
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagResults, setDiagResults] = useState(null);

  const [webhookStatus, setWebhookStatus] = useState(null);
  const [webhookChecking, setWebhookChecking] = useState(false);
  const [webhookFixing, setWebhookFixing] = useState(false);
  const [webhookMessage, setWebhookMessage] = useState(null);

  // ── Visão (leitura de imagens) ──
  const [vision, setVision] = useState(null);            // config mascarada do backend
  const [usage, setUsage] = useState(null);              // agregados de uso
  const [visionForm, setVisionForm] = useState({ apiKey: '', model: '', dailyLimit: '' });
  const [visionSaving, setVisionSaving] = useState(false);
  const [visionMsg, setVisionMsg] = useState(null);      // {type, text}
  const [visionTesting, setVisionTesting] = useState(false);
  const [visionTestResult, setVisionTestResult] = useState(null);

  useEffect(() => {
    api.get('/admin/wpp/bot_status')
      .then((res) => setBotEnabled(res.data.bot_enabled ?? true))
      .catch(() => {});
    checkWebhook();
    loadVision();
  }, []);

  async function loadVision() {
    try {
      const [cfg, use] = await Promise.all([
        api.get('/admin/vision/config'),
        api.get('/admin/vision/usage'),
      ]);
      setVision(cfg.data);
      setUsage(use.data);
      setVisionForm((f) => ({
        ...f,
        model: cfg.data.model || '',
        dailyLimit: cfg.data.daily_limit != null ? String(cfg.data.daily_limit) : '',
      }));
    } catch {
      /* silencioso — card mostra estado de carregando */
    }
  }

  async function saveVision() {
    setVisionSaving(true);
    setVisionMsg(null);
    try {
      const payload = {};
      if (visionForm.apiKey.trim()) payload.api_key = visionForm.apiKey.trim();
      if (visionForm.model.trim()) payload.model = visionForm.model.trim();
      if (visionForm.dailyLimit !== '') payload.daily_limit = Number(visionForm.dailyLimit);
      const res = await api.post('/admin/vision/config', payload);
      setVision(res.data);
      setVisionForm((f) => ({ ...f, apiKey: '' })); // limpa o campo de chave após salvar
      setVisionMsg({ type: 'success', text: 'Configuração salva.' });
      loadVision();
    } catch (err) {
      setVisionMsg({ type: 'error', text: err.response?.data?.error || 'Erro ao salvar.' });
    } finally {
      setVisionSaving(false);
    }
  }

  async function toggleVision() {
    if (!vision) return;
    const newValue = !vision.enabled;
    setVision({ ...vision, enabled: newValue });
    try {
      await api.post('/admin/vision/config', { enabled: newValue });
    } catch {
      setVision({ ...vision, enabled: !newValue });
      setVisionMsg({ type: 'error', text: 'Erro ao alterar o estado.' });
    }
  }

  async function testVision() {
    setVisionTesting(true);
    setVisionTestResult(null);
    try {
      const body = {};
      if (visionForm.apiKey.trim()) body.api_key = visionForm.apiKey.trim();
      if (visionForm.model.trim()) body.model = visionForm.model.trim();
      const res = await api.post('/admin/vision/test', body);
      setVisionTestResult(res.data);
    } catch (err) {
      setVisionTestResult({ ok: false, error: err.response?.data?.error || 'Erro no teste.' });
    } finally {
      setVisionTesting(false);
    }
  }

  async function checkWebhook({ clearMessage = true } = {}) {
    setWebhookChecking(true);
    try {
      const res = await api.get('/admin/whatsapp/webhook');
      setWebhookStatus(res.data);
      if (clearMessage) setWebhookMessage(null);
    } catch (err) {
      console.error('Erro ao verificar webhook:', err);
      setWebhookMessage({ type: 'error', text: 'Erro ao verificar o webhook.' });
    } finally {
      setWebhookChecking(false);
    }
  }

  async function fixWebhook() {
    if (!confirm('Deseja reiniciar o webhook da Evolution API e reconciliar mensagens recentes?')) return;
    setWebhookFixing(true);
    setWebhookMessage(null);
    try {
      const res = await api.post('/admin/whatsapp/webhook/restart');
      if (res.data.ok) {
        setWebhookMessage({
          type: 'success',
          text: res.data.reconcile_started
            ? 'Webhook reiniciado. Reconciliação das mensagens recentes foi iniciada.'
            : 'Webhook reiniciado. A reconciliação não iniciou porque já pode haver outra em andamento.',
        });
        await checkWebhook({ clearMessage: false });
      } else {
        setWebhookMessage({ type: 'error', text: res.data.error || 'Falha ao reiniciar webhook.' });
      }
    } catch (err) {
      setWebhookMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Erro ao reiniciar webhook.',
      });
    } finally {
      setWebhookFixing(false);
    }
  }

  async function toggleBot() {
    const newValue = !botEnabled;
    setBotEnabled(newValue);
    setBotStatus('saving');
    try {
      await api.post('/admin/wpp/bot_status', { bot_enabled: newValue });
      setBotStatus('saved');
      setTimeout(() => setBotStatus('idle'), 3000);
    } catch {
      setBotEnabled(!newValue);
      setBotStatus('error');
      setTimeout(() => setBotStatus('idle'), 3000);
    }
  }

  async function runDiag() {
    if (!phone.trim()) return;
    setDiagRunning(true);
    setDiagResults(null);
    try {
      const res = await api.post('/admin/wpp/diag', { phone: phone.trim() });
      setDiagResults(res.data);
    } catch (err) {
      setDiagResults({
        ok: false,
        results: [{
          step: 'general_error',
          label: 'Erro geral',
          ok: false,
          message: err?.response?.data?.error || err.message || 'Erro ao executar diagnóstico.',
        }],
      });
    } finally {
      setDiagRunning(false);
    }
  }

  function handlePhoneKey(e) {
    if (e.key === 'Enter' && !diagRunning && phone.trim()) runDiag();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <Bot className="h-5 w-5 text-green-400" />
          Bot WhatsApp
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Gerencie o bot de atendimento automático e execute diagnósticos de conectividade.
        </p>
      </div>

      <div className="space-y-5">
        {/* ── Habilitar / desabilitar ── */}
        <div className={`bg-gray-800/60 border rounded-xl p-6 transition-colors ${
          botEnabled ? 'border-green-500/30' : 'border-gray-700'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-base font-semibold flex items-center gap-2 ${
                botEnabled ? 'text-green-400' : 'text-gray-400'
              }`}>
                <Bot className="h-4 w-4" />
                {botEnabled ? 'Bot ativo' : 'Bot desabilitado'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Quando desabilitado, o bot não responde automaticamente. Apenas atendimento humano.
              </p>
              {botStatus === 'saving' && <p className="text-xs text-gray-500 mt-1.5">Salvando…</p>}
              {botStatus === 'saved'  && <p className="text-xs text-green-400 mt-1.5">✓ Configuração salva</p>}
              {botStatus === 'error'  && <p className="text-xs text-red-400 mt-1.5">Erro ao salvar</p>}
            </div>
            <button
              type="button"
              onClick={toggleBot}
              disabled={botStatus === 'saving'}
              aria-label={botEnabled ? 'Desabilitar bot' : 'Habilitar bot'}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50 ${
                botEnabled ? 'bg-green-500' : 'bg-gray-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                botEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>

        {/* ── Visão (leitura de imagens) ── */}
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Eye className="h-4 w-4 text-amber-400" />
              Visão (leitura de imagens)
            </h2>
            <button
              type="button"
              onClick={toggleVision}
              disabled={!vision}
              aria-label={vision?.enabled ? 'Desabilitar visão' : 'Habilitar visão'}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50 ${
                vision?.enabled ? 'bg-green-500' : 'bg-gray-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                vision?.enabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-5">
            Chave do Gemini que o bot usa para descrever imagens (comprovantes, prints de erro).
            Trocar aqui vale na hora, sem deploy.
          </p>

          {!vision ? (
            <div className="text-sm text-gray-400 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando configuração…
            </div>
          ) : (
            <div className="space-y-5">
              {/* Config */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs text-gray-400 flex items-center gap-1.5 mb-1">
                    <KeyRound className="h-3.5 w-3.5" /> Chave da API (Gemini)
                  </label>
                  <input
                    type="password"
                    value={visionForm.apiKey}
                    onChange={(e) => setVisionForm((f) => ({ ...f, apiKey: e.target.value }))}
                    placeholder={vision.key_set ? `Atual: ${vision.key_masked} — deixe em branco para manter` : 'Cole a nova chave do Gemini'}
                    className="w-full rounded-lg bg-gray-700/50 border border-gray-600 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition"
                  />
                  <p className="text-[11px] text-gray-600 mt-1">
                    Pegue em aistudio.google.com/apikey. {vision.key_set
                      ? <>Origem atual: <span className="text-gray-400">{vision.source?.api_key === 'db' ? 'painel' : '.env'}</span>.</>
                      : 'Nenhuma chave configurada.'}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Modelo</label>
                  <input
                    type="text"
                    value={visionForm.model}
                    onChange={(e) => setVisionForm((f) => ({ ...f, model: e.target.value }))}
                    placeholder="gemini-2.5-flash-lite"
                    className="w-full rounded-lg bg-gray-700/50 border border-gray-600 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Limite diário do plano (opcional)</label>
                  <input
                    type="number"
                    min="0"
                    value={visionForm.dailyLimit}
                    onChange={(e) => setVisionForm((f) => ({ ...f, dailyLimit: e.target.value }))}
                    placeholder="ex: 1000 — usado p/ estimar o restante"
                    className="w-full rounded-lg bg-gray-700/50 border border-gray-600 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition"
                  />
                  {usage?.last_quota_limit != null && (
                    <p className="text-[11px] text-gray-600 mt-1">
                      Último limite que o Gemini reportou no erro de cota: <span className="text-gray-400">{usage.last_quota_limit}</span> (janela curta, não diário).
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={testVision}
                  disabled={visionTesting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-medium transition"
                >
                  {visionTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {visionTesting ? 'Testando…' : 'Testar chave'}
                </button>
                <button
                  onClick={saveVision}
                  disabled={visionSaving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium transition"
                >
                  {visionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar
                </button>
                {visionMsg && (
                  <span className={`text-xs ${visionMsg.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                    {visionMsg.text}
                  </span>
                )}
              </div>

              {visionTestResult && (
                <div className={`rounded-lg border px-3 py-2 text-xs flex items-start gap-2 ${
                  visionTestResult.ok
                    ? 'border-green-500/30 bg-green-500/10 text-green-300'
                    : visionTestResult.rate_limited
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                      : 'border-red-500/30 bg-red-500/10 text-red-300'
                }`}>
                  {visionTestResult.ok
                    ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    : <XCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                  <span>
                    {visionTestResult.ok
                      ? `Chave OK (modelo ${visionTestResult.model}).`
                      : visionTestResult.error}
                  </span>
                </div>
              )}

              {/* Uso / cota */}
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-200 flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-cyan-400" /> Uso de hoje
                  </h3>
                  <button onClick={loadVision} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-700 transition" title="Atualizar">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
                {!usage ? (
                  <p className="text-xs text-gray-500">Sem dados de uso.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <div className="text-lg font-semibold text-white">{usage.today.calls}</div>
                        <div className="text-[11px] text-gray-500">chamadas</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-green-400">{usage.today.ok}</div>
                        <div className="text-[11px] text-gray-500">descritas</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-amber-400">{usage.today.rate_limited}</div>
                        <div className="text-[11px] text-gray-500">cota estourada</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-cyan-300">
                          {usage.remaining_estimate != null ? usage.remaining_estimate : '—'}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          restante {usage.daily_limit != null ? `(de ${usage.daily_limit})` : '(defina o limite)'}
                        </div>
                      </div>
                    </div>
                    {usage.today.rate_limited > 0 && (
                      <div className="mt-3 flex items-start gap-2 text-[11px] text-amber-300/90">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>
                          {usage.today.rate_limited} imagem(ns) ficaram sem descrição hoje por cota esgotada —
                          o cliente recebeu o fallback. Considere uma chave com mais cota (tier pago).
                        </span>
                      </div>
                    )}
                    {usage.series_7d?.length > 0 && (
                      <div className="mt-4">
                        <div className="text-[11px] text-gray-500 mb-2">Últimos 7 dias (✓ descritas / ✗ cota)</div>
                        <div className="space-y-1">
                          {usage.series_7d.map((d) => {
                            const total = d.ok + d.rate_limited + d.error || 1;
                            return (
                              <div key={d.day} className="flex items-center gap-2 text-[11px]">
                                <span className="text-gray-500 w-16 shrink-0">{d.day.slice(5)}</span>
                                <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-gray-700 flex">
                                  <div className="bg-green-500" style={{ width: `${(d.ok / total) * 100}%` }} />
                                  <div className="bg-amber-500" style={{ width: `${(d.rate_limited / total) * 100}%` }} />
                                  <div className="bg-red-500" style={{ width: `${(d.error / total) * 100}%` }} />
                                </div>
                                <span className="text-gray-400 w-20 shrink-0 text-right">{d.ok}✓ {d.rate_limited}✗</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Diagnóstico (apenas quando bot ativo) ── */}
        {botEnabled && (
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-6">
            <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-1">
              <PhoneCall className="h-4 w-4 text-violet-400" />
              Diagnóstico
            </h2>
            <p className="text-xs text-gray-500 mb-5">
              Testa a conexão com a Evolution API, tenta enviar uma mensagem e verifica o estado do bot.
            </p>

            <div className="flex gap-3 mb-5">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={handlePhoneKey}
                placeholder="Número para teste (ex: 5511999999999)"
                className="flex-1 rounded-lg bg-gray-700/50 border border-gray-600 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition"
              />
              <button
                onClick={runDiag}
                disabled={diagRunning || !phone.trim()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors whitespace-nowrap"
              >
                {diagRunning
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Play className="h-4 w-4" />}
                {diagRunning ? 'Testando…' : 'Iniciar Teste'}
              </button>
            </div>

            {diagResults && (
              <div className="bg-gray-900/50 rounded-lg border border-gray-700 px-4">
                {(diagResults.results ?? []).map((step, i) => (
                  <DiagStep key={i} step={step} />
                ))}
                {!diagResults.results?.length && (
                  <p className="py-3 text-center text-xs text-gray-500">Sem resultados de diagnóstico.</p>
                )}
                {diagResults.ok && (
                  <div className="py-3 text-center text-sm text-green-400 font-medium">
                    ✓ Todos os testes passaram com sucesso
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Status do Webhook ── */}
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-1">
                <Webhook className="h-4 w-4 text-cyan-400" />
                Status da Conexão e Webhook
              </h2>
              <p className="text-xs text-gray-500">
                Verifique se o WhatsApp está conectado e se o webhook está recebendo mensagens.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={checkWebhook}
                disabled={webhookChecking || webhookFixing}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition"
                title="Atualizar status"
              >
                <RefreshCw className={`h-4 w-4 ${webhookChecking ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={fixWebhook}
                disabled={webhookFixing}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-600/20 text-cyan-300 hover:bg-cyan-600/30 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition"
              >
                {webhookFixing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Webhook className="h-3.5 w-3.5" />}
                {webhookFixing ? 'Reiniciando...' : 'Reiniciar webhook'}
              </button>
            </div>
          </div>

          {!webhookStatus ? (
            <div className="text-sm text-gray-400 flex items-center gap-2">
              {webhookChecking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando status...
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  {webhookMessage?.text || 'Status indisponível. Tente atualizar ou reiniciar o webhook.'}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
                  <div className="text-xs text-gray-500 mb-1">Evolution API</div>
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    {webhookStatus.evolution_online ? (
                      <><span className="w-2 h-2 rounded-full bg-green-500"></span> Online</>
                    ) : (
                      <><span className="w-2 h-2 rounded-full bg-red-500"></span> Offline</>
                    )}
                  </div>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
                  <div className="text-xs text-gray-500 mb-1">WhatsApp Instância</div>
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    {webhookStatus.wa_state === 'open' ? (
                      <><span className="w-2 h-2 rounded-full bg-green-500"></span> Conectado</>
                    ) : (
                      <><span className="w-2 h-2 rounded-full bg-red-500"></span> {webhookStatus.wa_state || 'Desconectado'}</>
                    )}
                  </div>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50 col-span-2 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Configuração do Webhook</div>
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      {webhookStatus.webhook_ok ? (
                        <><span className="w-2 h-2 rounded-full bg-green-500"></span> Correta</>
                      ) : (
                        <><span className="w-2 h-2 rounded-full bg-red-500"></span> Incorreta ou Ausente</>
                      )}
                    </div>
                  </div>
                  {!webhookStatus.webhook_ok && (
                    <button
                      onClick={fixWebhook}
                      disabled={webhookFixing}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 text-xs font-medium transition"
                    >
                      {webhookFixing ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
                      Reconfigurar Webhook
                    </button>
                  )}
                </div>
              </div>

              {webhookMessage && (
                <div className={`rounded-lg border px-3 py-2 text-xs ${
                  webhookMessage.type === 'success'
                    ? 'border-green-500/30 bg-green-500/10 text-green-300'
                    : 'border-red-500/30 bg-red-500/10 text-red-300'
                }`}>
                  {webhookMessage.text}
                </div>
              )}

              {webhookStatus.last_db_message && (
                <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
                  <div className="text-xs text-gray-500 mb-1.5 flex justify-between">
                    <span>Última mensagem processada</span>
                    <span>{new Date(webhookStatus.last_db_message.dttime).toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-gray-300 truncate">
                    <span className="text-gray-500 mr-2">[{webhookStatus.last_db_message.role}]</span>
                    {webhookStatus.last_db_message.msg_preview}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
