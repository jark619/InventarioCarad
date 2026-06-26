create table if not exists public.collaborators (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  first_name text not null,
  last_name text not null,
  employee_number text not null,
  role public.app_role not null default 'cashier',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, employee_number)
);

create index if not exists collaborators_tenant_idx on public.collaborators(tenant_id);
create index if not exists collaborators_store_idx on public.collaborators(store_id);

alter table public.collaborators enable row level security;

drop policy if exists "admin reads collaborators" on public.collaborators;
drop policy if exists "admin manages collaborators" on public.collaborators;

create policy "admin reads collaborators"
  on public.collaborators for select
  using (
    tenant_id = public.current_tenant_id()
    and public.has_role(array['admin']::public.app_role[])
  );

create policy "admin manages collaborators"
  on public.collaborators for all
  using (
    tenant_id = public.current_tenant_id()
    and public.has_role(array['admin']::public.app_role[])
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.has_role(array['admin']::public.app_role[])
  );

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists collaborators_touch_updated_at on public.collaborators;
create trigger collaborators_touch_updated_at
  before update on public.collaborators
  for each row execute function public.touch_updated_at();

create or replace function public.assign_current_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.tenant_id = public.current_tenant_id();
  return new;
end;
$$;

drop trigger if exists collaborators_assign_tenant on public.collaborators;
create trigger collaborators_assign_tenant
  before insert on public.collaborators
  for each row execute function public.assign_current_tenant();

drop trigger if exists promotions_assign_tenant on public.promotions;
create trigger promotions_assign_tenant
  before insert on public.promotions
  for each row execute function public.assign_current_tenant();
