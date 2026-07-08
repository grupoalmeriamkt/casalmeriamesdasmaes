# Estudo: Pagamentos — Cielo vs Asaas

> **Data:** 2026-07-03  
> **Status:** Em planejamento — retomar quando houver decisão de negócio e credenciais.  
> **Contexto:** Conversa de validação de integração com maquininha Cielo LIO + análise de migração do gateway online (Asaas → Cielo E-commerce).

---

## Índice

1. [Resumo executivo](#1-resumo-executivo)
2. [Hardware na loja (Cielo Smart / LIO)](#2-hardware-na-loja-cielo-smart--lio)
3. [Três produtos Cielo — qual usar](#3-três-produtos-cielo--qual-usar)
4. [Integração maquininha (LIO) — PAUSADO](#4-integração-maquininha-lio--pausado)
5. [Migração online Asaas → Cielo E-commerce — ESCOPO ATIVO](#5-migração-online-asaas--cielo-e-commerce--escopo-ativo)
6. [Comparativo Asaas vs Cielo E-commerce](#6-comparativo-asaas-vs-cielo-e-commerce)
7. [Mapa técnico atual (Asaas no projeto)](#7-mapa-técnico-atual-asaas-no-projeto)
8. [Estratégia e fases de migração](#8-estratégia-e-fases-de-migração)
9. [Checklists para retomar](#9-checklists-para-retomar)
10. [Decisões pendentes](#10-decisões-pendentes)
11. [Links de referência](#11-links-de-referência)

---

## 1. Resumo executivo

| Tema | Conclusão |
|------|-----------|
| **Maquininha na loja** | Viável via **Integração Remota Cielo Smart (Order Manager API)**. **Pausado** por decisão do negócio. |
| **Link de Pagamento Cielo** | Pagamento online no celular/navegador — **não** usa a maquininha física. |
| **API E-commerce Cielo** | Substitui o **Asaas no canal online** (site, checkout, PIX, cartão). Projeto à parte, ~5–7 semanas de dev. |
| **Recomendação imediata (quando retomar LIO)** | LIO para loja + Asaas para site (dois canais, menor risco). |
| **Recomendação migração online** | Só migrar Asaas → Cielo E-commerce se financeiro aprovar taxas/contrato. Começar por **PIX**, depois **cartão (3DS/SOP)**. |

---

## 2. Hardware na loja (Cielo Smart / LIO)

Terminal identificado nas fotos (jul/2026):

- **Plataforma:** Cielo Smart / LIO (Android)
- **Apps relevantes:** Pagamento, Pedidos, Order Service, Cielo Integração, Cielo Store
- **Apps terceiros instalados:** OdhenPOS, PDV (não são nosso sistema)
- **Conectividade:** Wi-Fi / 4G (necessário para integração remota)
- **Etiqueta física:** "POS 1"

---

## 3. Três produtos Cielo — qual usar

| Produto | Canal | Documentação | Serve para |
|---------|-------|--------------|------------|
| **Integração Remota (Order Manager)** | Maquininha física na loja | [Manual Cielo LIO – Integração Remota](https://developercielo.github.io/manual/cielo-lio#integração-remota) | PDV web envia pedido → LIO cobra → webhook confirma |
| **API E-commerce** | Site / checkout online | [Como começar API E-commerce](https://docs.cielo.com.br/ecommerce-cielo/docs/onbording-api-ecommerce) | PIX + cartão no checkout (substitui Asaas) |
| **API Link de Pagamento** | Link/QR para pagar no celular | [Como começar API Link](https://docs.cielo.com.br/link/docs/como-come%C3%A7ar-api-link-de-pagamento) | Similar ao invoiceUrl do Asaas; produto separado do E-commerce |

**Não confundir:** E-commerce e Link são para **online**. Order Manager é para **maquininha**.

---

## 4. Integração maquininha (LIO) — PAUSADO

### Objetivo (quando retomar)

Cliente na loja paga na maquininha → sistema de pedidos marca **pago automaticamente** com dados reais da transação (bandeira, NSU, valor).

### Fluxo técnico alvo

```
Operador (painel web) → cria pedido manual
       ↓
Backend → POST Order Manager API /orders (reference = pedidoId)
       ↓
Maquininha → app "Pedidos" exibe cobrança
       ↓
Cliente passa cartão no app "Pagamento"
       ↓
Cielo → POST webhook no nosso backend (status Paid/Closed)
       ↓
Backend → syncPedidoPaymentFields + e-mail ops
```

### Ambientes API

| Ambiente | URL base |
|----------|----------|
| Sandbox | `https://api.cielo.com.br/sandbox-lio/order-management/v1` |
| Produção | `https://api.cielo.com.br/order-management/v1` |

### Credenciais necessárias

- Client-ID
- Access Token
- Merchant ID
- Cadastro no portal com API **"Cielo Smart - Order Manager"**
- URL de webhook registrada com suporte Cielo (produção)

### Status do pedido na Cielo

| Status | Significado |
|--------|-------------|
| `Draft` | Criado, não finalizado |
| `Entered` | Aguardando pagamento na LIO |
| `Paid` | Pago |
| `Closed` | Finalizado |

### Fase 1 alternativa (já especificada no projeto)

Método **POS manual** no `PedidoManualStepper`: operador informa bandeira/crédito/débito/CPF e marca pago offline (`pagar_pos`) — **sem** API Cielo. Ver `docs/superpowers/specs/2026-07-03-ajustes-pedidos-design.md` seção 4.

### O que NÃO usar para maquininha

- API Link de Pagamento
- API E-commerce
- Integração Local (app Android na Cielo Store) — nosso PDV é web

---

## 5. Migração online Asaas → Cielo E-commerce — ESCOPO ATIVO

### Objetivo

Substituir Asaas como gateway do **canal online** mantendo comportamento de negócio: pedido → pagamento → confirmação automática → e-mails, ops, Meta CAPI.

### Dentro do escopo

- Checkout público (`/checkout`) — PIX e cartão
- Página `/pagar/$id` — cartão via link do balcão
- Pedido manual — link pagamento, PIX QR, cartão QR
- Webhook, polling de status, conciliação admin
- Comprovante e labels na operação

### Fora do escopo (deste estudo)

- Maquininha LIO / POS presencial
- Dinheiro / POS manual offline
- Mercado Pago (legado)
- Boleto

### Estimativa

~**5–7 semanas** (1 dev experiente): fundação → PIX → cartão (3DS/SOP) → balcão/operação → go-live.

### Abordagem recomendada

**Provider abstraction + feature flag + cutover**

```ts
payment_provider: 'asaas' | 'cielo'  // app_config ou env
```

- Novos pedidos usam provider ativo
- Pedidos antigos continuam no Asaas
- Webhooks dos dois durante transição se necessário

---

## 6. Comparativo Asaas vs Cielo E-commerce

| Critério | Asaas (atual) | Cielo E-commerce |
|----------|---------------|------------------|
| Credenciais | 1 API Key | MerchantId + MerchantKey |
| PIX | Nativo, QR na API | Sim — habilitar no EC |
| Cartão | Dados no backend (`creditCard` no charge) | 3DS e/ou Silent Order Post (PCI) |
| Webhook | Token + eventos payment | Post de Notificação |
| Link pagamento | `invoiceUrl` nativo | API Link **ou** manter `/pagar/$id` com SOP |
| Cliente CPF | `upsertCustomer` | Dados na transação (sem cadastro obrigatório) |
| Split | `asaasWalletId` | Modelo diferente — **validar com financeiro** |
| Complexidade | Baixa–média | Média–alta (cartão) |
| Sandbox | Sim | Sim |

### Maior mudança técnica: cartão

Hoje: PAN vai direto ao Asaas no servidor.  
Cielo: **Silent Order Post** (token no browser) + **3DS** (autenticação do portador).

**Decisão pendente:** SOP + 3DS Data Only vs 3DS completo.

### Link de pagamento no balcão — opções

| Opção | Descrição |
|-------|-----------|
| **A** | API Link de Pagamento Cielo (mais parecido com Asaas invoiceUrl) |
| **B** | Checkout Cielo redirect/iframe |
| **C** | Manter `/pagar/$id` com SOP (**recomendado** — UI já existe) |

---

## 7. Mapa técnico atual (Asaas no projeto)

### Fluxos

```
Cliente site:     /checkout → POST /api/public/asaas/charge → webhook → pedido pago
Balcão link:      gerar_link → invoiceUrl Asaas
Balcão PIX:       gerar_pix → QR Asaas
Balcão cartão QR: link + /pagar/$id → asaas/charge
Acompanhamento:   /sucesso/$id → GET /api/public/asaas/status/$id
Admin:            conciliar-asaas
```

### Arquivos acoplados ao Asaas

| Camada | Arquivos |
|--------|----------|
| Integração | `src/integrations/asaas/*` |
| APIs | `asaas/charge.ts`, `asaas/webhook.ts`, `asaas/status.$id.ts`, `admin/conciliar-asaas.ts`, `admin/pedidos.ts` (gerar_link, gerar_pix) |
| Frontend | `CheckoutAsaas.tsx`, `checkout.tsx`, `CardPaymentForm.tsx`, `cardCharge.ts`, `PedidoManualStepper.tsx`, `CartaoQrDisplay.tsx`, `PixQrCode.tsx` |
| Sync | `pedidoSync.ts`, `asaasStatus.ts`, `asaasBillingType.ts`, `paymentStatus.ts` |
| Operação | `ComprovanteAsaas.tsx`, `PedidoDetalheContent.tsx` |
| Banco | `pagamentos.asaas_payment_id` (NOT NULL), `asaas_webhook_events` |
| Secrets | `asaasApiKey`, `asaasWalletId`, `asaasWebhookToken` em `app_secrets` |

### Funcionalidades a preservar na migração

- Cupom e total validados server-side
- Disponibilidade (data/horário entrega)
- Checkout access token
- Rate limit endpoints públicos
- Split opcional (`asaasWalletId`) — validar na Cielo
- Reconciliação admin
- Dedupe webhook (cupom, e-mail ops, Meta CAPI)

---

## 8. Estratégia e fases de migração

### Fase 0 — Decisão e setup (3–5 dias, negócio)

- EC Cielo E-commerce contratado
- Credenciais sandbox
- PIX habilitado
- Decisão 3DS/SOP e link balcão
- Comparativo de taxas
- Confirmar se split é requisito

### Fase 1 — Fundação (1–2 semanas)

- Migration: `pagamentos` com `provider`, `external_payment_id`
- `cielo_webhook_events`
- `src/integrations/cielo/client.server.ts`
- `src/lib/paymentProvider.ts` (interface comum)
- Refatorar `pedidoSync` / `paymentStatus` provider-agnostic
- Secrets e admin config Cielo

### Fase 2 — PIX online (~1 semana)

- Charge PIX via Cielo
- Webhook + polling
- Pedido manual `gerar_pix`

### Fase 3 — Cartão online (1,5–2 semanas)

- SOP e/ou 3DS no front
- `/checkout` e `/pagar/$id`
- Tratamento recusa/timeout

### Fase 4 — Balcão e operação (~1 semana)

- `gerar_link`, comprovante, conciliação, labels

### Fase 5 — Go-live (~1 semana)

- Credenciais produção
- URL notificação no site Cielo
- Feature flag `payment_provider=cielo`
- Runbook rollback

### Fase 6 — Descomissionamento Asaas (opcional)

- Manter webhook legado para pedidos pendentes
- Remover código após janela de conciliação (~90 dias)

### Mapeamento de status (rascunho)

| Interno | Asaas | Cielo (a definir) |
|---------|-------|-------------------|
| pendente | PENDING | Não finalizado |
| aprovado | CONFIRMED, RECEIVED | PaymentConfirmed / Capturado |
| recusado | REFUNDED, OVERDUE… | Denied / Cancelado |

---

## 9. Checklists para retomar

### Maquininha (LIO) — quando despausar

```
□ Conta Portal Desenvolvedores Cielo
□ App com API "Cielo Smart - Order Manager"
□ Credenciais SANDBOX: Client-ID / Access Token / Merchant ID
□ Nº de maquininhas na loja
□ Fluxo em caso de falha na maquininha
□ URL webhook produção cadastrada na Cielo
□ Teste presencial na loja
```

### Migração online (Cielo E-commerce)

```
□ EC Cielo E-commerce contratado
□ Credenciais SANDBOX (MerchantId + MerchantKey)
□ Credenciais PRODUÇÃO (go-live)
□ PIX habilitado no EC
□ URL de notificação no site Cielo
□ Decisão: 3DS completo ou Data Only
□ Decisão: split/repasse — necessário? Sim/Não
□ Comparativo de taxas aprovado pelo financeiro
□ Janela de go-live (evitar véspera de campanha)
```

---

## 10. Decisões pendentes

| # | Decisão | Opções | Impacto |
|---|---------|--------|---------|
| 1 | Migrar Asaas → Cielo E-commerce? | Sim / Não / Depois | Define se Fase 0+ inicia |
| 2 | Cartão: SOP vs 3DS | SOP+Data Only / 3DS full | UX e aprovação |
| 3 | Link balcão | Cielo Link / `/pagar/$id` | Esforço e UX |
| 4 | Split/repasse | Manter / dispensar | Pode bloquear migração |
| 5 | Maquininha LIO | Pausado / retomar Fase 1 manual / API | Escopo paralelo |
| 6 | Go-live | Big bang vs feature flag | Risco operacional |

---

## 11. Links de referência

- [Integração Remota Cielo Smart (Order Manager)](https://developercielo.github.io/manual/cielo-lio#integração-remota)
- [Portal Desenvolvedores Cielo](https://desenvolvedores.cielo.com.br)
- [API E-commerce — Como começar](https://docs.cielo.com.br/ecommerce-cielo/docs/onbording-api-ecommerce)
- [API E-commerce — Post de Notificação](https://docs.cielo.com.br/ecommerce-cielo/docs/post-de-notificacao)
- [API E-commerce — Pix](https://docs.cielo.com.br/ecommerce-cielo/docs/pix)
- [API E-commerce — Silent Order Post](https://docs.cielo.com.br/ecommerce-cielo/docs/sop)
- [API E-commerce — 3DS](https://docs.cielo.com.br/ecommerce-cielo/docs/o-que-e-a-autenticacao-3ds)
- [API Link de Pagamento](https://docs.cielo.com.br/link/docs/como-come%C3%A7ar-api-link-de-pagamento)
- [Suporte Cielo — Modelos de integração LIO](https://devcielo.zendesk.com/hc/pt-br/articles/115011719527)

### Docs internos do projeto

- `docs/superpowers/specs/2026-07-03-ajustes-pedidos-design.md` — POS manual (seção 4)
- `docs/SECURITY.md` — hardening checkout
- `supabase/migrations/20260430_asaas_integration.sql` — schema pagamentos

---

## Como retomar esta conversa

Ao voltar, diga algo como:

> "Retomar o estudo de pagamentos Cielo em `docs/estudos/2026-07-03-gateway-pagamentos-cielo.md`"

Ou especifique o trilho:

- **"Quero implementar a migração Asaas → Cielo E-commerce"** → começar Fase 0/1
- **"Quero retomar a integração com a maquininha"** → Order Manager + webhook LIO
- **"Só quero o POS manual por enquanto"** → spec em `2026-07-03-ajustes-pedidos-design.md`

---

*Documento gerado a partir da sessão de estudo de 2026-07-03.*
