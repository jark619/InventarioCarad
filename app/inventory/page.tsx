'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarcodeScanner } from '@/components/barcode-scanner';
import { ProductForm } from '@/components/product-form';
import { supabase } from '@/lib/supabase/client';
import type { Product } from '@/lib/types';

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showSearchCamera, setShowSearchCamera] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase().from('products').select('*').eq('is_active', true).order('name');
    if (loadError) setError(loadError.message);
    else { setProducts(data ?? []); setError(''); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return products;
    return products.filter(product => [product.name, product.barcode, product.category].some(value => value?.toLocaleLowerCase().includes(term)));
  }, [products, query]);

  const saved = () => { setEditingProduct(null); setError(''); load(); };
  const useScannedSearch = (barcode: string) => {
    setQuery(barcode);
    setShowSearchCamera(false);
    searchInput.current?.focus();
  };

  async function removeProduct(product: Product) {
    if (!window.confirm(`\u00bfRetirar "${product.name}" del inventario? Se conservar\u00e1 su historial de ventas.`)) return;
    setDeletingId(product.id);
    setError('');
    const { error: deleteError } = await supabase().from('products').update({ is_active: false }).eq('id', product.id);
    setDeletingId(null);
    if (deleteError) {
      setError(`No se pudo retirar el producto: ${deleteError.message}`);
      return;
    }
    if (editingProduct?.id === product.id) setEditingProduct(null);
    load();
  }

  return <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-5 sm:px-5 sm:py-7">
    <div><h1 className="text-2xl font-bold">Inventario</h1><p className="mt-1 text-sm text-slate-600">Escanea, registra y administra los productos de tu tienda.</p></div>
    <ProductForm product={editingProduct} onSaved={saved} onCancel={() => setEditingProduct(null)} />
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Productos ({visibleProducts.length})</h2>
            <p className="text-xs text-slate-500">Enfoca este campo para usar una lectora física, o abre la cámara del celular.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:max-w-md sm:flex-row">
            <input ref={searchInput} value={query} onChange={event => setQuery(event.target.value)} placeholder={'Buscar por nombre, código o categoría'} aria-label="Buscar productos" inputMode="search" autoComplete="off" className="min-w-0 flex-1" />
            <button type="button" onClick={() => setShowSearchCamera(current => !current)} className="shrink-0 bg-slate-800 text-sm text-white">{showSearchCamera ? 'Cerrar cámara' : 'Escanear'}</button>
          </div>
        </div>
        {showSearchCamera && <BarcodeScanner onDetected={useScannedSearch} />}
      </div>
      {error && <p role="alert" className="mx-5 mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {loading ? <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map(item => <div key={item} className="h-64 animate-pulse rounded-2xl bg-slate-100" />)}</div> : visibleProducts.length ? <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
        {visibleProducts.map(product => <article key={product.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {product.image_url ? <img src={product.image_url} alt={product.name} className="aspect-[16/10] w-full bg-slate-100 object-cover" /> : <div className="grid aspect-[16/10] w-full place-items-center bg-gradient-to-br from-blue-50 to-slate-100 text-center text-sm font-medium text-slate-500"><span><span className="mb-2 block text-3xl" aria-hidden="true">🍬</span>Sin imagen</span></div>}
          <div className="flex flex-1 flex-col p-4">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold text-slate-900">{product.name}</h3><p className="mt-1 truncate text-xs text-slate-500">{product.category}</p></div><strong className="shrink-0 text-lg text-blue-700">${Number(product.price).toFixed(2)}</strong></div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm"><div className="rounded-xl bg-slate-50 p-2"><dt className="text-xs text-slate-500">Existencia</dt><dd className={product.quantity <= product.low_stock_threshold ? 'font-bold text-rose-600' : 'font-semibold'}>{product.quantity}</dd></div><div className="min-w-0 rounded-xl bg-slate-50 p-2"><dt className="text-xs text-slate-500">Código</dt><dd className="truncate font-medium">{product.barcode || '—'}</dd></div></dl>
            {product.quantity <= product.low_stock_threshold && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">Existencia baja</p>}
            <div className="mt-auto grid grid-cols-2 gap-2 pt-4"><button type="button" onClick={() => { setEditingProduct(product); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="bg-blue-50 text-blue-700 hover:bg-blue-100">Editar</button><button type="button" onClick={() => removeProduct(product)} disabled={deletingId === product.id} className="bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50">{deletingId === product.id ? 'Retirando...' : 'Retirar'}</button></div>
          </div>
        </article>)}
      </div> : <p className="p-8 text-center text-slate-500">No se encontraron productos.</p>}
    </section>
  </main>;
}
