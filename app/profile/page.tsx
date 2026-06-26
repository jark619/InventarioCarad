'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type ProfileName = { full_name: string | null; role: string | null; employee_number: string | null };

export default function ProfilePage() {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase().from('profiles').select('full_name,role,employee_number').single().then(({ data }) => {
      const profile = data as ProfileName | null;
      setName(profile?.full_name ?? '');
      setRole(profile?.role ?? '');
      setEmployeeNumber(profile?.employee_number ?? '');
    });
  }, []);

  async function saveProfile() {
    setSaving(true);
    setMessage('');
    const { error } = await supabase().rpc('update_my_profile', { p_full_name: name });
    setSaving(false);
    setMessage(error ? error.message : 'Perfil actualizado correctamente.');
  }

  return <main className="mx-auto max-w-xl space-y-5 p-5">
    <section>
      <p className="text-sm font-semibold text-blue-600">CUENTA</p>
      <h1 className="mt-1 text-2xl font-bold">Mi perfil</h1>
      <p className="mt-1 text-slate-500">Actualiza tu nombre visible dentro de la tienda.</p>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <label className="text-sm font-medium text-slate-700">Nombre y apellidos</label>
      <input className="mt-2 w-full" value={name} onChange={event => setName(event.target.value)} placeholder="Nombre y apellidos" />
      <div className="mt-4 grid gap-3 text-sm text-slate-500 sm:grid-cols-2">
        <p>Rol: <span className="font-medium text-slate-700">{role || 'No disponible'}</span></p>
        <p>No. empleado: <span className="font-medium text-slate-700">{employeeNumber || 'No disponible'}</span></p>
      </div>
      <button onClick={saveProfile} disabled={saving} className="mt-4 bg-blue-600 text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar perfil'}</button>
      {message && <p className="mt-3 text-sm text-blue-700">{message}</p>}
    </section>
  </main>;
}
