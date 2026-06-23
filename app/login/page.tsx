'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login'); const [message, setMessage] = useState(''); const [loading, setLoading] = useState(false); const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setLoading(true); setMessage(''); const form = new FormData(event.currentTarget); const email = String(form.get('email')); const password = String(form.get('password'));
    const result = mode === 'login' ? await supabase().auth.signInWithPassword({ email, password }) : await supabase().auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
    setLoading(false); if (result.error) return setMessage(result.error.message); if (mode === 'signup' && !result.data.session) return setMessage('Revisa tu correo para confirmar la cuenta.'); router.push('/'); router.refresh(); }
  return <main className="mx-auto flex min-h-screen max-w-md items-center p-5"><section className="w-full rounded-2xl bg-white p-6 shadow"><Link href="/" className="text-sm text-indigo-600">← SGI Inventario</Link><h1 className="mt-4 text-2xl font-bold">{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h1><p className="mt-1 text-sm text-slate-600">Accede a tu tienda y a la caja.</p><form className="mt-5 space-y-3" onSubmit={submit}><input name="email" type="email" required autoComplete="email" placeholder="correo@tienda.com" className="w-full"/><input name="password" type="password" minLength={6} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Contraseña (mínimo 6 caracteres)" className="w-full"/><button disabled={loading} className="w-full bg-indigo-600 text-white disabled:opacity-50">{loading ? 'Procesando…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}</button></form>{message && <p className="mt-3 text-sm text-slate-600">{message}</p>}<button className="mt-5 text-sm text-indigo-600" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(''); }}>{mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}</button></section></main>;
}
