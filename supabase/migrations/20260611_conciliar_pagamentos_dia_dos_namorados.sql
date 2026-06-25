-- Conciliação manual: 4 pedidos com PIX confirmado no Asaas mas não atualizado no sistema
-- Causa: webhooks do Asaas não foram recebidos. Verificar URL e token no painel Asaas.

-- Atualizar status na tabela pagamentos (apenas os 4 confirmados; pay_8thxn438cce0lqxu da Fabiana fica PENDING)
UPDATE pagamentos
SET status = 'RECEIVED'
WHERE asaas_payment_id IN (
  'pay_6ckbhrsvy5syvquz',
  'pay_jri21a9nyk17j50g',
  'pay_tfru1bhf5mxenizw',
  'pay_dr3cih6cg0z41wvd'
);

-- Atualizar status dos pedidos + status no JSONB pagamento
UPDATE pedidos
SET
  status = 'pago',
  pagamento = jsonb_set(pagamento, '{status}', '"RECEIVED"')
WHERE id IN (
  '9b26c5bb-2345-4375-a2ee-10d6af1f16f0',
  '308c6759-f97e-4597-9a8f-bb7749a885e1',
  '2ab6caf2-701f-4efa-92b0-a5a8c5de4dc1',
  'a5c0cc1c-6693-444b-909c-7961d79e8225'
);
