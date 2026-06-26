'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Dashboard } from '@/components/dashboard';
import { supabase } from '@/lib/supabase/client';

export default function Home() {
  const [hasPlan, setHasPlan] = useState(false); const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); const client = supabase(); const loadAccess = async () => { const { data: { user } } = await client.auth.getUser(); if (!user) return setHasPlan(false); const { data } = await client.from('profiles').select('tenants(subscription_status)').eq('id', user.id).single() as { data: { tenants: { subscription_status?: string } | null } | null }; setHasPlan(data?.tenants?.subscription_status === 'active'); }; loadAccess(); const { data: listener } = client.auth.onAuthStateChange(() => loadAccess()); return () => listener.subscription.unsubscribe(); }, []);
  return <main className="min-h-screen bg-slate-50">{mounted && hasPlan ? <Dashboard /> : <Landing />}</main>;
}
function Landing() { return <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.1fr_.9fr]"><div><p className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">INVENTARIO + POS PARA TIENDAS</p><h1 className="mt-5 max-w-xl text-4xl font-bold tracking-tight sm:text-5xl">Controla tu inventario. <span className="text-blue-600">Vende sin fricción.</span></h1><p className="mt-5 max-w-lg text-lg leading-8 text-slate-600">Gestiona productos, escanea códigos y registra ventas desde cualquier dispositivo.</p><Link className="mt-8 inline-block rounded-xl bg-blue-600 px-6 py-3 text-white shadow-lg shadow-blue-200 hover:bg-blue-700" href="/pricing">Ver planes</Link></div><div className="rounded-3xl bg-slate-950 p-4 shadow-2xl shadow-blue-200"><div className="rounded-2xl bg-white p-5"><p className="text-sm text-slate-500">Todo listo para tu tienda</p><p className="mt-2 text-2xl font-bold">Inventario, caja y reportes</p><div className="mt-5 grid grid-cols-3 gap-2"><div className="rounded-xl bg-blue-600 p-3 text-white">Ventas</div><div className="rounded-xl bg-slate-100 p-3">Stock</div><div className="rounded-xl bg-teal-50 p-3">En vivo</div></div></div></div></section>; }
