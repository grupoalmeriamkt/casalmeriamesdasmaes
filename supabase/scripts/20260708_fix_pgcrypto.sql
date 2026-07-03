-- Corrige hash de senhas em share_tokens (Supabase: pgcrypto fica no schema extensions).
-- Rode este bloco no SQL Editor se crypt() deu "function does not exist".

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

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

UPDATE public.share_tokens
SET senha = extensions.crypt(senha, extensions.gen_salt('bf'))
WHERE senha IS NOT NULL AND senha <> '' AND senha !~ '^\$2[aby]\$';

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
        OR (_senha IS NOT NULL AND senha = crypt(_senha, senha))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.validar_token_pedidos(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_token_pedidos(text, text) TO anon, authenticated;
