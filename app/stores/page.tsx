'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Store = { id: string; name: string; created_at: string };
type TenantAccess = { tenants: { store_limit?: number } | null };

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [name, setName] = useState('');
  const [storeLimit, setStoreLimit] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const client = supabase();
    const [{ data: storeRows, error: storesError }, { data: userResult }] = await Promise.all([
      client.from('stores').select('id,name,created_at').order('created_at', { ascending: false }),
      client.auth.getUser(),
    ]);

    if (storesError) setMessage(storesError.message);
    else setStores((storeRows ?? []) as Store[]);

    const userId = userResult.user?.id;
    if (userId) {
      const { data } = await client.from('profiles').select('tenants(store_limit)').eq('id', userId).single() as { data: TenantAccess | null };
      setStoreLimit(data?.tenants?.store_limit ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    setMessage('');
    const { error } = await supabase().rpc('create_store', { p_name: cleanName });
    if (error) {
      setMessage(error.message);
      return;
    }
    setName('');
    setMessage('Tienda creada correctamente.');
    await load();
  }

  return <main className="mx-auto max-w-5xl space-y-6 p-5">
    <section>
      <p className="text-sm font-semibold text-blue-600">ADMINISTRACIÓN</p>
      <h1 className="mt-1 text-2xl font-bold">Tiendas</h1>
      <p className="mt-1 text-slate-500">Da de alta las sucursales disponibles según tu paquete.</p>
    </section>

    <form onSubmit={createStore} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input value={name} onChange={event => setName(event.target.value)} placeholder="Nombre de la tienda o sucursal" />
        <button className="bg-blue-600 text-white">Crear tienda</button>
      </div>
      <p className="mt-3 text-sm text-slate-500">
        {storeLimit === null ? 'Límite del plan no disponible.' : `Usadas ${stores.length} de ${storeLimit} tiendas permitidas.`}
      </p>
      {message && <p className="mt-3 text-sm text-blue-700">{message}</p>}
    </form>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5">
        <h2 className="font-semibold">Tiendas registradas</h2>
      </div>
      {loading ? <p className="p-5 text-sm text-slate-500">Cargando…</p> : <div className="divide-y divide-slate-100">
        {stores.map(store => <article key={store.id} className="flex items-center justify-between p-5">
          <div>
            <p className="font-medium">{store.name}</p>
            <p className="text-xs text-slate-500">Creada el {new Date(store.created_at).toLocaleDateString('es-MX')}</p>
          </div>
        </article>)}
        {stores.length === 0 && <p className="p-5 text-sm text-slate-500">Aún no hay tiendas registradas.</p>}
      </div>}
    </section>
  </main>;
}
