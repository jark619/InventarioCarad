-- Configuracion de terminal Point por negocio y seguimiento idempotente de
-- cobros presenciales procesados mediante Mercado Pago Orders API.
alter table public.tenants
  add column mercado_pago_terminal_id text,
  add column mercado_pago_terminal_mode text,
  add column mercado_pago_terminal_synced_at timestamptz;

alter table public.sales
  add column payment_reference text;

create unique index sales_tenant_payment_reference_key
  on public.sales (tenant_id, payment_reference)
  where payment_reference is not null;

create table public.mercado_pago_orders (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  request_id uuid not null,
  external_reference text not null unique,
  order_id text unique,
  amount numeric(12,2) not null check (amount > 0),
  status text not null,
  status_detail text,
  cart jsonb not null,
  sale_id uuid references public.sales(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, request_id)
);

create index mercado_pago_orders_tenant_created_idx
  on public.mercado_pago_orders (tenant_id, created_at desc);

alter table public.mercado_pago_orders enable row level security;

create policy "cashiers read tenant point orders"
  on public.mercado_pago_orders for select
  using (
    tenant_id = public.current_tenant_id()
    and public.has_role(array['admin','cashier']::public.app_role[])
  );

create or replace function public.create_sale(
  p_items jsonb,
  p_payment_method public.payment_method,
  p_payment_reference text
)
returns uuid
language plpgsql
security definer
set search_path = public
set lock_timeout = '5s'
set statement_timeout = '15s'
as $$
declare
  v_tenant uuid := public.current_tenant_id();
  v_reference text := nullif(trim(p_payment_reference), '');
  v_sale uuid;
begin
  if p_payment_method = 'card' and v_reference is null then
    raise exception 'La referencia del pago con tarjeta es obligatoria';
  end if;

  if v_reference is not null then
    select id into v_sale
      from public.sales
      where tenant_id = v_tenant and payment_reference = v_reference;
    if found then return v_sale; end if;
  end if;

  v_sale := public.create_sale(p_items, p_payment_method);

  if v_reference is not null then
    update public.sales
      set payment_reference = v_reference
      where id = v_sale and tenant_id = v_tenant and cashier_id = auth.uid();
    if not found then raise exception 'No se pudo asignar la referencia del pago'; end if;
  end if;

  return v_sale;
end;
$$;

grant execute on function public.create_sale(jsonb, public.payment_method, text) to authenticated;
