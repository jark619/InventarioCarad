alter table public.collaborators
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists email text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
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

  insert into public.profiles (
    id,
    tenant_id,
    role,
    full_name,
    first_name,
    last_name,
    is_administrator
  )
  values (
    new.id,
    v_tenant_id,
    'admin',
    v_full_name,
    nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'last_name', '')), ''),
    true
  );

  return new;
end;
$$;

create unique index if not exists collaborators_tenant_email_key
  on public.collaborators (tenant_id, lower(email))
  where email is not null;

create unique index if not exists collaborators_user_id_key
  on public.collaborators (user_id)
  where user_id is not null;

create index if not exists collaborators_tenant_role_idx
  on public.collaborators (tenant_id, role, active);
