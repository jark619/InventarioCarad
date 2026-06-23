'use client';
import Link from 'next/link';
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

const plans = [
  { id: 'starter', title: 'Inicial', price: '$199 MXN / mes', description: 'Una tienda, hasta 500 productos y punto de venta.' },
  { id: 'business', title: 'Negocio', price: '$499 MXN / mes', description: 'Hasta 5 tiendas, reportes y soporte prioritario.', featured: true },
];
export default function PricingPage() {
  const [message, setMessage] = useState(''); const [loading, setLoading] = useState<string | null>(null);
  async function checkout(plan: string) { setLoading(plan); setMessage(''); const { data: { session } } = await supabase().auth.getSession(); if (!session) { location.href = '/login?next=/pricing'; return; }
    const { data, error } = await supabase().functions.invoke('create-checkout', { body: { plan } }); setLoading(null); if (error || !data?.url) return setMessage(error?.message || 'No fue posible iniciar el pago.'); location.assign(data.url); }
  return <main className="mx-auto max-w-5xl p-5"><nav className="flex justify-between"><Link href="/" className="font-bold">SGI Inventario</Link><Link href="/login" className="text-indigo-600">Iniciar sesión</Link></nav><section className="py-12 text-center"><h1 className="text-4xl font-bold">Un plan simple para cada tienda</h1><p className="mt-3 text-slate-600">Activa tu inventario, caja y reportes en minutos.</p></section><section className="grid gap-5 md:grid-cols-2">{plans.map(plan => <article key={plan.id} className={`rounded-2xl border p-6 shadow-sm ${plan.featured ? 'border-indigo-600 bg-indigo-50' : 'bg-white'}`}><h2 className="text-xl font-bold">{plan.title}</h2><p className="mt-3 text-3xl font-bold">{plan.price}</p><p className="mt-4 min-h-12 text-slate-600">{plan.description}</p><button onClick={() => checkout(plan.id)} disabled={loading !== null} className="mt-6 w-full bg-indigo-600 text-white disabled:opacity-50">{loading === plan.id ? 'Abriendo pago…' : 'Elegir plan'}</button></article>)}</section>{message && <p className="mt-5 text-center text-red-600">{message}</p>}<p className="mt-8 text-center text-sm text-slate-500">Pago seguro procesado por Stripe. Puedes cancelar cuando lo necesites.</p></main>;
}
