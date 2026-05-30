-- Retorna nome da campanha vinculada a um token de pedidos.
-- Usado pela página pública /pedidos/$token para exibir o contexto da campanha.

CREATE OR REPLACE FUNCTION token_campanha_info(_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_campanha_id text;
  v_nome        text;
BEGIN
  SELECT campanha_id INTO v_campanha_id
  FROM share_tokens
  WHERE token = _token AND scope = 'pedidos';

  IF v_campanha_id IS NULL THEN
    RETURN jsonb_build_object('campanha_id', null, 'nome', null);
  END IF;

  SELECT (SELECT c->>'nome'
          FROM jsonb_array_elements(payload->'campanhas') c
          WHERE c->>'id' = v_campanha_id)
  INTO v_nome
  FROM app_config WHERE id = 'default';

  RETURN jsonb_build_object(
    'campanha_id', v_campanha_id,
    'nome', COALESCE(v_nome, v_campanha_id)
  );
END $$;

REVOKE ALL ON FUNCTION token_campanha_info(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION token_campanha_info(text) TO anon, authenticated;
