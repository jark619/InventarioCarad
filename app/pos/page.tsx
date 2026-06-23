'use client';
import { useCallback, useState } from 'react';
import { BarcodeScanner } from '@/components/barcode-scanner';
import { supabase } from '@/lib/supabase/client';
import type { CartLine, Product } from '@/lib/types';

export default function Pos() {
  const [cart, setCart] = useState<CartLine[]>([]); const [code, setCode] = useState(''); const [notice, setNotice] = useState('');
  const add = useCallback(async (barcode: string) => {
    const { data, error } = await supabase().from('products').select('*').eq('barcode', barcode).single() as { data: Product | null; error: Error | null };
    if (error || !data) return setNotice('Producto no encontrado'); if (data.quantity < 1) return setNotice('Sin existencias');
    setCart(c => { const line = c.find(x => x.id === data.id); return line ? c.map(x => x.id === data.id ? { ...x, units: x.units + 1 } : x) : [...c, { ...data, units: 1 }]; }); setNotice(`${data.name} agregado`);
  }, []);
  async function checkout() { if (!cart.length) return; const { error } = await supabase().rpc('create_sale', { p_items: cart.map(x => ({ product_id: x.id, quantity: x.units, unit_price: x.price })) }); if (error) return setNotice(error.message); setCart([]); setNotice('Venta registrada correctamente'); }
  const total = cart.reduce((s, x) => s + x.price * x.units, 0);
  return <main className="mx-auto grid max-w-6xl gap-5 p-4 lg:grid-cols-2"><section><h1 className="mb-4 text-2xl font-bold">Caja</h1><BarcodeScanner onDetected={add}/><form onSubmit={e => { e.preventDefault(); add(code); setCode(''); }} className="mt-3 flex gap-2"><input autoFocus value={code} onChange={e => setCode(e.target.value)} placeholder="Código (lectora USB)" className="w-full"/><button className="bg-slate-900 text-white">Agregar</button></form><p className="mt-2 text-sm text-slate-600">{notice}</p></section><section className="rounded-xl bg-white p-4 shadow"><h2 className="font-bold">Ticket</h2>{cart.map(x => <div className="flex justify-between border-b py-3" key={x.id}><span>{x.units} × {x.name}</span><span>${(x.units*x.price).toFixed(2)}</span></div>)}<div className="mt-4 flex justify-between text-xl font-bold"><span>Total</span><span>${total.toFixed(2)}</span></div><button onClick={checkout} className="mt-4 w-full bg-indigo-600 text-white">Cobrar</button></section></main>;
}
