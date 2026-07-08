-- Módulo Operação Restrita: acesso limitado a um token de pedidos,
-- somente pedidos aprovados, arquivar e criar pedido manual.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'cozinha', 'operacao');
  ELSE
    BEGIN
      ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operacao';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Token do portal (único; administrável pelo admin)
CREATE TABLE IF NOT EXISTS public.operacao_portal (
  id           int  PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  share_token  text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.operacao_portal (share_token)
VALUES ('eb18ba2c5d29e3784d5145b95e57d9e3')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.operacao_portal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operacao_portal_admin" ON public.operacao_portal;
CREATE POLICY "operacao_portal_admin" ON public.operacao_portal
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'admin')
  );

DROP POLICY IF EXISTS "operacao_portal_read_authenticated" ON public.operacao_portal;
CREATE POLICY "operacao_portal_read_authenticated" ON public.operacao_portal
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ── Helpers ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_access_operacao(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'operacao');
$$;

REVOKE ALL ON FUNCTION public.can_access_operacao(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_operacao(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.operacao_token_portal()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.can_access_operacao(auth.uid())
  ) THEN
    RETURN NULL;
  END IF;

  SELECT share_token INTO v_token FROM public.operacao_portal WHERE id = 1;
  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.operacao_token_portal() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operacao_token_portal() TO authenticated;

CREATE OR REPLACE FUNCTION public.can_access_pedidos_token(_user_id uuid, _token text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_portal text;
BEGIN
  IF public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'cozinha') THEN
    RETURN TRUE;
  END IF;

  IF NOT public.can_access_operacao(_user_id) THEN
    RETURN FALSE;
  END IF;

  SELECT share_token INTO v_portal FROM public.operacao_portal WHERE id = 1;
  RETURN v_portal IS NOT NULL AND v_portal = _token;
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_pedidos_token(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_pedidos_token(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.listar_usuarios_operacao()
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
  WHERE ur.role::text = 'operacao'
  ORDER BY ur.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_usuarios_operacao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_usuarios_operacao() TO authenticated;

-- pedidos_por_token: operação restrita só no token do portal
CREATE OR REPLACE FUNCTION public.pedidos_por_token(_token text, _senha text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_senha    text;
  v_campanha text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_access_pedidos_token(auth.uid(), _token) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT senha, campanha_id INTO v_senha, v_campanha
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
        p.campanha_id,
        p.recipient_name,
        p.recipient_phone,
        p.recipient_is_buyer,
        p.unidade_id,
        p.production_sector,
        p.execution_at,
        p.payment_status_raw,
        p.payment_status_normalized,
        p.payment_confirmed_at,
        p.is_test,
        p.archived_at,
        p.archived_by,
        p.conciliacao_pendente,
        p.fulfillment_stage,
        p.fulfillment_stage_at,
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
            'pix_expira_em', pg.pix_expira_em,
            'criado_em', pg.criado_em
          ) ORDER BY pg.criado_em DESC)
          FROM pagamentos pg WHERE pg.pedido_id = p.id
        ), '[]'::jsonb) AS pagamentos
      FROM pedidos p
      WHERE (v_campanha IS NULL OR p.campanha_id = v_campanha)
      ORDER BY p.criado_em DESC
      LIMIT 500
    ) t
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pedidos_por_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pedidos_por_token(text, text) TO authenticated;
