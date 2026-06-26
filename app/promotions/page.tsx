'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type DiscountType = 'percent' | 'fixed';
type Store = { id: string; name: string };
type Promotion = {
  id: string;
  store_id: string | null;
  name: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  active: boolean;
};

const emptyForm = { name: '', code: '', discount_type: 'percent' as DiscountType, discount_value: '10', store_id: '' };

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const client = supabase();
    const [{ data: promotionRows, error }, { data: storeRows }] = await Promise.all([
      client.from('promotions').select('id,store_id,name,code,discount_type,discount_value,active').order('created_at', { ascending: false }),
      client.from('stores').select('id,name').order('name'),
    ]);
    if (error) setMessage(error.message);
    else setPromotions((promotionRows ?? []) as Promotion[]);
    setStores((storeRows ?? []) as Store[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      store_id: form.store_id || null,
    };
    if (!payload.name || !payload.code || !payload.discount_value) return setMessage('Completa nombre, código y descuento.');
    const request = editingId
      ? supabase().from('promotions').update(payload).eq('id', editingId)
      : supabase().from('promotions').insert(payload);
    const { error } = await request;
    if (error) {
      setMessage(error.message);
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    setMessage(editingId ? 'Promoción actualizada.' : 'Promoción creada.');
    await load();
  }

  async function toggle(promotion: Promotion) {
    const { error } = await supabase().from('promotions').update({ active: !promotion.active }).eq('id', promotion.id);
    if (error) setMessage(error.message);
    else await load();
  }

  function edit(promotion: Promotion) {
    setEditingId(promotion.id);
    setForm({
      name: promotion.name,
      code: promotion.code,
      discount_type: promotion.discount_type,
      discount_value: String(promotion.discount_value),
      store_id: promotion.store_id ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return <main className="mx-auto max-w-6xl space-y-6 p-5">
    <section>
      <p className="text-sm font-semibold text-blue-600">VENTAS</p>
      <h1 className="mt-1 text-2xl font-bold">Promociones</h1>
      <p className="mt-1 text-slate-500">Configura descuentos que se podrán aplicar durante la venta.</p>
    </section>

    <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-5">
        <input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Nombre" />
        <input value={form.code} onChange={event => setForm({ ...form, code: event.target.value })} placeholder="Código" />
        <select value={form.discount_type} onChange={event => setForm({ ...form, discount_type: event.target.value as DiscountType })}>
          <option value="percent">Porcentaje</option>
          <option value="fixed">Monto fijo</option>
        </select>
        <input type="number" min="0" step="0.01" value={form.discount_value} onChange={event => setForm({ ...form, discount_value: event.target.value })} placeholder="Descuento" />
        <select value={form.store_id} onChange={event => setForm({ ...form, store_id: event.target.value })}>
          <option value="">Todas las tiendas</option>
          {stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
        </select>
      </div>
      <div className="mt-4 flex gap-2">
        <button className="bg-blue-600 text-white">{editingId ? 'Guardar cambios' : 'Crear promoción'}</button>
        {editingId && <button type="button" className="bg-slate-100 text-slate-700" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancelar</button>}
      </div>
      {message && <p className="mt-3 text-sm text-blue-700">{message}</p>}
    </form>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5">
        <h2 className="font-semibold">Promociones registradas</h2>
      </div>
      {loading ? <p className="p-5 text-sm text-slate-500">Cargando…</p> : <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Promoción</th><th>Código</th><th>Descuento</th><th>Estado</th><th className="pr-3 text-right">Acciones</th></tr></thead>
          <tbody>
            {promotions.map(promotion => <tr className="border-t border-slate-100" key={promotion.id}>
              <td className="p-3">{promotion.name}</td>
              <td>{promotion.code}</td>
              <td>{promotion.discount_type === 'percent' ? `${promotion.discount_value}%` : `$${Number(promotion.discount_value).toFixed(2)}`}</td>
              <td>{promotion.active ? 'Activa' : 'Inactiva'}</td>
              <td className="pr-3 text-right"><button type="button" className="bg-transparent px-2 text-blue-700" onClick={() => edit(promotion)}>Editar</button><button type="button" className="bg-transparent px-2 text-slate-700" onClick={() => toggle(promotion)}>{promotion.active ? 'Desactivar' : 'Activar'}</button></td>
            </tr>)}
            {promotions.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500">Aún no hay promociones.</td></tr>}
          </tbody>
        </table>
      </div>}
    </section>
  </main>;
}
