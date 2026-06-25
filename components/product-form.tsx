'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { BarcodeScanner } from '@/components/barcode-scanner';
import { supabase } from '@/lib/supabase/client';
import type { Product } from '@/lib/types';

type Props = {
  product?: Product | null;
  onSaved?: () => void;
  onCancel?: () => void;
};

type ProductFields = {
  name: string;
  barcode: string;
  quantity: string;
  price: string;
  category: string;
  threshold: string;
};

const emptyFields: ProductFields = {
  name: '',
  barcode: '',
  quantity: '',
  price: '',
  category: '',
  threshold: '5',
};

function fieldsFromProduct(product?: Product | null): ProductFields {
  if (!product) return emptyFields;
  return {
    name: product.name,
    barcode: product.barcode ?? '',
    quantity: String(product.quantity),
    price: String(product.price),
    category: product.category ?? '',
    threshold: String(product.low_stock_threshold),
  };
}

export function ProductForm({ product, onSaved, onCancel }: Props) {
  const [fields, setFields] = useState<ProductFields>(fieldsFromProduct(product));
  const [image, setImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [barcodeNotice, setBarcodeNotice] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const barcodeInput = useRef<HTMLInputElement>(null);
  const editing = Boolean(product);

  useEffect(() => {
    setFields(fieldsFromProduct(product));
    setImage(null);
    setError('');
    setBarcodeNotice('');
    setShowCamera(false);
  }, [product]);

  const updateField = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFields(current => ({ ...current, [name]: value }));
    if (name === 'barcode') setBarcodeNotice('');
  };

  const checkBarcode = useCallback(async (rawBarcode: string) => {
    const barcode = rawBarcode.trim();
    if (!barcode) return;

    setFields(current => ({ ...current, barcode }));
    const { data, error: lookupError } = await supabase()
      .from('products')
      .select('id,name')
      .eq('barcode', barcode)
      .maybeSingle();

    if (lookupError) {
      setBarcodeNotice('No se pudo validar el código. Inténtalo nuevamente.');
      return;
    }
    if (data && data.id !== product?.id) {
      setBarcodeNotice(`Ya existe el producto "${data.name}" con este código.`);
      return;
    }
    setBarcodeNotice(data ? 'Este es el código del producto que estás editando.' : 'Código disponible.');
  }, [product?.id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const values = Object.values(fields).map(value => value.trim());
    if (values.some(value => !value) || (!editing && !image)) {
      setSaving(false);
      setError('Completa todos los campos obligatorios e incluye una imagen del producto.');
      return;
    }

    const client = supabase();
    const { data: duplicate, error: duplicateError } = await client
      .from('products')
      .select('id,name')
      .eq('barcode', fields.barcode.trim())
      .maybeSingle();
    if (duplicateError) {
      setSaving(false);
      setError(duplicateError.message);
      return;
    }
    if (duplicate && duplicate.id !== product?.id) {
      setSaving(false);
      setBarcodeNotice(`Ya existe el producto "${duplicate.name}" con este código.`);
      setError('Usa un código de barras diferente.');
      return;
    }

    let imageUrl = product?.image_url ?? null;
    if (image) {
      const path = `${crypto.randomUUID()}-${image.name}`;
      const upload = await client.storage.from('product-images').upload(path, image);
      if (upload.error) {
        setSaving(false);
        setError(upload.error.message);
        return;
      }
      imageUrl = client.storage.from('product-images').getPublicUrl(path).data.publicUrl;
    }

    const payload = {
      name: fields.name.trim(),
      barcode: fields.barcode.trim(),
      quantity: Number(fields.quantity),
      category: fields.category.trim(),
      image_url: imageUrl,
      price: Number(fields.price),
      low_stock_threshold: Number(fields.threshold),
    };
    const result = product
      ? await client.from('products').update(payload).eq('id', product.id)
      : await client.from('products').insert(payload);

    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (!product) {
      setFields(emptyFields);
      setImage(null);
      setBarcodeNotice('');
    }
    onSaved?.();
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">{editing ? 'Editar producto' : 'Nuevo producto'}</h2>
      {editing && <button type="button" onClick={onCancel} className="text-sm font-medium text-slate-600 hover:text-slate-900">Cancelar edición</button>}
    </div>
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <input name="name" required value={fields.name} onChange={updateField} placeholder="Nombre del producto" />
      <div className="flex gap-2">
        <input ref={barcodeInput} name="barcode" required value={fields.barcode} onChange={updateField} onBlur={() => checkBarcode(fields.barcode)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); checkBarcode(fields.barcode); } }} inputMode="numeric" autoComplete="off" placeholder="Código de barras o lectora" className="min-w-0 flex-1" />
        <button type="button" onClick={() => setShowCamera(current => !current)} className="shrink-0 bg-slate-800 text-sm text-white">{showCamera ? 'Cerrar cámara' : 'Usar cámara'}</button>
      </div>
      <p className="text-xs text-slate-500 sm:col-span-2">Puedes escanear con la cámara del celular o enfocar este campo y disparar la lectora de código de barras.</p>
      {barcodeNotice && <p className={`sm:col-span-2 text-sm ${barcodeNotice.startsWith('Ya existe') ? 'text-amber-700' : 'text-emerald-700'}`}>{barcodeNotice}</p>}
      {showCamera && <div className="sm:col-span-2"><BarcodeScanner onDetected={barcode => { checkBarcode(barcode); setShowCamera(false); barcodeInput.current?.focus(); }} /></div>}
      <input name="quantity" required type="number" min="0" value={fields.quantity} onChange={updateField} placeholder="Cantidad inicial" />
      <input name="price" required type="number" min="0" step="0.01" value={fields.price} onChange={updateField} placeholder="Precio" />
      <input name="category" required value={fields.category} onChange={updateField} placeholder="Categoría" />
      <input name="threshold" required type="number" min="0" value={fields.threshold} onChange={updateField} placeholder="Alerta bajo stock" />
      <label className="flex min-h-11 items-center rounded-md border border-slate-300 px-3 text-sm text-slate-600 sm:col-span-2">
        <span className="mr-2">Imagen {editing ? '(opcional para reemplazar)' : '*'}</span>
        <input name="image" required={!editing} type="file" accept="image/*" onChange={event => setImage(event.target.files?.[0] ?? null)} className="min-w-0 text-sm" />
      </label>
      <button className="bg-indigo-600 text-white disabled:opacity-50 sm:col-span-2" disabled={saving}>{saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Guardar producto'}</button>
      {error && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{error}</p>}
    </form>
  </section>;
}
