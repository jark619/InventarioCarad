import Link from 'next/link';

export default function Home() {
  return <main className="mx-auto max-w-3xl p-6"><nav className="flex justify-end gap-4 text-sm"><Link href="/pricing">Planes</Link><Link href="/login" className="text-indigo-600">Iniciar sesión</Link></nav><h1 className="mt-12 text-3xl font-bold">SGI Inventario</h1><p className="mt-2 text-slate-600">MVP multi-tienda para inventario y ventas.</p><div className="mt-6 flex flex-wrap gap-3"><Link className="rounded-lg bg-indigo-600 px-4 py-2 text-white" href="/inventory">Inventario</Link><Link className="rounded-lg bg-slate-900 px-4 py-2 text-white" href="/pos">Abrir caja</Link><Link className="rounded-lg bg-white px-4 py-2 shadow" href="/reports">Reportes</Link><Link className="rounded-lg border border-indigo-600 px-4 py-2 text-indigo-700" href="/pricing">Ver planes</Link></div></main>;
}
