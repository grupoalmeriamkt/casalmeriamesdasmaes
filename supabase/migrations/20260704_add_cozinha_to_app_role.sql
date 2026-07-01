-- Adiciona valor 'cozinha' ao enum app_role (projeto Casa Almeria)
-- Rode no projeto: opbepcajjktehaezmqzf (vendas.grupoalmeria.com.br)
-- NÃO no sommarunning_2026.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'app_role'
        AND e.enumlabel = 'cozinha'
    ) THEN
      ALTER TYPE public.app_role ADD VALUE 'cozinha';
    END IF;
  ELSE
    CREATE TYPE public.app_role AS ENUM ('admin', 'cozinha');
  END IF;
END $$;

-- Confirma valores do enum
SELECT e.enumlabel AS role
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'app_role'
ORDER BY e.enumsortorder;
