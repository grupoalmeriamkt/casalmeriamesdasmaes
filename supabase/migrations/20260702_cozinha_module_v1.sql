-- Módulo Cozinha v1: role dedicada, portal autenticado e lockdown do link público

-- ── Enum app_role (cria se não existir; adiciona 'cozinha') ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'cozinha');
  ELSE
    BEGIN
      ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cozinha';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- ── Tabela user_roles (caso ainda não exista no projeto remoto) ───────────────
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_admin_read" ON public.user_roles;
CREATE POLICY "user_roles_admin_read" ON public.user_roles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'admin')
  );

DROP POLICY IF EXISTS "user_roles_admin_write" ON public.user_roles;
CREATE POLICY "user_roles_admin_write" ON public.user_roles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'admin')
  );

-- Usuário cozinha pode ver a própria role
DROP POLICY IF EXISTS "user_roles_self_read" ON public.user_roles;
CREATE POLICY "user_roles_self_read" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

-- ── Helpers de role ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = _role
  );
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.can_access_cozinha(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'cozinha');
$$;

REVOKE ALL ON FUNCTION public.can_access_cozinha(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_cozinha(uuid) TO authenticated;

-- Token geral para o módulo cozinha (sem expor na UI admin)
CREATE OR REPLACE FUNCTION public.cozinha_token_geral()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_access_cozinha(auth.uid()) THEN
    RETURN NULL;
  END IF;

  SELECT token INTO v_token
  FROM public.share_tokens
  WHERE scope = 'pedidos' AND campanha_id IS NULL
  ORDER BY criado_em ASC
  LIMIT 1;

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.cozinha_token_geral() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cozinha_token_geral() TO authenticated;

-- Lista usuários da cozinha (somente admin)
CREATE OR REPLACE FUNCTION public.listar_usuarios_cozinha()
RETURNS TABLE (
  user_id    uuid,
  email      text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT ur.user_id, u.email::text, ur.created_at
  FROM public.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  WHERE ur.role::text = 'cozinha'
  ORDER BY ur.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_usuarios_cozinha() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_usuarios_cozinha() TO authenticated;

-- ── Lockdown: pedidos_por_token exige usuário cozinha ou admin ──────────────
CREATE OR REPLACE FUNCTION public.pedidos_por_token(_token text, _senha text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_senha text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_access_cozinha(auth.uid()) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT senha INTO v_senha
  FROM public.share_tokens
  WHERE token = _token AND scope = 'pedidos';

  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  IF v_senha IS NOT NULL THEN
    IF _senha IS NULL OR _senha <> v_senha THEN
      RETURN '[]'::jsonb;
    END IF;
  END IF;

  RETURN (
    SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.criado_em DESC), '[]'::jsonb)
    FROM (
      SELECT
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
          (SELECT jsonb_agg(jsonb_build_object(
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
          ) ORDER BY pg.criado_em DESC)
          FROM pagamentos pg WHERE pg.pedido_id = p.id
        ), '[]'::jsonb) AS pagamentos
      FROM pedidos p
      ORDER BY p.criado_em DESC
      LIMIT 500
    ) t
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pedidos_por_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pedidos_por_token(text, text) TO authenticated;
