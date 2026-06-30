-- Expande setores operacionais em pedidos (planilha ENCOMENDAS)

ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_production_sector_check;

ALTER TABLE pedidos ADD CONSTRAINT pedidos_production_sector_check
  CHECK (
    production_sector IS NULL OR production_sector IN (
      'CONFEITARIA',
      'PADARIA',
      'COZINHA',
      'COZINHA_104_SUL',
      'COZINHA_104_CONFEITARIA'
    )
  );
