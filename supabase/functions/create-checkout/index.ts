import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() });
const headers = { 'Access-Control-Allow-Origin': Deno.env.get('APP_URL') ?? '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const prices: Record<string, string | undefined> = { starter: Deno.env.get('STRIPE_PRICE_STARTER'), business: Deno.env.get('STRIPE_PRICE_BUSINESS') };

Deno.serve(async request => { if (request.method === 'OPTIONS') return new Response('ok', { headers }); try {
  const token = request.headers.get('Authorization')?.replace('Bearer ', ''); if (!token) throw new Error('Inicia sesión para contratar un plan.');
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await client.auth.getUser(); if (!user) throw new Error('Sesión inválida.'); const { data: profile } = await client.from('profiles').select('tenant_id').eq('id', user.id).single(); if (!profile) throw new Error('Primero crea o únete a una tienda.');
  const { plan } = await request.json(); const price = prices[plan]; if (!price) throw new Error('Plan no válido.'); const { data: tenant } = await client.from('tenants').select('stripe_customer_id').eq('id', profile.tenant_id).single();
  const session = await stripe.checkout.sessions.create({ mode: 'subscription', customer: tenant?.stripe_customer_id || undefined, customer_email: tenant?.stripe_customer_id ? undefined : user.email, line_items: [{ price, quantity: 1 }], success_url: `${Deno.env.get('APP_URL')}/?checkout=success`, cancel_url: `${Deno.env.get('APP_URL')}/pricing?checkout=cancel`, metadata: { tenant_id: profile.tenant_id, plan } });
  return Response.json({ url: session.url }, { headers });
} catch (error) { return Response.json({ error: error.message }, { status: 400, headers }); } });
