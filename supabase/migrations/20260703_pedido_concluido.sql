ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS concluido_at timestamptz,
  ADD COLUMN IF NOT EXISTS concluido_by text;
CREATE INDEX IF NOT EXISTS idx_pedidos_concluido ON pedidos (concluido_at) WHERE archived_at IS NULL;
