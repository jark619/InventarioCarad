'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Terminal = {
  id: string;
  pos_id?: string;
  store_id?: string;
  external_pos_id?: string;
  operating_mode?: string;
};

type ConfiguredTerminal = {
  mercado_pago_terminal_id: string | null;
  mercado_pago_terminal_mode: string | null;
  mercado_pago_terminal_synced_at: string | null;
};

type CredentialStatus = {
  configured: boolean;
  token_hint: string | null;
  updated_at: string | null;
};

async function accessToken() {
  const { data } = await supabase().auth.getSession();
  return data.session?.access_token ?? '';
}

export default function PaymentSettingsPage() {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [configured, setConfigured] = useState<ConfiguredTerminal | null>(null);
  const [credential, setCredential] = useState<CredentialStatus | null>(null);
  const [credentialInput, setCredentialInput] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCredential, setSavingCredential] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const token = await accessToken();
    if (!token) {
      setError('Inicia sesión como administrador para configurar Mercado Pago.');
      setLoading(false);
      return;
    }

    const credentialResponse = await fetch('/api/mercado-pago/credentials', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const credentialResult = await credentialResponse.json() as CredentialStatus & { error?: string };
    if (!credentialResponse.ok) {
      setError(credentialResult.error ?? 'No fue posible consultar la credencial.');
      setLoading(false);
      return;
    }
    setCredential(credentialResult);

    if (!credentialResult.configured) {
      setTerminals([]);
      setConfigured(null);
      setSelectedId('');
      setLoading(false);
      return;
    }

    const terminalResponse = await fetch('/api/mercado-pago/terminals', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const result = await terminalResponse.json() as { terminals?: Terminal[]; configured?: ConfiguredTerminal; error?: string };
    if (!terminalResponse.ok) {
      setError(result.error ?? 'No fue posible consultar las terminales.');
      setLoading(false);
      return;
    }

    const rows = result.terminals ?? [];
    setTerminals(rows);
    setConfigured(result.configured ?? null);
    setSelectedId(result.configured?.mercado_pago_terminal_id ?? rows[0]?.id ?? '');
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function saveCredential() {
    if (!credentialInput.trim() || savingCredential) return;
    setSavingCredential(true);
    setError('');
    setMessage('');
    const token = await accessToken();
    const response = await fetch('/api/mercado-pago/credentials', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accessToken: credentialInput }),
    });
    const result = await response.json() as { error?: string };
    setSavingCredential(false);
    if (!response.ok) {
      setError(result.error ?? 'No se pudo guardar la credencial.');
      return;
    }
    setCredentialInput('');
    setMessage('Access Token validado y guardado de forma cifrada para este negocio. Selecciona nuevamente la terminal.');
    await load();
  }

  async function removeCredential() {
    if (!credential?.configured || savingCredential || !window.confirm('¿Desconectar Mercado Pago de este negocio? La terminal configurada también se desvinculará del sistema.')) return;
    setSavingCredential(true);
    setError('');
    const token = await accessToken();
    const response = await fetch('/api/mercado-pago/credentials', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json() as { error?: string };
    setSavingCredential(false);
    if (!response.ok) {
      setError(result.error ?? 'No se pudo eliminar la credencial.');
      return;
    }
    setMessage('Mercado Pago fue desconectado de este negocio.');
    await load();
  }

  async function synchronize() {
    if (!selectedId || saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    const token = await accessToken();
    const response = await fetch('/api/mercado-pago/terminals', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ terminalId: selectedId }),
    });
    const result = await response.json() as { terminal?: Terminal; error?: string };
    setSaving(false);
    if (!response.ok) {
      setError(result.error ?? 'No se pudo sincronizar la terminal.');
      return;
    }
    setMessage('Terminal sincronizada y lista para recibir cobros desde Caja.');
    await load();
  }

  return <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-5 sm:px-5 sm:py-7">
    <header>
      <p className="text-sm font-semibold text-blue-600">CONFIGURACIÓN</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-950">Mercado Pago Point</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Conecta la terminal Smart Point 2 que recibirá los cobros con tarjeta iniciados desde Caja.</p>
    </header>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">Credencial del negocio</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">Cada cliente usa su propia cuenta. El token se valida en Mercado Pago, se cifra antes de guardarlo y nunca vuelve a mostrarse.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${credential?.configured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{credential?.configured ? `Guardada · •••${credential.token_hint}` : 'Sin configurar'}</span>
      </div>
      <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="mercado-pago-token">Access Token de Mercado Pago</label>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input id="mercado-pago-token" type="password" value={credentialInput} onChange={event => setCredentialInput(event.target.value)} autoComplete="new-password" placeholder={credential?.configured ? 'Pega un token nuevo para reemplazarlo' : 'APP_USR-...'} className="min-w-0 w-full font-mono" />
        <button type="button" onClick={saveCredential} disabled={!credentialInput.trim() || savingCredential} className="bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{savingCredential ? 'Validando...' : credential?.configured ? 'Reemplazar token' : 'Guardar token'}</button>
      </div>
      {credential?.configured && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <span>Actualizado {credential.updated_at ? new Date(credential.updated_at).toLocaleString('es-MX') : 'recientemente'}</span>
        <button type="button" onClick={removeCredential} disabled={savingCredential} className="min-h-0 bg-transparent px-2 py-1 text-rose-700 hover:bg-rose-50 disabled:opacity-50">Desconectar cuenta</button>
      </div>}
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">Estado de la conexión</h2>
          <p className="mt-1 text-sm text-slate-500">La terminal activa pertenece exclusivamente a la cuenta configurada para este negocio.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${configured?.mercado_pago_terminal_mode === 'PDV' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {configured?.mercado_pago_terminal_mode === 'PDV' ? 'Conectada · PDV' : 'Pendiente'}
        </span>
      </div>
      {configured?.mercado_pago_terminal_id && <dl className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <div><dt className="text-slate-500">Terminal activa</dt><dd className="mt-1 break-all font-semibold text-slate-900">{configured.mercado_pago_terminal_id}</dd></div>
        <div><dt className="text-slate-500">Última sincronización</dt><dd className="mt-1 font-semibold text-slate-900">{configured.mercado_pago_terminal_synced_at ? new Date(configured.mercado_pago_terminal_synced_at).toLocaleString('es-MX') : 'Sin registro'}</dd></div>
      </dl>}
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">Seleccionar Smart Point 2</h2>
      <p className="mt-1 text-sm text-slate-500">La terminal debe estar encendida y vinculada previamente a la cuenta de Mercado Pago.</p>

      {loading ? <div className="mt-4 h-24 animate-pulse rounded-xl bg-slate-100" /> : !credential?.configured ? <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Guarda primero el Access Token de este negocio para consultar sus terminales.</p> : terminals.length ? <div className="mt-4 grid gap-3">
        {terminals.map(terminal => <label key={terminal.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-blue-500 ${selectedId === terminal.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
          <input type="radio" name="terminal" value={terminal.id} checked={selectedId === terminal.id} onChange={() => setSelectedId(terminal.id)} className="mt-1 h-4 w-4" />
          <span className="min-w-0 flex-1">
            <span className="block break-all font-semibold text-slate-900">{terminal.id}</span>
            <span className="mt-1 block text-xs text-slate-500">Caja {terminal.external_pos_id || terminal.pos_id || 'sin identificar'} · Modo {terminal.operating_mode || 'UNDEFINED'}</span>
          </span>
        </label>)}
      </div> : !error && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">No se encontraron terminales. Vincula el dispositivo desde la app de Mercado Pago y vuelve a consultar.</p>}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={synchronize} disabled={!selectedId || saving || loading} className="bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Sincronizando...' : 'Sincronizar y activar PDV'}</button>
        <button type="button" onClick={() => void load()} disabled={saving || loading} className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50">Actualizar terminales</button>
      </div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-white">
      <h2 className="font-semibold">Antes de sincronizar</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-300">
        <li>El servidor debe tener una llave global <code className="rounded bg-white/10 px-1.5 py-0.5 text-white">MERCADO_PAGO_ENCRYPTION_KEY</code> para cifrar credenciales.</li>
        <li>Guarda arriba el Access Token correspondiente a este negocio.</li>
        <li>Enciende el Smart Point 2 y asócialo a una sucursal y caja desde Mercado Pago.</li>
        <li>Actualiza la lista y activa el modo PDV.</li>
      </ol>
    </section>

    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
  </main>;
}
