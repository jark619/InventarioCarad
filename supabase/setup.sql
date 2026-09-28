-- InventarioCarad - instalacion completa para un proyecto nuevo de Supabase
-- Ejecuta este archivo una sola vez en Supabase > SQL Editor > New query.
-- No crea usuarios: Supabase Auth los administra. Al registrar un usuario,
-- el trigger handle_new_user crea automaticamente su negocio y perfil admin.

begin;

create extension if not exists "uuid-ossp";

create type public.app_role as enum ('admin', 'inventory', 'cashier');

create table public.tenants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  logo_url text,
  plan text not null default 'trial' check (plan in ('trial', 'starter', 'business')),
  subscription_status text not null default 'inactive',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  store_limit integer not null default 1 check (store_limit > 0),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role public.app_role not null default 'cashier',
  full_name text,
  first_name text,
  last_name text,
  employee_number text,
  is_administrator boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  barcode text,
  quantity integer not null default 0 check (quantity >= 0),
  category text,
  image_url text,
  price numeric(12,2) not null default 0 check (price >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id),
  cashier_id uuid not null references auth.users(id),
  total numeric(12,2) not null check (total >= 0),
  created_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0)
);

create table public.billing_events (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references public.tenants(id) on delete set null,
  stripe_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.store_members (
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'cashier',
  primary key (store_id, user_id)
);

create table public.promotions (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  name text not null,
  code text not null,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table public.collaborators (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  first_name text not null,
  last_name text not null,
  employee_number text not null,
  email text,
  role public.app_role not null default 'cashier',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, employee_number)
);

create index products_tenant_barcode_idx on public.products (tenant_id, barcode);
create index products_tenant_active_name_idx on public.products (tenant_id, is_active, name);
create unique index products_tenant_barcode_active_key
  on public.products (tenant_id, barcode)
  where is_active and barcode is not null;
create index products_tenant_active_barcode_idx on public.products (tenant_id, is_active, barcode);
create index sales_tenant_created_idx on public.sales (tenant_id, created_at desc);
create index collaborators_tenant_idx on public.collaborators (tenant_id);
create index collaborators_store_idx on public.collaborators (store_id);
create unique index collaborators_tenant_email_key
  on public.collaborators (tenant_id, lower(email)) where email is not null;
create unique index collaborators_user_id_key
  on public.collaborators (user_id) where user_id is not null;
create index collaborators_tenant_role_idx
  on public.collaborators (tenant_id, role, active);

create or replace function public.current_tenant_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

create or replace function public.has_role(roles public.app_role[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select role = any(roles) from public.profiles where id = auth.uid()
$$;

create or replace function public.plan_store_limit(p_plan text)
returns integer
language sql immutable set search_path = public
as $$
  select case p_plan when 'business' then 5 else 1 end
$$;

create or replace function public.assign_product_tenant()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.tenant_id := public.current_tenant_id();
  if new.tenant_id is null then raise exception 'Usuario sin tienda'; end if;
  return new;
end;
$$;

create or replace function public.assign_current_tenant()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.tenant_id := coalesce(new.tenant_id, public.current_tenant_id());
  if new.tenant_id is null then raise exception 'Usuario sin tienda'; end if;
  return new;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger assign_product_tenant
  before insert on public.products
  for each row execute function public.assign_product_tenant();
create trigger collaborators_assign_tenant
  before insert on public.collaborators
  for each row execute function public.assign_current_tenant();
create trigger promotions_assign_tenant
  before insert on public.promotions
  for each row execute function public.assign_current_tenant();
create trigger collaborators_touch_updated_at
  before update on public.collaborators
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_tenant_name text;
  v_full_name text;
begin
  if coalesce((new.raw_app_meta_data->>'skip_tenant_onboarding')::boolean, false) then
    return new;
  end if;
  if exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;

  v_full_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');
  v_tenant_name := nullif(trim(coalesce(
    new.raw_user_meta_data->>'store_name',
    new.raw_user_meta_data->>'tenant_name',
    v_full_name,
    split_part(new.email, '@', 1),
    'Mi tienda'
  )), '');

  insert into public.tenants (name)
  values (coalesce(v_tenant_name, 'Mi tienda'))
  returning id into v_tenant_id;

  insert into public.profiles
    (id, tenant_id, role, full_name, first_name, last_name, is_administrator)
  values
    (new.id, v_tenant_id, 'admin', v_full_name,
     nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), ''),
     nullif(trim(coalesce(new.raw_user_meta_data->>'last_name', '')), ''), true);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.create_sale(p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
set lock_timeout = '5s'
set statement_timeout = '15s'
as $$
declare
  v_tenant uuid := public.current_tenant_id();
  v_sale uuid;
  v_item jsonb;
  v_product public.products;
  v_qty integer;
  v_total numeric := 0;
begin
  if v_tenant is null or not coalesce(public.has_role(array['admin','cashier']::public.app_role[]), false) then
    raise exception 'No autorizado';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid and tenant_id = v_tenant
      for update;
    if not found then raise exception 'Producto invalido'; end if;
    if not v_product.is_active then raise exception 'Producto retirado'; end if;
    if v_qty < 1 or v_product.quantity < v_qty then
      raise exception 'Stock insuficiente para %', v_product.name;
    end if;
    v_total := v_total + v_qty * v_product.price;
    update public.products
      set quantity = quantity - v_qty, updated_at = now()
      where id = v_product.id;
  end loop;

  insert into public.sales (tenant_id, cashier_id, total)
    values (v_tenant, auth.uid(), v_total) returning id into v_sale;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid and tenant_id = v_tenant;
    insert into public.sale_items (sale_id, product_id, quantity, unit_price)
      values (v_sale, v_product.id, v_qty, v_product.price);
  end loop;
  return v_sale;
end;
$$;

create or replace function public.create_store(p_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_tenant uuid := public.current_tenant_id();
  v_id uuid;
  v_name text := nullif(trim(p_name), '');
begin
  if v_tenant is null then raise exception 'Usuario sin tienda'; end if;
  if not coalesce(public.has_role(array['admin']::public.app_role[]), false) then
    raise exception 'Solo administradores';
  end if;
  if v_name is null then raise exception 'El nombre de la tienda es obligatorio'; end if;
  if (select count(*) from public.stores where tenant_id = v_tenant) >=
     (select store_limit from public.tenants where id = v_tenant) then
    raise exception 'Limite de tiendas alcanzado para tu plan';
  end if;
  insert into public.stores (tenant_id, name)
    values (v_tenant, v_name) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.update_my_profile(p_full_name text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles set full_name = trim(p_full_name) where id = auth.uid();
end;
$$;

create or replace function public.admin_update_collaborator(
  p_id uuid, p_full_name text, p_role public.app_role
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not coalesce(public.has_role(array['admin']::public.app_role[]), false) then
    raise exception 'Solo administradores';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_id and tenant_id = public.current_tenant_id()
  ) then
    raise exception 'Colaborador no pertenece a tu tienda';
  end if;
  update public.profiles set full_name = trim(p_full_name), role = p_role where id = p_id;
end;
$$;

grant execute on function public.create_sale(jsonb) to authenticated;
grant execute on function public.create_store(text) to authenticated;
grant execute on function public.update_my_profile(text) to authenticated;
grant execute on function public.admin_update_collaborator(uuid, text, public.app_role) to authenticated;

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.billing_events enable row level security;
alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.promotions enable row level security;
alter table public.collaborators enable row level security;

create policy "read own tenant" on public.tenants for select
  using (id = public.current_tenant_id());
create policy "read own profile" on public.profiles for select
  using (id = auth.uid());
create policy "admin reads staff" on public.profiles for select
  using (tenant_id = public.current_tenant_id()
    and public.has_role(array['admin']::public.app_role[]));
create policy "read products in tenant" on public.products for select
  using (tenant_id = public.current_tenant_id());
create policy "manage products" on public.products for all
  using (tenant_id = public.current_tenant_id()
    and public.has_role(array['admin','inventory']::public.app_role[]))
  with check (tenant_id = public.current_tenant_id()
    and public.has_role(array['admin','inventory']::public.app_role[]));
create policy "read tenant sales" on public.sales for select
  using (tenant_id = public.current_tenant_id());
create policy "read tenant sale items" on public.sale_items for select
  using (exists (
    select 1 from public.sales s
    where s.id = sale_id and s.tenant_id = public.current_tenant_id()
  ));
create policy "admins read own billing events" on public.billing_events for select
  using (tenant_id = public.current_tenant_id()
    and public.has_role(array['admin']::public.app_role[]));
create policy "tenant reads stores" on public.stores for select
  using (tenant_id = public.current_tenant_id());
create policy "admin manages stores" on public.stores for all
  using (tenant_id = public.current_tenant_id()
    and public.has_role(array['admin']::public.app_role[]))
  with check (tenant_id = public.current_tenant_id()
    and public.has_role(array['admin']::public.app_role[]));
create policy "tenant reads promotions" on public.promotions for select
  using (tenant_id = public.current_tenant_id());
create policy "admin manages promotions" on public.promotions for all
  using (tenant_id = public.current_tenant_id()
    and public.has_role(array['admin']::public.app_role[]))
  with check (tenant_id = public.current_tenant_id()
    and public.has_role(array['admin']::public.app_role[]));
create policy "tenant reads members" on public.store_members for select
  using (exists (
    select 1 from public.stores s
    where s.id = store_id and s.tenant_id = public.current_tenant_id()
  ));
create policy "admin reads collaborators" on public.collaborators for select
  using (tenant_id = public.current_tenant_id()
    and public.has_role(array['admin']::public.app_role[]));
create policy "admin manages collaborators" on public.collaborators for all
  using (tenant_id = public.current_tenant_id()
    and public.has_role(array['admin']::public.app_role[]))
  with check (tenant_id = public.current_tenant_id()
    and public.has_role(array['admin']::public.app_role[]));

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "inventory uploads images" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images'
    and public.has_role(array['admin','inventory']::public.app_role[]));
create policy "public reads images" on storage.objects for select
  using (bucket_id = 'product-images');

create view public.sales_report with (security_invoker = true) as
select
  p.tenant_id,
  p.id,
  p.name,
  p.quantity,
  p.low_stock_threshold,
  coalesce(sum(si.quantity), 0) as units_sold
from public.products p
left join public.sale_items si on si.product_id = p.id
group by p.tenant_id, p.id, p.name, p.quantity, p.low_stock_threshold;

commit;
