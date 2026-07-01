-- Etapa de produção (fulfillment_stage), separada do status de pagamento.

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS fulfillment_stage text CHECK (
    fulfillment_stage IS NULL
    OR fulfillment_stage IN ('confirmado', 'em_preparo', 'pronto', 'finalizado')
  ),
  ADD COLUMN IF NOT EXISTS fulfillment_stage_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_pedidos_fulfillment_stage ON pedidos (fulfillment_stage)
  WHERE archived_at IS NULL;

-- Backfill conservador: pedidos aprovados e não arquivados começam em "confirmado".
UPDATE pedidos
SET fulfillment_stage = 'confirmado',
    fulfillment_stage_at = COALESCE(payment_confirmed_at, criado_em)
WHERE fulfillment_stage IS NULL
  AND payment_status_normalized = 'aprovado'
  AND archived_at IS NULL;

-- pedidos_por_token: incluir fulfillment_stage / _at no retorno (para a cozinha ler também).
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
    SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY COALESCE(t.execution_at, t.criado_em) ASC), '[]'::jsonb)
    FROM (
      SELECT
        p.id, p.criado_em, p.cliente_nome, p.cliente_whatsapp, p.cliente_cpf, p.cliente_email,
        p.cesta, p.sobremesas, p.tipo, p.endereco_ou_unidade, p.data_entrega, p.horario,
        p.pagamento, p.total, p.status, p.campanha_id,
        p.recipient_name, p.recipient_phone, p.recipient_is_buyer,
        p.unidade_id, p.production_sector, p.execution_at,
        p.payment_status_raw, p.payment_status_normalized, p.payment_confirmed_at,
        p.is_test, p.archived_at, p.archived_by, p.conciliacao_pendente,
        p.fulfillment_stage, p.fulfillment_stage_at,
        coalesce(
          (SELECT jsonb_agg(jsonb_build_object(
            'id', pg.id, 'asaas_payment_id', pg.asaas_payment_id, 'metodo', pg.metodo,
            'status', pg.status, 'valor', pg.valor, 'cupom_codigo', pg.cupom_codigo,
            'cupom_desconto', pg.cupom_desconto, 'cartao_brand', pg.cartao_brand,
            'cartao_last4', pg.cartao_last4, 'criado_em', pg.criado_em
          ) ORDER BY pg.criado_em DESC)
          FROM pagamentos pg WHERE pg.pedido_id = p.id
        ), '[]'::jsonb) AS pagamentos
      FROM pedidos p
      WHERE (v_campanha IS NULL OR p.campanha_id = v_campanha)
      ORDER BY COALESCE(p.execution_at, p.criado_em) ASC
      LIMIT 500
    ) t
  );
END $$;

REVOKE ALL ON FUNCTION pedidos_por_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pedidos_por_token(text, text) TO anon, authenticated;
