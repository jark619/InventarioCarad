import { NextResponse } from 'next/server';
import {
  getMercadoPagoContext,
  mercadoPagoErrorResponse,
  mercadoPagoRequest,
  type MercadoPagoTerminal,
} from '@/lib/mercado-pago/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type TerminalList = { data?: { terminals?: MercadoPagoTerminal[] } };

export async function GET(request: Request) {
  const context = await getMercadoPagoContext(request, ['admin']);
  if ('error' in context) return context.error;

  try {
    const [response, tenantResult] = await Promise.all([
      mercadoPagoRequest<TerminalList>(context.profile.tenant_id, '/terminals/v1/list?limit=50&offset=0'),
      context.client
        .from('tenants')
        .select('mercado_pago_terminal_id,mercado_pago_terminal_mode,mercado_pago_terminal_synced_at')
        .eq('id', context.profile.tenant_id)
        .single(),
    ]);

    if (tenantResult.error) {
      return NextResponse.json({ error: tenantResult.error.message }, { status: 400 });
    }

    return NextResponse.json({
      terminals: response.data?.terminals ?? [],
      configured: tenantResult.data,
    });
  } catch (error) {
    return mercadoPagoErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const context = await getMercadoPagoContext(request, ['admin']);
  if ('error' in context) return context.error;

  const body = await request.json() as { terminalId?: string };
  const terminalId = body.terminalId?.trim() ?? '';
  if (!/^[A-Za-z0-9_-]{5,100}$/.test(terminalId)) {
    return NextResponse.json({ error: 'Selecciona una terminal válida.' }, { status: 400 });
  }

  try {
    const available = await mercadoPagoRequest<TerminalList>(context.profile.tenant_id, '/terminals/v1/list?limit=50&offset=0');
    const terminal = available.data?.terminals?.find(item => item.id === terminalId);
    if (!terminal) {
      return NextResponse.json({ error: 'La terminal no pertenece a la cuenta configurada.' }, { status: 404 });
    }

    const setup = terminal.operating_mode === 'PDV'
      ? { terminals: [terminal] }
      : await mercadoPagoRequest<{ terminals?: MercadoPagoTerminal[] }>(context.profile.tenant_id, '/terminals/v1/setup', {
        method: 'PATCH',
        body: JSON.stringify({ terminals: [{ id: terminalId, operating_mode: 'PDV' }] }),
      });
    const synchronized = setup.terminals?.find(item => item.id === terminalId) ?? terminal;

    const { error: updateError } = await supabaseAdmin()
      .from('tenants')
      .update({
        mercado_pago_terminal_id: terminalId,
        mercado_pago_terminal_mode: synchronized.operating_mode ?? 'PDV',
        mercado_pago_terminal_synced_at: new Date().toISOString(),
      })
      .eq('id', context.profile.tenant_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ terminal: synchronized });
  } catch (error) {
    return mercadoPagoErrorResponse(error);
  }
}
