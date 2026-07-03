-- Diagnóstico rápido: rode no SQL Editor do Supabase e cole o resultado.
-- Ajuda a saber quais migrations já foram aplicadas no banco remoto.

SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Foco nas tabelas usadas pelo app:
SELECT
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'share_tokens') AS tem_share_tokens,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pedidos') AS tem_pedidos,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles') AS tem_user_roles,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pedidos' AND column_name = 'access_token'
  ) AS tem_pedidos_access_token;
