-- Adiciona campanha_id em pedidos e share_tokens para rastrear pedidos por campanha.

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS campanha_id text;
ALTER TABLE share_tokens ADD COLUMN IF NOT EXISTS campanha_id text;

-- Recria upsert_pedido_rascunho com suporte a campanha_id no payload.
DROP FUNCTION IF EXISTS upsert_pedido_rascunho(uuid, jsonb);

CREATE OR REPLACE FUNCTION upsert_pedido_rascunho(_pedido_id uuid, _payload jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF _pedido_id IS NOT NULL THEN
    UPDATE pedidos SET
      cliente_nome        = _payload->>'cliente_nome',
      cliente_whatsapp    = _payload->>'cliente_whatsapp',
      cesta               = _payload->'cesta',
      sobremesas          = _payload->'sobremesas',
      tipo                = _payload->>'tipo',
      endereco_ou_unidade = _payload->>'endereco_ou_unidade',
      data_entrega        = NULLIF(_payload->>'data_entrega', ''),
      horario             = NULLIF(_payload->>'horario', ''),
      pagamento           = _payload->'pagamento',
      total               = (_payload->>'total')::numeric,
      status              = _payload->>'status',
      campanha_id         = NULLIF(_payload->>'campanha_id', '')
    WHERE id = _pedido_id
    RETURNING id INTO v_id;
    RETURN COALESCE(v_id, _pedido_id);
  ELSE
    INSERT INTO pedidos (
      cliente_nome, cliente_whatsapp, cesta, sobremesas, tipo,
      endereco_ou_unidade, data_entrega, horario, pagamento, total, status, campanha_id
    ) VALUES (
      _payload->>'cliente_nome',
      _payload->>'cliente_whatsapp',
      _payload->'cesta',
      _payload->'sobremesas',
      _payload->>'tipo',
      _payload->>'endereco_ou_unidade',
      NULLIF(_payload->>'data_entrega', ''),
      NULLIF(_payload->>'horario', ''),
      _payload->'pagamento',
      (_payload->>'total')::numeric,
      _payload->>'status',
      NULLIF(_payload->>'campanha_id', '')
    ) RETURNING id INTO v_id;
    RETURN v_id;
  END IF;
END $$;

REVOKE ALL ON FUNCTION upsert_pedido_rascunho(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_pedido_rascunho(uuid, jsonb) TO anon, authenticated;

-- Recria pedidos_por_token filtrando por campanha_id do token (se definido).
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
