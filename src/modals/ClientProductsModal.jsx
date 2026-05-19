import { useState, useEffect, useCallback } from 'react';
import {
  X, Loader2, Store, Package, Plus, Trash2, ChevronLeft,
  CheckCircle2, Circle, ShoppingBag, LinkIcon, Unlink
} from 'lucide-react';
import api from '@/services/api';
import { formatCurrency } from '@/utils/format';

/* ─── Helpers ─────────────────────────────────────────────────── */
function Spinner() {
  return <Loader2 className="h-4 w-4 animate-spin" />;
}

/* ─── Main Modal ──────────────────────────────────────────────── */
export default function ClientProductsModal({ client, onClose }) {
  // 'stores' | 'store_products'
  const [view, setView] = useState('stores');
  const [activeStore, setActiveStore] = useState(null);

  function openStoreProducts(store) {
    setActiveStore(store);
    setView('store_products');
  }

  function backToStores() {
    setActiveStore(null);
    setView('stores');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/60 shrink-0 bg-gray-800/50">
          <div className="flex items-center gap-3 min-w-0">
            {view === 'store_products' && (
              <button
                onClick={backToStores}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                title="Voltar para lojas"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="font-semibold text-white text-base truncate">
                {view === 'stores' ? 'Lojas do cliente' : `Produtos — ${activeStore?.name}`}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{client.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-3 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          {view === 'stores' ? (
            <StoresView client={client} onOpenStore={openStoreProducts} />
          ) : (
            <StoreProductsView client={client} store={activeStore} />
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-3 border-t border-gray-700/60 shrink-0 bg-gray-800/30">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-300 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Stores View ─────────────────────────────────────────────── */
function StoresView({ client, onOpenStore }) {
  const [stores, setStores] = useState([]);
  const [allStores, setAllStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [error, setError] = useState('');

  const fetchStores = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [clientRes, allRes] = await Promise.all([
        api.get(`/admin/clients/${client.id}/stores`),
        api.get('/admin/stores'),
      ]);
      setStores(clientRes.data.stores || []);
      setAllStores(allRes.data.stores || []);
    } catch {
      setError('Erro ao carregar lojas.');
    } finally {
      setLoading(false);
    }
  }, [client.id]);

  useEffect(() => { fetchStores(); }, [fetchStores]);

  const linkedIds = new Set(stores.map(s => s.id));
  const availableToAdd = allStores.filter(s => !linkedIds.has(s.id));

  async function handleAddStore(store) {
    setAddingId(store.id);
    setShowAddDropdown(false);
    try {
      await api.post(`/admin/clients/${client.id}/stores`, { store_id: store.id });
      await fetchStores();
    } catch (e) {
      const msg = e?.response?.data?.error || 'Erro ao vincular loja.';
      setError(msg);
    } finally {
      setAddingId(null);
    }
  }

  async function handleRemoveStore(storeId) {
    if (!window.confirm('Desvincular esta loja do cliente?')) return;
    setRemovingId(storeId);
    try {
      await api.delete(`/admin/clients/${client.id}/stores/${storeId}`);
      setStores(prev => prev.filter(s => s.id !== storeId));
    } catch {
      setError('Erro ao desvincular loja.');
    } finally {
      setRemovingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-14 text-gray-400 text-sm">
        <Spinner /> Carregando lojas…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      {/* Add store button */}
      <div className="relative">
        <button
          onClick={() => setShowAddDropdown(v => !v)}
          disabled={availableToAdd.length === 0}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
        >
          <Plus className="h-4 w-4" />
          Vincular loja
        </button>

        {showAddDropdown && availableToAdd.length > 0 && (
          <div className="absolute left-0 mt-2 z-20 w-72 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-700">
              <p className="text-xs text-gray-400 font-medium">Selecione uma loja para vincular</p>
            </div>
            <ul className="max-h-56 overflow-y-auto">
              {availableToAdd.map(s => (
                <li key={s.id}>
                  <button
                    onClick={() => handleAddStore(s)}
                    disabled={addingId === s.id}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-700 text-left transition-colors text-sm"
                  >
                    {addingId === s.id
                      ? <Spinner />
                      : <Store className="h-4 w-4 text-violet-400 shrink-0" />
                    }
                    <span className="text-gray-200 truncate">{s.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* click-outside overlay */}
        {showAddDropdown && (
          <div className="fixed inset-0 z-10" onClick={() => setShowAddDropdown(false)} />
        )}
      </div>

      {/* Stores list */}
      {stores.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <Store className="h-10 w-10 text-gray-600" />
          <p className="text-sm text-gray-500">Nenhuma loja vinculada ao cliente.</p>
          <p className="text-xs text-gray-600">Use o botão acima para vincular uma loja.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {stores.map(store => (
            <StoreCard
              key={store.id}
              store={store}
              removing={removingId === store.id}
              onView={() => onOpenStore(store)}
              onRemove={() => handleRemoveStore(store.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Store Card ──────────────────────────────────────────────── */
function StoreCard({ store, removing, onView, onRemove }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-gray-800/60 border border-gray-700/60 rounded-xl hover:border-gray-600 transition-colors group">
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center shrink-0">
        {store.url_thumb ? (
          <img src={store.url_thumb} alt={store.name} className="w-8 h-8 object-contain rounded" />
        ) : (
          <Store className="h-5 w-5 text-violet-400" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{store.name}</p>
        {store.url_page && (
          <a
            href={store.url_page}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-violet-400 hover:text-violet-300 truncate block"
          >
            {store.url_page}
          </a>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onView}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 transition-colors border border-violet-600/30"
        >
          <Package className="h-3.5 w-3.5" />
          Ver produtos
        </button>
        <button
          onClick={onRemove}
          disabled={removing}
          title="Desvincular loja"
          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
        >
          {removing ? <Spinner /> : <Unlink className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/* ─── Store Products View ─────────────────────────────────────── */
function StoreProductsView({ client, store }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState({}); // { product_id: bool }

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/admin/clients/${client.id}/stores/${store.id}/products`);
      setItems(res.data.items || []);
    } catch {
      setError('Erro ao carregar produtos da loja.');
    } finally {
      setLoading(false);
    }
  }, [client.id, store.id]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function handleToggle(item) {
    const pid = item.product_id;
    setToggling(t => ({ ...t, [pid]: true }));
    try {
      if (item.client_has) {
        await api.delete(`/admin/clients/${client.id}/products/${pid}`);
        setItems(prev => prev.map(i =>
          i.product_id === pid
            ? { ...i, client_has: false, user_package_id: null }
            : i
        ));
      } else {
        const res = await api.post(`/admin/clients/${client.id}/products`, {
          package_id: pid,
          store_id: store.id,
        });
        setItems(prev => prev.map(i =>
          i.product_id === pid
            ? { ...i, client_has: true, user_package_id: res.data.user_package_id }
            : i
        ));
      }
    } catch (e) {
      const msg = e?.response?.data?.error || 'Erro ao alterar produto.';
      setError(msg);
    } finally {
      setToggling(t => ({ ...t, [pid]: false }));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-14 text-gray-400 text-sm">
        <Spinner /> Carregando produtos…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> Vinculado ao cliente
        </span>
        <span className="flex items-center gap-1.5">
          <Circle className="h-3.5 w-3.5 text-gray-600" /> Não vinculado
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <ShoppingBag className="h-10 w-10 text-gray-600" />
          <p className="text-sm text-gray-500">Nenhum produto cadastrado nesta loja.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <ProductRow
              key={item.product_id}
              item={item}
              toggling={!!toggling[item.product_id]}
              onToggle={() => handleToggle(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Product Row ─────────────────────────────────────────────── */
function ProductRow({ item, toggling, onToggle }) {
  return (
    <div
      className={`flex items-center gap-4 p-3.5 rounded-xl border transition-all ${
        item.client_has
          ? 'bg-green-500/5 border-green-500/20 hover:border-green-500/30'
          : 'bg-gray-800/40 border-gray-700/50 hover:border-gray-600/60'
      }`}
    >
      {/* Status icon */}
      <div className="shrink-0">
        {item.client_has
          ? <CheckCircle2 className="h-5 w-5 text-green-400" />
          : <Circle className="h-5 w-5 text-gray-600" />
        }
      </div>

      {/* Image */}
      {item.image && (
        <img
          src={item.image}
          alt={item.title}
          className="w-9 h-9 object-contain rounded-lg bg-gray-700 shrink-0"
        />
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-white truncate">{item.title}</p>
          {item.principal ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30 shrink-0">
              Principal
            </span>
          ) : null}
          {!item.active ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-500 shrink-0">
              Inativo
            </span>
          ) : null}
        </div>
        {item.price != null && (
          <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(item.price)}</p>
        )}
      </div>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        disabled={toggling}
        title={item.client_has ? 'Desvincular produto do cliente' : 'Vincular produto ao cliente'}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors border shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
          item.client_has
            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
            : 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/20'
        }`}
      >
        {toggling ? (
          <Spinner />
        ) : item.client_has ? (
          <><Unlink className="h-3 w-3" /> Desvincular</>
        ) : (
          <><LinkIcon className="h-3 w-3" /> Vincular</>
        )}
      </button>
    </div>
  );
}
