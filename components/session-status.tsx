'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export function SessionStatus() {
  const [email, setEmail] = useState<string | null>(null); const router = useRouter();
  useEffect(() => { const client = supabase(); client.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null)); const { data: listener } = client.auth.onAuthStateChange((_event, session) => setEmail(session?.user.email ?? null)); return () => listener.subscription.unsubscribe(); }, []);
  async function signOut() { await supabase().auth.signOut(); setEmail(null); router.push('/'); router.refresh(); }
  if (!email) return <a href="/login" className="text-blue-600 hover:text-blue-700">Iniciar sesi&oacute;n</a>;
  return <div className="flex items-center gap-3"><span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 sm:inline">Sesi&oacute;n activa: {email}</span><button onClick={signOut} className="min-h-0 border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-rose-200 hover:text-rose-700">Cerrar sesi&oacute;n</button></div>;
}
