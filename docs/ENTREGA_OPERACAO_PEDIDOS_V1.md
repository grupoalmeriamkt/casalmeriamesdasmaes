# Entrega — Operação de Pedidos v1 (preview)

Branch: `feat/operacao-pedidos-v1`

## Ativar preview

1. Aplicar migration `supabase/migrations/20260629_operacao_pedidos_v1.sql` no Supabase.
2. Configurar no ambiente de preview (Vercel):
   - `VITE_FEATURE_OPERACAO_PEDIDOS=true`
   - `FEATURE_OPERACAO_PEDIDOS=true`
3. **Não** ativar em produção (`vendas.grupoalmeria.com.br`) até aceite da Juliana.

## Resumo técnico

- Colunas operacionais em `pedidos`: destinatário, setor, `execution_at`, status de pagamento normalizado, `is_test`, arquivamento, `conciliacao_pendente`.
- Tabela `produto_regras` + API `POST /api/disponibilidade` com validação server-side (timezone `America/Sao_Paulo`).
- Conciliação Asaas reforçada + tabela `conciliacao_eventos` + UI de pendências no admin.
- Checkout: default "Eu mesmo" preenche destinatário automaticamente.
- `/pedidos/{token}` com fila operacional (destinatário em destaque, agrupamento Hoje/Amanhã, filtros setor/unidade).
- Exportação CSV enriquecida em `/pedidos/{token}` quando flag ativa.
- Admin > Pedidos permanece visão comercial (sem mudanças operacionais na UI).

## Fora deste escopo (fase 2 — logística)

- Impressão operacional / romaneio motoboy
- Impressão em lote por data de execução
- `venue_delivery` / endereço estruturado para rotas
- Tecnisa, rastreamento de motoboy, acesso por unidade

## Migrations e backfill

| Arquivo | Conteúdo |
|---------|----------|
| `20260629_operacao_pedidos_v1.sql` | Colunas, `produto_regras`, `conciliacao_eventos`, backfill destinatário/execução/status, RPC `arquivar_pedidos_vencidos`, `upsert_pedido_rascunho` e `pedidos_por_token` atualizados |

## Testes executados

```bash
npm install
npm run test
npm run build
```

Casos cobertos: conciliação múltiplos PIX, status normalizado, `execution_at`, regras CPD vs cozinha, filtro sem testes, arquivamento por data SP.

## Casos manuais sugeridos (Juliana)

1. Pedido pago no Asaas aparece em Aprovado sem ação manual.
2. Pedido "Eu mesmo" mostra um único destinatário operacional.
3. Pedido "Outra pessoa" destaca nome do recebedor.
4. Bolo não oferece mesmo dia (validação no charge).
5. Fila padrão oculta pedidos vencidos e testes.
6. Filtro por setor isola demanda da confeitaria/padaria/cozinha.
