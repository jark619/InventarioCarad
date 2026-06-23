-- Ejecutar despues de 001_initial.sql y 002_billing.sql.
-- Activa la cuenta existente jark619@gmail.com como demo con acceso completo.
do $$
declare
  v_user_id uuid;
  v_tenant_id uuid;
begin
  select id into v_user_id from auth.users where email = 'jark619@gmail.com';
  if v_user_id is null then
    raise exception 'No existe el usuario jark619@gmail.com en Supabase Auth';
  end if;

  select id into v_tenant_id from public.profiles where id = v_user_id;
  if v_tenant_id is null then
    insert into public.tenants (name, plan, subscription_status)
    values ('Tienda Demo Jark', 'business', 'active')
    returning id into v_tenant_id;

    insert into public.profiles (id, tenant_id, role, full_name)
    values (v_user_id, v_tenant_id, 'admin', 'Jark Demo');
  else
    update public.tenants
    set plan = 'business', subscription_status = 'active'
    where id = v_tenant_id;
  end if;
end $$;
