-- InventarioCarad - usuario demo para ejecutar directamente en Supabase SQL Editor
-- Requisito: ejecutar primero supabase/setup.sql.
-- Este archivo contiene una contrasena. Eliminelo o cambiela despues de usarlo.

begin;

create extension if not exists pgcrypto;

do $$
declare
  v_user_id uuid;
  v_tenant_id uuid;
  v_email constant text := 'sandoval.carmen2@gmail.com';
  -- Sustituye este valor antes de ejecutar. No publiques una contrasena real.
  v_password constant text := 'CAMBIA_ESTA_CONTRASENA';
  v_business_name constant text := 'Dulcería Carad';
begin
  select id
    into v_user_id
    from auth.users
    where lower(email) = lower(v_email)
    limit 1;

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'full_name', 'Carmen Sandoval',
        'first_name', 'Carmen',
        'last_name', 'Sandoval',
        'store_name', v_business_name
      ),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
  else
    update auth.users
      set encrypted_password = crypt(v_password, gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
            || '{"provider":"email","providers":["email"]}'::jsonb,
          raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
            || jsonb_build_object(
              'full_name', 'Carmen Sandoval',
              'first_name', 'Carmen',
              'last_name', 'Sandoval',
              'store_name', v_business_name
            ),
          updated_at = now()
      where id = v_user_id;
  end if;

  -- La identidad permite iniciar sesion mediante el proveedor Email/Password.
  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    v_user_id::text,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email',
    now(),
    now(),
    now()
  )
  on conflict (provider_id, provider) do update
    set identity_data = excluded.identity_data,
        updated_at = now();

  -- El trigger de setup.sql normalmente ya crea estos registros.
  select tenant_id
    into v_tenant_id
    from public.profiles
    where id = v_user_id;

  if v_tenant_id is null then
    insert into public.tenants (
      name,
      plan,
      subscription_status,
      store_limit
    ) values (
      v_business_name,
      'business',
      'active',
      5
    ) returning id into v_tenant_id;

    insert into public.profiles (
      id,
      tenant_id,
      role,
      full_name,
      first_name,
      last_name,
      is_administrator
    ) values (
      v_user_id,
      v_tenant_id,
      'admin',
      'Carmen Sandoval',
      'Carmen',
      'Sandoval',
      true
    );
  else
    update public.profiles
      set role = 'admin',
          full_name = 'Carmen Sandoval',
          first_name = 'Carmen',
          last_name = 'Sandoval',
          is_administrator = true
      where id = v_user_id;
  end if;

  update public.tenants
    set name = v_business_name,
        plan = 'business',
        subscription_status = 'active',
        store_limit = 5
    where id = v_tenant_id;
end
$$;

commit;

-- Verificacion: debe devolver una fila con el negocio y rol correctos.
select
  u.email,
  t.name as negocio,
  p.role,
  t.plan,
  t.subscription_status
from auth.users u
join public.profiles p on p.id = u.id
join public.tenants t on t.id = p.tenant_id
where lower(u.email) = lower('sandoval.carmen2@gmail.com');
