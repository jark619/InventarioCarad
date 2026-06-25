-- Permite reutilizar codigos de barras de productos retirados sin perder historial.
alter table public.products
  drop constraint if exists products_tenant_id_barcode_key;

drop index if exists products_tenant_barcode_active_key;

create unique index products_tenant_barcode_active_key
  on public.products (tenant_id, barcode)
  where is_active and barcode is not null;

create index if not exists products_tenant_active_barcode_idx
  on public.products (tenant_id, is_active, barcode);
