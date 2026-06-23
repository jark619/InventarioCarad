-- Multi-sucursal, colaboradores y promociones por tienda.
alter table public.tenants add column if not exists store_limit integer not null default 1 check (store_limit > 0);
update public.tenants set store_limit = case plan when 'business' then 5 else 1 end;
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists employee_number text;
alter table public.profiles add column if not exists is_administrator boolean not null default false;

create table public.stores (id uuid primary key default uuid_generate_v4(), tenant_id uuid not null references public.tenants(id) on delete cascade, name text not null, created_at timestamptz not null default now());
create table public.store_members (store_id uuid not null references public.stores(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, role public.app_role not null default 'cashier', primary key(store_id,user_id));
create table public.promotions (id uuid primary key default uuid_generate_v4(), tenant_id uuid not null references public.tenants(id) on delete cascade, store_id uuid references public.stores(id) on delete cascade, name text not null, code text not null, discount_type text not null check(discount_type in ('percent','fixed')), discount_value numeric(12,2) not null check(discount_value > 0), starts_at timestamptz not null default now(), ends_at timestamptz, active boolean not null default true, created_at timestamptz not null default now(), unique(tenant_id,code));
alter table public.stores enable row level security; alter table public.store_members enable row level security; alter table public.promotions enable row level security;
create policy "tenant reads stores" on public.stores for select using (tenant_id = public.current_tenant_id());
create policy "admin manages stores" on public.stores for all using (tenant_id = public.current_tenant_id() and public.has_role(array['admin']::public.app_role[])) with check (tenant_id = public.current_tenant_id() and public.has_role(array['admin']::public.app_role[]));
create policy "tenant reads promotions" on public.promotions for select using (tenant_id = public.current_tenant_id());
create policy "admin manages promotions" on public.promotions for all using (tenant_id = public.current_tenant_id() and public.has_role(array['admin']::public.app_role[])) with check (tenant_id = public.current_tenant_id() and public.has_role(array['admin']::public.app_role[]));
create policy "admin reads staff" on public.profiles for select using (tenant_id = public.current_tenant_id() and public.has_role(array['admin']::public.app_role[]));
create policy "tenant reads members" on public.store_members for select using (exists(select 1 from public.stores s where s.id=store_id and s.tenant_id=public.current_tenant_id()));

create or replace function public.create_store(p_name text) returns uuid language plpgsql security definer set search_path=public as $$ declare v_tenant uuid:=public.current_tenant_id(); v_id uuid; begin if not public.has_role(array['admin']::public.app_role[]) then raise exception 'Solo administradores'; end if; if (select count(*) from public.stores where tenant_id=v_tenant) >= (select store_limit from public.tenants where id=v_tenant) then raise exception 'Limite de tiendas alcanzado para tu plan'; end if; insert into public.stores(tenant_id,name) values(v_tenant,p_name) returning id into v_id; return v_id; end; $$;
grant execute on function public.create_store(text) to authenticated;
