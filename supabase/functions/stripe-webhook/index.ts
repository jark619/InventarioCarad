import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() });
Deno.serve(async request => { const signature = request.headers.get('stripe-signature'); if (!signature) return new Response('Missing Stripe signature', { status: 400 }); try {
  const event = await stripe.webhooks.constructEventAsync(await request.text(), signature, Deno.env.get('STRIPE_WEBHOOK_SECRET')!); const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  if (event.type === 'checkout.session.completed') { const session = event.data.object as Stripe.Checkout.Session; const tenantId = session.metadata?.tenant_id; if (tenantId) await admin.from('tenants').update({ plan: session.metadata?.plan, subscription_status: 'active', stripe_customer_id: String(session.customer), stripe_subscription_id: String(session.subscription) }).eq('id', tenantId); }
  if (event.type === 'customer.subscription.deleted') { const subscription = event.data.object as Stripe.Subscription; await admin.from('tenants').update({ subscription_status: 'canceled' }).eq('stripe_subscription_id', subscription.id); }
  await admin.from('billing_events').upsert({ stripe_event_id: event.id, event_type: event.type, payload: event.data.object }); return new Response('ok');
} catch (error) { return new Response(`Webhook error: ${error.message}`, { status: 400 }); } });
