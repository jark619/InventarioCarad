'use client';
import { FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export function ProductForm({ onSaved }: { onSaved?: () => void }) {
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); setSaving(true); setError(''); const data = new FormData(e.currentTarget); const value = (name: string) => { const entry = data.get(name); return typeof entry === 'string' ? entry : ''; }; const client = supabase(); let image_url: string | null = null;
    const image = data.get('image'); if (image instanceof File && image.size) { const path = `${crypto.randomUUID()}-${image.name}`; const upload = await client.storage.from('product-images').upload(path, image); if (upload.error) { setSaving(false); return setError(upload.error.message); } image_url = client.storage.from('product-images').getPublicUrl(path).data.publicUrl; }
    const { error } = await client.from('products').insert({ name: value('name'), barcode: value('barcode') || null, quantity: Number(value('quantity')), category: value('category') || null, image_url, price: Number(value('price')), low_stock_threshold: Number(value('threshold') || 5) });
    setSaving(false); if (error) return setError(error.message); e.currentTarget.reset(); onSaved?.(); }
  return <form onSubmit={submit} className="grid gap-3 rounded-xl bg-white p-4 shadow sm:grid-cols-2"><input name="name" required placeholder="Nombre del producto" /><input name="barcode" placeholder="Código de barras" /><input name="quantity" required type="number" min="0" placeholder="Cantidad inicial" /><input name="price" required type="number" min="0" step="0.01" placeholder="Precio" /><input name="category" placeholder="Categoría" /><input name="image" type="file" accept="image/*" /><input name="threshold" type="number" min="0" defaultValue="5" placeholder="Alerta bajo stock" /><button className="bg-indigo-600 text-white disabled:opacity-50" disabled={saving}>{saving ? 'Guardando…' : 'Guardar producto'}</button>{error && <p className="text-sm text-red-600">{error}</p>}</form>;
}
