# Segurança — Casa Almeria

Registro das medidas de segurança implementadas no projeto, pendências operacionais e instruções de manutenção.

**Última revisão:** 2026-07-08

---

## Resumo executivo

| Área | Status |
|------|--------|
| Autorização em rotas admin | Implementado |
| Proteção financeira (total/cupom/charge) | Implementado |
| Token de acesso ao checkout (UUID + segredo) | Implementado |
| Hash de senhas em share_tokens | Implementado (migration) |
| Rate limiting em APIs públicas | Implementado (in-memory) |
| Headers de segurança HTTP | Implementado (`vercel.json`) |
| Sign-up público desabilitado | **Ação manual no Supabase** |

---

## 1. Revisão de 2026-07-03 — correções críticas

### 1.1 Escalação de privilégio (rotas admin)

**Problema:** Várias rotas aceitavam qualquer JWT válido, sem verificar role.

**Correção:**

| Rota | Proteção |
|------|----------|
| `/api/admin/save-config` | `requireAdmin` |
| `/api/admin/cupons` | `requireAdmin` |
| `/api/admin/arquivar-pedidos` | `canAccessCozinha` |
| `/api/admin/conciliar-asaas` | `canAccessCozinha` |
| `/api/admin/conciliacao-pendencias` | `canAccessCozinha` |

**Arquivos:** `src/lib/authServer.ts`, rotas em `src/routes/api/admin/*`

### 1.2 Manipulação de valor no pagamento

**Problema:** `POST /api/public/asaas/charge` usava `body.total` do cliente.

**Correção:**
- Total validado contra `pedidos.total` no banco
- Cupom validado com total do pedido
- Bloqueio de recobrança (`status === "pago"` → 409, `cancelado` → 410)
- Remoção de `body` interno do Asaas nas respostas de erro

**Arquivo:** `src/routes/api/public/asaas/charge.ts`

### 1.3 IDOR em edição por token

**Problema:** Token válido podia editar qualquer `pedido_id`.

**Correção:** Validação de escopo por `campanha_id` + suporte a `senha` no body.

**Arquivo:** `src/routes/api/pedidos/editar-por-token.ts`

### 1.4 Proxies abertos (Meta / Mercado Pago)

**Problema:** Qualquer cliente podia usar tokens de integração via API pública.

**Correção:**
- `meta-capi`: só aceita `pixelId` configurado em `app_config`
- `mp-preference`: exige UUID de pedido válido e total conferido

**Arquivos:** `src/routes/api/public/meta-capi.ts`, `src/routes/api/public/mp-preference.ts`

---

## 2. Revisão de 2026-07-08 — endurecimento adicional

### 2.1 Token de acesso ao checkout

**Problema:** Endpoints públicos por UUID expunham dados a quem soubesse o UUID.

**Solução:**

1. Coluna `pedidos.access_token` (64 chars hex, gerado automaticamente)
2. RPC `upsert_pedido_rascunho` retorna `{ id, access_token }`
3. Cliente envia header `X-Checkout-Access` ou query `?access=`
4. Staff (cozinha/admin) pode acessar com `Authorization: Bearer` em rotas de comprovante

**Arquivos novos:**
- `src/lib/checkoutAccess.ts`
- `src/lib/checkoutAccess.server.ts`

**Migration:** `supabase/migrations/20260708_security_hardening.sql`

### 2.2 Hash de senhas em share_tokens

**Solução:** pgcrypto + trigger bcrypt + migração de senhas legadas.

**Migration:** `supabase/migrations/20260708_security_hardening.sql`

### 2.3 Rate limiting

**Arquivo:** `src/lib/rateLimit.server.ts`

| Rota | Limite |
|------|--------|
| `/api/public/asaas/charge` | 20/min |
| `/api/public/cupom/validar` | 30/min |
| `/api/public/pedido/$id` | 60/min |
| `/api/public/pagamento/$id` | 60/min |
| `/api/public/comprovante/$id` | 30/min |
| `/api/public/asaas/status/$id` | 120/min |
| `/api/public/meta-capi` | 60/min |
| `/api/public/mp-preference` | 20/min |

### 2.4 Headers HTTP

Configurados em `vercel.json`: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

### 2.5 Sign-up público (ação manual)

No painel Supabase: **Authentication → Providers → Email → desabilitar Enable sign ups**.

---

## 3. Deploy — checklist

- [ ] Aplicar migration `20260708_security_hardening.sql`
- [ ] Desabilitar sign-up no Supabase
- [ ] Deploy na Vercel
- [ ] Testar checkout, sucesso PIX e QR do pedido manual

```bash
supabase db push
```

Se `share_tokens` não existir no remoto, a migration `20260708_security_hardening.sql` agora cria a tabela automaticamente. Use `supabase/scripts/diagnostico_tabelas.sql` no SQL Editor para confirmar antes/depois.

---

## 4. Arquivos principais

```
src/lib/authServer.ts
src/lib/checkoutAccess.ts
src/lib/checkoutAccess.server.ts
src/lib/rateLimit.server.ts
supabase/migrations/20260708_security_hardening.sql
docs/SECURITY.md
vercel.json
```

---

## 5. Manutenção

Ao adicionar rota `/api/public/*`:
1. Avaliar exposição de dados
2. Adicionar verificação de acesso
3. Adicionar rate limit
4. Atualizar este documento
