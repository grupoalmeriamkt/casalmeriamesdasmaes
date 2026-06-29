-- Operação de pedidos v1: destinatário, setor, execução, arquivamento, conciliação, regras de produto

-- ── Colunas operacionais em pedidos ─────────────────────────────────────────
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS recipient_phone text,
  ADD COLUMN IF NOT EXISTS recipient_is_buyer boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS unidade_id text,
  ADD COLUMN IF NOT EXISTS production_sector text CHECK (
    production_sector IS NULL OR production_sector IN ('CONFEITARIA', 'PADARIA', 'COZINHA')
  ),
  ADD COLUMN IF NOT EXISTS execution_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_status_raw text,
  ADD COLUMN IF NOT EXISTS payment_status_normalized text,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by text,
  ADD COLUMN IF NOT EXISTS conciliacao_pendente boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pedidos_execution_at ON pedidos (execution_at);
CREATE INDEX IF NOT EXISTS idx_pedidos_archived_at ON pedidos (archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_operacional ON pedidos (payment_status_normalized, execution_at)
  WHERE archived_at IS NULL AND is_test = false;

-- ── Regras de produção por produto ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS produto_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id text NOT NULL,
  produto_tipo text NOT NULL CHECK (produto_tipo IN ('cesta', 'sobremesa')),
  production_sector text NOT NULL CHECK (production_sector IN ('CONFEITARIA', 'PADARIA', 'COZINHA')),
  minimum_lead_time_hours integer NOT NULL DEFAULT 24,
  same_day_allowed boolean NOT NULL DEFAULT false,
  allowed_fulfillment_modes text[] NOT NULL DEFAULT ARRAY['delivery', 'retirada'],
  allowed_unit_ids text[],
  cutoff_time time,
  monday_first_slot time NOT NULL DEFAULT '12:00',
  weekend_extra_hours integer NOT NULL DEFAULT 0,
  available_time_windows text[],
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (produto_id, produto_tipo)
);

ALTER TABLE produto_regras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "produto_regras_read_all" ON produto_regras;
CREATE POLICY "produto_regras_read_all" ON produto_regras FOR SELECT USING (true);

DROP POLICY IF EXISTS "produto_regras_admin_all" ON produto_regras;
CREATE POLICY "produto_regras_admin_all" ON produto_regras FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
);

-- Seed conservador: cestas = produção na casa (4h, same-day); sobremesas = CPD (24h)
INSERT INTO produto_regras (produto_id, produto_tipo, production_sector, minimum_lead_time_hours, same_day_allowed)
SELECT c.id, 'cesta', 'COZINHA', 4, true
FROM (VALUES
  ('aconchego'), ('cafe-carinho'), ('tabua'), ('tabua-premium')
) AS c(id)
ON CONFLICT (produto_id, produto_tipo) DO NOTHING;

INSERT INTO produto_regras (produto_id, produto_tipo, production_sector, minimum_lead_time_hours, same_day_allowed, allowed_fulfillment_modes)
SELECT s.id, 'sobremesa', 'CONFEITARIA', 24, false, ARRAY['retirada']
FROM (VALUES
  ('bolo-cenoura'), ('torta-limao'), ('brigadeiro-gourmet')
) AS s(id)
ON CONFLICT (produto_id, produto_tipo) DO NOTHING;

-- ── Auditoria de conciliação ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conciliacao_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid REFERENCES pedidos(id) ON DELETE SET NULL,
  pagamento_id uuid,
  tipo text NOT NULL,
  detalhe jsonb NOT NULL DEFAULT '{}',
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conciliacao_eventos_pedido ON conciliacao_eventos (pedido_id);

