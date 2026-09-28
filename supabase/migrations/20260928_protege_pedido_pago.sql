-- Pedido pago não pode voltar para rascunho.
--
-- O autosave do checkout (RPC upsert_pedido_rascunho) regrava `status` e `pagamento`
-- com o payload do navegador. Quando isso acontecia depois da confirmação, o pedido pago
-- voltava para "rascunho" e sumia da fila da operação — 4 pedidos entre agosto e setembro
-- de 2026 (R$ 1.300 em vendas invisíveis para a produção).
--
-- A proteção de prazo já existia para 'expirado'; aqui ela passa a cobrir também o pago.
-- Só o servidor (service_role) mexe no status e no bloco de pagamento de um pedido pago.

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

  IF OLD.status = 'pago'
     OR OLD.payment_confirmed_at IS NOT NULL
     OR OLD.payment_status_normalized = 'aprovado' THEN
    NEW.status := OLD.status;
    NEW.pagamento := OLD.pagamento;
    NEW.payment_status_raw := OLD.payment_status_raw;
    NEW.payment_status_normalized := OLD.payment_status_normalized;
    NEW.payment_confirmed_at := OLD.payment_confirmed_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pedidos_protege_prazo_pagamento ON public.pedidos;
CREATE TRIGGER pedidos_protege_prazo_pagamento
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.pedidos_protege_prazo_pagamento();
