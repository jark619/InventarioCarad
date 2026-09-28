import { NextResponse } from 'next/server';
import {
  getMercadoPagoContext,
  mercadoPagoErrorResponse,
  mercadoPagoRequest,
  type MercadoPagoOrder,
} from '@/lib/mercado-pago/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/database.types';

export const runtime = 'nodejs';

type CartItem = { productId: string; quantity: number };
type StoredOrder = {
  id: string;
  order_id: string | null;
  external_reference: string;
  cart: Json;
  sale_id: string | null;
};

const finalStatuses = new Set(['processed', 'failed', 'canceled', 'expired', 'action_required', 'refunded']);

function cleanCart(value: unknown): CartItem[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) return null;
  const items = value.map(item => {
    const row = item as Partial<CartItem>;
    return { productId: String(row.productId ?? ''), quantity: Number(row.quantity) };
  });
  if (items.some(item => !/^[0-9a-f-]{36}$/i.test(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1)) return null;
  if (new Set(items.map(item => item.productId)).size !== items.length) return null;
  return items;
}

export async function POST(request: Request) {
  const context = await getMercadoPagoContext(request, ['admin', 'cashier']);
  if ('error' in context) return context.error;

  const body = await request.json() as { cart?: unknown; requestId?: string };
  const cart = cleanCart(body.cart);
  const requestId = body.requestId?.trim() ?? '';
  if (!cart || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    return NextResponse.json({ error: 'El ticket no es válido.' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: existing } = await admin
    .from('mercado_pago_orders')
    .select('order_id,status,status_detail,sale_id')
    .eq('tenant_id', context.profile.tenant_id)
    .eq('request_id', requestId)
    .maybeSingle();
  if (existing?.order_id) {
    return NextResponse.json(existing);
  }

  const [{ data: tenant, error: tenantError }, { data: products, error: productsError }] = await Promise.all([
    context.client
      .from('tenants')
      .select('mercado_pago_terminal_id,mercado_pago_terminal_mode')
      .eq('id', context.profile.tenant_id)
      .single(),
    context.client
      .from('products')
      .select('id,name,price,quantity,is_active')
      .in('id', cart.map(item => item.productId)),
  ]);

  if (tenantError || !tenant?.mercado_pago_terminal_id || tenant.mercado_pago_terminal_mode !== 'PDV') {
    return NextResponse.json({ error: 'Configura y sincroniza una terminal Point en modo PDV.' }, { status: 409 });
  }
  if (productsError) {
    return NextResponse.json({ error: productsError.message }, { status: 400 });
  }

  const productMap = new Map((products ?? []).map(product => [product.id, product]));
  let amountInCents = 0;
  for (const item of cart) {
    const product = productMap.get(item.productId);
    if (!product || !product.is_active) {
      return NextResponse.json({ error: 'Uno de los productos ya no está disponible.' }, { status: 409 });
    }
    if (product.quantity < item.quantity) {
      return NextResponse.json({ error: `No hay suficientes unidades de ${product.name}.` }, { status: 409 });
    }
    amountInCents += Math.round(Number(product.price) * 100) * item.quantity;
  }
  if (amountInCents < 1) {
    return NextResponse.json({ error: 'El total del ticket debe ser mayor a cero.' }, { status: 400 });
  }

  const externalReference = `sgi_${requestId.replace(/-/g, '')}`;
  const storedCart = cart.map(item => ({ product_id: item.productId, quantity: item.quantity })) as unknown as Json;
  const { data: pending, error: pendingError } = await admin
    .from('mercado_pago_orders')
    .upsert({
      tenant_id: context.profile.tenant_id,
      created_by: context.user.id,
      request_id: requestId,
      external_reference: externalReference,
      amount: amountInCents / 100,
      status: 'creating',
      cart: storedCart,
    }, { onConflict: 'tenant_id,request_id' })
    .select('id,order_id,external_reference,cart,sale_id')
    .single();

  if (pendingError || !pending) {
    return NextResponse.json({ error: pendingError?.message ?? 'No se pudo preparar el cobro.' }, { status: 400 });
  }
  if (pending.order_id) {
    return NextResponse.json(pending);
  }

  try {
    const order = await mercadoPagoRequest<MercadoPagoOrder>('/v1/orders', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': requestId },
      body: JSON.stringify({
        type: 'point',
        external_reference: externalReference,
        expiration_time: 'PT5M',
        transactions: { payments: [{ amount: (amountInCents / 100).toFixed(2) }] },
        config: {
          point: {
            terminal_id: tenant.mercado_pago_terminal_id,
            print_on_terminal: 'seller_ticket',
          },
        },
        description: 'Venta SGI Inventario',
      }),
    });

    const { error: updateError } = await admin
      .from('mercado_pago_orders')
      .update({ order_id: order.id, status: order.status, status_detail: order.status_detail ?? null })
      .eq('id', pending.id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ order_id: order.id, status: order.status, status_detail: order.status_detail ?? null });
  } catch (error) {
    await admin.from('mercado_pago_orders').update({ status: 'failed_to_create' }).eq('id', pending.id);
    return mercadoPagoErrorResponse(error);
  }
}

