-- Segurança: token de acesso ao checkout, hash de senhas em share_tokens,
-- retorno da RPC upsert_pedido_rascunho com access_token.
--
-- NOTA: se share_tokens não existir (migration 20260430 nunca aplicada no remoto),
-- esta migration cria a tabela e políticas básicas antes do hash/validação.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ── Token de acesso por pedido (checkout / pagamento público) ───────────────
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS access_token text;

UPDATE public.pedidos
SET access_token = extensions.encode(extensions.gen_random_bytes(32), 'hex')
WHERE access_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pedidos_access_token_key
  ON public.pedidos(access_token) WHERE access_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.pedidos_set_access_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.access_token IS NULL OR NEW.access_token = '' THEN
    NEW.access_token := encode(gen_random_bytes(32), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedidos_access_token ON public.pedidos;
CREATE TRIGGER trg_pedidos_access_token
  BEFORE INSERT ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.pedidos_set_access_token();

-- ── Bootstrap share_tokens (se ainda não existir no banco remoto) ───────────
CREATE TABLE IF NOT EXISTS public.share_tokens (
  token       text        PRIMARY KEY,
  scope       text        NOT NULL,
  senha       text,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  campanha_id text
);

ALTER TABLE public.share_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_roles'
  ) THEN
    DROP POLICY IF EXISTS "share_tokens_admin_all" ON public.share_tokens;
    CREATE POLICY "share_tokens_admin_all" ON public.share_tokens
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text = 'admin'
        )
      );
  END IF;
END $$;

-- ── Hash de senhas em share_tokens ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hash_share_token_senha()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.senha IS NOT NULL AND NEW.senha <> '' AND NEW.senha !~ '^\$2[aby]\$' THEN
    NEW.senha := crypt(NEW.senha, gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_share_tokens_hash_senha ON public.share_tokens;
CREATE TRIGGER trg_share_tokens_hash_senha
  BEFORE INSERT OR UPDATE OF senha ON public.share_tokens
  FOR EACH ROW EXECUTE FUNCTION public.hash_share_token_senha();

-- Migra senhas legadas em texto plano para bcrypt.
UPDATE public.share_tokens
SET senha = extensions.crypt(senha, extensions.gen_salt('bf'))
WHERE senha IS NOT NULL AND senha <> '' AND senha !~ '^\$2[aby]\$';

CREATE OR REPLACE FUNCTION public.validar_token_pedidos(_token text, _senha text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.share_tokens
    WHERE token = _token
      AND scope = 'pedidos'
      AND (
        senha IS NULL
        OR (_senha IS NOT NULL AND senha = crypt(_senha, senha))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.validar_token_pedidos(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_token_pedidos(text, text) TO anon, authenticated;

-- token_requer_senha (usado pelo front da cozinha) — recria se faltava
CREATE OR REPLACE FUNCTION public.token_requer_senha(_token text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT senha IS NOT NULL FROM public.share_tokens WHERE token = _token AND scope = 'pedidos'),
    false
  );
$$;
REVOKE ALL ON FUNCTION public.token_requer_senha(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.token_requer_senha(text) TO anon, authenticated;

-- ── upsert_pedido_rascunho: retorna id + access_token ───────────────────────
DROP FUNCTION IF EXISTS public.upsert_pedido_rascunho(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.upsert_pedido_rascunho(_pedido_id uuid, _payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
DECLARE v_data text;
DECLARE v_horario text;
DECLARE v_execution_at timestamptz;
DECLARE v_recipient_name text;
DECLARE v_recipient_phone text;
DECLARE v_recipient_is_buyer boolean;
DECLARE v_access_token text;
BEGIN
  v_data := NULLIF(_payload->>'data_entrega', '');
  v_horario := NULLIF(_payload->>'horario', '');
  v_execution_at := COALESCE(
    NULLIF(_payload->>'execution_at', '')::timestamptz,
    compute_execution_at_sql(v_data, v_horario)
  );
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
      execution_at        = v_execution_at,
      is_test             = COALESCE((_payload->>'is_test')::boolean, is_test)
    WHERE id = _pedido_id
    RETURNING id, access_token INTO v_id, v_access_token;
    v_id := COALESCE(v_id, _pedido_id);
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
      v_execution_at,
      COALESCE((_payload->>'is_test')::boolean, false)
    ) RETURNING id, access_token INTO v_id, v_access_token;
  END IF;

  IF v_access_token IS NULL THEN
    SELECT access_token INTO v_access_token FROM pedidos WHERE id = v_id;
  END IF;

  RETURN jsonb_build_object('id', v_id, 'access_token', v_access_token);
END $$;

REVOKE ALL ON FUNCTION public.upsert_pedido_rascunho(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_pedido_rascunho(uuid, jsonb) TO anon, authenticated;
