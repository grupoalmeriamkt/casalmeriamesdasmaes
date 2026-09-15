-- Prazo de 2 minutos para pagar. O servidor grava o fim do prazo quando o cliente abre a
-- tela de pagamento (ou a equipe gera PIX/link). Sem pagamento no prazo, o pedido vira
-- status 'expirado' e não aceita nova cobrança.

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS pagamento_expira_em timestamptz;

-- Varredura da conciliação: pedidos ainda abertos com prazo vencido.
CREATE INDEX IF NOT EXISTS pedidos_pagamento_expira_em_idx
  ON public.pedidos (pagamento_expira_em)
  WHERE pagamento_expira_em IS NOT NULL;

-- Só o servidor (service_role) mexe no prazo ou tira um pedido de 'expirado'.
-- Sem isso, o rascunho salvo pelo checkout (RPC upsert_pedido_rascunho, que regrava
-- o status) reabriria um pedido expirado.
CREATE OR REPLACE FUNCTION public.pedidos_protege_prazo_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.pagamento_expira_em IS DISTINCT FROM OLD.pagamento_expira_em THEN
    NEW.pagamento_expira_em := OLD.pagamento_expira_em;
  END IF;
  IF OLD.status = 'expirado' THEN
    NEW.status := 'expirado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pedidos_protege_prazo_pagamento ON public.pedidos;
CREATE TRIGGER pedidos_protege_prazo_pagamento
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.pedidos_protege_prazo_pagamento();
