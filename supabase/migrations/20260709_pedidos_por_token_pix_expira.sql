-- Inclui pix_expira_em no retorno de pagamentos em pedidos_por_token (tela de operação).
-- IMPORTANTE: preserva todos os campos operacionais (regressão corrigida).

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
  IF auth.uid() IS NULL OR NOT public.can_access_cozinha(auth.uid()) THEN
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
