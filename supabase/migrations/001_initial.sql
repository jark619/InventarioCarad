-- Ejecutar en Supabase SQL Editor. Cada consulta se aísla por tenant mediante RLS.
create extension if not exists "uuid-ossp";
create type public.app_role as enum ('admin', 'inventory', 'cashier');
create table public.tenants (id uuid primary key default uuid_generate_v4(), name text not null, logo_url text, created_at timestamptz not null default now());
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, tenant_id uuid not null references public.tenants(id) on delete cascade, role public.app_role not null default 'cashier', full_name text, created_at timestamptz not null default now());
create table public.products (id uuid primary key default uuid_generate_v4(), tenant_id uuid not null references public.tenants(id) on delete cascade, name text not null, barcode text, quantity integer not null default 0 check (quantity >= 0), category text, image_url text, price numeric(12,2) not null default 0 check (price >= 0), low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (tenant_id, barcode));
create table public.sales (id uuid primary key default uuid_generate_v4(), tenant_id uuid not null references public.tenants(id), cashier_id uuid not null references auth.users(id), total numeric(12,2) not null, created_at timestamptz not null default now());
create table public.sale_items (id uuid primary key default uuid_generate_v4(), sale_id uuid not null references public.sales(id) on delete cascade, product_id uuid not null references public.products(id), quantity integer not null check(quantity > 0), unit_price numeric(12,2) not null check(unit_price >= 0));
create index products_tenant_barcode_idx on public.products(tenant_id, barcode); create index sales_tenant_created_idx on public.sales(tenant_id, created_at desc);

create or replace function public.current_tenant_id() returns uuid language sql stable security definer set search_path = public as $$ select tenant_id from public.profiles where id = auth.uid() $$;
create or replace function public.has_role(roles public.app_role[]) returns boolean language sql stable security definer set search_path = public as $$ select role = any(roles) from public.profiles where id = auth.uid() $$;
create or replace function public.assign_product_tenant() returns trigger language plpgsql security definer set search_path = public as $$ begin new.tenant_id := public.current_tenant_id(); if new.tenant_id is null then raise exception 'Usuario sin tienda'; end if; return new; end; $$;
create trigger assign_product_tenant before insert on public.products for each row execute function public.assign_product_tenant();
alter table public.tenants enable row level security; alter table public.profiles enable row level security; alter table public.products enable row level security; alter table public.sales enable row level security; alter table public.sale_items enable row level security;
create policy "read own tenant" on public.tenants for select using (id = public.current_tenant_id());
create policy "read own profile" on public.profiles for select using (id = auth.uid());
create policy "read products in tenant" on public.products for select using (tenant_id = public.current_tenant_id());
create policy "manage products" on public.products for all using (tenant_id = public.current_tenant_id() and public.has_role(array['admin','inventory']::public.app_role[])) with check (tenant_id = public.current_tenant_id() and public.has_role(array['admin','inventory']::public.app_role[]));
create policy "read tenant sales" on public.sales for select using (tenant_id = public.current_tenant_id());
create policy "read tenant sale items" on public.sale_items for select using (exists (select 1 from public.sales s where s.id = sale_id and s.tenant_id = public.current_tenant_id()));

-- Esta RPC garantiza transacción, bloqueo de filas y descuento atómico de inventario.
create or replace function public.create_sale(p_items jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare v_tenant uuid := public.current_tenant_id(); v_sale uuid; v_item jsonb; v_product public.products; v_qty integer; v_price numeric; v_total numeric := 0;
begin
 if v_tenant is null or not public.has_role(array['admin','cashier']::public.app_role[]) then raise exception 'No autorizado'; end if;
 if jsonb_array_length(p_items)=0 then raise exception 'La venta no tiene productos'; end if;
 for v_item in select * from jsonb_array_elements(p_items) loop
   v_qty := (v_item->>'quantity')::integer;
   select * into v_product from public.products where id=(v_item->>'product_id')::uuid and tenant_id=v_tenant for update;
   if not found then raise exception 'Producto inválido'; end if;
   if v_qty < 1 or v_product.quantity < v_qty then raise exception 'Stock insuficiente para %', v_product.name; end if;
   v_price := (v_item->>'unit_price')::numeric; v_total := v_total + v_qty*v_price;
   update public.products set quantity=quantity-v_qty, updated_at=now() where id=v_product.id;
 end loop;
 insert into public.sales(tenant_id,cashier_id,total) values(v_tenant,auth.uid(),v_total) returning id into v_sale;
 for v_item in select * from jsonb_array_elements(p_items) loop
  insert into public.sale_items(sale_id,product_id,quantity,unit_price) values(v_sale,(v_item->>'product_id')::uuid,(v_item->>'quantity')::integer,(v_item->>'unit_price')::numeric);
 end loop;
 return v_sale;
end; $$;
grant execute on function public.create_sale(jsonb) to authenticated;

-- Bucket público: la URL se guarda en products.image_url. Solo roles que administran
-- inventario pueden cargar; en producción añade límite de tamaño desde el dashboard.
insert into storage.buckets(id, name, public) values ('product-images', 'product-images', true) on conflict (id) do nothing;
create policy "inventory uploads images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.has_role(array['admin','inventory']::public.app_role[]));
create policy "public reads images" on storage.objects for select using (bucket_id = 'product-images');

create view public.sales_report with (security_invoker = true) as
 select p.tenant_id,p.id,p.name,p.quantity,p.low_stock_threshold,coalesce(sum(si.quantity),0) units_sold
 from public.products p left join public.sale_items si on si.product_id=p.id group by p.tenant_id,p.id,p.name,p.quantity,p.low_stock_threshold;
