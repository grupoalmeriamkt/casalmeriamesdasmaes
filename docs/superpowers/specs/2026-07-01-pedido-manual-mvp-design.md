# Pedido Manual — Fase 1 (MVP) — Design

Data: 2026-07-01
Status: aprovado para implementação
Autor: Alex Rodrigues + Claude

## 1. Objetivo

Permitir que a equipe interna monte um pedido completo pelo painel administrativo,
reutilizando a mesma lógica de onboarding do fluxo público de pedido via link, gere um
link de pagamento individual para o cliente e acompanhe automaticamente o status desse
pagamento, registrando qual operador foi responsável pela venda.

Este documento cobre **somente a Fase 1 (MVP)**. As demais frentes (status
financeiro×operacional formal, auditoria completa, métricas/ranking, filtros avançados e
página de detalhe rica) serão especificadas em fases seguintes.

## 2. Escopo da Fase 1

Incluído:

- Tabela `operators` (perfil vinculado ao login) + área simples de gestão (padrão AbaCozinha).
- Stepper de criação manual com campos essenciais + motor de disponibilidade (data/hora
  respeitando lead time por produto).
- Geração de link de pagamento via Asaas (`invoiceUrl`), reutilizando a infraestrutura existente.
- Acompanhamento automático de pago/pendente via webhook e reconciliação já existentes.
- Ajuste mínimo na tabela de pedidos: colunas Origem e Operador + botão de criar.

Fora de escopo (fases futuras):

- Extras (cartões/polaroids com upload), taxa de entrega por zona/geocoding, cupom.
- Colunas formais `financial_status` / `operational_status` separadas.
- Tabela `order_activity_logs` e a seção "Histórico operacional".
- Métricas no topo, ranking de operadores, filtros avançados (por operador, origem,
  período de pagamento, links expirados etc.).
- Página de detalhe dedicada e rica do pedido.
- PIN / chave operacional como trava (a coluna é criada, mas fica inativa no MVP).
- Cancelamento/substituição formal de links Asaas anteriores (reembolso é ação separada).

## 3. Contexto do sistema atual (confirmado)

- Stack: TanStack Start + Router (React 19, Vite), Supabase (Postgres + Auth), Tailwind v4
  + shadcn/Radix, Zustand para estado admin, Sonner. Sem TanStack Query — padrão é `fetch`
  direto + `setState`.
- Fluxo público: `src/components/Quiz.tsx` (~2068 linhas) + store `usePedido`
  (`src/store/pedido.ts`). Produtos são cestas/sobremesas (hardcoded em `src/lib/data.ts` +
  regras em `produto_regras`). Motor de disponibilidade modular em `src/lib/availability/`.
  Persistência via RPC `upsert_pedido_rascunho(_pedido_id, _payload)`, payload montado por
  `toPayload()` em `src/lib/pedidos.ts`.
- Pagamento: integração Asaas completa. Cliente Asaas em
  `src/integrations/asaas/client.server.ts` (`makeAsaasClient().createPayment()` retorna
  `invoiceUrl`, aceita `billingType: 'UNDEFINED'`). Cobranças em `pagamentos`; webhook
  idempotente em `src/routes/api/public/asaas/webhook.ts` (tabela `asaas_webhook_events`);
  reconciliação em `src/integrations/asaas/reconcile.server.ts` e
  `src/routes/api/admin/conciliar-asaas.ts`; mapeamento de status em `src/lib/asaasStatus.ts`,
  `src/lib/paymentStatus.ts`; sync em `src/lib/pedidoSync.ts` (`syncPedidoPaymentFields`).
- Auth: Supabase Auth (JWT). Enum `app_role` (`admin`, `cozinha`), tabela `user_roles`.
  Server valida via `authenticateRequest` + `requireAdmin` (`src/lib/authServer.ts`). Client
  via `useAuth` (`src/hooks/useAuth.ts`). Cada pessoa tem login próprio.
- Tabela de pedidos admin: `src/components/admin/AbaPedidos.tsx`, alimentada por
  `/api/public/admin/pedidos` (500 linhas, join com `pagamentos`); mutações via
  `/api/admin/pedidos` com `action`. Modal de detalhe `DetalhesPedidoAdmin`.
