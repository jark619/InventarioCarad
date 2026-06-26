'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type ReportRow = { id: string; name: string; quantity: number; low_stock_threshold: number; units_sold: number };
export default function ReportsPage() {
  const [rows, setRows] = useState<ReportRow[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase().from('sales_report').select('*').order('units_sold', { ascending: false });
    if (queryError) {
      setRows([]);
      setError(queryError.message || 'No fue posible cargar los reportes.');
    } else {
      setRows((data ?? []) as ReportRow[]);
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const lowStock = rows.filter(x => x.quantity <= x.low_stock_threshold); const sold = rows.reduce((sum, x) => sum + Number(x.units_sold), 0);
  return <main className="mx-auto max-w-5xl space-y-5 p-4"><h1 className="text-2xl font-bold">Reportes</h1>{error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="grid gap-3 sm:grid-cols-3"><article className="rounded-xl bg-white p-4 shadow"><p className="text-sm text-slate-500">Productos registrados</p><strong className="text-2xl">{rows.length}</strong></article><article className="rounded-xl bg-white p-4 shadow"><p className="text-sm text-slate-500">Unidades vendidas</p><strong className="text-2xl">{sold}</strong></article><article className="rounded-xl bg-white p-4 shadow"><p className="text-sm text-slate-500">Alertas de stock</p><strong className="text-2xl text-red-600">{lowStock.length}</strong></article></div><section className="rounded-xl bg-white p-4 shadow"><h2 className="mb-3 font-bold">Más vendidos / existencias</h2>{loading ? <p>Cargando...</p> : <div className="space-y-2">{rows.map(x => <div key={x.id} className="flex justify-between border-b py-2"><span>{x.name}</span><span className={x.quantity <= x.low_stock_threshold ? 'text-red-600' : ''}>{x.units_sold} vendidos · {x.quantity} en stock</span></div>)}</div>}</section></main>;
}
