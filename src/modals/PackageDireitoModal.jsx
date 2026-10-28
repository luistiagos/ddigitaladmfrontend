import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, ShieldCheck, Search, Trash2, Plus } from 'lucide-react';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { formatUtcDateTime } from '@/utils/format';

/* ─── Cadastro de direito do pacote ───────────────────────────────
 * GET/PUT/DELETE /admin/items/<id>/direito e PUT /admin/items/<id>/nome-exibicao.
 * O vocabulario (sistemas e fatias) vem da resposta, nunca do painel. Quem decide se uma mudanca
 * reduz o alcance e o servidor (409 com o alcance); o painel so mostra os numeros e reenvia com
 * `confirmar_reducao: true` (EARS-11, porta 4 do design).
 * Doc: docs/modules/area-membros/changes/2026-10-20-telas-de-vinculos-do-direito/spec.md
 */

const SELO = {
  nao_configurado: { label: 'não configurado', variant: 'gray' },
  sem_conteudo: { label: 'sem conteúdo de app', variant: 'blue' },
};

function plural(n, um, varios) {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Selo do estado do cadastro, o mesmo na lista de produtos e no cadastro (EARS-12). */
export function seloDoCadastro({ estado, sistemas, incluidos }) {
  if (SELO[estado]) return SELO[estado];
  const label = plural(sistemas, 'sistema', 'sistemas')
    + (incluidos > 0 ? ` · ${plural(incluidos, 'incluído', 'incluídos')}` : '');
  return { label, variant: 'green' };
}

function estadoDoCadastro(c) {
  return {
    estado: !c.configurado ? 'nao_configurado' : c.sem_conteudo ? 'sem_conteudo' : 'configurado',
    sistemas: c.sistemas.length,
    incluidos: c.incluidos.length,
  };
}

function formDoCadastro(c) {
  return {
    sem_conteudo: c.sem_conteudo,
    sistemas: c.sistemas.map(s => s.mnemonico),
    fatias: [...c.fatias],
    incluidos: [...c.incluidos],
  };
}

function alternar(lista, valor) {
  return lista.includes(valor) ? lista.filter(v => v !== valor) : [...lista, valor];
}

function somar(lista, novos) {
  return [...lista, ...novos.filter(v => !lista.includes(v))];
}

function erroDaResposta(e, padrao) {
  return e?.response?.data?.error || padrao;
}

function ErrorBox({ children }) {
  return (
    <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
      {children}
    </div>
  );
}

function Bloco({ titulo, children }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-400">{titulo}</p>
      {children}
    </div>
  );
}

const NOME_MAX = 80;

