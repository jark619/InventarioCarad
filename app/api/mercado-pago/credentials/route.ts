import { NextResponse } from 'next/server';
import {
  encryptCredential,
  getMercadoPagoContext,
  mercadoPagoErrorResponse,
  mercadoPagoRequestWithAccessToken,
} from '@/lib/mercado-pago/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const context = await getMercadoPagoContext(request, ['admin']);
  if ('error' in context) return context.error;

  const { data, error } = await supabaseAdmin()
    .from('mercado_pago_credentials')
    .select('token_hint,updated_at')
    .eq('tenant_id', context.profile.tenant_id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    configured: Boolean(data),
    token_hint: data?.token_hint ?? null,
    updated_at: data?.updated_at ?? null,
  });
}

export async function POST(request: Request) {
  const context = await getMercadoPagoContext(request, ['admin']);
  if ('error' in context) return context.error;

  const body = await request.json() as { accessToken?: string };
  const accessToken = body.accessToken?.trim() ?? '';
  if (accessToken.length < 20 || accessToken.length > 500 || /\s/.test(accessToken)) {
    return NextResponse.json({ error: 'Captura un Access Token válido.' }, { status: 400 });
  }

  try {
    await mercadoPagoRequestWithAccessToken(accessToken, '/terminals/v1/list?limit=1&offset=0');
  } catch (error) {
    return mercadoPagoErrorResponse(error);
  }

  try {
    const { error } = await supabaseAdmin().from('mercado_pago_credentials').upsert({
      tenant_id: context.profile.tenant_id,
      access_token_ciphertext: encryptCredential(accessToken),
      token_hint: accessToken.slice(-6),
      created_by: context.user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ configured: true, token_hint: accessToken.slice(-6) });
  } catch (error) {
    return mercadoPagoErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const context = await getMercadoPagoContext(request, ['admin']);
  if ('error' in context) return context.error;

  const { error } = await supabaseAdmin()
    .from('mercado_pago_credentials')
    .delete()
    .eq('tenant_id', context.profile.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ configured: false });
}
