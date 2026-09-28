-- Cada tenant conserva su propia credencial de Mercado Pago cifrada por el
-- backend. No se crean politicas: solo el service role puede leer o escribir.
create table public.mercado_pago_credentials (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  access_token_ciphertext text not null,
  token_hint text not null check (char_length(token_hint) between 4 and 8),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mercado_pago_credentials enable row level security;
revoke all on table public.mercado_pago_credentials from anon, authenticated;

create or replace function public.clear_tenant_point_terminal_on_credential_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  v_tenant_id := case when tg_op = 'DELETE' then old.tenant_id else new.tenant_id end;

  update public.tenants
    set mercado_pago_terminal_id = null,
        mercado_pago_terminal_mode = null,
        mercado_pago_terminal_synced_at = null
    where id = v_tenant_id;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger mercado_pago_credentials_clear_terminal
  after insert or update or delete on public.mercado_pago_credentials
  for each row execute function public.clear_tenant_point_terminal_on_credential_change();