- Migrações em `supabase/migrations/`, convenção `YYYYMMDD_descricao.sql`.

## 4. Decisões-chave

1. **Identidade do operador = usuário logado.** Cada vendedor já tem login próprio; o
   "operador responsável" é derivado do usuário autenticado, não de texto livre. `operators`
   é um perfil vinculado a `auth.users`. Sem PIN no MVP.
2. **Reuso por extração (abordagem A).** Extrair a lógica pura de onboarding para módulos
   reutilizáveis e construir um stepper admin novo e leve que os consome. O Quiz público
   permanece intocado (evita risco no fluxo que gera receita).
3. **Link de pagamento = cobrança Asaas + `invoiceUrl`.** `billingType: 'UNDEFINED'` para o
   cliente escolher o método na página hospedada do Asaas. Reutiliza `pagamentos` + webhook +
   reconciliação; nenhuma sincronização nova.
4. **Sem novas colunas de status no MVP.** Reutiliza `pedidos.status` e
   `payment_status_normalized`. A separação formal financeiro×operacional fica para a Fase 2.

## 5. Modelo de dados

Nova migração `supabase/migrations/20260701_pedido_manual_v1.sql`.

### 5.1 Tabela `operators`

```
id             uuid PK default gen_random_uuid()
user_id        uuid references auth.users(id) on delete set null, unique  (nullable)
name           text not null
short_name     text
email          text
phone          text
role_title     text                 -- cargo ou área
internal_key   text unique          -- chave operacional
pin_hash       text                 -- reservado p/ fase futura; não usado no MVP
is_active      boolean not null default true
last_activity_at timestamptz
created_at     timestamptz not null default now()
updated_at     timestamptz not null default now()
```

- RLS habilitada, espelhando `user_roles`:
  - admin lê/escreve todas as linhas (via `has_role(auth.uid(),'admin')`);
  - cada usuário lê a própria linha (`user_id = auth.uid()`).
- Trigger `updated_at` no padrão das outras tabelas (ex.: `trg_pagamentos_atualizado`).
- Índice em `user_id` e em `is_active`.

### 5.2 Alterações em `pedidos`

```
origin       text not null default 'publico'
             check (origin in ('publico','manual','importado'))
operator_id  uuid references operators(id) on delete set null   (nullable)
```

- Linhas existentes assumem `origin='publico'` pelo default (sem backfill manual necessário).
- Índice parcial `idx_pedidos_origin_manual on pedidos(origin) where origin = 'manual'`.

### 5.3 Alterações em `pagamentos`

```
invoice_url  text   -- URL do link de pagamento hospedado (Asaas invoiceUrl)
```

- Guarda o link retornado por `createPayment` para exibir/copiar/enviar sem reconsultar o Asaas.
- **Constraint de `metodo`**: hoje `pagamentos.metodo` é `not null check (metodo in
  ('PIX','CREDIT_CARD','BOLETO'))`. Como o link usa `billingType: 'UNDEFINED'` (cliente
  escolhe na página do Asaas), o método não é conhecido na criação. Decisão: (1) a migração
  torna `metodo` **nullable** e relaxa a CHECK para aceitar `NULL`; (2) o webhook — que hoje
  só grava `status` e `raw_response` — passa a gravar também o `metodo` a partir de
  `event.payment.billingType` na confirmação (valor concreto `PIX`/`CREDIT_CARD`/`BOLETO`).
  Nenhuma linha existente é afetada (todas já têm método concreto; reescrever com o mesmo
  valor é idempotente).

## 6. Módulos compartilhados de onboarding (extração)

Novo diretório `src/lib/orderForm/`:

- `schema.ts` — schema Zod dos campos essenciais (cliente, produto, quantidade, tipo,
  local/endereço, data, horário, observações). CPF opcional para salvar, obrigatório para
  gerar link.
- `buildPayload.ts` — `buildPedidoManualPayload(input)` que reaproveita `toPayload`,
  `computeExecutionAt` e `src/lib/availability` (`buildRegrasForItens`,
  `resolveProductionSector`) para produzir o mesmo formato salvo hoje, acrescido de
  `origin` e `operator_id`.
