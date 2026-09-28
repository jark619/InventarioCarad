'use client';

import { FormEvent, useCallback, useRef, useState } from 'react';
import { BarcodeScanner } from '@/components/barcode-scanner';
import { supabase } from '@/lib/supabase/client';
import type { Json } from '@/lib/supabase/database.types';
import type { CartLine, Product } from '@/lib/types';

const SALE_TIMEOUT_MS = 20_000;
const CARD_POLL_ATTEMPTS = 90;
type PaymentMethod = 'cash' | 'card';

export default function Pos() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [code, setCode] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [notice, setNotice] = useState('');
  const [searching, setSearching] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [pointOrderId, setPointOrderId] = useState('');
  const cardRequestId = useRef('');

  const addProduct = useCallback((product: Product) => {
    if (paying) {
      setNotice('Espera a que termine el cobro actual antes de modificar el ticket.');
      return;
    }
    if (product.quantity < 1) {
      setNotice(`${product.name} no tiene existencias.`);
      return;
    }
    setCart(current => {
      const line = current.find(item => item.id === product.id);
      if (line && line.units >= product.quantity) {
        setNotice(`Solo hay ${product.quantity} unidades disponibles de ${product.name}.`);
        return current;
      }
      setNotice(`${product.name} agregado al ticket.`);
      return line
        ? current.map(item => item.id === product.id ? { ...item, units: item.units + 1 } : item)
        : [...current, { ...product, units: 1 }];
    });
  }, [paying]);

  const addByBarcode = useCallback(async (rawBarcode: string) => {
    const barcode = rawBarcode.trim();
    if (!barcode) return;
    const { data, error } = await supabase().from('products').select('*').eq('barcode', barcode).eq('is_active', true).maybeSingle();
    if (error || !data) {
      setNotice('No se encontró un producto activo con ese código.');
      return;
    }
    addProduct(data as Product);
  }, [addProduct]);

  async function searchProducts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = search.trim();
    if (!term) {
      setResults([]);
      setNotice('Escribe el nombre o descripción del producto.');
      return;
    }
    setSearching(true);
    setNotice('');
    const { data, error } = await supabase().from('products').select('*').eq('is_active', true).ilike('name', `%${term}%`).order('name').limit(20);
    setSearching(false);
    if (error) {
      setResults([]);
      setNotice(`No se pudo buscar: ${error.message}`);
      return;
    }
    const products = (data ?? []) as Product[];
    setResults(products);
    setNotice(products.length ? `${products.length} producto(s) encontrado(s).` : 'No se encontraron productos.');
  }

  function changeUnits(product: CartLine, amount: number) {
    if (paying) return;
    setCart(current => {
      const line = current.find(item => item.id === product.id);
      if (!line) return current;
      const nextUnits = line.units + amount;
      if (nextUnits > product.quantity) {
        setNotice(`Solo hay ${product.quantity} unidades disponibles de ${product.name}.`);
        return current;
      }
      if (nextUnits <= 0) return current.filter(item => item.id !== product.id);
      return current.map(item => item.id === product.id ? { ...item, units: nextUnits } : item);
    });
  }

  async function checkoutCash() {
    if (!cart.length || paying) return;
    setPaying(true);
    setNotice('Registrando venta...');
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let saleRegistered = false;

    try {
      const client = supabase();
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('SALE_TIMEOUT')), SALE_TIMEOUT_MS);
      });
      const saleOperation = async () => {
        const { data: sessionData, error: sessionError } = await client.auth.getSession();
        if (sessionError || !sessionData.session) {
          throw new Error('Tu sesión venció. Inicia sesión nuevamente antes de cobrar.');
        }

        const items = cart.map(item => ({
          product_id: item.id,
          quantity: item.units,
          unit_price: item.price,
        })) as unknown as Json;

        const saleResult = await client.rpc('create_sale', {
          p_items: items,
          p_payment_method: 'cash',
          p_payment_reference: null,
        });
        if (saleResult.error) return saleResult;

        saleRegistered = true;
        const saleId = saleResult.data;
        setCart([]);
        setResults([]);
        setPaymentMethod('cash');
        setNotice('Venta registrada. Verificando salida de inventario...');

        const [savedSale, updatedProducts] = await Promise.all([
          client.from('sales').select('id,total').eq('id', saleId).single(),
          client.from('products').select('id,quantity').in('id', cart.map(item => item.id)),
        ]);
        if (savedSale.error || !savedSale.data) throw new Error('SALE_NOT_VERIFIED');
        if (updatedProducts.error) throw new Error('STOCK_NOT_VERIFIED');

        const quantities = new Map((updatedProducts.data ?? []).map(product => [product.id, product.quantity]));
        const inventoryUpdated = cart.every(item => {
          const currentQuantity = quantities.get(item.id);
          return currentQuantity !== undefined && currentQuantity <= item.quantity - item.units;
        });
        if (!inventoryUpdated) throw new Error('STOCK_NOT_UPDATED');

        return saleResult;
      };
      const { data: saleId, error } = await Promise.race([saleOperation(), timeout]);

      if (error) throw new Error(error.message);
      setNotice(`Venta ${String(saleId).slice(0, 8)} registrada e inventario actualizado correctamente.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      if (saleRegistered) {
        setNotice('La venta fue registrada, pero no se pudo comprobar la salida de inventario. Revisa Inventario y Reportes antes de repetir el cobro.');
      } else if (message === 'SALE_TIMEOUT') {
        setNotice('Supabase tardó demasiado en responder. Revisa Reportes antes de intentar nuevamente para evitar duplicar la venta.');
      } else if (message.toLowerCase().includes('fetch')) {
        setNotice('No fue posible conectar con Supabase. Revisa tu conexión y las variables de entorno de Vercel.');
      } else if (message.toLowerCase().includes('lock timeout')) {
        setNotice('El inventario estaba ocupado por otra venta. Espera unos segundos y vuelve a intentarlo.');
      } else {
        setNotice(`No se pudo registrar la venta: ${message}`);
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setPaying(false);
    }
  }

  async function checkoutCard() {
    if (!cart.length || paying) return;
    setPaying(true);
    setPointOrderId('');
    setNotice('Enviando cobro al Smart Point 2...');
    let allowNewAttempt = false;

    try {
      const client = supabase();
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) throw new Error('Tu sesión venció. Inicia sesión nuevamente antes de cobrar.');

      cardRequestId.current ||= crypto.randomUUID();
      const createResponse = await fetch('/api/mercado-pago/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId: cardRequestId.current,
          cart: cart.map(item => ({ productId: item.id, quantity: item.units })),
        }),
      });
      const created = await createResponse.json() as { order_id?: string; error?: string };
      if (!createResponse.ok || !created.order_id) {
        throw new Error(created.error ?? 'No se pudo iniciar el cobro en la terminal.');
      }

      setPointOrderId(created.order_id);
      setNotice('Cobro enviado. Sigue las instrucciones en el Smart Point 2.');

      for (let attempt = 0; attempt < CARD_POLL_ATTEMPTS; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 2_000));
        const statusResponse = await fetch(`/api/mercado-pago/orders?orderId=${encodeURIComponent(created.order_id)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        });
        const status = await statusResponse.json() as {
          status?: string;
          status_detail?: string;
          sale_id?: string;
          error?: string;
        };

        if (!statusResponse.ok) throw new Error(status.error ?? 'No se pudo verificar el cobro.');
        if (status.status === 'processed' && status.sale_id) {
          setCart([]);
          setResults([]);
          setPaymentMethod('cash');
          setPointOrderId('');
          cardRequestId.current = '';
          setNotice(`Pago aprobado y venta ${status.sale_id.slice(0, 8)} registrada correctamente.`);
          return;
        }
        if (status.status === 'at_terminal') {
          setNotice('La terminal recibió el cobro. Esperando la tarjeta y la confirmación del cliente...');
          continue;
        }
        if (status.status === 'failed') {
          allowNewAttempt = true;
          throw new Error('El pago fue rechazado. Puedes intentarlo de nuevo o elegir Efectivo.');
        }
        if (status.status === 'canceled') {
          allowNewAttempt = true;
          throw new Error('El cobro fue cancelado en la terminal.');
        }
        if (status.status === 'expired') {
          allowNewAttempt = true;
          throw new Error('El cobro expiró antes de completarse.');
        }
        if (status.status === 'action_required') throw new Error('Revisa el Smart Point 2 para confirmar si el pago fue aprobado o rechazado antes de continuar.');
      }

      throw new Error('El cobro sigue pendiente. Revisa la terminal y no repitas el pago hasta confirmar el resultado.');
    } catch (error) {
      if (allowNewAttempt) {
        cardRequestId.current = '';
        setPointOrderId('');
      }
      setNotice(error instanceof Error ? error.message : 'No se pudo completar el cobro con tarjeta.');
    } finally {
      setPaying(false);
    }
  }

  async function cancelPointOrder() {
    if (!pointOrderId || paying) return;
    setPaying(true);
    setNotice('Cancelando cobro pendiente...');
    try {
      const { data } = await supabase().auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error('Tu sesión venció.');
      const response = await fetch(`/api/mercado-pago/orders?orderId=${encodeURIComponent(pointOrderId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await response.json() as { status?: string; error?: string };
      if (!response.ok || result.status !== 'canceled') {
        throw new Error(result.error ?? 'Cancela el cobro directamente en la terminal.');
      }
      cardRequestId.current = '';
      setPointOrderId('');
      setNotice('Cobro cancelado. Ya puedes elegir otro método de pago.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo cancelar el cobro.');
    } finally {
      setPaying(false);
    }
  }

  function checkout() {
    if (paymentMethod === 'card') {
      void checkoutCard();
      return;
    }
    void checkoutCash();
  }

  const total = cart.reduce((sum, item) => sum + item.price * item.units, 0);

  return <main className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-5 sm:px-5 lg:grid-cols-[1.1fr_.9fr] lg:py-7">
    <section className="min-w-0 space-y-5">
      <div><p className="text-sm font-semibold text-blue-600">PUNTO DE VENTA</p><h1 className="mt-1 text-2xl font-bold">Abrir caja</h1><p className="mt-1 text-sm text-slate-600">Escanea varias veces el mismo código para sumar unidades al ticket.</p></div>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="font-semibold">Escanear código de barras</h2>
        <div className="mt-3"><BarcodeScanner onDetected={addByBarcode} /></div>
        <form onSubmit={event => { event.preventDefault(); void addByBarcode(code); setCode(''); }} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input autoFocus value={code} onChange={event => setCode(event.target.value)} placeholder="Código de barras o lectora USB" inputMode="numeric" autoComplete="off" className="min-w-0 w-full" />
          <button className="bg-slate-900 text-white">Agregar código</button>
        </form>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="font-semibold">Buscar producto</h2>
        <p className="mt-1 text-xs text-slate-500">Busca por nombre o descripción y agrégalo al ticket.</p>
        <form onSubmit={searchProducts} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Ej. paleta, chocolate, gomitas" type="search" className="min-w-0 w-full" />
          <button disabled={searching} className="bg-blue-600 text-white disabled:opacity-50">{searching ? 'Buscando...' : 'Buscar'}</button>
        </form>
        {results.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2">{results.map(product => <button key={product.id} type="button" onClick={() => addProduct(product)} disabled={product.quantity < 1} className="flex min-h-16 items-center justify-between gap-3 border border-slate-200 bg-white p-3 text-left hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50"><span className="min-w-0"><span className="block truncate font-medium">{product.name}</span><span className="block text-xs text-slate-500">{product.quantity} disponibles</span></span><span className="shrink-0 font-semibold text-blue-700">${Number(product.price).toFixed(2)}</span></button>)}</div>}
      </section>
      {notice && <p role="status" className={`rounded-xl border p-3 text-sm ${notice.startsWith('No se pudo') || notice.startsWith('No se encontró') ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>{notice}</p>}
    </section>
    <section className="h-fit min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:sticky lg:top-4">
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Ticket</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{cart.reduce((sum, item) => sum + item.units, 0)} artículos</span></div>
      {cart.length ? <div className="mt-3 divide-y divide-slate-100">{cart.map(item => <article className="py-4" key={item.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{item.name}</p><p className="text-xs text-slate-500">${Number(item.price).toFixed(2)} cada uno</p></div><strong className="shrink-0">${(item.units * item.price).toFixed(2)}</strong></div><div className="mt-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><button type="button" onClick={() => changeUnits(item, -1)} disabled={paying} aria-label={`Quitar una unidad de ${item.name}`} className="grid h-10 min-h-0 w-10 place-items-center bg-slate-100 p-0 text-lg disabled:opacity-50">−</button><span className="min-w-8 text-center font-semibold">{item.units}</span><button type="button" onClick={() => changeUnits(item, 1)} disabled={paying} aria-label={`Agregar una unidad de ${item.name}`} className="grid h-10 min-h-0 w-10 place-items-center bg-blue-100 p-0 text-lg text-blue-700 disabled:opacity-50">+</button></div><button type="button" onClick={() => setCart(current => current.filter(product => product.id !== item.id))} disabled={paying} className="min-h-10 bg-transparent px-2 text-sm text-rose-700 disabled:opacity-50">Quitar</button></div></article>)}</div> : <p className="mt-4 rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">Escanea o busca productos para comenzar la venta.</p>}
      <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 text-xl font-bold"><span>Total</span><span>${total.toFixed(2)}</span></div>
      <fieldset className="mt-5" disabled={paying || Boolean(pointOrderId)}>
        <legend className="mb-2 text-sm font-semibold text-slate-700">Método de pago</legend>
        <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="group" aria-label="Método de pago">
          {([
            { value: 'cash', label: 'Efectivo' },
            { value: 'card', label: 'Tarjeta' },
          ] as const).map(option => <label key={option.value} className={`cursor-pointer rounded-lg px-3 py-3 text-center text-sm font-semibold transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 ${paymentMethod === option.value ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-900'} ${paying ? 'cursor-not-allowed opacity-60' : ''}`}>
            <input type="radio" name="payment-method" value={option.value} checked={paymentMethod === option.value} onChange={() => setPaymentMethod(option.value)} className="sr-only" />
            {option.label}
          </label>)}
        </div>
      </fieldset>
      {paymentMethod === 'card' && <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
        <p className="font-medium">El cobro se enviará al Smart Point 2 configurado.</p>
        <p className="mt-1 text-xs text-sky-700">{pointOrderId ? `Order: ${pointOrderId}` : 'La venta se registrará solo después de que Mercado Pago confirme el pago.'}</p>
        {pointOrderId && !paying && <button type="button" onClick={cancelPointOrder} className="mt-3 min-h-10 border border-sky-300 bg-white px-3 text-sm text-sky-800 hover:bg-sky-100">Cancelar cobro pendiente</button>}
      </div>}
      <button type="button" onClick={checkout} disabled={!cart.length || paying} className={`mt-4 min-h-14 w-full text-lg text-white disabled:cursor-not-allowed disabled:opacity-50 ${paymentMethod === 'card' ? 'bg-sky-500 hover:bg-sky-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{paying ? (paymentMethod === 'card' ? 'Esperando terminal...' : 'Registrando pago...') : (paymentMethod === 'card' ? (pointOrderId ? 'Revisar cobro pendiente' : 'Cobrar en terminal') : 'Registrar pago')}</button>
    </section>
  </main>;
}
