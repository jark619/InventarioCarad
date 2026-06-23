import Link from 'next/link';

export default function Home() {
  return <main className="mx-auto max-w-3xl p-6"><h1 className="text-3xl font-bold">SGI Inventario</h1><p className="mt-2 text-slate-600">MVP multi-tienda para inventario y ventas.</p><div className="mt-6 flex gap-3"><Link className="rounded-lg bg-indigo-600 px-4 py-2 text-white" href="/inventory">Inventario</Link><Link className="rounded-lg bg-slate-900 px-4 py-2 text-white" href="/pos">Abrir caja</Link><Link className="rounded-lg bg-white px-4 py-2 shadow" href="/reports">Reportes</Link></div></main>;
}