- Fonte de produtos/locais: a mesma consumida pelo Quiz (store admin + `src/lib/data.ts` +
  `produto_regras`). Nada hardcoded novo.

Regra: nenhuma regra de negócio de disponibilidade/preço é reimplementada — apenas
importada dos módulos existentes.

## 7. Stepper de criação manual

- Rota nova `src/routes/pedidos.novo.tsx` → caminho `/pedidos/novo`, protegida por admin
  (mesmo guard de `/admin`, usando `useAuth().isAdmin` + `AccessDenied`).
- Botão "Criar pedido manual" no topo da aba Pedidos (`AbaPedidos.tsx`) navega para a rota.
- Estado local próprio do stepper (não usa o store persistido `usePedido` do fluxo público,
  para não contaminar rascunhos do cliente).
- Layout tela cheia com indicador de progresso, seguindo o padrão visual do admin
  (charcoal/olive/terracotta, componentes shadcn).

Etapas:

```
①Operador  ②Cliente  ③Produto  ④Entrega/Retirada  ⑤Revisão  ⑥Pagamento
```

1. **Operador**: pré-selecionado com o usuário logado (auto-provisão da linha `operators`);
   confirmável. Bloqueia avançar sem operador vinculado.
2. **Cliente**: nome*, whatsapp*, email, CPF (obrigatório apenas na etapa de gerar link).
3. **Produto**: seleção de cesta/sobremesa + quantidade; carrega as regras do produto.
4. **Entrega/Retirada**: tipo; se entrega → endereço; se retirada → unidade; data + horário
   validados pelo motor de disponibilidade (bloqueia data/hora inviável por lead time).
5. **Revisão**: itens, valor unitário, total, operador responsável, dados do cliente,
   observações. Permite voltar e editar qualquer etapa.
6. **Pagamento**: confirma criação do pedido (status inicial `aguardando_pagamento`), gera o
   link e exibe as ações rápidas.

Validações reutilizam `validateDisponibilidade()` de `src/lib/availability`.

## 8. Geração do link de pagamento

Novas actions no endpoint `src/routes/api/admin/pedidos.ts` (autenticadas via
`authenticateRequest` + `requireAdmin`):

- `criar_manual`: insere o pedido via admin client (service_role) com `origin='manual'`,
  `operator_id` (resolvido do usuário logado), status `aguardando_pagamento` e o payload de
  onboarding montado por `buildPedidoManualPayload`. Retorna `{ id }`.
- `gerar_link`: exige CPF. Fluxo:
  1. `upsertCustomer({ name, cpfCnpj, email, mobilePhone })`;
  2. `createPayment({ customer, billingType: 'UNDEFINED', value: total, dueDate,
     description, externalReference: pedidoId })`;
  3. insere linha em `pagamentos` (mesmo shape usado por `charge.ts`), guardando
     `asaas_payment_id`, `invoice_url`, `valor`, `status` (`metodo` fica `NULL` até o cliente
     escolher/pagar; `raw_response` guarda o objeto completo do Asaas);
  4. retorna `{ invoiceUrl, pagamentoId }`.
- `dueDate`: por padrão a data de entrega do pedido; se retirada sem data definida,
  hoje + 2 dias. (Configurável em fase futura.)
- Gerar novo link cria **nova** linha em `pagamentos` (histórico preservado). O pagamento
  "relevante" é escolhido por `pagamentoRelevante` (`src/lib/asaasStatus.ts`). Cancelamento/
  substituição formal do link anterior no Asaas fica para a Fase 2.

Ações rápidas exibidas após gerar (na etapa 6 e no modal de detalhe existente):

- **Copiar link**, **Abrir link**, **WhatsApp** (`wa.me` com mensagem pré-preenchida),
  **E-mail** (reutiliza `src/lib/email.ts` / integração Resend via `/api/admin/email`),
  **Gerar novo link**.

Cliente-side: funções em `src/lib/pedidos.ts` (`criarPedidoManual`, `gerarLinkPagamento`)
no mesmo padrão das mutações existentes (`fetch` + Bearer token).

