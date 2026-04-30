-- share_tokens: tokens públicos para acesso à tela da cozinha (pedidos/$token)

create table if not exists share_tokens (
  token      text        primary key,
  scope      text        not null,
  senha      text,
  criado_em  timestamptz not null default now()
);

alter table share_tokens enable row level security;

drop policy if exists "share_tokens_admin_all" on share_tokens;
create policy "share_tokens_admin_all" on share_tokens for all using (
  exists (select 1 from user_roles where user_id = auth.uid() and role::text = 'admin')
) with check (
  exists (select 1 from user_roles where user_id = auth.uid() and role::text = 'admin')
);

-- Verifica se o token exige senha (usado pelo gate público da cozinha)
create or replace function token_requer_senha(_token text)
returns boolean
language sql security definer set search_path = public as $$
  select coalesce(
    (select senha is not null from share_tokens where token = _token and scope = 'pedidos'),
    false
  );
$$;
revoke all on function token_requer_senha(text) from public;
grant execute on function token_requer_senha(text) to anon, authenticated;

-- Valida a senha de um token (retorna true se correta ou se token não tem senha)
create or replace function validar_token_pedidos(_token text, _senha text)
returns boolean
language sql security definer set search_path = public as $$
  select exists (
    select 1 from share_tokens
    where token = _token
      and scope = 'pedidos'
      and (senha is null or senha = _senha)
  );
$$;
revoke all on function validar_token_pedidos(text, text) from public;
grant execute on function validar_token_pedidos(text, text) to anon, authenticated;

-- Retorna pedidos (com pagamentos aninhados) para um token válido
drop function if exists pedidos_por_token(text, text);
create or replace function pedidos_por_token(_token text, _senha text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_senha text;
begin
  -- Valida token
  select senha into v_senha
  from share_tokens
  where token = _token and scope = 'pedidos';

  if not found then
    return '[]'::jsonb;
  end if;

  -- Valida senha se necessário
  if v_senha is not null then
    if _senha is null or _senha <> v_senha then
      return '[]'::jsonb;
    end if;
  end if;

  return (
    select coalesce(jsonb_agg(to_jsonb(t) order by t.criado_em desc), '[]'::jsonb)
    from (
      select
        p.id,
        p.criado_em,
        p.cliente_nome,
        p.cliente_whatsapp,
        p.cliente_cpf,
        p.cliente_email,
        p.cesta,
        p.sobremesas,
        p.tipo,
        p.endereco_ou_unidade,
        p.data_entrega,
        p.horario,
        p.pagamento,
        p.total,
        p.status,
        coalesce(
          (select jsonb_agg(jsonb_build_object(
            'id', pg.id,
            'asaas_payment_id', pg.asaas_payment_id,
            'metodo', pg.metodo,
            'status', pg.status,
            'valor', pg.valor,
            'cupom_codigo', pg.cupom_codigo,
            'cupom_desconto', pg.cupom_desconto,
            'cartao_brand', pg.cartao_brand,
            'cartao_last4', pg.cartao_last4,
            'criado_em', pg.criado_em
          ) order by pg.criado_em desc)
          from pagamentos pg where pg.pedido_id = p.id
        ), '[]'::jsonb) as pagamentos
      from pedidos p
      order by p.criado_em desc
      limit 500
    ) t
  );
end $$;
revoke all on function pedidos_por_token(text, text) from public;
grant execute on function pedidos_por_token(text, text) to anon, authenticated;
