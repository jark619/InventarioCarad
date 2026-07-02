'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Role = 'admin' | 'inventory' | 'cashier';
type Store = { id: string; name: string };
type Collaborator = {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
  email: string | null;
  role: Role;
  store_id: string | null;
  active: boolean;
};

const emptyForm = {
  first_name: '',
  last_name: '',
  employee_number: '',
  email: '',
  password: '',
  role: 'cashier' as Role,
  store_id: '',
};

const roleLabels: Record<Role, string> = { admin: 'Admin', inventory: 'Inventario', cashier: 'Cajero' };

export default function TeamPage() {
  const [rows, setRows] = useState<Collaborator[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const client = supabase();
    const [{ data: collaborators, error }, { data: storeRows }] = await Promise.all([
      client.from('collaborators').select('id,first_name,last_name,employee_number,email,role,store_id,active').order('created_at', { ascending: false }),
      client.from('stores').select('id,name').order('name'),
    ]);
    if (error) setMessage(error.message);
    else setRows((collaborators ?? []) as Collaborator[]);
    setStores((storeRows ?? []) as Store[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function collaboratorRequest(method: 'POST' | 'PATCH', body: Record<string, unknown>) {
    const client = supabase();
    const { data: sessionResult } = await client.auth.getSession();
    const accessToken = sessionResult.session?.access_token;
    if (!accessToken) return { error: 'Inicia sesion para gestionar colaboradores.' };

    const response = await fetch('/api/collaborators', {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    const result = await response.json() as { error?: string };
    return response.ok ? { error: '' } : { error: result.error ?? 'No se pudo completar la operacion.' };
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      employee_number: form.employee_number.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      role: form.role,
      store_id: form.store_id || null,
      active: true,
    };

    if (!payload.first_name || !payload.last_name || !payload.employee_number) {
      setMessage('Captura nombre, apellidos y numero de empleado.');
      return;
    }

    if (!editingId && (!payload.email || !payload.password)) {
      setMessage('Captura correo electronico y password para que el colaborador pueda iniciar sesion.');
      return;
    }

    const result = editingId
      ? await collaboratorRequest('PATCH', { id: editingId, ...payload })
      : await collaboratorRequest('POST', payload);

    if (result.error) {
      setMessage(result.error);
      return;
    }

    setForm(emptyForm);
    setEditingId(null);
    setMessage(editingId ? 'Colaborador actualizado.' : 'Colaborador creado con acceso de login.');
    await load();
  }

  async function deactivate(row: Collaborator) {
    const result = await collaboratorRequest('PATCH', {
      id: row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      employee_number: row.employee_number,
      role: row.role,
      store_id: row.store_id,
      active: false,
    });
    if (result.error) setMessage(result.error);
    else await load();
  }

  function edit(row: Collaborator) {
    setEditingId(row.id);
    setForm({
      first_name: row.first_name,
      last_name: row.last_name,
      employee_number: row.employee_number,
      email: row.email ?? '',
      password: '',
      role: row.role,
      store_id: row.store_id ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return <main className="mx-auto max-w-6xl space-y-6 p-5">
    <section>
      <p className="text-sm font-semibold text-blue-600">EQUIPO</p>
      <h1 className="mt-1 text-2xl font-bold">Colaboradores</h1>
      <p className="mt-1 text-slate-500">Administra acceso, tienda y rol de cada colaborador.</p>
    </section>

    <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-3">
        <input value={form.first_name} onChange={event => setForm({ ...form, first_name: event.target.value })} placeholder="Nombre" />
        <input value={form.last_name} onChange={event => setForm({ ...form, last_name: event.target.value })} placeholder="Apellidos" />
        <input value={form.employee_number} onChange={event => setForm({ ...form, employee_number: event.target.value })} placeholder="No. empleado" />
        <input value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} type="email" placeholder="Correo electronico" disabled={Boolean(editingId)} />
        <input value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} type="password" minLength={6} placeholder={editingId ? 'Nuevo password opcional' : 'Password temporal'} />
        <select value={form.store_id} onChange={event => setForm({ ...form, store_id: event.target.value })}>
          <option value="">Sin tienda asignada</option>
          {stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
        </select>
        <select value={form.role} onChange={event => setForm({ ...form, role: event.target.value as Role })}>
          <option value="admin">Admin</option>
          <option value="inventory">Inventario</option>
          <option value="cashier">Cajero</option>
        </select>
      </div>
      <div className="mt-4 flex gap-2">
        <button className="bg-blue-600 text-white">{editingId ? 'Guardar cambios' : 'Crear colaborador'}</button>
        {editingId && <button type="button" className="bg-slate-100 text-slate-700" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancelar</button>}
      </div>
      {message && <p className="mt-3 text-sm text-blue-700">{message}</p>}
    </form>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5"><h2 className="font-semibold">Equipo registrado</h2></div>
      {loading ? <p className="p-5 text-sm text-slate-500">Cargando...</p> : <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Colaborador</th><th>Correo</th><th>No. empleado</th><th>Tienda</th><th>Rol</th><th>Estado</th><th className="pr-3 text-right">Acciones</th></tr></thead>
          <tbody>
            {rows.map(row => <tr key={row.id} className="border-t border-slate-100">
              <td className="p-3 font-medium">{row.first_name} {row.last_name}</td>
              <td>{row.email ?? 'Sin correo'}</td>
              <td>{row.employee_number}</td>
              <td>{stores.find(store => store.id === row.store_id)?.name ?? 'Sin asignar'}</td>
              <td>{roleLabels[row.role]}</td>
              <td>{row.active ? 'Activo' : 'Inactivo'}</td>
              <td className="pr-3 text-right"><button type="button" className="bg-transparent px-2 text-blue-700" onClick={() => edit(row)}>Editar</button><button type="button" className="bg-transparent px-2 text-rose-700" onClick={() => deactivate(row)}>Desactivar</button></td>
            </tr>)}
            {rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">Aun no hay colaboradores.</td></tr>}
          </tbody>
        </table>
      </div>}
    </section>
  </main>;
}
