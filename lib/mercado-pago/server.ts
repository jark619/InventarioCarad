import { NextResponse } from 'next/server';
import { supabaseWithToken } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

type Role = Database['public']['Enums']['app_role'];

export type MercadoPagoTerminal = {
  id: string;
  pos_id?: string;
  store_id?: string;
  external_pos_id?: string;
  operating_mode?: string;
};

export type MercadoPagoOrder = {
  id: string;
  status: string;
  status_detail?: string;
  external_reference: string;
};

export async function getMercadoPagoContext(request: Request, roles: Role[]) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  if (!accessToken) {
    return { error: NextResponse.json({ error: 'Inicia sesión para continuar.' }, { status: 401 }) };
  }

  const client = supabaseWithToken(accessToken);
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) {
    return { error: NextResponse.json({ error: 'La sesión no es válida.' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('tenant_id,role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.tenant_id) {
    return { error: NextResponse.json({ error: 'El usuario no tiene un negocio asignado.' }, { status: 403 }) };
  }

  if (!roles.includes(profile.role)) {
    return { error: NextResponse.json({ error: 'No tienes permisos para realizar esta acción.' }, { status: 403 }) };
  }

  return { accessToken, client, profile, user };
}

export async function mercadoPagoRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new MercadoPagoError('Falta configurar MERCADO_PAGO_ACCESS_TOKEN en el servidor.', 503);
  }

  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const details = payload as { message?: string; error?: string } | null;
    throw new MercadoPagoError(
      details?.message ?? details?.error ?? 'Mercado Pago rechazó la solicitud.',
      response.status
    );
  }

  return payload as T;
}

export class MercadoPagoError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

export function mercadoPagoErrorResponse(error: unknown) {
  if (error instanceof MercadoPagoError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error && error.name === 'TimeoutError') {
    return NextResponse.json({ error: 'Mercado Pago tardó demasiado en responder.' }, { status: 504 });
  }
  return NextResponse.json({ error: 'No fue posible comunicarse con Mercado Pago.' }, { status: 502 });
}
