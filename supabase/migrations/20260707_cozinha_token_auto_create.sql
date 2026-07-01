-- Garante token geral da cozinha ao abrir o portal (evita tela em branco)

CREATE OR REPLACE FUNCTION public.cozinha_token_geral()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
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
    v_token := encode(gen_random_bytes(16), 'hex');
    INSERT INTO public.share_tokens (token, scope)
    VALUES (v_token, 'pedidos');
  END IF;

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.cozinha_token_geral() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cozinha_token_geral() TO authenticated;
