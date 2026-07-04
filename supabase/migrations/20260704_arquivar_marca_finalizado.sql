-- Ao arquivar (manual ou job), marca também como etapa finalizada.
CREATE OR REPLACE FUNCTION arquivar_pedidos_vencidos()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  UPDATE pedidos
  SET
    archived_at = now(),
    archived_by = 'job_arquivar_vencidos',
    fulfillment_stage = 'finalizado',
    fulfillment_stage_at = COALESCE(fulfillment_stage_at, now())
  WHERE archived_at IS NULL
    AND execution_at IS NOT NULL
    AND (execution_at AT TIME ZONE 'America/Sao_Paulo')::date < (now() AT TIME ZONE 'America/Sao_Paulo')::date
    AND payment_status_normalized = 'aprovado';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- Backfill: pedidos já arquivados sem etapa finalizada.
UPDATE pedidos
SET
  fulfillment_stage = 'finalizado',
  fulfillment_stage_at = COALESCE(fulfillment_stage_at, archived_at, now())
WHERE archived_at IS NOT NULL
  AND (fulfillment_stage IS NULL OR fulfillment_stage <> 'finalizado');
