-- Corrige uso de pgcrypto em produção (Supabase): a extensão vive no schema
-- `extensions`, e funções/triggers chamavam gen_random_bytes/crypt/gen_salt SEM
-- qualificar o schema. Mesmo com `SET search_path = ... extensions` o resolver
-- às vezes falhava, quebrando em runtime com "function ... does not exist".
--
-- Incidente (2026-07-04): o trigger pedidos_set_access_token derrubou TODA compra
-- na loja pública ("Erro ao salvar pedido: function gen_random_bytes(integer) does
-- not exist"). Esta migration qualifica todos os usos com `extensions.` de vez.
-- Já aplicada manualmente no SQL editor de produção; este arquivo mantém o repo
-- em sync com o banco. Idempotente.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1) Checkout público: token de acesso por pedido (BEFORE INSERT em pedidos)
CREATE OR REPLACE FUNCTION public.pedidos_set_access_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.access_token IS NULL OR NEW.access_token = '' THEN
    NEW.access_token := encode(extensions.gen_random_bytes(32), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Portal da cozinha: token geral
CREATE OR REPLACE FUNCTION public.cozinha_token_geral()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
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

  IF v_token IS NULL THEN
    v_token := encode(extensions.gen_random_bytes(16), 'hex');
    INSERT INTO public.share_tokens (token, scope)
    VALUES (v_token, 'pedidos');
  END IF;

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.cozinha_token_geral() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cozinha_token_geral() TO authenticated;

-- 3) Hash de senha de share_tokens (crypt/gen_salt)
CREATE OR REPLACE FUNCTION public.hash_share_token_senha()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.senha IS NOT NULL AND NEW.senha <> '' AND NEW.senha !~ '^\$2[aby]\$' THEN
    NEW.senha := extensions.crypt(NEW.senha, extensions.gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$;

-- 4) Validação de senha de share_tokens (crypt)
CREATE OR REPLACE FUNCTION public.validar_token_pedidos(_token text, _senha text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.share_tokens
    WHERE token = _token
      AND scope = 'pedidos'
      AND (
        senha IS NULL
        OR (_senha IS NOT NULL AND senha = extensions.crypt(_senha, senha))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.validar_token_pedidos(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_token_pedidos(text, text) TO anon, authenticated;
