-- Estado de suscripción por tienda. Stripe lo actualiza únicamente desde el webhook.
alter table public.tenants add column if not exists plan text not null default 'trial' check (plan in ('trial', 'starter', 'business'));
alter table public.tenants add column if not exists subscription_status text not null default 'inactive';
alter table public.tenants add column if not exists stripe_customer_id text unique;
alter table public.tenants add column if not exists stripe_subscription_id text unique;

create table public.billing_events (id uuid primary key default uuid_generate_v4(), tenant_id uuid references public.tenants(id) on delete set null, stripe_event_id text not null unique, event_type text not null, payload jsonb not null, created_at timestamptz not null default now());
alter table public.billing_events enable row level security;
create policy "admins read own billing events" on public.billing_events for select using (tenant_id = public.current_tenant_id() and public.has_role(array['admin']::public.app_role[]));