export default function PackageDireitoModal({ pacote, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [aviso, setAviso] = useState('');
  // { acao: 'salvar' | 'remover', alcance: {contas, compras} } -- vem do 409 do servidor
  const [reducao, setReducao] = useState(null);
  const [nome, setNome] = useState('');
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [nomeMsg, setNomeMsg] = useState('');
  const [nomeErro, setNomeErro] = useState('');

  const fetchCadastro = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/admin/items/${pacote.id}/direito`);
      setData(res.data);
      setForm(formDoCadastro(res.data.cadastro));
      setNome(res.data.nome_exibicao || '');
    } catch (e) {
      setData(null);
      setError(erroDaResposta(e, 'Erro ao carregar o cadastro de direito.'));
    } finally {
      setLoading(false);
    }
  }, [pacote.id]);

  useEffect(() => { fetchCadastro(); }, [fetchCadastro]);

  function corpoDoCadastro(confirmar) {
    // "Sem conteudo" nao leva sistema, fatia nem inclusao (EARS-8): as listas vao vazias, e o que
    // estava marcado volta se o admin desmarcar "sem conteudo" antes de salvar.
    const listas = form.sem_conteudo
      ? { sistemas: [], fatias: [], incluidos: [] }
      : { sistemas: form.sistemas, fatias: form.fatias, incluidos: form.incluidos };
    return { sem_conteudo: form.sem_conteudo, ...listas, confirmar_reducao: confirmar };
  }

  function falhou(e, acao, confirmar, padrao) {
    if (e?.response?.status === 409 && !confirmar) {
      setReducao({ acao, alcance: e.response.data.alcance || { contas: 0, compras: 0 } });
      return;
    }
    setReducao(null);
    setSaveError({ mensagem: erroDaResposta(e, padrao), recusados: e?.response?.data?.recusados });
  }

  async function salvar(confirmar) {
    setSaving(true);
    setSaveError(null);
    setAviso('');
    try {
      const res = await api.put(`/admin/items/${pacote.id}/direito`, corpoDoCadastro(confirmar));
      setReducao(null);
      setData(d => ({ ...d, cadastro: res.data.cadastro }));
      setForm(formDoCadastro(res.data.cadastro));
      setAviso('Cadastro salvo.');
      onChanged?.();
    } catch (e) {
      falhou(e, 'salvar', confirmar, 'Erro ao salvar o cadastro de direito.');
    } finally {
      setSaving(false);
    }
  }

  async function remover(confirmar) {
    setSaving(true);
    setSaveError(null);
    setAviso('');
    try {
      await api.delete(`/admin/items/${pacote.id}/direito${confirmar ? '?confirmar_reducao=1' : ''}`);
      setReducao(null);
      setAviso('Cadastro removido: o pacote voltou a "não configurado".');
      onChanged?.();
      await fetchCadastro();
    } catch (e) {
      falhou(e, 'remover', confirmar, 'Erro ao remover o cadastro de direito.');
    } finally {
      setSaving(false);
    }
  }

  async function salvarNome() {
    setSalvandoNome(true);
    setNomeMsg('');
    setNomeErro('');
    try {
      const res = await api.put(`/admin/items/${pacote.id}/nome-exibicao`, { nome });
      const gravado = res.data.nome_exibicao;
      setNome(gravado || '');
      setNomeMsg(gravado ? 'Nome de exibição salvo.' : 'Nome de exibição apagado: o app usa o título do pacote.');
    } catch (e) {
      setNomeErro(erroDaResposta(e, 'Erro ao salvar o nome de exibição.'));
    } finally {
      setSalvandoNome(false);
    }
  }

  const cadastro = data?.cadastro;
  const vocab = data?.vocabulario ?? null;
  const podeSalvar = !!form && !!vocab && !saving;
  const nomeDoPacote = `${pacote.title} (#${pacote.id})`;
  const alcance = reducao?.alcance;
  const numeros = alcance
    ? `${plural(alcance.contas, 'conta', 'contas')} e ${plural(alcance.compras, 'compra aprovada', 'compras aprovadas')}`
    : '';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
        <div
          role="dialog"
          aria-label="Direito do app"
          className="w-full max-w-2xl bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 shrink-0">
            <div className="min-w-0">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-violet-400" /> Direito do app
              </h2>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{nomeDoPacote}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Spinner so na primeira leitura: a releitura depois de remover mantem a tela. */}
            {loading && !data ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando o cadastro…
              </div>
            ) : error ? (
              <ErrorBox>
                {error}{' '}
                <button onClick={fetchCadastro} className="underline hover:text-red-300">Tentar de novo</button>
              </ErrorBox>
            ) : (
              <>
                <EstadoDoCadastro cadastro={cadastro} alcance={data.alcance} />

                {vocab === null && (
                  <ErrorBox>
                    Repositório de ROMs indisponível: o cadastro pode ser lido, mas não salvo.
                    {data.vocabulario_erro && <span className="block text-xs mt-1 text-red-300/80">{data.vocabulario_erro}</span>}
                  </ErrorBox>
                )}

                <label className="flex items-center gap-2 text-sm text-gray-200">
                  <input
                    type="checkbox"
                    checked={form.sem_conteudo}
                    onChange={() => setForm(f => ({ ...f, sem_conteudo: !f.sem_conteudo }))}
                  />
                  Sem conteúdo de app
                </label>
                {form.sem_conteudo && (
                  <p className="text-xs text-gray-500 -mt-3">
                    O pacote não concede sistema, fatia nem inclusão: as listas abaixo não são salvas.
                  </p>
                )}

                <fieldset disabled={form.sem_conteudo} className={`space-y-5 ${form.sem_conteudo ? 'opacity-50' : ''}`}>
                  <CopiarDeOutro
                    pacoteId={pacote.id}
                    onCopiar={c => setForm(f => ({
                      ...f,
                      sistemas: somar(f.sistemas, c.sistemas),
                      fatias: somar(f.fatias, c.fatias),
                      incluidos: somar(f.incluidos, c.incluidos),
                    }))}
                  />

                  <Sistemas
                    cadastro={cadastro}
                    vocab={vocab}
                    marcados={form.sistemas}
                    filtro={filtro}
                    onFiltro={setFiltro}
                    onToggle={m => setForm(f => ({ ...f, sistemas: alternar(f.sistemas, m) }))}
                  />

                  {(data.fatias || []).length > 0 && (
                    <Bloco titulo="Fatias">
                      <div className="flex flex-wrap gap-4">
                        {data.fatias.map(fatia => (
                          <label key={fatia} className="flex items-center gap-2 text-sm text-gray-200">
                            <input
                              type="checkbox"
                              checked={form.fatias.includes(fatia)}
                              onChange={() => setForm(f => ({ ...f, fatias: alternar(f.fatias, fatia) }))}
                            />
                            {fatia}
                          </label>
                        ))}
                      </div>
                    </Bloco>
                  )}

                  <Incluidos
                    pacoteId={pacote.id}
                    incluidos={form.incluidos}
                    onAdd={id => setForm(f => ({ ...f, incluidos: f.incluidos.includes(id) ? f.incluidos : [...f.incluidos, id] }))}
                    onRemove={id => setForm(f => ({ ...f, incluidos: f.incluidos.filter(i => i !== id) }))}
                  />
                </fieldset>

                {saveError && (
                  <ErrorBox>
                    {saveError.mensagem}
                    {(saveError.recusados || []).length > 0 && (
                      <span className="block text-xs mt-1">Recusados: {saveError.recusados.join(', ')}</span>
                    )}
                  </ErrorBox>
                )}
                {aviso && <p className="text-sm text-green-400">{aviso}</p>}

                <div className="flex gap-3">
                  <button
                    onClick={() => salvar(false)}
                    disabled={!podeSalvar}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Salvar cadastro
                  </button>
                  {cadastro.configurado && (
                    <button
                      onClick={() => remover(false)}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" /> Remover cadastro
                    </button>
                  )}
                </div>

                <div className="border-t border-gray-700 pt-5">
                  <Bloco titulo={`Nome de exibição no app (até ${NOME_MAX} caracteres; vazio = título do pacote)`}>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        aria-label="Nome de exibição"
                        value={nome}
                        maxLength={NOME_MAX}
                        onChange={e => setNome(e.target.value)}
                        placeholder={pacote.title}
                        className="flex-1 bg-gray-700/50 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500 placeholder-gray-500"
                      />
                      <button
                        onClick={salvarNome}
                        disabled={salvandoNome}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors disabled:opacity-50"
                      >
                        {salvandoNome && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Salvar nome
                      </button>
                    </div>
                    {nomeMsg && <p className="text-xs text-green-400">{nomeMsg}</p>}
                    {nomeErro && <ErrorBox>{nomeErro}</ErrorBox>}
                  </Bloco>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {reducao && (
        <ConfirmModal
          title={reducao.acao === 'remover' ? 'Remover cadastro' : 'Reduzir o alcance'}
          message={reducao.acao === 'remover'
            ? `Remover o cadastro de ${nomeDoPacote}? Ele volta a "não configurado". Alcance: ${numeros} (diretas ou por inclusão).`
            : `A mudança reduz o alcance de ${nomeDoPacote}: ${numeros} (diretas ou por inclusão) perdem o que for tirado. Confirmar?`}
          confirmLabel={reducao.acao === 'remover' ? 'Remover' : 'Confirmar redução'}
          destructive
          loading={saving}
          onConfirm={() => (reducao.acao === 'remover' ? remover(true) : salvar(true))}
          onCancel={() => setReducao(null)}
        />
      )}
    </>
  );
}

function EstadoDoCadastro({ cadastro, alcance }) {
  const selo = seloDoCadastro(estadoDoCadastro(cadastro));
  return (
    <div className="space-y-1 text-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={selo.variant}>{selo.label}</Badge>
        {cadastro.configurado && (
          <span className="text-xs text-gray-500">
            atualizado por {cadastro.atualizado_por || '—'} em {formatUtcDateTime(cadastro.atualizado_em)}
          </span>
        )}
      </div>
      {!cadastro.configurado && (
        <p className="text-xs text-gray-500">Sem cadastro: o pacote não concede nada no app (à venda em loja ligada, aparece "em preparação").</p>
      )}
      {alcance && (
        <p className="text-xs text-gray-400">
          Alcance hoje: {plural(alcance.contas, 'conta', 'contas')} e {plural(alcance.compras, 'compra aprovada', 'compras aprovadas')} (diretas ou por inclusão).
        </p>
      )}
    </div>
  );
}

function Sistemas({ cadastro, vocab, marcados, filtro, onFiltro, onToggle }) {
  if (vocab === null) {
    // Sem vocabulario nao se afirma "fora do repositorio" (o servidor manda a marca `null`).
    const gravados = cadastro.sistemas.map(s => s.mnemonico);
    return (
      <Bloco titulo="Sistemas">
        <p className="text-xs text-gray-400">
          Gravados: {gravados.length > 0 ? gravados.join(', ') : 'nenhum'}
        </p>
      </Bloco>
    );
  }
  const fora = cadastro.sistemas.filter(s => s.no_repositorio === false).map(s => s.mnemonico);
  const termo = filtro.trim().toLowerCase();
  const visiveis = termo
    ? vocab.filter(v => v.mnemonico.toLowerCase().includes(termo) || (v.console || '').toLowerCase().includes(termo))
    : vocab;
  return (
    <Bloco titulo={`Sistemas (${marcados.length} marcados)`}>
      {fora.length > 0 && (
        <div className="space-y-1 p-3 rounded-lg border border-orange-500/30 bg-orange-500/5">
          {fora.map(m => (
            <label key={m} className="flex items-center gap-2 text-sm text-gray-200">
              <input type="checkbox" checked={marcados.includes(m)} onChange={() => onToggle(m)} />
              {m} <Badge variant="orange">fora do repositório</Badge>
            </label>
          ))}
          <p className="text-xs text-orange-300/80">
            Saiu do repositório de ROMs: o servidor recusa salvar com ele marcado.
          </p>
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 pointer-events-none" />
        <input
          type="text"
          value={filtro}
          onChange={e => onFiltro(e.target.value)}
          placeholder="Filtrar sistemas..."
          className="w-full bg-gray-700/50 border border-gray-600 text-white text-sm rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-violet-500 placeholder-gray-500"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 max-h-56 overflow-y-auto pr-1">
        {visiveis.map(v => (
          <label key={v.mnemonico} className="flex items-center gap-2 text-sm text-gray-200 min-w-0">
            <input type="checkbox" checked={marcados.includes(v.mnemonico)} onChange={() => onToggle(v.mnemonico)} />
            <span className="truncate">{v.mnemonico} — {v.console || '?'}</span>
          </label>
        ))}
        {visiveis.length === 0 && <p className="text-xs text-gray-500">Nenhum sistema com esse filtro.</p>}
      </div>
    </Bloco>
  );
}

/** Busca de pacote por titulo ou id, a mesma para incluir e para copiar (EARS-33). */
function BuscaDePacote({ excluir, placeholder, rotuloBotao, acao, ariaAcao, onEscolher, vazio }) {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState('');

  async function buscar(e) {
    e?.preventDefault();
    const q = busca.trim();
    if (!q) return;
    setErro('');
    if (/^\d+$/.test(q)) {
      // Id direto: o servidor recusa id inexistente nomeando-o (EARS-9).
      setResultados([{ id: Number(q), title: null }]);
      return;
    }
    setBuscando(true);
    try {
      const res = await api.get(`/admin/items?title=${encodeURIComponent(q)}&per_page=10`);
      setResultados(res.data.items || []);
    } catch (err) {
      setResultados(null);
      setErro(erroDaResposta(err, 'Erro ao buscar pacotes.'));
    } finally {
      setBuscando(false);
    }
  }

  const candidatos = (resultados || []).filter(r => !excluir(r.id));

  return (
    <>
      <div className="flex gap-2">
        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') buscar(e); }}
          placeholder={placeholder}
          className="flex-1 bg-gray-700/50 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500 placeholder-gray-500"
        />
        <button
          type="button"
          onClick={buscar}
          disabled={buscando}
          aria-label={rotuloBotao}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors disabled:opacity-50"
        >
          {buscando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} Buscar
        </button>
      </div>
      {erro && <ErrorBox>{erro}</ErrorBox>}
      {resultados && candidatos.length === 0 && (
        <p className="text-xs text-gray-500">{vazio}</p>
      )}
      {candidatos.length > 0 && (
        <ul className="space-y-1">
          {candidatos.map(r => (
            <li key={r.id} className="flex items-center justify-between gap-2 text-sm text-gray-300">
              <span className="truncate">#{r.id}{r.title ? ` ${r.title}` : ''}</span>
              <button
                type="button"
                aria-label={`${ariaAcao} ${r.id}`}
                onClick={() => onEscolher(r)}
                className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 shrink-0"
              >
                <Plus className="h-3 w-3" /> {acao}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Incluidos({ pacoteId, incluidos, onAdd, onRemove }) {
  const [titulos, setTitulos] = useState({});

  function incluir(item) {
    if (item.title) setTitulos(t => ({ ...t, [item.id]: item.title }));
    onAdd(item.id);
  }

  const ordenados = [...incluidos].sort((a, b) => a - b);

  return (
    <Bloco titulo="Pacotes incluídos (quem tem este pacote ganha também estes)">
      {ordenados.length === 0 ? (
        <p className="text-xs text-gray-500">Nenhum pacote incluído.</p>
      ) : (
        <ul className="space-y-1">
          {ordenados.map(id => (
            <li key={id} aria-label={`incluido ${id}`} className="flex items-center justify-between gap-2 text-sm text-gray-200">
              <span>#{id}{titulos[id] ? ` ${titulos[id]}` : ''}</span>
              <button type="button" onClick={() => onRemove(id)} className="text-xs text-red-400 hover:text-red-300">
                Tirar
              </button>
            </li>
          ))}
        </ul>
      )}
      <BuscaDePacote
        excluir={id => id === pacoteId || incluidos.includes(id)}
        placeholder="Buscar pacote por título ou id..."
        acao="Incluir"
        ariaAcao="incluir"
        vazio="Nenhum pacote para incluir."
        onEscolher={incluir}
      />
    </Bloco>
  );
}

/** Copia o cadastro direto de outro pacote para o formulario, somado ao que ja esta marcado
 * (EARS-33). Nao grava: so "Salvar cadastro" grava, e reduzir continua passando pelo 409. */
function CopiarDeOutro({ pacoteId, onCopiar }) {
  const [copiando, setCopiando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');

  async function copiar(item) {
    setCopiando(true);
    setAviso('');
    setErro('');
    const origem = `#${item.id}${item.title ? ` ${item.title}` : ''}`;
    try {
      const res = await api.get(`/admin/items/${item.id}/direito`);
      const c = res.data.cadastro;
      if (!c.configurado || c.sem_conteudo) {
        setAviso(`${origem} não tem vínculos para copiar.`);
        return;
      }
      // Sistema fora do repositorio faria o servidor recusar o cadastro inteiro (EARS-4), e o
      // proprio pacote nao pode se incluir (EARS-9).
      const sistemas = c.sistemas.filter(s => s.no_repositorio !== false).map(s => s.mnemonico);
      const fora = c.sistemas.filter(s => s.no_repositorio === false).map(s => s.mnemonico);
      const incluidos = c.incluidos.filter(id => id !== pacoteId);
      onCopiar({ sistemas, fatias: [...c.fatias], incluidos });
      const naoCopiados = [
        ...fora.map(m => `${m} (fora do repositório)`),
        ...(c.incluidos.includes(pacoteId) ? [`#${pacoteId} (o próprio pacote)`] : []),
      ];
      setAviso(`Copiado de ${origem}: ${plural(sistemas.length, 'sistema', 'sistemas')}, `
        + `${plural(c.fatias.length, 'fatia', 'fatias')} e ${plural(incluidos.length, 'incluído', 'incluídos')}, `
        + 'somados ao que já estava marcado. Salve para gravar.'
        + (naoCopiados.length > 0 ? ` Não copiados: ${naoCopiados.join(', ')}.` : ''));
    } catch (e) {
      setErro(erroDaResposta(e, `Erro ao ler o cadastro de ${origem}.`));
    } finally {
      setCopiando(false);
    }
  }

  return (
    <Bloco titulo="Copiar de outro pacote (marca os vínculos dele somados aos daqui; só grava ao salvar)">
      <BuscaDePacote
        excluir={id => id === pacoteId}
        placeholder="Copiar de: título ou id do pacote..."
        rotuloBotao="Procurar pacote de origem"
        acao="Copiar"
        ariaAcao="copiar de"
        vazio="Nenhum outro pacote com esse termo."
        onEscolher={copiar}
      />
      {copiando && (
        <p className="flex items-center gap-2 text-xs text-gray-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lendo o cadastro…
        </p>
      )}
      {aviso && <p className="text-xs text-green-400">{aviso}</p>}
      {erro && <ErrorBox>{erro}</ErrorBox>}
    </Bloco>
  );
}
