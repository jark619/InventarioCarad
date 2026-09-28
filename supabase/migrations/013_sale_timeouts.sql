-- Evita que el cobro espere indefinidamente cuando otra transaccion mantiene
-- bloqueada una fila de inventario o una consulta tarda demasiado.
alter function public.create_sale(jsonb)
  set lock_timeout = '5s';

alter function public.create_sale(jsonb)
  set statement_timeout = '15s';

grant execute on function public.create_sale(jsonb) to authenticated;

