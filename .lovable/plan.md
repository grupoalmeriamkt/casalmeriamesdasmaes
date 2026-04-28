# Plano: Proteger Access Tokens do Mercado Pago e Meta CAPI

## Problema confirmado
A tabela `app_config` tem RLS `select` aberto a `anon` (necessário para o site público funcionar). Hoje o `payload` jsonb guarda `pagamento.mpAccessToken` e `integracoes.metaAccessToken` — qualquer visitante pode lê-los pelo DevTools. Além disso, as rotas `/api/public/meta-capi` e `/api/public/mp-preference` aceitam o `accessToken` no body vindo do navegador.

Bom dado: você confirmou que **nunca colou um token real**, então não há credencial vazada — só precisamos corrigir antes de você usar de verdade.

## O que vai mudar

### 1. Banco — nova tabela `app_secrets` (migração)
- Tabela separada, RLS **admin-only** para SELECT/INSERT/UPDATE.
- Guarda só os campos sensíveis: `mpAccessToken`, `metaAccessToken`, `webhookUrl` (opcional).
- `app_config` continua igual, mas removo dela os campos sensíveis ao publicar.

### 2. Cliente Supabase Admin no servidor
- Criar `src/integrations/supabase/client.server.ts` usando `SUPABASE_SERVICE_ROLE_KEY` (vou pedir pra você adicionar como secret).
- Esse client só é usado nas rotas `/api/public/*` — nunca no front.

### 3. Rotas públicas param de aceitar token do cliente
- `src/routes/api/public/mp-preference.ts`: remove `accessToken` do schema; lê de `app_secrets` via `supabaseAdmin`.
- `src/routes/api/public/meta-capi.ts`: idem para `accessToken` e `pixelId` (pixelId pode ficar público, mas simplifica unificar).
- Se o token não estiver configurado, retorna 503 com mensagem clara.

### 4. Frontend para de enviar tokens
- `src/lib/metaPixel.ts`: `sendCapiEvent` envia só `eventName`, `eventId`, `userData`, `customData`.
- `src/components/Quiz.tsx`: chamada ao MP envia só `items`, `payer`, `backUrls` etc.

### 5. Admin (UI)
- `AbaPagamento.tsx` e `AbaIntegracoes.tsx`: campos de Access Token viram **write-only**.
  - Se já configurado, mostra "•••• configurado" + botão "Substituir".
  - Salvar grava em `app_secrets` (não em `app_config`).
- `mpPublicKey`, `metaPixelId`, `gtmId`, `whatsappUrl`, `instagramUrl` continuam em `app_config` (são públicos por natureza).

### 6. cloudConfig.ts
- `loadCloudConfig`: carrega `app_config` (público) + tenta carregar `app_secrets` (só funciona se admin logado, senão ignora).
- `saveCloudConfig`: separa o payload — sensível vai pra `app_secrets`, resto pra `app_config`.

## Migração de dados
Como `mpAccessToken` e `metaAccessToken` estão vazios no banco, nada a migrar. Faço só um UPDATE limpando esses campos do payload de `app_config` por garantia.

## Pré-requisito (vou pedir depois de você aprovar)
Adicionar como secret do projeto: `SUPABASE_SERVICE_ROLE_KEY` (você pega no painel do seu Supabase em Project Settings → API → service_role).

## Arquivos afetados

**Criados**
- `supabase/migrations/<timestamp>_app_secrets.sql`
- `src/integrations/supabase/client.server.ts`

**Editados**
- `src/lib/cloudConfig.ts`
- `src/lib/metaPixel.ts`
- `src/routes/api/public/mp-preference.ts`
- `src/routes/api/public/meta-capi.ts`
- `src/components/Quiz.tsx`
- `src/components/admin/AbaPagamento.tsx`
- `src/components/admin/AbaIntegracoes.tsx`
- `src/store/admin.ts` (marcar campos sensíveis como não-persistidos no localStorage também)

## Resultado
- Visitantes do site não conseguem mais ler nenhum token, mesmo com DevTools.
- Tokens só trafegam: navegador do admin → Supabase (RLS admin) e servidor (service role) → API externa.
- Admin continua editando tokens normalmente pelo painel.

Aprove e eu implemento, e em seguida te peço a `SUPABASE_SERVICE_ROLE_KEY`.