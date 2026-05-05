-- Recria upsert_pedido_rascunho: quando _pedido_id é null, SEMPRE insere novo pedido.
-- Correção: a versão anterior usava upsert com conflict em CPF, causando
-- o segundo pedido do mesmo cliente a sobrescrever o primeiro em vez de criar novo.

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
      data_entrega        = NULLIF(_payload->>'data_entrega', '')::date,
      horario             = NULLIF(_payload->>'horario', ''),
      pagamento           = _payload->'pagamento',
      total               = (_payload->>'total')::numeric,
      status              = _payload->>'status'
    WHERE id = _pedido_id
    RETURNING id INTO v_id;
    RETURN COALESCE(v_id, _pedido_id);
  ELSE
    INSERT INTO pedidos (
      cliente_nome, cliente_whatsapp, cesta, sobremesas, tipo,
      endereco_ou_unidade, data_entrega, horario, pagamento, total, status
    ) VALUES (
      _payload->>'cliente_nome',
      _payload->>'cliente_whatsapp',
      _payload->'cesta',
      _payload->'sobremesas',
      _payload->>'tipo',
      _payload->>'endereco_ou_unidade',
      NULLIF(_payload->>'data_entrega', '')::date,
      NULLIF(_payload->>'horario', ''),
      _payload->'pagamento',
      (_payload->>'total')::numeric,
      _payload->>'status'
    ) RETURNING id INTO v_id;
    RETURN v_id;
  END IF;
END $$;

REVOKE ALL ON FUNCTION upsert_pedido_rascunho(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_pedido_rascunho(uuid, jsonb) TO anon, authenticated;