export async function GET(request: Request) {
  const context = await getMercadoPagoContext(request, ['admin', 'cashier']);
  if ('error' in context) return context.error;

  const orderId = new URL(request.url).searchParams.get('orderId')?.trim() ?? '';
  if (!/^[A-Za-z0-9_-]{5,100}$/.test(orderId)) {
    return NextResponse.json({ error: 'La referencia del cobro no es válida.' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: stored, error: storedError } = await admin
    .from('mercado_pago_orders')
    .select('id,order_id,external_reference,cart,sale_id')
    .eq('tenant_id', context.profile.tenant_id)
    .eq('order_id', orderId)
    .single() as { data: StoredOrder | null; error: { message: string } | null };

  if (storedError || !stored) {
    return NextResponse.json({ error: 'El cobro no pertenece a este negocio.' }, { status: 404 });
  }

  try {
    const order = await mercadoPagoRequest<MercadoPagoOrder>(`/v1/orders/${encodeURIComponent(orderId)}`);
    let saleId = stored.sale_id;

    if (order.status === 'processed' && !saleId) {
      const { data, error: saleError } = await context.client.rpc('create_sale', {
        p_items: stored.cart,
        p_payment_method: 'card',
        p_payment_reference: orderId,
      });
      if (saleError) {
        const { data: previousSale } = await context.client
          .from('sales')
          .select('id')
          .eq('payment_reference', orderId)
          .maybeSingle();
        if (!previousSale) {
          await admin.from('mercado_pago_orders').update({
            status: order.status,
            status_detail: 'paid_sale_error',
          }).eq('id', stored.id);
          return NextResponse.json({
            error: 'El pago fue aprobado, pero no se pudo registrar la salida de inventario. No repitas el cobro.',
            order_id: orderId,
            status: order.status,
          }, { status: 409 });
        }
        saleId = previousSale.id;
      } else {
        saleId = data;
      }
    }

    await admin.from('mercado_pago_orders').update({
      status: order.status,
      status_detail: order.status_detail ?? null,
      sale_id: saleId,
      updated_at: new Date().toISOString(),
    }).eq('id', stored.id);

    return NextResponse.json({
      order_id: order.id,
      status: order.status,
      status_detail: order.status_detail ?? null,
      sale_id: saleId,
      final: finalStatuses.has(order.status),
    });
  } catch (error) {
    return mercadoPagoErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const context = await getMercadoPagoContext(request, ['admin', 'cashier']);
  if ('error' in context) return context.error;

  const orderId = new URL(request.url).searchParams.get('orderId')?.trim() ?? '';
  if (!/^[A-Za-z0-9_-]{5,100}$/.test(orderId)) {
    return NextResponse.json({ error: 'La referencia del cobro no es válida.' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: stored } = await admin
    .from('mercado_pago_orders')
    .select('id')
    .eq('tenant_id', context.profile.tenant_id)
    .eq('order_id', orderId)
    .maybeSingle();
  if (!stored) {
    return NextResponse.json({ error: 'El cobro no pertenece a este negocio.' }, { status: 404 });
  }

  try {
    const order = await mercadoPagoRequest<MercadoPagoOrder>(`/v1/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: 'POST',
      headers: { 'X-Idempotency-Key': crypto.randomUUID() },
    });
    await admin.from('mercado_pago_orders').update({
      status: order.status,
      status_detail: order.status_detail ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', stored.id);
    return NextResponse.json({ status: order.status });
  } catch (error) {
    return mercadoPagoErrorResponse(error);
  }
}
