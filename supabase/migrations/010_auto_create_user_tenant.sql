-- Crea el tenant y perfil administrador cuando Supabase Auth registra un usuario.
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.create_store(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_tenant_id();
  v_id uuid;
  v_name text := nullif(trim(p_name), '');
begin
  if v_tenant is null then
    raise exception 'Usuario sin tienda';
  end if;

  if not coalesce(public.has_role(array['admin']::public.app_role[]), false) then
    raise exception 'Solo administradores';
  end if;

  if v_name is null then
    raise exception 'El nombre de la tienda es obligatorio';
  end if;

  if (select count(*) from public.stores where tenant_id = v_tenant) >=
     (select store_limit from public.tenants where id = v_tenant) then
    raise exception 'Limite de tiendas alcanzado para tu plan';
  end if;

  insert into public.stores (tenant_id, name)
  values (v_tenant, v_name)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_store(text) to authenticated;

-- Repara cuentas existentes creadas antes de este onboarding automatico.
do $$
declare
  v_user record;
  v_tenant_id uuid;
  v_tenant_name text;
  v_full_name text;
begin
  for v_user in
    select id, email, raw_user_meta_data
    from auth.users u
    where not exists (
      select 1
      from public.profiles p
      where p.id = u.id
    )
  loop
    v_full_name := nullif(trim(coalesce(v_user.raw_user_meta_data->>'full_name', '')), '');
    v_tenant_name := nullif(trim(coalesce(
      v_user.raw_user_meta_data->>'store_name',
      v_user.raw_user_meta_data->>'tenant_name',
      v_full_name,
      split_part(v_user.email, '@', 1),
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
      v_user.id,
      v_tenant_id,
      'admin',
      v_full_name,
      nullif(trim(coalesce(v_user.raw_user_meta_data->>'first_name', '')), ''),
      nullif(trim(coalesce(v_user.raw_user_meta_data->>'last_name', '')), ''),
      true
    );
  end loop;
end $$;
