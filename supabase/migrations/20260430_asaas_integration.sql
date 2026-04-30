-- Asaas integration: app_secrets, cupons, pagamentos, webhooks

-- Tabela de segredos (admin-only). Criada aqui pois o projeto referencia mas nunca foi migrada.
create table if not exists app_secrets (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);
alter table app_secrets enable row level security;

drop policy if exists "app_secrets_admin_all" on app_secrets;
create policy "app_secrets_admin_all" on app_secrets for all using (
  exists (select 1 from user_roles where user_id = auth.uid() and role::text = 'admin')
) with check (
  exists (select 1 from user_roles where user_id = auth.uid() and role::text = 'admin')
);

alter table pedidos
  add column if not exists cliente_cpf text,
  add column if not exists cliente_email text;

create table if not exists cupons (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  tipo text not null check (tipo in ('percentual','fixo')),
  valor numeric(10,2) not null check (valor > 0),
  ativo boolean not null default true,
  validade timestamptz,
  uso_max integer,
  uso_atual integer not null default 0,
  valor_minimo numeric(10,2),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_cupons_codigo on cupons(lower(codigo));

create table if not exists pagamentos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  asaas_payment_id text unique not null,
  asaas_customer_id text not null,
  metodo text not null check (metodo in ('PIX','CREDIT_CARD','BOLETO')),
  status text not null,
  valor numeric(10,2) not null,
  cupom_codigo text,
  cupom_desconto numeric(10,2),
  pix_qrcode_payload text,
  pix_qrcode_image text,
  pix_expira_em timestamptz,
  cartao_last4 text,
  cartao_brand text,
  cartao_token text,
  raw_response jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_pagamentos_pedido on pagamentos(pedido_id);
create index if not exists idx_pagamentos_status on pagamentos(status);

create table if not exists asaas_webhook_events (
  id uuid primary key default gen_random_uuid(),
  asaas_event_id text unique,
  event text not null,
  payment_id text,
  payload jsonb not null,
  processado boolean not null default false,
  erro text,
  recebido_em timestamptz not null default now(),
  processado_em timestamptz
);
create index if not exists idx_webhook_payment on asaas_webhook_events(payment_id);
create index if not exists idx_webhook_pendente on asaas_webhook_events(processado) where processado = false;

create or replace function set_atualizado_em() returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;

drop trigger if exists trg_pagamentos_atualizado on pagamentos;
create trigger trg_pagamentos_atualizado before update on pagamentos
  for each row execute function set_atualizado_em();

drop trigger if exists trg_cupons_atualizado on cupons;
create trigger trg_cupons_atualizado before update on cupons
  for each row execute function set_atualizado_em();

alter table pagamentos enable row level security;
alter table asaas_webhook_events enable row level security;
alter table cupons enable row level security;

drop policy if exists "pagamentos_admin_read" on pagamentos;
create policy "pagamentos_admin_read" on pagamentos for select using (
  exists (select 1 from user_roles where user_id = auth.uid() and role::text = 'admin')
);

drop policy if exists "webhook_admin_read" on asaas_webhook_events;
create policy "webhook_admin_read" on asaas_webhook_events for select using (
  exists (select 1 from user_roles where user_id = auth.uid() and role::text = 'admin')
);

drop policy if exists "cupons_admin_all" on cupons;
create policy "cupons_admin_all" on cupons for all using (
  exists (select 1 from user_roles where user_id = auth.uid() and role::text = 'admin')
) with check (
  exists (select 1 from user_roles where user_id = auth.uid() and role::text = 'admin')
);

create or replace function validar_cupom(_codigo text, _valor numeric)
returns table(valido boolean, motivo text, desconto numeric, codigo text)
language plpgsql security definer set search_path = public as $$
declare c cupons%rowtype;
begin
  select * into c from cupons where lower(codigo) = lower(_codigo) limit 1;
  if not found then
    return query select false, 'Cupom não encontrado'::text, 0::numeric, _codigo; return;
  end if;
  if not c.ativo then
    return query select false, 'Cupom inativo'::text, 0::numeric, c.codigo; return;
  end if;
  if c.validade is not null and c.validade < now() then
    return query select false, 'Cupom expirado'::text, 0::numeric, c.codigo; return;
  end if;
  if c.uso_max is not null and c.uso_atual >= c.uso_max then
    return query select false, 'Cupom esgotado'::text, 0::numeric, c.codigo; return;
  end if;
  if c.valor_minimo is not null and _valor < c.valor_minimo then
    return query select false, ('Valor mínimo '||c.valor_minimo)::text, 0::numeric, c.codigo; return;
  end if;
  if c.tipo = 'percentual' then
    return query select true, 'ok'::text, round((_valor * c.valor / 100)::numeric, 2), c.codigo;
  else
    return query select true, 'ok'::text, least(c.valor, _valor), c.codigo;
  end if;
end $$;
revoke all on function validar_cupom(text, numeric) from public;
grant execute on function validar_cupom(text, numeric) to anon, authenticated;

create or replace function pagamento_status(_pagamento_id uuid)
returns table(status text, metodo text, atualizado_em timestamptz, pedido_id uuid)
language sql security definer set search_path = public as $$
  select status, metodo, atualizado_em, pedido_id from pagamentos where id = _pagamento_id;
$$;
revoke all on function pagamento_status(uuid) from public;
grant execute on function pagamento_status(uuid) to anon, authenticated;

create or replace function incrementar_uso_cupom(_codigo text)
returns void language sql security definer set search_path = public as $$
  update cupons set uso_atual = uso_atual + 1 where lower(codigo) = lower(_codigo);
$$;
revoke all on function incrementar_uso_cupom(text) from public;

insert into cupons (codigo, tipo, valor, ativo) values ('ALMERIA10','percentual',10,true)
on conflict (codigo) do nothing;

-- Garante registro 'default' em app_secrets, preservando chaves existentes
insert into app_secrets (id, payload)
values ('default', jsonb_build_object('asaasApiKey','','asaasWalletId','','asaasWebhookToken',''))
on conflict (id) do update
set payload = app_secrets.payload || jsonb_build_object(
  'asaasApiKey', coalesce(app_secrets.payload->>'asaasApiKey',''),
  'asaasWalletId', coalesce(app_secrets.payload->>'asaasWalletId',''),
  'asaasWebhookToken', coalesce(app_secrets.payload->>'asaasWebhookToken','')
);
