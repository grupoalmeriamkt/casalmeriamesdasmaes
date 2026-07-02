-- Fase 1 do modulo de pedido manual.
-- Idempotente: pode ser reaplicada sem erro.

-- 1) Operadores (perfil vinculado ao login)
create table if not exists operators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  short_name text,
  email text,
  phone text,
  role_title text,
  internal_key text,
  pin_hash text,
  is_active boolean not null default true,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists operators_user_id_key
  on operators(user_id) where user_id is not null;
create unique index if not exists operators_internal_key_key
  on operators(internal_key) where internal_key is not null;
create index if not exists idx_operators_is_active on operators(is_active);

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_operators_updated on operators;
create trigger trg_operators_updated before update on operators
  for each row execute function set_updated_at();

alter table operators enable row level security;

drop policy if exists operators_admin_all on operators;
create policy operators_admin_all on operators
  for all to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

drop policy if exists operators_self_read on operators;
create policy operators_self_read on operators
  for select to authenticated
  using (user_id = auth.uid());

-- 2) pedidos: origem e operador
alter table pedidos add column if not exists origin text not null default 'publico';
alter table pedidos drop constraint if exists pedidos_origin_check;
alter table pedidos add constraint pedidos_origin_check
  check (origin in ('publico','manual','importado'));
alter table pedidos add column if not exists operator_id uuid
  references operators(id) on delete set null;
create index if not exists idx_pedidos_origin_manual
  on pedidos(origin) where origin = 'manual';

-- 3) pagamentos: link do Asaas e metodo nullable
alter table pagamentos add column if not exists invoice_url text;
alter table pagamentos alter column metodo drop not null;
alter table pagamentos drop constraint if exists pagamentos_metodo_check;
alter table pagamentos add constraint pagamentos_metodo_check
  check (metodo is null or metodo in ('PIX','CREDIT_CARD','BOLETO'));
