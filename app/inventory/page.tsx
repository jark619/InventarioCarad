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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showSearchCamera, setShowSearchCamera] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase().from('products').select('*').eq('is_active', true).order('name');
    if (loadError) setError(loadError.message);
    else setProducts(data ?? []);
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

  return <main className="mx-auto max-w-5xl space-y-6 p-4">
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
      {error && <p role="alert" className="px-5 pt-3 text-sm text-rose-700">{error}</p>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Producto</th><th>{'C\u00f3digo'}</th><th>Existencia</th><th>Precio</th><th className="pr-3 text-right">Acciones</th></tr></thead><tbody>{visibleProducts.map(product => <tr className="border-t border-slate-100" key={product.id}><td className="p-3"><p className="font-medium">{product.name}</p><p className="text-xs text-slate-500">{product.category}</p></td><td>{product.barcode || '\u2014'}</td><td className={product.quantity <= product.low_stock_threshold ? 'font-bold text-rose-600' : ''}>{product.quantity}</td><td>${Number(product.price).toFixed(2)}</td><td className="pr-3 text-right"><div className="flex justify-end gap-2"><button type="button" onClick={() => { setEditingProduct(product); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="bg-transparent px-2 text-blue-700 hover:bg-blue-50">Editar</button><button type="button" onClick={() => removeProduct(product)} disabled={deletingId === product.id} className="bg-transparent px-2 text-rose-700 hover:bg-rose-50 disabled:opacity-50">{deletingId === product.id ? 'Eliminando...' : 'Retirar'}</button></div></td></tr>)}{visibleProducts.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500">No se encontraron productos.</td></tr>}</tbody></table></div>
    </section>
  </main>;
}
