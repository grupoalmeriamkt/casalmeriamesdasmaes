-- Ordena pedidos_por_token por data de criação: mais recente primeiro

DROP FUNCTION IF EXISTS pedidos_por_token(text, text);

CREATE OR REPLACE FUNCTION pedidos_por_token(_token text, _senha text DEFAULT null)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_senha     text;
  v_campanha  text;
BEGIN
  SELECT senha, campanha_id INTO v_senha, v_campanha
  FROM share_tokens
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
      WHERE (v_campanha IS NULL OR p.campanha_id = v_campanha)
      ORDER BY p.criado_em DESC
      LIMIT 500
    ) t
  );
END $$;

REVOKE ALL ON FUNCTION pedidos_por_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pedidos_por_token(text, text) TO anon, authenticated;
