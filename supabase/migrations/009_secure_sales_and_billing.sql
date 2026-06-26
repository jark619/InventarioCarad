-- Refuerza integridad de ventas y sincronizacion de limites por plan.

create or replace function public.plan_store_limit(p_plan text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_plan
    when 'business' then 5
    else 1
  end;
$$;

-- La venta usa el precio de la base de datos como fuente de verdad. El precio
-- enviado por cliente se ignora para evitar tickets manipulados.
create or replace function public.create_sale(p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_tenant_id();
  v_sale uuid;
  v_item jsonb;
  v_product public.products;
  v_qty integer;
  v_total numeric := 0;
begin
  if v_tenant is null or not public.has_role(array['admin','cashier']::public.app_role[]) then
    raise exception 'No autorizado';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;

    select *
      into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid
        and tenant_id = v_tenant
      for update;

    if not found then
      raise exception 'Producto invalido';
    end if;

    if not v_product.is_active then
      raise exception 'Producto retirado';
    end if;

    if v_qty < 1 or v_product.quantity < v_qty then
      raise exception 'Stock insuficiente para %', v_product.name;
    end if;

    v_total := v_total + v_qty * v_product.price;

    update public.products
      set quantity = quantity - v_qty,
          updated_at = now()
      where id = v_product.id;
  end loop;

  insert into public.sales(tenant_id, cashier_id, total)
    values(v_tenant, auth.uid(), v_total)
    returning id into v_sale;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;

    select *
      into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid
        and tenant_id = v_tenant;

    insert into public.sale_items(sale_id, product_id, quantity, unit_price)
      values(v_sale, v_product.id, v_qty, v_product.price);
  end loop;

  return v_sale;
end;
$$;

grant execute on function public.create_sale(jsonb) to authenticated;

-- Alinea tenants existentes por si el plan fue cambiado antes de esta migracion.
update public.tenants
  set store_limit = public.plan_store_limit(plan)
  where store_limit is distinct from public.plan_store_limit(plan);
