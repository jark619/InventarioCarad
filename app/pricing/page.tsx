'use client';
import Link from 'next/link';
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

const plans = [
  { id: 'starter', title: 'Inicial', price: '$199', description: 'Para la operación diaria de una tienda.', details: ['1 tienda', 'Hasta 500 productos', 'Inventario y punto de venta'] },
  { id: 'business', title: 'Negocio', price: '$499', description: 'Para negocios con varias sucursales.', details: ['Hasta 5 tiendas', 'Reportes avanzados', 'Soporte prioritario'], featured: true },
];
export default function PricingPage() {
  const [message, setMessage] = useState(''); const [loading, setLoading] = useState<string | null>(null);
  async function checkout(plan: string) { setLoading(plan); setMessage(''); const { data: { session } } = await supabase().auth.getSession(); if (!session) { location.href = '/login?next=/pricing'; return; }
    const { data, error } = await supabase().functions.invoke('create-checkout', { body: { plan } }); setLoading(null); if (error || !data?.url) return setMessage(error?.message || 'No fue posible iniciar el pago.'); location.assign(data.url); }
  return <main className="min-h-screen bg-slate-50"><nav className="mx-auto flex max-w-5xl justify-between px-5 py-6"><Link href="/" className="font-bold">SGI Inventario</Link><Link href="/login" className="text-blue-600">Iniciar sesión</Link></nav><section className="mx-auto max-w-5xl px-5 py-12 text-center"><p className="text-sm font-semibold text-blue-600">PLANES CLAROS, SIN SORPRESAS</p><h1 className="mt-3 text-4xl font-bold tracking-tight">Elige cómo empezar a vender</h1><p className="mt-3 text-slate-600">Activa inventario, caja y reportes en cuestión de minutos.</p></section><section className="mx-auto grid max-w-4xl gap-5 px-5 pb-8 md:grid-cols-2">{plans.map(plan => <article key={plan.id} className={`relative rounded-2xl border p-7 shadow-sm ${plan.featured ? 'border-blue-600 bg-blue-50 shadow-blue-100' : 'bg-white'}`}>{plan.featured && <span className="absolute -top-3 left-6 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">Más elegido</span>}<h2 className="text-xl font-bold">{plan.title}</h2><p className="mt-3 text-4xl font-bold">{plan.price}<span className="text-sm font-medium text-slate-500"> MXN / mes</span></p><p className="mt-4 min-h-12 text-slate-600">{plan.description}</p><ul className="mt-5 space-y-3 text-sm text-slate-700">{plan.details.map(detail => <li key={detail} className="flex gap-2"><span className="text-teal-600">✓</span>{detail}</li>)}</ul><button onClick={() => checkout(plan.id)} disabled={loading !== null} className="mt-7 min-h-12 w-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">{loading === plan.id ? 'Abriendo pago…' : 'Elegir plan'}</button></article>)}</section>{message && <p className="text-center text-red-600">{message}</p>}<p className="pb-10 text-center text-sm text-slate-500">Pago seguro con Stripe · Cancela cuando lo necesites</p></main>;
}
