-- Adiciona filtros de campanha e produto na tabela cupons
alter table cupons add column if not exists campanha_ids text[];
alter table cupons add column if not exists produto_ids text[];