## 9. Acompanhamento de status (pago/pendente)

Sem novo código de sincronização:

- O webhook existente (`src/routes/api/public/asaas/webhook.ts`) casa por `asaas_payment_id`,
  atualiza `pagamentos` e chama `syncPedidoPaymentFields`, promovendo o pedido a `pago`
  automaticamente.
- A reconciliação manual (`/api/admin/conciliar-asaas`) já cobre reconsulta quando o webhook
  falha; o botão de reconciliar já é chamado pela AbaPedidos ao carregar.
- Idempotência já garantida pela unicidade de `asaas_webhook_events.asaas_event_id` e
  `pagamentos.asaas_payment_id`.

## 10. Área de operadores

- Nova aba "Operadores" no `src/routes/admin.tsx` (array `ABAS`), componente
  `src/components/admin/AbaOperadores.tsx`, clonando o padrão de `AbaCozinha.tsx`.
- Funções: listar operadores; ativar/desativar; editar `short_name`, `role_title`,
  `internal_key`. Somente admin.
- Endpoint `src/routes/api/admin/operators.ts` (GET listar; POST `criar`/`atualizar`/
  `ativar`/`desativar`), autenticado + `requireAdmin`.
- Auto-provisão: helper server-side `ensureOperator(userId, {name,email})` chamado no
  `criar_manual` e no carregamento do stepper, criando a linha `operators` se não existir.

## 11. Ajuste mínimo na tabela de pedidos

- `PedidoRow` (`src/lib/pedidos.ts`) ganha `origin` e `operator_id` (+ nome do operador via
  join no endpoint `/api/public/admin/pedidos`).
- `AbaPedidos.tsx`: coluna **Origem** (badge público/manual) e **Operador**; botão
  "Criar pedido manual" no topo.
- Filtros e métricas por origem/operador ficam para a Fase 3.

## 12. Regras de negócio respeitadas na Fase 1

- Não gerar link sem operador responsável (garantido: operador = usuário logado obrigatório).
- Não criar pedido sem cliente, produto, quantidade, local e dados de entrega/retirada
  (validação no schema + motor de disponibilidade).
- Histórico de cobranças preservado: cada link é uma nova linha em `pagamentos`; nunca
  sobrescreve.
- Idempotência de webhook mantida (infra existente).
- Reconsulta manual disponível (reconciliação existente).

## 13. Riscos e mitigações

- **CPF obrigatório para link**: o Asaas exige `cpfCnpj` para criar o customer. Mitigação: o
  stepper permite salvar o pedido sem CPF, mas bloqueia "Gerar link" pedindo o CPF.
- **Regressão no fluxo público**: mitigada pela abordagem de extração (Quiz intocado) e por
  não alterar o RPC público `upsert_pedido_rascunho`.
- **Divergência de status**: coberta pela reconciliação existente.
- **CHECK de `pagamentos.metodo`**: precisa ser relaxada para aceitar `NULL` (link
  `UNDEFINED`). A migração altera a constraint sem afetar linhas existentes; o webhook
  preenche o método real na confirmação. Ver §5.3.

## 14. Testes

- Unidade: `buildPedidoManualPayload` (mapeamento de campos, `execution_at`, setor derivado),
  schema de validação (CPF condicional, campos obrigatórios), regras de disponibilidade
  reaproveitadas.
- Integração (server): `criar_manual` insere com `origin='manual'` e `operator_id`;
  `gerar_link` cria pagamento e persiste `invoiceUrl`; auth/`requireAdmin` barra não-admin.
- Manual/E2E: percorrer o stepper, gerar link, simular webhook de confirmação e verificar
  que o pedido vira `pago` na AbaPedidos.

## 15. Fases futuras (referência, fora deste spec)

- Fase 2: status financeiro×operacional formal; `order_activity_logs` + histórico
  operacional; cancelamento/substituição de link; ações de reembolso separadas; PIN.
- Fase 3: colunas/filtros avançados e métricas no topo (manuais, valor gerado/pago/pendente,
  conversão, ranking de operadores); página de detalhe dedicada; paridade total do onboarding
  (extras, taxa por zona, cupom); origem "importado".