-- ── Função: parse horário → hora inteira ────────────────────────────────────
CREATE OR REPLACE FUNCTION parse_horario_inicio_sql(horario text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(
    (regexp_match(horario, 'Entre\s+(\d{1,2})h', 'i'))[1]::integer,
  12);
$$;

-- ── Função: execution_at a partir de data + horário ─────────────────────────
CREATE OR REPLACE FUNCTION compute_execution_at_sql(data_entrega date, horario text)
RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN data_entrega IS NULL THEN NULL
    ELSE (data_entrega + make_time(
      LEAST(23, GREATEST(0, parse_horario_inicio_sql(horario))),
      0, 0
    )) AT TIME ZONE 'America/Sao_Paulo'
  END;
$$;

-- ── Backfill destinatário ─────────────────────────────────────────────────────
UPDATE pedidos p SET
  recipient_name = COALESCE(
    p.pagamento->'destinatario'->>'nome',
    p.cliente_nome
  ),
  recipient_phone = COALESCE(
    p.pagamento->'destinatario'->>'whatsapp',
    p.cliente_whatsapp
  ),
  recipient_is_buyer = (p.pagamento->'destinatario' IS NULL OR p.pagamento->'destinatario' = 'null'::jsonb)
WHERE recipient_name IS NULL;

-- Backfill execution_at
UPDATE pedidos
SET execution_at = compute_execution_at_sql(data_entrega::date, horario)
WHERE execution_at IS NULL AND data_entrega IS NOT NULL;

-- Backfill payment normalized a partir de status + pagamentos
UPDATE pedidos p SET
  payment_status_raw = COALESCE(p.pagamento->>'status', p.status),
  payment_status_normalized = CASE
    WHEN p.status = 'cancelado' THEN 'cancelado'
    WHEN p.status = 'rascunho' THEN 'rascunho'
    WHEN p.status = 'abandonado' THEN 'abandonado'
    WHEN p.status = 'pago' OR UPPER(p.pagamento->>'status') IN ('CONFIRMED', 'RECEIVED') THEN 'aprovado'
    WHEN UPPER(p.pagamento->>'status') = 'OVERDUE' OR p.status = 'vencido' THEN 'vencido'
    WHEN UPPER(p.pagamento->>'status') IN ('REFUNDED', 'PAYMENT_DELETED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE') THEN 'cancelado'
    ELSE 'aguardando'
  END
WHERE payment_status_normalized IS NULL;

-- Pedidos de teste (heurística conservadora)
UPDATE pedidos SET is_test = true
WHERE is_test = false AND (
  LOWER(cliente_nome) LIKE '%teste%'
  OR LOWER(cliente_email) LIKE '%teste%'
  OR LOWER(cliente_nome) LIKE '%sandbox%'
);

-- Arquivar pedidos com execução anterior a hoje (SP)
UPDATE pedidos
SET archived_at = now(), archived_by = 'migration_backfill'
WHERE archived_at IS NULL
  AND execution_at IS NOT NULL
  AND (execution_at AT TIME ZONE 'America/Sao_Paulo')::date < (now() AT TIME ZONE 'America/Sao_Paulo')::date
  AND payment_status_normalized = 'aprovado';

-- ── RPC: arquivar pedidos vencidos ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION arquivar_pedidos_vencidos()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  UPDATE pedidos
  SET archived_at = now(), archived_by = 'job_arquivar_vencidos'
  WHERE archived_at IS NULL
    AND execution_at IS NOT NULL
    AND (execution_at AT TIME ZONE 'America/Sao_Paulo')::date < (now() AT TIME ZONE 'America/Sao_Paulo')::date
    AND payment_status_normalized = 'aprovado';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION arquivar_pedidos_vencidos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION arquivar_pedidos_vencidos() TO authenticated;

-- ── Atualiza upsert_pedido_rascunho com novos campos ─────────────────────────
DROP FUNCTION IF EXISTS upsert_pedido_rascunho(uuid, jsonb);

CREATE OR REPLACE FUNCTION upsert_pedido_rascunho(_pedido_id uuid, _payload jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
DECLARE v_data date;
DECLARE v_horario text;
DECLARE v_recipient_name text;
DECLARE v_recipient_phone text;
DECLARE v_recipient_is_buyer boolean;
BEGIN
  v_data := NULLIF(_payload->>'data_entrega', '')::date;
  v_horario := NULLIF(_payload->>'horario', '');
  v_recipient_name := COALESCE(
    NULLIF(_payload->>'recipient_name', ''),
    _payload->'pagamento'->'destinatario'->>'nome',
    _payload->>'cliente_nome'
  );
  v_recipient_phone := COALESCE(
    NULLIF(_payload->>'recipient_phone', ''),
    _payload->'pagamento'->'destinatario'->>'whatsapp',
    _payload->>'cliente_whatsapp'
  );
  v_recipient_is_buyer := COALESCE(
    (_payload->>'recipient_is_buyer')::boolean,
    (_payload->'pagamento'->'destinatario' IS NULL)
  );

  IF _pedido_id IS NOT NULL THEN
    UPDATE pedidos SET
      cliente_nome        = _payload->>'cliente_nome',
      cliente_whatsapp    = _payload->>'cliente_whatsapp',
      cliente_cpf         = NULLIF(_payload->>'cliente_cpf', ''),
      cliente_email       = NULLIF(_payload->>'cliente_email', ''),
      cesta               = _payload->'cesta',
      sobremesas          = _payload->'sobremesas',
      tipo                = _payload->>'tipo',
      endereco_ou_unidade = _payload->>'endereco_ou_unidade',
      data_entrega        = v_data,
      horario             = v_horario,
      pagamento           = _payload->'pagamento',
      total               = (_payload->>'total')::numeric,
      status              = _payload->>'status',
      campanha_id         = NULLIF(_payload->>'campanha_id', ''),
      recipient_name      = v_recipient_name,
      recipient_phone     = v_recipient_phone,
      recipient_is_buyer  = v_recipient_is_buyer,
      unidade_id          = NULLIF(_payload->>'unidade_id', ''),
      production_sector   = NULLIF(_payload->>'production_sector', ''),
      execution_at        = compute_execution_at_sql(v_data, v_horario),
      is_test             = COALESCE((_payload->>'is_test')::boolean, is_test)
    WHERE id = _pedido_id
    RETURNING id INTO v_id;
    RETURN COALESCE(v_id, _pedido_id);
  ELSE
    INSERT INTO pedidos (
      cliente_nome, cliente_whatsapp, cliente_cpf, cliente_email,
      cesta, sobremesas, tipo, endereco_ou_unidade, data_entrega, horario,
      pagamento, total, status, campanha_id,
      recipient_name, recipient_phone, recipient_is_buyer,
      unidade_id, production_sector, execution_at, is_test
    ) VALUES (
      _payload->>'cliente_nome',
      _payload->>'cliente_whatsapp',
      NULLIF(_payload->>'cliente_cpf', ''),
      NULLIF(_payload->>'cliente_email', ''),
      _payload->'cesta',
      _payload->'sobremesas',
      _payload->>'tipo',
      _payload->>'endereco_ou_unidade',
      v_data,
      v_horario,
      _payload->'pagamento',
      (_payload->>'total')::numeric,
      _payload->>'status',
      NULLIF(_payload->>'campanha_id', ''),
      v_recipient_name,
      v_recipient_phone,
      v_recipient_is_buyer,
      NULLIF(_payload->>'unidade_id', ''),
      NULLIF(_payload->>'production_sector', ''),
      compute_execution_at_sql(v_data, v_horario),
      COALESCE((_payload->>'is_test')::boolean, false)
    ) RETURNING id INTO v_id;
    RETURN v_id;
  END IF;
END $$;

REVOKE ALL ON FUNCTION upsert_pedido_rascunho(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_pedido_rascunho(uuid, jsonb) TO anon, authenticated;

-- ── Atualiza pedidos_por_token com novos campos ───────────────────────────────
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
    SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY COALESCE(t.execution_at, t.criado_em) ASC), '[]'::jsonb)
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
      ORDER BY COALESCE(p.execution_at, p.criado_em) ASC
      LIMIT 500
    ) t
  );
END $$;

REVOKE ALL ON FUNCTION pedidos_por_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pedidos_por_token(text, text) TO anon, authenticated;
