-- Acesso ao portal /operacao por código: o admin cadastra nome, CPF, setor e um código
-- numérico. Cada operador ganha um login técnico no Supabase (sem senha conhecida) e o
-- servidor troca o código por uma sessão. O setor fica em operators.role_title.
-- Idempotente: pode ser reaplicada sem erro.

ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS access_code text;

ALTER TABLE public.operators DROP CONSTRAINT IF EXISTS operators_cpf_digitos;
ALTER TABLE public.operators ADD CONSTRAINT operators_cpf_digitos
  CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$');

ALTER TABLE public.operators DROP CONSTRAINT IF EXISTS operators_access_code_digitos;
ALTER TABLE public.operators ADD CONSTRAINT operators_access_code_digitos
  CHECK (access_code IS NULL OR access_code ~ '^[0-9]{6,8}$');

CREATE UNIQUE INDEX IF NOT EXISTS operators_access_code_key
  ON public.operators (access_code) WHERE access_code IS NOT NULL;

-- Um CPF por operador ativo (quem foi removido fica como histórico, inativo).
CREATE UNIQUE INDEX IF NOT EXISTS operators_cpf_ativo_key
  ON public.operators (cpf) WHERE cpf IS NOT NULL AND is_active;

-- Tentativas de código erradas por IP. Fica no banco para o limite valer entre as
-- instâncias serverless. Sem policies: só o service_role lê e grava.
CREATE TABLE IF NOT EXISTS public.operacao_login_falhas (
  id        bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip        text        NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operacao_login_falhas_ip_idx
  ON public.operacao_login_falhas (ip, criado_em);

ALTER TABLE public.operacao_login_falhas ENABLE ROW LEVEL SECURITY;
