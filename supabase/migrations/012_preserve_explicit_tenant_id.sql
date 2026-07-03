create or replace function public.assign_current_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.tenant_id = coalesce(new.tenant_id, public.current_tenant_id());

  if new.tenant_id is null then
    raise exception 'Usuario sin tienda';
  end if;

  return new;
end;
$$;
