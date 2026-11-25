/**
 * Modelos de IA — cadastro de modelos de LLM, chaves por modelo e a lista ordenada de cada tipo
 * de chamada (principal + fallbacks). Sem nada cadastrado, cada tipo usa o modelo do `.env`.
 *
 * A regra vive no backend (`llm_registry_dao`, `llm_contract`); esta tela só mostra e repassa.
 * A chave de API nunca volta do servidor: a tela só conhece `fingerprint` e `last4`.
 *
 * Change: docs/modules/chatbot-whatsapp/changes/2026-11-13-provedor-de-llm-plugavel/ (T7)
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Cpu, Loader2, Plus, Trash2, ChevronUp, ChevronDown, CheckCircle2, XCircle, AlertTriangle,
  KeyRound, RefreshCw, Pencil, X, FlaskConical,
} from 'lucide-react';
import api from '@/services/api';

const PROVEDORES = ['openrouter', 'deepseek', 'custom'];

const erroDe = (err, padrao) => err?.response?.data?.error || padrao;

export const ehFree = (modelId) => /:free$/i.test((modelId || '').trim());

/** Sugestão de `ref` (o backend tem a mesma em `llm_registry_dao.ref_sugerida`). É só o valor
 * inicial do campo: a validação (unicidade, sem espaço) continua só no servidor. */
const refSugerida = (provider, modelId) => {
  const id = (modelId || '').trim();
  if (!id) return '';
  return provider === 'deepseek' ? id : `${provider}:${id}`;
};

