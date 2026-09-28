-- Registra el metodo de pago de cada venta sin romper clientes que todavia
-- usan la firma create_sale(jsonb).
create type public.payment_method as enum ('cash', 'card');

alter table public.sales
  add column payment_method public.payment_method not null default 'cash';

create or replace function public.create_sale(
  p_items jsonb,
  p_payment_method public.payment_method
)
returns uuid
language plpgsql
security definer
set search_path = public
set lock_timeout = '5s'
set statement_timeout = '15s'
as $$
declare
  v_sale uuid;
begin
  v_sale := public.create_sale(p_items);

  update public.sales
    set payment_method = p_payment_method
    where id = v_sale
      and tenant_id = public.current_tenant_id()
      and cashier_id = auth.uid();

  if not found then
    raise exception 'No se pudo asignar el metodo de pago';
  end if;

  return v_sale;
end;
$$;

grant execute on function public.create_sale(jsonb, public.payment_method) to authenticated;
