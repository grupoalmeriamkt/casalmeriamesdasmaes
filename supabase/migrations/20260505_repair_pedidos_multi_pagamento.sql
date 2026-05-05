-- Repara pedidos que acumularam mais de 1 pagamento no mesmo registro.
-- Para cada pagamento "extra" (mais antigos), cria um novo pedido clonado
-- e redireciona o pagamento para ele.
-- ATENÇÃO: os itens do pedido clonado podem refletir os dados do pedido mais recente
-- (pois a função antiga sobrescrevia). Revisar no admin após aplicar.

DO $$
DECLARE
  r      RECORD;
  novo_id uuid;
BEGIN
  FOR r IN
    SELECT pg.id AS pag_id, pg.pedido_id, pg.criado_em AS pag_criado_em
    FROM pagamentos pg
    WHERE pg.pedido_id IN (
      SELECT pedido_id FROM pagamentos GROUP BY pedido_id HAVING COUNT(*) > 1
    )
    AND pg.id NOT IN (
      SELECT DISTINCT ON (pedido_id) id
      FROM pagamentos
      ORDER BY pedido_id, criado_em DESC
    )
  LOOP
    INSERT INTO pedidos (
      criado_em,
      cliente_nome, cliente_whatsapp, cliente_cpf, cliente_email,
      cesta, sobremesas, tipo, endereco_ou_unidade,
      data_entrega, horario, pagamento, total, status
    )
    SELECT
      r.pag_criado_em,
      cliente_nome, cliente_whatsapp, cliente_cpf, cliente_email,
      cesta, sobremesas, tipo, endereco_ou_unidade,
      data_entrega, horario, pagamento, total,
      'aguardando_pagamento'
    FROM pedidos
    WHERE id = r.pedido_id
    RETURNING id INTO novo_id;

    UPDATE pagamentos SET pedido_id = novo_id WHERE id = r.pag_id;
  END LOOP;
END $$;
