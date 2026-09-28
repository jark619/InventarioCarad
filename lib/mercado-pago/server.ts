import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin, supabaseWithToken } from '@/lib/supabase/server';
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

export async function mercadoPagoRequestWithAccessToken<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
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

export async function mercadoPagoRequest<T>(tenantId: string, path: string, init?: RequestInit): Promise<T> {
  const { data, error } = await supabaseAdmin()
    .from('mercado_pago_credentials')
    .select('access_token_ciphertext')
    .eq('tenant_id', tenantId)
    .single();
  if (error || !data) {
    throw new MercadoPagoError('Configura el Access Token de Mercado Pago para este negocio.', 409);
  }
  return mercadoPagoRequestWithAccessToken<T>(decryptCredential(data.access_token_ciphertext), path, init);
}

export function encryptCredential(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', credentialEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptCredential(value: string) {
  const [version, ivValue, tagValue, encryptedValue] = value.split(':');
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
    throw new MercadoPagoError('La credencial de Mercado Pago almacenada no es válida.', 500);
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', credentialEncryptionKey(), Buffer.from(ivValue, 'base64'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new MercadoPagoError('No fue posible descifrar la credencial de Mercado Pago.', 500);
  }
}

function credentialEncryptionKey() {
  const encoded = process.env.MERCADO_PAGO_ENCRYPTION_KEY;
  if (!encoded) {
    throw new MercadoPagoError('Falta configurar MERCADO_PAGO_ENCRYPTION_KEY en el servidor.', 503);
  }
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) {
    throw new MercadoPagoError('MERCADO_PAGO_ENCRYPTION_KEY debe ser una llave Base64 de 32 bytes.', 503);
  }
  return key;
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