/** Datas do banco vêm em UTC sem fuso ("2026-11-14 10:00:00"). */
function dataUtc(s) {
  if (!s) return null;
  const d = new Date(`${String(s).replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
const fmt = (s) => dataUtc(s)?.toLocaleString('pt-BR') || s || '—';

const chaveMascarada = (k) => `${k.fingerprint || 'chave'} · ****${k.last4 || ''}`;
const chaveUtil = (k) => k.enabled && !!k.test_ok_at;

const cartao = 'bg-gray-800/60 border border-gray-700 rounded-xl p-5';
const campoBase = 'bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-60';
const campo = `w-full ${campoBase}`;
const botao = 'inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition disabled:opacity-50';
const botaoPrim = `${botao} bg-violet-600 hover:bg-violet-500 text-white`;
const botaoSec = `${botao} bg-gray-700/60 hover:bg-gray-700 text-gray-200`;

function Mensagem({ msg }) {
  if (!msg) return null;
  const ok = msg.type === 'success';
  return (
    <div role={ok ? 'status' : 'alert'} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
      ok ? 'border-green-500/30 bg-green-500/10 text-green-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
      {ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
      <span>{msg.text}</span>
    </div>
  );
}

export function AvisoFree() {
  return (
    <div data-testid="aviso-free" className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      <span>
        Modelo <b>:free</b>: servido sob os termos de teste da OpenRouter (uso de avaliação), com
        limite de 20 req/min e 1.000 req/dia, sem cache. Não segura um tipo de volume como principal.
      </span>
    </div>
  );
}

function ResultadoTeste({ r }) {
  if (!r) return null;
  if (r.erro) return <Mensagem msg={{ type: 'error', text: r.erro }} />;
  return (
    <div className={`rounded-lg border px-3 py-2 text-xs ${r.aprovado
      ? 'border-green-500/30 bg-green-500/10 text-green-200' : 'border-red-500/30 bg-red-500/10 text-red-200'}`}>
      <div className="font-medium mb-1">
        {r.aprovado ? 'Teste de contrato aprovado' : 'Teste de contrato reprovado'}
        {' · '}JSON {r.json_ok ? 'ok' : 'reprovado'}
        {r.salvo === false && ' · nada foi salvo'}
      </div>
      <ul className="space-y-0.5">
        {(r.verificacoes || []).map((v) => (
          <li key={v.nome} className="flex gap-1.5">
            <span>{v.ok ? '✓' : '✗'}</span>
            <span className="text-gray-300">{v.nome}</span>
            {v.detalhe && <span className="text-gray-400">— {String(v.detalhe)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Formulário de modelo (novo ou edição) ─────────────────────────────────────

const VAZIO = {
  provider: 'openrouter', model_id: '', base_url: '', ref: '', label: '',
  price_hit: '', price_miss: '', price_out: '', peak_pricing: false,
};

function ModeloForm({ inicial, onSalvo, onCancelar }) {
  const editando = !!inicial;
  const [f, setF] = useState(() => (inicial
    ? { ...VAZIO, ...inicial, base_url: inicial.base_url || '', label: inicial.label || '' }
    : VAZIO));
  const [refTocada, setRefTocada] = useState(editando);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);

  const mudar = (campoNome, valor) => setF((atual) => {
    const novo = { ...atual, [campoNome]: valor };
    if (!refTocada && (campoNome === 'provider' || campoNome === 'model_id')) {
      novo.ref = refSugerida(novo.provider, novo.model_id);
    }
    return novo;
  });

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setMsg(null);
    const precos = { price_hit: f.price_hit, price_miss: f.price_miss, price_out: f.price_out };
    try {
      if (editando) {
        await api.patch(`/admin/llm/models/${inicial.id}`, {
          label: f.label, ...precos, peak_pricing: !!f.peak_pricing,
        });
      } else {
        await api.post('/admin/llm/models', {
          provider: f.provider, model_id: f.model_id, base_url: f.base_url || null, ref: f.ref,
          label: f.label, ...precos, peak_pricing: !!f.peak_pricing,
        });
      }
      onSalvo();
    } catch (err) {
      setMsg({ type: 'error', text: erroDe(err, 'Erro ao salvar o modelo.') });
    } finally {
      setSalvando(false);
    }
  }

  const rotulo = (texto, filho) => (
    <label className="block text-xs text-gray-400 space-y-1">
      <span>{texto}</span>
      {filho}
    </label>
  );

  return (
    <form onSubmit={salvar} className="space-y-3 bg-gray-900/40 border border-gray-700/60 rounded-lg p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rotulo('Provedor', (
          <select className={campo} value={f.provider} disabled={editando}
            onChange={(e) => mudar('provider', e.target.value)}>
            {PROVEDORES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        ))}
        {rotulo('Modelo (id no provedor)', (
          <input className={campo} value={f.model_id} disabled={editando} placeholder="xiaomi/mimo-v2.6-pro"
            onChange={(e) => mudar('model_id', e.target.value)} />
        ))}
        {rotulo(f.provider === 'custom' ? 'Base URL (obrigatória)' : 'Base URL (opcional)', (
          <input className={campo} value={f.base_url} disabled={editando} placeholder="https://..."
            onChange={(e) => mudar('base_url', e.target.value)} />
        ))}
        {rotulo('Ref (nome na telemetria)', (
          <input className={campo} value={f.ref} disabled={editando}
            onChange={(e) => { setRefTocada(true); mudar('ref', e.target.value); }} />
        ))}
        {rotulo('Rótulo', (
          <input className={campo} value={f.label} onChange={(e) => mudar('label', e.target.value)} />
        ))}
        <div className="grid grid-cols-3 gap-2">
          {rotulo('US$/M cache hit', <input className={campo} inputMode="decimal" value={f.price_hit} onChange={(e) => mudar('price_hit', e.target.value)} />)}
          {rotulo('US$/M cache miss', <input className={campo} inputMode="decimal" value={f.price_miss} onChange={(e) => mudar('price_miss', e.target.value)} />)}
          {rotulo('US$/M saída', <input className={campo} inputMode="decimal" value={f.price_out} onChange={(e) => mudar('price_out', e.target.value)} />)}
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-300">
        <input type="checkbox" checked={!!f.peak_pricing} onChange={(e) => mudar('peak_pricing', e.target.checked)} />
        Preço de pico (tabela diurna/noturna do DeepSeek)
      </label>
      {editando && (
        <p className="text-[11px] text-gray-500">
          Provedor, modelo, base URL e ref não mudam depois de cadastrados: cadastre outro modelo.
        </p>
      )}
      {ehFree(f.model_id) && <AvisoFree />}
      <Mensagem msg={msg} />
      <div className="flex gap-2">
        <button type="submit" className={botaoPrim} disabled={salvando}>
          {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {editando ? 'Salvar alterações' : 'Cadastrar modelo'}
        </button>
        <button type="button" className={botaoSec} onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

// ── Chaves de um modelo ───────────────────────────────────────────────────────

function statusTeste(k) {
  if (k.test_ok_at) return <span className="text-green-400">aprovada em {fmt(k.test_ok_at)}</span>;
  if (k.test_result) return <span className="text-red-400">reprovada no último teste</span>;
  return <span className="text-amber-400">não testada (fora da cadeia)</span>;
}

function Chaves({ modelo, chaves, tipos, onMudou }) {
  const [nova, setNova] = useState({ apiKey: '', label: '' });
  const [ocupado, setOcupado] = useState(null);
  const [msg, setMsg] = useState(null);
  const [resultado, setResultado] = useState(null);

  /** Desabilitar/excluir a última chave útil de um modelo em lista: permitido (chave vazada
   * precisa sair na hora), mas o admin precisa saber que o modelo sai da cadeia. */
  const ultimaEmLista = (k) => tipos.length > 0 && chaveUtil(k) && chaves.filter(chaveUtil).length === 1;
  const avisoSaida = (acao) => `${acao} a última chave habilitada e testada de ${modelo.ref}, que está `
    + `nas listas: ${tipos.join(', ')}. O modelo sai da cadeia e ela segue pelo próximo. Continuar?`;

  async function rodar(nome, fn) {
    setOcupado(nome);
    setMsg(null);
    try {
      await fn();
    } finally {
      setOcupado(null);
    }
  }

  const testarNova = () => rodar('testar-nova', async () => {
    try {
      const res = await api.post(`/admin/llm/models/${modelo.id}/test`, { api_key: nova.apiKey.trim() });
      setResultado({ ...res.data, salvo: false });
    } catch (err) {
      setResultado({ erro: erroDe(err, 'Erro ao testar a chave.') });
    }
  });

  const salvarNova = () => rodar('salvar', async () => {
    try {
      await api.post(`/admin/llm/models/${modelo.id}/keys`, {
        api_key: nova.apiKey.trim(), label: nova.label.trim() || null,
      });
      setNova({ apiKey: '', label: '' });
      setResultado(null);
      setMsg({ type: 'success', text: 'Chave salva. Teste-a para que entre na cadeia.' });
      onMudou();
    } catch (err) {
      setMsg({ type: 'error', text: erroDe(err, 'Erro ao salvar a chave.') });
    }
  });

  const testar = (k) => rodar(`testar-${k.id}`, async () => {
    try {
      const res = await api.post(`/admin/llm/keys/${k.id}/test`);
      setResultado(res.data);
      onMudou();
    } catch (err) {
      setResultado({ erro: erroDe(err, 'Erro ao testar a chave.') });
    }
  });

  const alternar = (k) => {
    if (k.enabled && ultimaEmLista(k) && !window.confirm(avisoSaida('Desabilitar'))) return;
    rodar(`alternar-${k.id}`, async () => {
      try {
        await api.patch(`/admin/llm/keys/${k.id}`, { enabled: !k.enabled });
        onMudou();
      } catch (err) {
        setMsg({ type: 'error', text: erroDe(err, 'Erro ao alterar a chave.') });
      }
    });
  };

  const excluir = (k) => {
    const texto = ultimaEmLista(k) ? avisoSaida('Excluir') : `Excluir a chave ${chaveMascarada(k)}?`;
    if (!window.confirm(texto)) return;
    rodar(`excluir-${k.id}`, async () => {
      try {
        await api.delete(`/admin/llm/keys/${k.id}`);
        onMudou();
      } catch (err) {
        setMsg({ type: 'error', text: erroDe(err, 'Erro ao excluir a chave.') });
      }
    });
  };

  const agora = Date.now();
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
        <KeyRound className="h-3.5 w-3.5 text-amber-400" /> Chaves ({chaves.length})
      </h4>
      {chaves.length === 0 && (
        <p className="text-[11px] text-gray-500">Sem chave: o modelo não pode entrar em lista.</p>
      )}
      {chaves.map((k) => {
        const espera = dataUtc(k.cooldown_until);
        return (
          <div key={k.id} data-testid={`chave-${k.id}`} className="flex flex-wrap items-center gap-2 bg-gray-900/40 border border-gray-700/50 rounded-lg px-3 py-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${chaveUtil(k) ? 'bg-green-500' : k.enabled ? 'bg-amber-500' : 'bg-gray-600'}`} />
            <div className="flex-1 min-w-0 text-xs">
              <div className="text-gray-200 truncate">
                {chaveMascarada(k)}
                {k.label && <span className="text-gray-500"> · {k.label}</span>}
                {!k.enabled && <span className="ml-2 text-[10px] text-gray-500">desabilitada</span>}
              </div>
              <div className="text-[11px] text-gray-500 space-x-2">
                {statusTeste(k)}
                {espera && espera.getTime() > agora && (
                  <span className="text-amber-400">em espera até {espera.toLocaleString('pt-BR')}</span>
                )}
                {k.last_error && <span className="text-red-400">último erro ({fmt(k.last_error_at)}): {k.last_error}</span>}
              </div>
            </div>
            <button type="button" className={botaoSec} disabled={!!ocupado} onClick={() => testar(k)}>
              {ocupado === `testar-${k.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
              Testar
            </button>
            <button type="button" className={botaoSec} disabled={!!ocupado} onClick={() => alternar(k)}>
              {k.enabled ? 'Desabilitar' : 'Habilitar'}
            </button>
            <button type="button" title="Excluir chave" aria-label={`Excluir chave ${k.fingerprint}`}
              className="p-1.5 text-gray-500 hover:text-red-400 rounded hover:bg-gray-700/60 transition"
              disabled={!!ocupado} onClick={() => excluir(k)}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      })}

      <div className="flex flex-wrap gap-2 items-end">
        <input type="password" autoComplete="off" aria-label={`Nova chave de ${modelo.ref}`}
          className={`${campoBase} flex-1 min-w-[12rem]`} placeholder="Nova chave de API"
          value={nova.apiKey} onChange={(e) => setNova({ ...nova, apiKey: e.target.value })} />
        <input className={`${campoBase} w-40`} placeholder="Rótulo (opcional)" aria-label="Rótulo da chave"
          value={nova.label} onChange={(e) => setNova({ ...nova, label: e.target.value })} />
        <button type="button" className={botaoSec} disabled={!nova.apiKey.trim() || !!ocupado} onClick={testarNova}>
          {ocupado === 'testar-nova' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
          Testar antes de salvar
        </button>
        <button type="button" className={botaoPrim} disabled={!nova.apiKey.trim() || !!ocupado} onClick={salvarNova}>
          <Plus className="h-3.5 w-3.5" /> Salvar chave
        </button>
      </div>
      <ResultadoTeste r={resultado} />
      <Mensagem msg={msg} />
    </div>
  );
}

// ── Cartão de modelo ──────────────────────────────────────────────────────────

function Modelo({ modelo, chaves, tipos, onMudou }) {
  const [editando, setEditando] = useState(false);
  const [msg, setMsg] = useState(null);

  async function excluir() {
    if (!window.confirm(`Excluir o modelo ${modelo.ref} e todas as chaves dele?`)) return;
    setMsg(null);
    try {
      await api.delete(`/admin/llm/models/${modelo.id}`);
      onMudou();
    } catch (err) {
      setMsg({ type: 'error', text: erroDe(err, 'Erro ao excluir o modelo.') });
    }
  }

  const json = modelo.json_ok === true ? ['JSON ok', 'text-green-400']
    : modelo.json_ok === false ? ['JSON reprovado', 'text-red-400'] : ['JSON não testado', 'text-gray-500'];

  return (
    <div data-testid={`modelo-${modelo.id}`} className="bg-gray-900/30 border border-gray-700/60 rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white break-all">
            {modelo.ref}
            {modelo.label && <span className="text-gray-400 font-normal"> · {modelo.label}</span>}
          </div>
          <div className="text-[11px] text-gray-500 break-all">
            {modelo.provider} · {modelo.model_id}{modelo.base_url ? ` · ${modelo.base_url}` : ''}
          </div>
          <div className="text-[11px] text-gray-400 mt-1 space-x-2">
            <span>US$/M: hit {modelo.price_hit} · miss {modelo.price_miss} · saída {modelo.price_out}</span>
            {modelo.peak_pricing && <span className="text-cyan-400">preço de pico</span>}
            <span className={json[1]}>{json[0]}</span>
          </div>
          <div className="text-[11px] mt-1">
            {tipos.length
              ? <span className="text-violet-300">nas listas: {tipos.join(', ')}</span>
              : <span className="text-gray-500">fora das listas</span>}
          </div>
        </div>
        <button type="button" className={botaoSec} onClick={() => setEditando((v) => !v)}>
          {editando ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          {editando ? 'Fechar' : 'Editar'}
        </button>
        <button type="button" className={botaoSec} onClick={excluir} aria-label={`Excluir modelo ${modelo.ref}`}>
          <Trash2 className="h-3.5 w-3.5" /> Excluir
        </button>
      </div>
      {ehFree(modelo.model_id) && <AvisoFree />}
      <Mensagem msg={msg} />
      {editando && (
        <ModeloForm inicial={modelo} onCancelar={() => setEditando(false)}
          onSalvo={() => { setEditando(false); onMudou(); }} />
      )}
      <Chaves modelo={modelo} chaves={chaves} tipos={tipos} onMudou={onMudou} />
    </div>
  );
}

// ── Lista de um tipo ──────────────────────────────────────────────────────────

// Item da lista que e o modelo do .env do tipo (`llm_provider.REF_ENV`, gravado no banco como
// model_pk NULL). Change docs/modules/chatbot-whatsapp/changes/2026-11-25-modelo-do-env-como-elo-da-lista/
const ENV = '.env';

function ListaTipo({ tipo, modelos, onSalvo }) {
  const salvos = tipo.itens.map((i) => i.model_pk);
  const [ordem, setOrdem] = useState(salvos);
  const [evidencia, setEvidencia] = useState('');
  const [adicionar, setAdicionar] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);

  const chaveSalvos = salvos.join(',');
  useEffect(() => {
    setOrdem(chaveSalvos ? chaveSalvos.split(',').map((v) => (v === ENV ? ENV : Number(v))) : []);
  }, [chaveSalvos]);

  const porId = Object.fromEntries(modelos.map((m) => [m.id, m]));
  const rotuloEnv = `Modelo do .env (${tipo.modelo_env})`;
  const refDe = (pk) => (pk === ENV ? rotuloEnv : null) || porId[pk]?.ref || tipo.itens.find((i) => i.model_pk === pk)?.ref || `#${pk}`;
  const mudou = ordem.join(',') !== chaveSalvos;
  const principalMudou = ordem.length > 0 && ordem[0] !== salvos[0];
  const principalSalvo = tipo.itens[0];

  const mover = (i, d) => setOrdem((o) => {
    const n = [...o];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    return n;
  });

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    const corpo = { tipo: tipo.tipo, modelos: ordem };
    if (principalMudou && evidencia.trim()) corpo.evidencia = evidencia.trim();
    try {
      const res = await api.put('/admin/llm/chains', corpo);
      setEvidencia('');
      setMsg({ type: 'success', text: ordem.length ? 'Lista salva.' : 'Lista vazia: o tipo volta ao .env.' });
      onSalvo(tipo.tipo, res.data.itens || []);
    } catch (err) {
      setMsg({ type: 'error', text: erroDe(err, 'Erro ao salvar a lista.') });
    } finally {
      setSalvando(false);
    }
  }

  const disponiveis = modelos.filter((m) => !ordem.includes(m.id));
  const envDisponivel = !ordem.includes(ENV);

  return (
    <div data-testid={`tipo-${tipo.tipo}`} className="bg-gray-900/30 border border-gray-700/60 rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-white font-mono">{tipo.tipo}</span>
        {tipo.estruturado && (
          <span className="text-[10px] uppercase tracking-wide text-cyan-300 border border-cyan-400/30 rounded px-1.5 py-0.5">exige JSON</span>
        )}
        {tipo.usando_env && (
          <span className="text-[11px] text-gray-400">usando o .env ({tipo.modelo_env})</span>
        )}
      </div>

      {ordem.length === 0 ? (
        <p className="text-[11px] text-gray-500">Lista vazia: este tipo usa o modelo do .env ({tipo.modelo_env}).</p>
      ) : (
        <ol className="space-y-1">
          {ordem.map((pk, i) => (
            <li key={pk} className="flex items-center gap-2 text-xs bg-gray-800/60 rounded px-2 py-1.5">
              <span className="w-16 text-gray-500">{i === 0 ? 'principal' : `fallback ${i}`}</span>
              <span className="flex-1 text-gray-200 break-all">{refDe(pk)}</span>
              <button type="button" aria-label={`Subir ${refDe(pk)}`} disabled={i === 0} onClick={() => mover(i, -1)}
                className="p-1 text-gray-400 hover:text-white disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
              <button type="button" aria-label={`Descer ${refDe(pk)}`} disabled={i === ordem.length - 1} onClick={() => mover(i, 1)}
                className="p-1 text-gray-400 hover:text-white disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
              <button type="button" aria-label={`Tirar ${refDe(pk)} da lista`} onClick={() => setOrdem((o) => o.filter((x) => x !== pk))}
                className="p-1 text-gray-500 hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ol>
      )}

      {principalSalvo?.evidencia && !principalMudou && (
        <p className="text-[11px] text-gray-400">
          Homologação do principal: {principalSalvo.evidencia}
          {principalSalvo.homologado_por && ` — ${principalSalvo.homologado_por}`}
          {principalSalvo.homologado_em && `, ${fmt(principalSalvo.homologado_em)}`}
        </p>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        {(envDisponivel || disponiveis.length > 0) && (
          <>
            <select className={`${campoBase} w-auto`} aria-label={`Adicionar modelo em ${tipo.tipo}`}
              value={adicionar} onChange={(e) => setAdicionar(e.target.value)}>
              <option value="">Adicionar modelo…</option>
              {envDisponivel && <option value={ENV}>{rotuloEnv}</option>}
              {disponiveis.map((m) => <option key={m.id} value={m.id}>{m.ref}</option>)}
            </select>
            <button type="button" className={botaoSec} disabled={!adicionar}
              onClick={() => { setOrdem((o) => [...o, adicionar === ENV ? ENV : Number(adicionar)]); setAdicionar(''); }}>
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          </>
        )}
      </div>

      {principalMudou && (
        <label className="block text-[11px] text-gray-400 space-y-1">
          <span>Evidência de homologação do novo principal (opcional: suíte, replay, data)</span>
          <input className={campo} value={evidencia} onChange={(e) => setEvidencia(e.target.value)} />
        </label>
      )}

      {mudou && (
        <div className="flex gap-2">
          <button type="button" className={botaoPrim} disabled={salvando} onClick={salvar}>
            {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar lista
          </button>
          <button type="button" className={botaoSec} disabled={salvando}
            onClick={() => { setOrdem(salvos); setEvidencia(''); setMsg(null); }}>Descartar</button>
        </div>
      )}
      <Mensagem msg={msg} />
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function LlmModels() {
  const [modelos, setModelos] = useState(null);
  const [chaves, setChaves] = useState({});
  const [tipos, setTipos] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [novo, setNovo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [m, c] = await Promise.all([api.get('/admin/llm/models'), api.get('/admin/llm/chains')]);
      const lista = m.data.models || [];
      const porModelo = await Promise.all(lista.map((mod) => api.get(`/admin/llm/models/${mod.id}/keys`)
        .then((r) => [mod.id, r.data.keys || []])));
      setModelos(lista);
      setChaves(Object.fromEntries(porModelo));
      setTipos(c.data.tipos || []);
    } catch (err) {
      setErro(erroDe(err, 'Erro ao carregar o cadastro de modelos.'));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const tiposDoModelo = (id) => (tipos || []).filter((t) => t.itens.some((i) => i.model_pk === id)).map((t) => t.tipo);

  const listaSalva = (nome, itens) => setTipos((ts) => ts.map((t) => (t.tipo === nome
    ? { ...t, itens, usando_env: itens.length === 0 } : t)));

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Cpu className="h-5 w-5 text-violet-400" /> Modelos de IA
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Modelos de LLM, chaves por modelo e a ordem (principal e fallbacks) de cada tipo de chamada.
            Mudanças valem em até 60 s, sem deploy. Tipo sem lista usa o modelo do .env.
          </p>
        </div>
        <button type="button" onClick={carregar} title="Atualizar" aria-label="Atualizar"
          className="p-2 text-gray-400 hover:text-white rounded hover:bg-gray-700 transition">
          <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {erro && <Mensagem msg={{ type: 'error', text: erro }} />}

      {!modelos && !erro ? (
        <div className="text-sm text-gray-400 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : modelos && (
        <>
          <section className={cartao}>
            <h2 className="text-base font-semibold text-white mb-1">Listas por tipo de chamada</h2>
            <p className="text-xs text-gray-500 mb-4">
              Só entra na lista modelo com chave habilitada aprovada no teste; tipo que exige JSON só
              aceita modelo com JSON aprovado.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {(tipos || []).map((t) => (
                <ListaTipo key={t.tipo} tipo={t} modelos={modelos} onSalvo={listaSalva} />
              ))}
            </div>
          </section>

          <section className={cartao}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">Modelos cadastrados</h2>
              {!novo && (
                <button type="button" className={botaoPrim} onClick={() => setNovo(true)}>
                  <Plus className="h-3.5 w-3.5" /> Novo modelo
                </button>
              )}
            </div>
            {novo && (
              <div className="mb-4">
                <ModeloForm onCancelar={() => setNovo(false)} onSalvo={() => { setNovo(false); carregar(); }} />
              </div>
            )}
            {modelos.length === 0 ? (
              <p className="text-sm text-gray-400">
                Nenhum modelo cadastrado: todos os tipos estão usando o .env.
              </p>
            ) : (
              <div className="space-y-3">
                {modelos.map((m) => (
                  <Modelo key={m.id} modelo={m} chaves={chaves[m.id] || []}
                    tipos={tiposDoModelo(m.id)} onMudou={carregar} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
