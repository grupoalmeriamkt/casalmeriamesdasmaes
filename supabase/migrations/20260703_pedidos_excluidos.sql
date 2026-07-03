-- supabase/migrations/20260703_pedidos_excluidos.sql
create table if not exists public.pedidos_excluidos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null,
  pedido_snapshot jsonb not null,
  motivo text not null,
  excluido_por text,
  excluido_em timestamptz not null default now()
);
alter table public.pedidos_excluidos enable row level security;
-- sem policies para anon/authenticated: acesso só via service_role (endpoints admin)
