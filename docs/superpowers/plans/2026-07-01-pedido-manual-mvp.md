# Pedido Manual (Fase 1 / MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que um admin monte um pedido manual pelo painel, reaproveitando o onboarding público, gere um link de pagamento Asaas e acompanhe o status automaticamente, com o operador responsável registrado.

**Architecture:** Extrair a lógica pura de onboarding para módulos reutilizáveis (`src/lib/orderForm/`) e construir um stepper admin novo que os consome; o Quiz público fica intocado. O link de pagamento reutiliza a cobrança Asaas existente (`createPayment` → `invoiceUrl`) e a tabela `pagamentos`, deixando o webhook existente sincronizar o status. Operador = usuário logado, com perfil na nova tabela `operators`.

**Tech Stack:** TanStack Start + Router (React 19, Vite), Supabase (Postgres + Auth), Asaas, Tailwind v4 + shadcn/Radix, Zustand (store admin), Zod, Sonner, Vitest.

## Global Constraints

- Rotas de API são arquivos `createFileRoute("/api/...")({ server: { handlers: { GET/POST } } })`.
- **Todo endpoint admin** chama `authenticateRequest(request)` → 401 se null, e `requireAdmin(auth.admin, auth.user.id)` → 403 se false. Acesso ao banco via `auth.admin` (service_role).
- UI usa tokens Tailwind existentes (`charcoal`, `olive`, `terracotta`, `linen`, `border`, `muted-foreground`), componentes shadcn (`Button`, `Input`, `Dialog`, `DialogContent/Header/Footer/Title`), ícones `lucide-react`, `toast` de `sonner`, e o wrapper `AdminSection` de `@/components/admin/AdminField`.
- Testes: **Vitest**, `environment: "node"`, arquivos `src/**/*.test.ts` (sem JSX nos arquivos de teste). Rodar com `npm test`. Type-check com `npx tsc --noEmit`.
- **Nunca reimplementar** regras de disponibilidade/preço: importar de `@/lib/availability` e `@/lib/executionAt`.
- **Não alterar** o Quiz público (`src/components/Quiz.tsx`) nem o RPC `upsert_pedido_rascunho`.
- Valores monetários em `numeric` BRL.
- Cada task termina com commit. Mensagens no padrão convencional; ao final de cada commit adicionar a linha `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Migração de banco (operators, pedidos, pagamentos)

**Files:**
- Create: `supabase/migrations/20260701_pedido_manual_v1.sql`

**Interfaces:**
- Produces: tabela `operators`; colunas `pedidos.origin`, `pedidos.operator_id`; colunas `pagamentos.invoice_url` e `pagamentos.metodo` (agora nullable).

- [ ] **Step 1: Escrever a migração**

Create `supabase/migrations/20260701_pedido_manual_v1.sql`:

```sql
-- Fase 1 do modulo de pedido manual.
-- Idempotente: pode ser reaplicada sem erro.

-- 1) Operadores (perfil vinculado ao login)
create table if not exists operators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  short_name text,
  email text,
  phone text,
  role_title text,
  internal_key text,
  pin_hash text,
  is_active boolean not null default true,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists operators_user_id_key
  on operators(user_id) where user_id is not null;
create unique index if not exists operators_internal_key_key
  on operators(internal_key) where internal_key is not null;
create index if not exists idx_operators_is_active on operators(is_active);

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_operators_updated on operators;
create trigger trg_operators_updated before update on operators
  for each row execute function set_updated_at();

alter table operators enable row level security;

drop policy if exists operators_admin_all on operators;
create policy operators_admin_all on operators
  for all to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

drop policy if exists operators_self_read on operators;
create policy operators_self_read on operators
  for select to authenticated
  using (user_id = auth.uid());

-- 2) pedidos: origem e operador
alter table pedidos add column if not exists origin text not null default 'publico';
alter table pedidos drop constraint if exists pedidos_origin_check;
alter table pedidos add constraint pedidos_origin_check
  check (origin in ('publico','manual','importado'));
alter table pedidos add column if not exists operator_id uuid
  references operators(id) on delete set null;
create index if not exists idx_pedidos_origin_manual
  on pedidos(origin) where origin = 'manual';

-- 3) pagamentos: link do Asaas e metodo nullable
alter table pagamentos add column if not exists invoice_url text;
alter table pagamentos alter column metodo drop not null;
alter table pagamentos drop constraint if exists pagamentos_metodo_check;
alter table pagamentos add constraint pagamentos_metodo_check
  check (metodo is null or metodo in ('PIX','CREDIT_CARD','BOLETO'));
```

- [ ] **Step 2: Validar a sintaxe e aplicar no banco**

Aplicar via Supabase (CLI `supabase db push`, ou colar no SQL Editor do projeto). Confirmar que executa sem erro e é idempotente rodando **duas vezes** — a segunda execução não deve gerar erro.

Verificação manual (SQL Editor):
```sql
select column_name, is_nullable from information_schema.columns
  where table_name = 'pagamentos' and column_name in ('metodo','invoice_url');
-- metodo -> YES (nullable); invoice_url presente
select column_name from information_schema.columns
  where table_name = 'pedidos' and column_name in ('origin','operator_id');
-- retorna as duas linhas
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260701_pedido_manual_v1.sql
git commit -m "feat(pedido-manual): migracao operators, origin/operator_id e pagamentos.invoice_url

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Helper `mapBillingTypeToMetodo` (TDD)

**Files:**
- Create: `src/lib/asaasBillingType.ts`
- Test: `src/lib/asaasBillingType.test.ts`

**Interfaces:**
- Produces: `mapBillingTypeToMetodo(billingType: string | null | undefined): "PIX" | "CREDIT_CARD" | "BOLETO" | null`

- [ ] **Step 1: Escrever o teste que falha**

Create `src/lib/asaasBillingType.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapBillingTypeToMetodo } from "./asaasBillingType";

describe("mapBillingTypeToMetodo", () => {
  it("mapeia tipos concretos", () => {
    expect(mapBillingTypeToMetodo("PIX")).toBe("PIX");
    expect(mapBillingTypeToMetodo("CREDIT_CARD")).toBe("CREDIT_CARD");
    expect(mapBillingTypeToMetodo("BOLETO")).toBe("BOLETO");
  });
  it("retorna null para UNDEFINED/desconhecido/vazio", () => {
    expect(mapBillingTypeToMetodo("UNDEFINED")).toBeNull();
    expect(mapBillingTypeToMetodo(undefined)).toBeNull();
    expect(mapBillingTypeToMetodo(null)).toBeNull();
    expect(mapBillingTypeToMetodo("FOO")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -- asaasBillingType`
Expected: FAIL (módulo `./asaasBillingType` não existe).

- [ ] **Step 3: Implementar**

Create `src/lib/asaasBillingType.ts`:

```ts
export type MetodoPagamento = "PIX" | "CREDIT_CARD" | "BOLETO";

/** Converte o billingType do Asaas no nosso enum de metodo. Retorna null para UNDEFINED/desconhecido. */
export function mapBillingTypeToMetodo(
  billingType: string | null | undefined,
): MetodoPagamento | null {
  switch (billingType) {
    case "PIX":
    case "CREDIT_CARD":
    case "BOLETO":
      return billingType;
    default:
      return null;
  }
}
```

- [ ] **Step 4: Rodar e confirmar passa**

Run: `npm test -- asaasBillingType`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/asaasBillingType.ts src/lib/asaasBillingType.test.ts
git commit -m "feat(pedido-manual): helper mapBillingTypeToMetodo

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Webhook grava `metodo` a partir do `billingType`

**Files:**
- Modify: `src/routes/api/public/asaas/webhook.ts` (bloco que faz `.from("pagamentos").update({...})`, ~linhas 127-135)

**Interfaces:**
- Consumes: `mapBillingTypeToMetodo` (Task 2)

- [ ] **Step 1: Adicionar o import**

No topo de `src/routes/api/public/asaas/webhook.ts`, adicionar:

```ts
import { mapBillingTypeToMetodo } from "@/lib/asaasBillingType";
```

- [ ] **Step 2: Atualizar o update de `pagamentos`**

Substituir o bloco atual:

```ts
const { data: pagamento, error: payErr } = await admin
  .from("pagamentos")
  .update({
    status: newStatus,
    raw_response: event.payment as unknown as Record<string, unknown>,
  })
  .eq("asaas_payment_id", event.payment.id)
  .select("id, pedido_id, cupom_codigo, status")
  .maybeSingle();
```

por:

```ts
const metodoDerivado = mapBillingTypeToMetodo(
  (event.payment as { billingType?: string }).billingType,
);
const updatePatch: Record<string, unknown> = {
  status: newStatus,
  raw_response: event.payment as unknown as Record<string, unknown>,
};
if (metodoDerivado) updatePatch.metodo = metodoDerivado;

const { data: pagamento, error: payErr } = await admin
  .from("pagamentos")
  .update(updatePatch)
  .eq("asaas_payment_id", event.payment.id)
  .select("id, pedido_id, cupom_codigo, status")
  .maybeSingle();
```

- [ ] **Step 3: Type-check + testes existentes**

Run: `npx tsc --noEmit && npm test`
Expected: sem erros de tipo; suíte existente passa (nenhum teste quebra).

- [ ] **Step 4: Commit**

```bash
git add src/routes/api/public/asaas/webhook.ts
git commit -m "feat(pedido-manual): webhook preenche metodo a partir do billingType

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `orderForm/types.ts` + `orderForm/schema.ts` (TDD)

**Files:**
- Create: `src/lib/orderForm/types.ts`
- Create: `src/lib/orderForm/schema.ts`
- Test: `src/lib/orderForm/schema.test.ts`

**Interfaces:**
- Produces: type `ManualOrderInput`, `ManualOrderItem`; `manualOrderSchema` (Zod), `cpfParaLinkSchema` (Zod).

- [ ] **Step 1: Escrever os tipos**

Create `src/lib/orderForm/types.ts`:

```ts
export type ManualOrderItem = {
  produto_id: string;
  produto_tipo: "cesta" | "sobremesa";
  nome: string;
  preco: number;
  quantidade: number;
};

export type ManualOrderInput = {
  cliente: { nome: string; whatsapp: string; email?: string; cpf?: string };
  itens: ManualOrderItem[];
  tipo: "delivery" | "retirada";
  enderecoOuUnidade: string;
  unidadeId?: string | null;
  data?: string | null;
  horario?: string | null;
  observacoes?: string;
};
```

- [ ] **Step 2: Escrever o teste que falha**

Create `src/lib/orderForm/schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { manualOrderSchema, cpfParaLinkSchema } from "./schema";

const base = {
  cliente: { nome: "Maria Silva", whatsapp: "61999998888" },
  itens: [
    { produto_id: "aconchego", produto_tipo: "cesta", nome: "Cesta", preco: 255, quantidade: 1 },
  ],
  tipo: "retirada",
  enderecoOuUnidade: "Asa Sul",
  unidadeId: "asa-sul",
};

describe("manualOrderSchema", () => {
  it("aceita um pedido de retirada valido", () => {
    expect(manualOrderSchema.safeParse(base).success).toBe(true);
  });
  it("rejeita pedido sem produtos", () => {
    expect(manualOrderSchema.safeParse({ ...base, itens: [] }).success).toBe(false);
  });
  it("exige unidadeId quando tipo e retirada", () => {
    expect(manualOrderSchema.safeParse({ ...base, unidadeId: null }).success).toBe(false);
  });
  it("nao exige unidadeId para delivery", () => {
    const r = manualOrderSchema.safeParse({
      ...base, tipo: "delivery", unidadeId: null, enderecoOuUnidade: "SQS 100",
    });
    expect(r.success).toBe(true);
  });
  it("rejeita nome curto", () => {
    const r = manualOrderSchema.safeParse({
      ...base, cliente: { nome: "Ma", whatsapp: "61999998888" },
    });
    expect(r.success).toBe(false);
  });
});

describe("cpfParaLinkSchema", () => {
  it("aceita 11 digitos", () => {
    expect(cpfParaLinkSchema.safeParse("12345678901").success).toBe(true);
  });
  it("rejeita vazio", () => {
    expect(cpfParaLinkSchema.safeParse("").success).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar e confirmar falha**

Run: `npm test -- orderForm/schema`
Expected: FAIL (`./schema` não existe).

- [ ] **Step 4: Implementar o schema**

Create `src/lib/orderForm/schema.ts`:

```ts
import { z } from "zod";

export const manualOrderItemSchema = z.object({
  produto_id: z.string().min(1),
  produto_tipo: z.enum(["cesta", "sobremesa"]),
  nome: z.string().min(1),
  preco: z.number().nonnegative(),
  quantidade: z.number().int().positive(),
});

export const manualOrderSchema = z
  .object({
    cliente: z.object({
      nome: z.string().trim().min(3, "Nome muito curto"),
      whatsapp: z.string().trim().min(10, "WhatsApp invalido"),
      email: z.union([z.string().trim().email("E-mail invalido"), z.literal("")]).optional(),
      cpf: z.string().trim().optional(),
    }),
    itens: z.array(manualOrderItemSchema).min(1, "Selecione ao menos um produto"),
    tipo: z.enum(["delivery", "retirada"]),
    enderecoOuUnidade: z.string().trim().min(1, "Informe o endereco ou unidade"),
    unidadeId: z.string().nullable().optional(),
    data: z.string().nullable().optional(),
    horario: z.string().nullable().optional(),
    observacoes: z.string().optional(),
  })
  .refine((v) => (v.tipo === "retirada" ? !!v.unidadeId : true), {
    message: "Selecione a unidade de retirada",
    path: ["unidadeId"],
  });

export type ManualOrderParsed = z.infer<typeof manualOrderSchema>;

/** CPF obrigatorio para gerar o link (Asaas exige cpfCnpj). Aceita 11 digitos ou formatado. */
export const cpfParaLinkSchema = z
  .string()
  .trim()
  .regex(/^\d{11}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF invalido");
```

- [ ] **Step 5: Rodar e confirmar passa**

Run: `npm test -- orderForm/schema`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/orderForm/types.ts src/lib/orderForm/schema.ts src/lib/orderForm/schema.test.ts
git commit -m "feat(pedido-manual): tipos e schema Zod do onboarding manual

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `orderForm/buildPayload.ts` (TDD)

**Files:**
- Create: `src/lib/orderForm/buildPayload.ts`
- Test: `src/lib/orderForm/buildPayload.test.ts`

**Interfaces:**
- Consumes: `ManualOrderInput` (Task 4); `computeExecutionAt` de `@/lib/executionAt`; `buildRegrasForItens`, `resolveProductionSector`, `CarrinhoItem` de `@/lib/availability`.
- Produces: `buildPedidoManualPayload(input: ManualOrderInput, operatorId: string | null): PedidoManualPayload`; `calcularTotal(itens): number`; type `PedidoManualPayload`.

- [ ] **Step 1: Escrever o teste que falha**

Create `src/lib/orderForm/buildPayload.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildPedidoManualPayload, calcularTotal } from "./buildPayload";
import type { ManualOrderInput } from "./types";

const input: ManualOrderInput = {
  cliente: { nome: "Maria Silva", whatsapp: "61999998888", email: "m@x.com", cpf: "12345678901" },
  itens: [
    { produto_id: "aconchego", produto_tipo: "cesta", nome: "Cesta Aconchego", preco: 255, quantidade: 2 },
    { produto_id: "travessa-morango", produto_tipo: "sobremesa", nome: "Travessa", preco: 65, quantidade: 1 },
  ],
  tipo: "retirada",
  enderecoOuUnidade: "Asa Sul",
  unidadeId: "asa-sul",
  data: "2026-07-10",
  horario: "Entre 12h e 17h",
};

describe("calcularTotal", () => {
  it("soma preco*quantidade", () => {
    expect(calcularTotal(input.itens)).toBe(255 * 2 + 65);
  });
});

describe("buildPedidoManualPayload", () => {
  it("marca origin manual e operador", () => {
    const p = buildPedidoManualPayload(input, "op-1");
    expect(p.origin).toBe("manual");
    expect(p.operator_id).toBe("op-1");
    expect(p.status).toBe("aguardando_pagamento");
  });
  it("separa cesta e sobremesas e soma total", () => {
    const p = buildPedidoManualPayload(input, null);
    expect(p.cesta?.nome).toBe("Cesta Aconchego");
    expect(p.sobremesas).toHaveLength(1);
    expect(p.total).toBe(575);
  });
  it("calcula execution_at a partir de data + horario", () => {
    const p = buildPedidoManualPayload(input, null);
    expect(p.execution_at).toBeTruthy();
  });
  it("normaliza cpf/email vazios para null", () => {
    const p = buildPedidoManualPayload(
      { ...input, cliente: { nome: "Ana Paula", whatsapp: "61988887777" } },
      null,
    );
    expect(p.cliente_cpf).toBeNull();
    expect(p.cliente_email).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -- orderForm/buildPayload`
Expected: FAIL (`./buildPayload` não existe).

- [ ] **Step 3: Implementar**

Create `src/lib/orderForm/buildPayload.ts`:

```ts
import { computeExecutionAt } from "@/lib/executionAt";
import {
  buildRegrasForItens,
  resolveProductionSector,
  type CarrinhoItem,
} from "@/lib/availability";
import type { ManualOrderInput, ManualOrderItem } from "./types";

export type PedidoManualPayload = {
  origin: "manual";
  operator_id: string | null;
  cliente_nome: string;
  cliente_whatsapp: string;
  cliente_email: string | null;
  cliente_cpf: string | null;
  cesta: { nome: string; quantidade: number; preco: number } | null;
  sobremesas: { nome: string; quantidade: number; preco: number }[];
  tipo: string;
  endereco_ou_unidade: string;
  data_entrega: string | null;
  horario: string | null;
  pagamento: { metodo: string; status: string; observacoes_internas?: string };
  total: number;
  status: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_is_buyer: boolean;
  unidade_id: string | null;
  production_sector: string | null;
  execution_at: string | null;
};

export function calcularTotal(itens: ManualOrderItem[]): number {
  return itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0);
}

export function buildPedidoManualPayload(
  input: ManualOrderInput,
  operatorId: string | null,
): PedidoManualPayload {
  const cestaItem = input.itens.find((i) => i.produto_tipo === "cesta") ?? null;
  const sobremesaItens = input.itens.filter((i) => i.produto_tipo === "sobremesa");

  const itensCarrinho: CarrinhoItem[] = input.itens.map((i) => ({
    produto_id: i.produto_id,
    produto_tipo: i.produto_tipo,
    nome: i.nome,
  }));
  const productionSector = itensCarrinho.length
    ? resolveProductionSector(itensCarrinho, buildRegrasForItens(itensCarrinho))
    : null;

  const emailTrim = input.cliente.email?.trim();
  const cpfTrim = input.cliente.cpf?.trim();

  return {
    origin: "manual",
    operator_id: operatorId,
    cliente_nome: input.cliente.nome,
    cliente_whatsapp: input.cliente.whatsapp,
    cliente_email: emailTrim ? emailTrim : null,
    cliente_cpf: cpfTrim ? cpfTrim : null,
    cesta: cestaItem
      ? { nome: cestaItem.nome, quantidade: cestaItem.quantidade, preco: cestaItem.preco }
      : null,
    sobremesas: sobremesaItens.map((s) => ({
      nome: s.nome, quantidade: s.quantidade, preco: s.preco,
    })),
    tipo: input.tipo,
    endereco_ou_unidade: input.enderecoOuUnidade,
    data_entrega: input.data ?? null,
    horario: input.horario ?? null,
    pagamento: {
      metodo: "",
      status: "aguardando_pagamento",
      ...(input.observacoes ? { observacoes_internas: input.observacoes } : {}),
    },
    total: calcularTotal(input.itens),
    status: "aguardando_pagamento",
    recipient_name: input.cliente.nome,
    recipient_phone: input.cliente.whatsapp,
    recipient_is_buyer: true,
    unidade_id: input.unidadeId ?? null,
    production_sector: productionSector,
    execution_at: computeExecutionAt(input.data ?? null, input.horario ?? null),
  };
}
```

- [ ] **Step 4: Rodar e confirmar passa**

Run: `npm test -- orderForm/buildPayload`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/orderForm/buildPayload.ts src/lib/orderForm/buildPayload.test.ts
git commit -m "feat(pedido-manual): builder do payload do pedido manual

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `operatorsServer.ts` + endpoint `/api/admin/operators`

**Files:**
- Create: `src/lib/operatorsServer.ts`
- Create: `src/routes/api/admin/operators.ts`

**Interfaces:**
- Produces: `ensureOperator(admin, userId, { name, email? }): Promise<OperatorRow | null>`; type `OperatorRow`; endpoint `/api/admin/operators` (GET lista; POST `auto` | `atualizar` | `definir_ativo`).

- [ ] **Step 1: Implementar `ensureOperator`**

Create `src/lib/operatorsServer.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type OperatorRow = {
  id: string;
  user_id: string | null;
  name: string;
  short_name: string | null;
  email: string | null;
  phone: string | null;
  role_title: string | null;
  internal_key: string | null;
  is_active: boolean;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Garante que exista um operador para o usuario logado; cria se necessario. */
export async function ensureOperator(
  admin: SupabaseClient,
  userId: string,
  info: { name: string; email?: string | null },
): Promise<OperatorRow | null> {
  const { data: existing } = await admin
    .from("operators")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await admin
      .from("operators")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", existing.id);
    return existing as OperatorRow;
  }

  const { data: created, error } = await admin
    .from("operators")
    .insert({
      user_id: userId,
      name: info.name || info.email || "Operador",
      email: info.email ?? null,
      is_active: true,
      last_activity_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    console.error("[ensureOperator]", error);
    return null;
  }
  return created as OperatorRow;
}
```

- [ ] **Step 2: Implementar o endpoint**

Create `src/routes/api/admin/operators.ts`:

```ts
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest, requireAdmin } from "@/lib/authServer";
import { ensureOperator } from "@/lib/operatorsServer";

const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("auto") }),
  z.object({
    action: z.literal("atualizar"),
    id: z.string().uuid(),
    name: z.string().min(1).optional(),
    short_name: z.string().nullable().optional(),
    role_title: z.string().nullable().optional(),
    internal_key: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal("definir_ativo"),
    id: z.string().uuid(),
    is_active: z.boolean(),
  }),
]);

export const Route = createFileRoute("/api/admin/operators")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });
        if (!(await requireAdmin(auth.admin, auth.user.id))) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }
        const { data, error } = await auth.admin
          .from("operators")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) {
          console.error("[operators] list error", error);
          return Response.json({ error: error.message }, { status: 500 });
        }
        return Response.json({ operators: data ?? [] });
      },
      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });
        if (!(await requireAdmin(auth.admin, auth.user.id))) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400 });
        }
        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "invalid_body" }, { status: 400 });
        }

        if (parsed.data.action === "auto") {
          const op = await ensureOperator(auth.admin, auth.user.id, {
            name: (auth.user.user_metadata?.name as string) ?? auth.user.email ?? "Operador",
            email: auth.user.email ?? null,
          });
          if (!op) return Response.json({ error: "ensure_failed" }, { status: 500 });
          return Response.json({ operator: op });
        }

        if (parsed.data.action === "atualizar") {
          const { id } = parsed.data;
          const patch: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(parsed.data)) {
            if (k === "action" || k === "id") continue;
            if (v !== undefined) patch[k] = v;
          }
          if (Object.keys(patch).length === 0) {
            return Response.json({ error: "nenhum_campo" }, { status: 400 });
          }
          const { error } = await auth.admin.from("operators").update(patch).eq("id", id);
          if (error) {
            console.error("[operators] atualizar error", error);
            return Response.json({ error: error.message }, { status: 500 });
          }
          return Response.json({ ok: true });
        }

        const { id, is_active } = parsed.data;
        const { error } = await auth.admin.from("operators").update({ is_active }).eq("id", id);
        if (error) {
          console.error("[operators] definir_ativo error", error);
          return Response.json({ error: error.message }, { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/lib/operatorsServer.ts src/routes/api/admin/operators.ts
git commit -m "feat(pedido-manual): ensureOperator e endpoint /api/admin/operators

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Client lib `src/lib/operators.ts`

**Files:**
- Create: `src/lib/operators.ts`

**Interfaces:**
- Consumes: endpoint `/api/admin/operators` (Task 6).
- Produces: type `Operator`; `listarOperadores()`, `obterOperadorAtual()`, `atualizarOperador(id, campos)`, `definirOperadorAtivo(id, is_active)`.

- [ ] **Step 1: Implementar**

Create `src/lib/operators.ts`:

```ts
import { supabase } from "@/integrations/supabase/client";

export type Operator = {
  id: string;
  user_id: string | null;
  name: string;
  short_name: string | null;
  email: string | null;
  phone: string | null;
  role_title: string | null;
  internal_key: string | null;
  is_active: boolean;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
};

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessao expirada");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function listarOperadores(): Promise<Operator[]> {
  try {
    const headers = await authHeaders();
    const res = await fetch("/api/admin/operators", { headers });
    const json = await res.json();
    if (!res.ok) return [];
    return (json.operators ?? []) as Operator[];
  } catch (e) {
    console.error("listarOperadores:", e);
    return [];
  }
}

/** Auto-provisiona/retorna o operador do usuario logado. */
export async function obterOperadorAtual(): Promise<Operator | null> {
  try {
    const headers = await authHeaders();
    const res = await fetch("/api/admin/operators", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "auto" }),
    });
    const json = await res.json();
    if (!res.ok) return null;
    return (json.operator ?? null) as Operator | null;
  } catch (e) {
    console.error("obterOperadorAtual:", e);
    return null;
  }
}

export async function atualizarOperador(
  id: string,
  campos: Partial<Pick<Operator, "short_name" | "role_title" | "internal_key" | "phone" | "name">>,
): Promise<{ ok: boolean; error?: string }> {
  const headers = await authHeaders();
  const res = await fetch("/api/admin/operators", {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "atualizar", id, ...campos }),
  });
  const json = await res.json();
  return res.ok ? { ok: true } : { ok: false, error: json.error };
}

export async function definirOperadorAtivo(
  id: string,
  is_active: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const headers = await authHeaders();
  const res = await fetch("/api/admin/operators", {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "definir_ativo", id, is_active }),
  });
  const json = await res.json();
  return res.ok ? { ok: true } : { ok: false, error: json.error };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/operators.ts
git commit -m "feat(pedido-manual): client lib de operadores

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Aba "Operadores" no admin

**Files:**
- Create: `src/components/admin/AbaOperadores.tsx`
- Modify: `src/routes/admin.tsx` (imports + array `ABAS`, ~linhas 37-46)

**Interfaces:**
- Consumes: `listarOperadores`, `atualizarOperador`, `definirOperadorAtivo`, `Operator` (Task 7).

- [ ] **Step 1: Criar o componente**

Create `src/components/admin/AbaOperadores.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { AdminSection } from "./AdminField";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Users, RefreshCw, Pencil } from "lucide-react";
import {
  listarOperadores, atualizarOperador, definirOperadorAtivo, type Operator,
} from "@/lib/operators";

export function AbaOperadores() {
  const [operadores, setOperadores] = useState<Operator[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<Operator | null>(null);
  const [form, setForm] = useState({ short_name: "", role_title: "", internal_key: "" });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setOperadores(await listarOperadores());
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirEdicao = (op: Operator) => {
    setEditando(op);
    setForm({
      short_name: op.short_name ?? "",
      role_title: op.role_title ?? "",
      internal_key: op.internal_key ?? "",
    });
  };

  const salvar = async () => {
    if (!editando) return;
    setSalvando(true);
    const res = await atualizarOperador(editando.id, {
      short_name: form.short_name.trim() || null,
      role_title: form.role_title.trim() || null,
      internal_key: form.internal_key.trim() || null,
    });
    setSalvando(false);
    if (!res.ok) { toast.error("Nao foi possivel salvar", { description: res.error }); return; }
    toast.success("Operador atualizado.");
    setEditando(null);
    await carregar();
  };

  const alternarAtivo = async (op: Operator) => {
    const res = await definirOperadorAtivo(op.id, !op.is_active);
    if (!res.ok) { toast.error("Nao foi possivel alterar", { description: res.error }); return; }
    toast.success(op.is_active ? "Operador desativado." : "Operador ativado.");
    await carregar();
  };

  return (
    <AdminSection
      title="Operadores"
      description="Equipe interna responsavel pelas vendas. O operador e identificado pelo login; ajuste apelido, cargo e chave interna aqui."
      icon={<Users className="h-5 w-5" />}
    >
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-charcoal">Operadores cadastrados</p>
          <Button size="sm" variant="outline" onClick={carregar} disabled={carregando}>
            <RefreshCw className={`mr-1 h-3 w-3 ${carregando ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : operadores.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum operador ainda. Eles aparecem aqui automaticamente ao criar o primeiro pedido manual.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {operadores.map((op) => (
              <li key={op.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-charcoal">
                    {op.short_name || op.name}{" "}
                    {!op.is_active && <span className="text-xs text-terracotta">(inativo)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {op.email ?? "-"}{op.role_title ? ` · ${op.role_title}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => abrirEdicao(op)}>
                    <Pencil className="mr-1 h-3 w-3" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => alternarAtivo(op)}>
                    {op.is_active ? "Desativar" : "Ativar"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!editando} onOpenChange={(open) => !open && setEditando(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar operador</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Input placeholder="Apelido / nome curto" value={form.short_name}
              onChange={(e) => setForm((f) => ({ ...f, short_name: e.target.value }))} />
            <Input placeholder="Cargo ou area" value={form.role_title}
              onChange={(e) => setForm((f) => ({ ...f, role_title: e.target.value }))} />
            <Input placeholder="Chave interna" value={form.internal_key}
              onChange={(e) => setForm((f) => ({ ...f, internal_key: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminSection>
  );
}
```

- [ ] **Step 2: Registrar a aba em `admin.tsx`**

Em `src/routes/admin.tsx`: adicionar aos imports de componentes `import { AbaOperadores } from "@/components/admin/AbaOperadores";` e ao import de ícones do lucide incluir `Users`. No array `ABAS`, adicionar a entrada logo após a de `pedidos`:

```ts
{ id: "operadores", label: "Operadores", Icon: Users, Comp: AbaOperadores },
```

- [ ] **Step 3: Type-check + verificação manual**

Run: `npx tsc --noEmit`
Expected: sem erros.

Manual: `npm run dev`, logar como admin em `/admin`, abrir a aba "Operadores". Lista vazia mostra a mensagem placeholder. (Ainda não há operadores — serão criados no primeiro pedido manual.)

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/AbaOperadores.tsx src/routes/admin.tsx
git commit -m "feat(pedido-manual): aba Operadores no painel admin

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Action `criar_manual` em `/api/admin/pedidos`

**Files:**
- Modify: `src/routes/api/admin/pedidos.ts` (imports; `BodySchema`; handler)

**Interfaces:**
- Consumes: `manualOrderSchema` (Task 4), `buildPedidoManualPayload` (Task 5), `ensureOperator` (Task 6).
- Produces: POST `{ action: "criar_manual", pedido: ManualOrderInput }` → `{ ok: true, id }`.

- [ ] **Step 1: Adicionar imports**

No topo de `src/routes/api/admin/pedidos.ts`, adicionar:

```ts
import { manualOrderSchema } from "@/lib/orderForm/schema";
import { buildPedidoManualPayload } from "@/lib/orderForm/buildPayload";
import { ensureOperator } from "@/lib/operatorsServer";
```

- [ ] **Step 2: Adicionar a variante ao `BodySchema`**

Dentro de `z.discriminatedUnion("action", [ ... ])`, adicionar:

```ts
z.object({
  action: z.literal("criar_manual"),
  pedido: manualOrderSchema,
}),
```

- [ ] **Step 3: Adicionar o handler**

Antes do `return Response.json({ error: "unknown_action" }, ...)` final, adicionar:

```ts
if (action === "criar_manual") {
  const { pedido } = parsed.data;
  const op = await ensureOperator(auth.admin, auth.user.id, {
    name: (auth.user.user_metadata?.name as string) ?? auth.user.email ?? "Operador",
    email: auth.user.email ?? null,
  });
  const payload = buildPedidoManualPayload(pedido, op?.id ?? null);
  const { data, error } = await auth.admin
    .from("pedidos")
    .insert(payload)
    .select("id")
    .single();
  if (error) {
    console.error("[admin/pedidos] criar_manual error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true, id: data.id });
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros. (Se o TS reclamar que `pedido` — tipo `ManualOrderParsed` — não é atribuível a `ManualOrderInput`, verificar que os campos batem; ambos derivam do mesmo shape.)

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/admin/pedidos.ts
git commit -m "feat(pedido-manual): action criar_manual insere pedido origem manual

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Action `gerar_link` em `/api/admin/pedidos`

**Files:**
- Modify: `src/routes/api/admin/pedidos.ts` (imports; helper `deriveDueDate`; `BodySchema`; handler)

**Interfaces:**
- Consumes: `getAppSecrets` de `@/integrations/supabase/client.server`; `makeAsaasClient` de `@/integrations/asaas/client.server`; `AsaasCreatePayment` de `@/integrations/asaas/types`.
- Produces: POST `{ action: "gerar_link", id, cpf }` → `{ ok: true, pagamentoId, invoiceUrl }`.

- [ ] **Step 1: Adicionar imports e helper**

No topo de `src/routes/api/admin/pedidos.ts`, adicionar imports:

```ts
import { getAppSecrets } from "@/integrations/supabase/client.server";
import { makeAsaasClient } from "@/integrations/asaas/client.server";
import type { AsaasCreatePayment } from "@/integrations/asaas/types";
```

E, fora do `createFileRoute` (nível de módulo), adicionar o helper:

```ts
function deriveDueDate(dataEntrega: string | null): string {
  // Asaas exige YYYY-MM-DD. Usa a data de entrega se valida; senao hoje + 2 dias.
  if (dataEntrega && /^\d{4}-\d{2}-\d{2}$/.test(dataEntrega)) return dataEntrega;
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 2: Adicionar a variante ao `BodySchema`**

Adicionar ao union:

```ts
z.object({
  action: z.literal("gerar_link"),
  id: z.string().uuid(),
  cpf: z.string().trim().min(11),
}),
```

- [ ] **Step 3: Adicionar o handler**

Antes do `return Response.json({ error: "unknown_action" }, ...)` final, adicionar:

```ts
if (action === "gerar_link") {
  const { id, cpf } = parsed.data;

  const secrets = await getAppSecrets();
  if (!secrets.asaasApiKey) {
    return Response.json({ error: "asaas_not_configured" }, { status: 503 });
  }
  const asaas = makeAsaasClient(secrets.asaasApiKey);

  const { data: pedido, error: pedidoErr } = await auth.admin
    .from("pedidos")
    .select("id, cliente_nome, cliente_whatsapp, cliente_email, total, data_entrega")
    .eq("id", id)
    .maybeSingle();
  if (pedidoErr || !pedido) {
    return Response.json({ error: "pedido_nao_encontrado" }, { status: 404 });
  }
  if (!pedido.total || Number(pedido.total) <= 0) {
    return Response.json({ error: "total_invalido" }, { status: 400 });
  }

  let customer;
  try {
    customer = await asaas.upsertCustomer({
      name: pedido.cliente_nome,
      cpfCnpj: cpf.replace(/\D/g, ""),
      email: pedido.cliente_email ?? undefined,
      mobilePhone: pedido.cliente_whatsapp ?? undefined,
      externalReference: id,
    });
  } catch (e) {
    console.error("[admin/pedidos] gerar_link customer error", e);
    return Response.json({ error: "asaas_customer_error" }, { status: 502 });
  }

  const paymentInput: AsaasCreatePayment = {
    customer: customer.id,
    billingType: "UNDEFINED",
    value: Number(pedido.total),
    dueDate: deriveDueDate(pedido.data_entrega),
    description: `Pedido ${id.slice(0, 8)} - Casa Almeria`,
    externalReference: id,
  };

  let payment;
  try {
    payment = await asaas.createPayment(paymentInput);
  } catch (e) {
    console.error("[admin/pedidos] gerar_link payment error", e);
    return Response.json({ error: "asaas_payment_error" }, { status: 502 });
  }

  const { data: pagamento, error: insErr } = await auth.admin
    .from("pagamentos")
    .insert({
      pedido_id: id,
      asaas_payment_id: payment.id,
      asaas_customer_id: customer.id,
      metodo: null,
      status: payment.status,
      valor: Number(pedido.total),
      invoice_url: payment.invoiceUrl ?? null,
      raw_response: payment as unknown as Record<string, unknown>,
    })
    .select("id, invoice_url")
    .single();
  if (insErr) {
    console.error("[admin/pedidos] gerar_link insert error", insErr);
    return Response.json({ error: insErr.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    pagamentoId: pagamento.id,
    invoiceUrl: pagamento.invoice_url,
  });
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/admin/pedidos.ts
git commit -m "feat(pedido-manual): action gerar_link cria cobranca Asaas e guarda invoice_url

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Expor `origin`, `operador` e `invoice_url` na listagem + tipos

**Files:**
- Modify: `src/routes/api/public/admin/pedidos.ts` (o `.select(...)`)
- Modify: `src/lib/pedidos.ts` (`PagamentoAsaasRow`, `PedidoRow`)

**Interfaces:**
- Produces: cada pedido da listagem passa a ter `origin`, `operator_id`, `operador` (join) e cada pagamento passa a ter `invoice_url`.

- [ ] **Step 1: Atualizar o SELECT**

Em `src/routes/api/public/admin/pedidos.ts`, substituir o `.select(\`...\`)` por:

```ts
.select(
  `
  *,
  operador:operators ( id, name, short_name ),
  pagamentos (
    id,
    asaas_payment_id,
    metodo,
    status,
    valor,
    cupom_codigo,
    cupom_desconto,
    cartao_brand,
    cartao_last4,
    invoice_url,
    criado_em
  )
`,
)
```

- [ ] **Step 2: Estender os tipos em `pedidos.ts`**

Em `src/lib/pedidos.ts`, no type `PagamentoAsaasRow` adicionar o campo:

```ts
  invoice_url?: string | null;
```

E no type `PedidoRow` adicionar:

```ts
  origin?: string | null;
  operator_id?: string | null;
  operador?: { id: string; name: string; short_name: string | null } | null;
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/routes/api/public/admin/pedidos.ts src/lib/pedidos.ts
git commit -m "feat(pedido-manual): listagem expoe origin, operador e invoice_url

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Client fns `criarPedidoManual` e `gerarLinkPagamento`

**Files:**
- Modify: `src/lib/pedidos.ts` (novas funções + import de tipo)

**Interfaces:**
- Consumes: actions `criar_manual` (Task 9) e `gerar_link` (Task 10); helper interno `getAuthToken` (já existe em `pedidos.ts`).
- Produces: `criarPedidoManual(pedido): Promise<{ ok; id?; error? }>`; `gerarLinkPagamento(id, cpf): Promise<{ ok; invoiceUrl?; pagamentoId?; error? }>`.

- [ ] **Step 1: Adicionar import de tipo**

No topo de `src/lib/pedidos.ts`, adicionar:

```ts
import type { ManualOrderInput } from "@/lib/orderForm/types";
```

- [ ] **Step 2: Adicionar as funções**

Ao final de `src/lib/pedidos.ts` (antes do `export { rowToPedidoOperacional } ...` ou logo após as outras mutações), adicionar:

```ts
/** Cria um pedido manual (origem = manual). Requer admin autenticado. */
export async function criarPedidoManual(
  pedido: ManualOrderInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: "Nao autenticado" };
  try {
    const res = await fetch("/api/admin/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "criar_manual", pedido }),
    });
    const json = (await res.json()) as { ok?: boolean; id?: string; error?: string };
    return res.ok ? { ok: true, id: json.id } : { ok: false, error: json.error ?? "Erro" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede" };
  }
}

/** Gera um link de pagamento Asaas para o pedido. Requer admin autenticado. */
export async function gerarLinkPagamento(
  id: string,
  cpf: string,
): Promise<{ ok: boolean; invoiceUrl?: string; pagamentoId?: string; error?: string }> {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: "Nao autenticado" };
  try {
    const res = await fetch("/api/admin/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "gerar_link", id, cpf }),
    });
    const json = (await res.json()) as {
      ok?: boolean; invoiceUrl?: string; pagamentoId?: string; error?: string;
    };
    return res.ok
      ? { ok: true, invoiceUrl: json.invoiceUrl, pagamentoId: json.pagamentoId }
      : { ok: false, error: json.error ?? "Erro" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede" };
  }
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/lib/pedidos.ts
git commit -m "feat(pedido-manual): client fns criarPedidoManual e gerarLinkPagamento

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Estado do stepper `useManualOrder` (TDD da validação)

**Files:**
- Create: `src/components/pedidoManual/useManualOrder.ts`
- Test: `src/components/pedidoManual/useManualOrder.test.ts`

**Interfaces:**
- Consumes: `ManualOrderInput` (Task 4), `Operator` (Task 7).
- Produces: `ETAPAS`, type `Etapa`, `estadoInicial`, `validarEtapa(etapa, state): string[]`, hook `useManualOrder()`; type `ManualOrderState`.

- [ ] **Step 1: Escrever o teste que falha**

Create `src/components/pedidoManual/useManualOrder.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validarEtapa, estadoInicial, type ManualOrderState } from "./useManualOrder";
import type { Operator } from "@/lib/operators";

const opFake = { id: "1" } as Operator;

describe("validarEtapa", () => {
  it("bloqueia etapa operador sem operador", () => {
    expect(validarEtapa("operador", estadoInicial).length).toBeGreaterThan(0);
  });
  it("passa etapa operador com operador definido", () => {
    const s: ManualOrderState = { ...estadoInicial, operador: opFake };
    expect(validarEtapa("operador", s)).toEqual([]);
  });
  it("exige nome e whatsapp na etapa cliente", () => {
    const s: ManualOrderState = {
      ...estadoInicial, cliente: { nome: "Ab", whatsapp: "123", email: "", cpf: "" },
    };
    expect(validarEtapa("cliente", s).length).toBe(2);
  });
  it("exige unidade para retirada na etapa entrega", () => {
    const s: ManualOrderState = {
      ...estadoInicial, tipo: "retirada", unidadeId: null,
      data: "2026-07-10", horario: "Entre 12h e 17h",
    };
    expect(validarEtapa("entrega", s)).toContain("Selecione a unidade de retirada.");
  });
  it("exige data e horario na etapa entrega", () => {
    const s: ManualOrderState = {
      ...estadoInicial, tipo: "delivery", enderecoOuUnidade: "SQS 100",
      data: null, horario: null,
    };
    const erros = validarEtapa("entrega", s);
    expect(erros).toContain("Selecione a data.");
    expect(erros).toContain("Selecione o horario.");
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -- useManualOrder`
Expected: FAIL (`./useManualOrder` não existe).

- [ ] **Step 3: Implementar**

Create `src/components/pedidoManual/useManualOrder.ts`:

```ts
import { useState } from "react";
import type { ManualOrderInput } from "@/lib/orderForm/types";
import type { Operator } from "@/lib/operators";

export type ManualOrderState = ManualOrderInput & { operador: Operator | null };

export const ETAPAS = ["operador", "cliente", "produto", "entrega", "revisao", "pagamento"] as const;
export type Etapa = (typeof ETAPAS)[number];

export const estadoInicial: ManualOrderState = {
  operador: null,
  cliente: { nome: "", whatsapp: "", email: "", cpf: "" },
  itens: [],
  tipo: "retirada",
  enderecoOuUnidade: "",
  unidadeId: null,
  data: null,
  horario: null,
  observacoes: "",
};

/** Validacao pura por etapa — retorna lista de erros (vazia = pode avancar). */
export function validarEtapa(etapa: Etapa, s: ManualOrderState): string[] {
  const erros: string[] = [];
  if (etapa === "operador" && !s.operador) {
    erros.push("Selecione o operador responsavel.");
  }
  if (etapa === "cliente") {
    if (s.cliente.nome.trim().length < 3) erros.push("Informe o nome do cliente.");
    if (s.cliente.whatsapp.replace(/\D/g, "").length < 10) erros.push("Informe um WhatsApp valido.");
  }
  if (etapa === "produto" && s.itens.length === 0) {
    erros.push("Selecione ao menos um produto.");
  }
  if (etapa === "entrega") {
    if (s.tipo === "retirada" && !s.unidadeId) erros.push("Selecione a unidade de retirada.");
    if (s.tipo === "delivery" && s.enderecoOuUnidade.trim().length === 0) {
      erros.push("Informe o endereco de entrega.");
    }
    if (!s.data) erros.push("Selecione a data.");
    if (!s.horario) erros.push("Selecione o horario.");
  }
  return erros;
}

export function useManualOrder() {
  const [etapaIndex, setEtapaIndex] = useState(0);
  const [state, setState] = useState<ManualOrderState>(estadoInicial);
  const etapa = ETAPAS[etapaIndex];

  const patch = (p: Partial<ManualOrderState>) => setState((s) => ({ ...s, ...p }));
  const erros = validarEtapa(etapa, state);
  const avancar = () => {
    if (erros.length === 0 && etapaIndex < ETAPAS.length - 1) setEtapaIndex((i) => i + 1);
  };
  const voltar = () => setEtapaIndex((i) => Math.max(0, i - 1));

  return { etapa, etapaIndex, state, patch, erros, avancar, voltar, setEtapaIndex };
}
```

- [ ] **Step 4: Rodar e confirmar passa**

Run: `npm test -- useManualOrder`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/pedidoManual/useManualOrder.ts src/components/pedidoManual/useManualOrder.test.ts
git commit -m "feat(pedido-manual): estado e validacao por etapa do stepper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Componente `LinkPagamentoAcoes`

**Files:**
- Create: `src/components/pedidoManual/LinkPagamentoAcoes.tsx`

**Interfaces:**
- Produces: `<LinkPagamentoAcoes invoiceUrl whatsapp? email? onGerarNovo? gerando? />`.

- [ ] **Step 1: Implementar**

Create `src/components/pedidoManual/LinkPagamentoAcoes.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, ExternalLink, MessageCircle, Mail, RefreshCw } from "lucide-react";

export function LinkPagamentoAcoes({
  invoiceUrl, whatsapp, email, onGerarNovo, gerando,
}: {
  invoiceUrl: string;
  whatsapp?: string;
  email?: string;
  onGerarNovo?: () => void;
  gerando?: boolean;
}) {
  const copiar = () => {
    navigator.clipboard.writeText(invoiceUrl);
    toast.success("Link copiado!");
  };
  const zap = whatsapp
    ? `https://wa.me/55${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Ola! Aqui esta o link para pagamento do seu pedido: ${invoiceUrl}`,
      )}`
    : null;
  const mailto = email
    ? `mailto:${email}?subject=${encodeURIComponent(
        "Link de pagamento - Casa Almeria",
      )}&body=${encodeURIComponent(
        `Ola! Segue o link para pagamento do seu pedido: ${invoiceUrl}`,
      )}`
    : null;

  return (
    <div className="rounded-2xl border border-border bg-linen/50 p-4">
      <p className="mb-2 text-sm font-bold text-charcoal">Link de pagamento</p>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 ring-1 ring-border">
        <code className="min-w-0 flex-1 truncate text-xs text-charcoal">{invoiceUrl}</code>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={copiar}>
          <Copy className="mr-1 h-3 w-3" /> Copiar
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1 h-3 w-3" /> Abrir
          </a>
        </Button>
        {zap && (
          <Button size="sm" variant="outline" asChild>
            <a href={zap} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-1 h-3 w-3" /> WhatsApp
            </a>
          </Button>
        )}
        {mailto && (
          <Button size="sm" variant="outline" asChild>
            <a href={mailto}>
              <Mail className="mr-1 h-3 w-3" /> E-mail
            </a>
          </Button>
        )}
        {onGerarNovo && (
          <Button size="sm" variant="outline" onClick={onGerarNovo} disabled={gerando}>
            <RefreshCw className={`mr-1 h-3 w-3 ${gerando ? "animate-spin" : ""}`} /> Gerar novo
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/pedidoManual/LinkPagamentoAcoes.tsx
git commit -m "feat(pedido-manual): componente de acoes rapidas do link de pagamento

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Componente `PedidoManualStepper`

**Files:**
- Create: `src/components/pedidoManual/PedidoManualStepper.tsx`

**Interfaces:**
- Consumes: `useManualOrder`, `ETAPAS`, `estadoInicial` (Task 13); `useCestasAtivas`, `useSobremesasAtivas`, `useUnidadesAtivas` de `@/store/admin`; `obterOperadorAtual` (Task 7); `criarPedidoManual`, `gerarLinkPagamento` (Task 12); `buildRegrasForItens`, `regraMaisRestritiva`, `listAvailableDates`, `getAvailableWindows` de `@/lib/availability`; `calcularTotal` de `@/lib/orderForm/buildPayload`; `cpfParaLinkSchema` de `@/lib/orderForm/schema`; `LinkPagamentoAcoes` (Task 14).
- Produces: `<PedidoManualStepper onFinalizado={(id) => void} />`.

- [ ] **Step 1: Implementar o stepper**

Create `src/components/pedidoManual/PedidoManualStepper.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useManualOrder, ETAPAS, type Etapa } from "./useManualOrder";
import { LinkPagamentoAcoes } from "./LinkPagamentoAcoes";
import { obterOperadorAtual } from "@/lib/operators";
import { criarPedidoManual, gerarLinkPagamento } from "@/lib/pedidos";
import { useCestasAtivas, useSobremesasAtivas, useUnidadesAtivas } from "@/store/admin";
import { calcularTotal } from "@/lib/orderForm/buildPayload";
import { cpfParaLinkSchema } from "@/lib/orderForm/schema";
import {
  buildRegrasForItens, regraMaisRestritiva, listAvailableDates, getAvailableWindows,
  type CarrinhoItem,
} from "@/lib/availability";
import type { ManualOrderItem } from "@/lib/orderForm/types";

const TITULOS: Record<Etapa, string> = {
  operador: "Operador responsavel",
  cliente: "Dados do cliente",
  produto: "Produtos",
  entrega: "Entrega ou retirada",
  revisao: "Revisao",
  pagamento: "Pagamento",
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PedidoManualStepper({ onFinalizado }: { onFinalizado: (id: string) => void }) {
  const { etapa, etapaIndex, state, patch, erros, avancar, voltar } = useManualOrder();
  const cestas = useCestasAtivas();
  const sobremesas = useSobremesasAtivas();
  const unidades = useUnidadesAtivas();

  const [criando, setCriando] = useState(false);
  const [pedidoId, setPedidoId] = useState<string | null>(null);
  const [cpf, setCpf] = useState("");
  const [gerando, setGerando] = useState(false);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);

  // Auto-provisiona o operador logado ao abrir.
  useEffect(() => {
    (async () => {
      const op = await obterOperadorAtual();
      if (op) patch({ operador: op });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = useMemo(() => calcularTotal(state.itens), [state.itens]);

  // Datas/janelas disponiveis a partir das regras dos itens selecionados.
  const { datas, janelas } = useMemo(() => {
    if (state.itens.length === 0) return { datas: [] as string[], janelas: [] as string[] };
    const carrinho: CarrinhoItem[] = state.itens.map((i) => ({
      produto_id: i.produto_id, produto_tipo: i.produto_tipo, nome: i.nome,
    }));
    const regra = regraMaisRestritiva(buildRegrasForItens(carrinho));
    const now = new Date();
    const datas = listAvailableDates(regra, now, 21);
    const janelas = state.data
      ? getAvailableWindows(regra, state.data, now).map((j) => j.label)
      : [];
    return { datas, janelas };
  }, [state.itens, state.data]);

  const setQuantidade = (item: Omit<ManualOrderItem, "quantidade">, qtd: number) => {
    const restantes = state.itens.filter((i) => i.produto_id !== item.produto_id);
    patch({ itens: qtd > 0 ? [...restantes, { ...item, quantidade: qtd }] : restantes });
  };
  const getQtd = (produtoId: string) =>
    state.itens.find((i) => i.produto_id === produtoId)?.quantidade ?? 0;

  const criar = async () => {
    setCriando(true);
    const { operador, ...pedido } = state;
    const res = await criarPedidoManual(pedido);
    setCriando(false);
    if (!res.ok || !res.id) {
      toast.error("Nao foi possivel criar o pedido", { description: res.error });
      return;
    }
    setPedidoId(res.id);
    toast.success("Pedido criado! Gere o link de pagamento.");
  };

  const gerar = async () => {
    if (!pedidoId) return;
    const parsed = cpfParaLinkSchema.safeParse(cpf);
    if (!parsed.success) {
      toast.error("Informe um CPF valido para gerar o link.");
      return;
    }
    setGerando(true);
    const res = await gerarLinkPagamento(pedidoId, cpf);
    setGerando(false);
    if (!res.ok || !res.invoiceUrl) {
      toast.error("Nao foi possivel gerar o link", { description: res.error });
      return;
    }
    setInvoiceUrl(res.invoiceUrl);
    toast.success("Link de pagamento gerado!");
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Indicador de progresso */}
      <ol className="mb-6 flex flex-wrap gap-2 text-xs">
        {ETAPAS.map((e, i) => (
          <li
            key={e}
            className={`rounded-full px-3 py-1 font-medium ${
              i === etapaIndex
                ? "bg-charcoal text-white"
                : i < etapaIndex
                  ? "bg-olive/15 text-olive"
                  : "bg-linen text-muted-foreground"
            }`}
          >
            {i + 1}. {TITULOS[e]}
          </li>
        ))}
      </ol>

      <h1 className="mb-4 text-xl font-bold text-charcoal">{TITULOS[etapa]}</h1>

      {/* Etapa: Operador */}
      {etapa === "operador" && (
        <div className="rounded-2xl border border-border bg-card p-4">
          {state.operador ? (
            <p className="text-sm text-charcoal">
              Responsavel: <strong>{state.operador.short_name || state.operador.name}</strong>
              <br />
              <span className="text-xs text-muted-foreground">{state.operador.email}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Identificando operador logado...</p>
          )}
        </div>
      )}

      {/* Etapa: Cliente */}
      {etapa === "cliente" && (
        <div className="grid gap-3">
          <Input placeholder="Nome do cliente*" value={state.cliente.nome}
            onChange={(e) => patch({ cliente: { ...state.cliente, nome: e.target.value } })} />
          <Input placeholder="WhatsApp* (DDD + numero)" value={state.cliente.whatsapp}
            onChange={(e) => patch({ cliente: { ...state.cliente, whatsapp: e.target.value } })} />
          <Input placeholder="E-mail (opcional)" value={state.cliente.email ?? ""}
            onChange={(e) => patch({ cliente: { ...state.cliente, email: e.target.value } })} />
          <Input placeholder="CPF (obrigatorio p/ gerar link)" value={state.cliente.cpf ?? ""}
            onChange={(e) => patch({ cliente: { ...state.cliente, cpf: e.target.value } })} />
        </div>
      )}

      {/* Etapa: Produto */}
      {etapa === "produto" && (
        <div className="grid gap-4">
          <div>
            <p className="mb-2 text-sm font-bold text-charcoal">Cestas</p>
            <ul className="grid gap-2">
              {cestas.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2">
                  <span className="min-w-0 truncate text-sm text-charcoal">
                    {c.nome} — {formatBRL(c.preco)}
                  </span>
                  <input type="number" min={0} className="w-16 rounded-md border border-border px-2 py-1 text-sm"
                    value={getQtd(c.id)}
                    onChange={(e) => setQuantidade(
                      { produto_id: c.id, produto_tipo: "cesta", nome: c.nome, preco: c.preco },
                      Math.max(0, Number(e.target.value) || 0),
                    )} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-sm font-bold text-charcoal">Sobremesas</p>
            <ul className="grid gap-2">
              {sobremesas.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2">
                  <span className="min-w-0 truncate text-sm text-charcoal">
                    {s.nome} — {formatBRL(s.preco)}
                  </span>
                  <input type="number" min={0} className="w-16 rounded-md border border-border px-2 py-1 text-sm"
                    value={getQtd(s.id)}
                    onChange={(e) => setQuantidade(
                      { produto_id: s.id, produto_tipo: "sobremesa", nome: s.nome, preco: s.preco },
                      Math.max(0, Number(e.target.value) || 0),
                    )} />
                </li>
              ))}
            </ul>
          </div>
          <p className="text-right text-sm font-bold text-charcoal">Total: {formatBRL(total)}</p>
        </div>
      )}

      {/* Etapa: Entrega/Retirada */}
      {etapa === "entrega" && (
        <div className="grid gap-3">
          <div className="flex gap-2">
            <Button variant={state.tipo === "retirada" ? "default" : "outline"} size="sm"
              onClick={() => patch({ tipo: "retirada", enderecoOuUnidade: "" })}>Retirada</Button>
            <Button variant={state.tipo === "delivery" ? "default" : "outline"} size="sm"
              onClick={() => patch({ tipo: "delivery", unidadeId: null })}>Entrega</Button>
          </div>

          {state.tipo === "retirada" ? (
            <select className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={state.unidadeId ?? ""}
              onChange={(e) => {
                const u = unidades.find((x) => x.id === e.target.value);
                patch({ unidadeId: e.target.value || null, enderecoOuUnidade: u?.nome ?? "" });
              }}>
              <option value="">Selecione a unidade</option>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          ) : (
            <Input placeholder="Endereco completo de entrega" value={state.enderecoOuUnidade}
              onChange={(e) => patch({ enderecoOuUnidade: e.target.value })} />
          )}

          <select className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={state.data ?? ""} onChange={(e) => patch({ data: e.target.value || null, horario: null })}>
            <option value="">Selecione a data</option>
            {datas.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          <select className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={state.horario ?? ""} onChange={(e) => patch({ horario: e.target.value || null })}
            disabled={!state.data}>
            <option value="">Selecione o horario</option>
            {janelas.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>

          <Input placeholder="Observacoes (opcional)" value={state.observacoes ?? ""}
            onChange={(e) => patch({ observacoes: e.target.value })} />
        </div>
      )}

      {/* Etapa: Revisao */}
      {etapa === "revisao" && (
        <div className="grid gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-charcoal">
          <p><strong>Operador:</strong> {state.operador?.short_name || state.operador?.name}</p>
          <p><strong>Cliente:</strong> {state.cliente.nome} — {state.cliente.whatsapp}</p>
          <p><strong>Itens:</strong></p>
          <ul className="ml-4 list-disc">
            {state.itens.map((i) => (
              <li key={i.produto_id}>{i.quantidade}x {i.nome} — {formatBRL(i.preco * i.quantidade)}</li>
            ))}
          </ul>
          <p><strong>{state.tipo === "retirada" ? "Retirada" : "Entrega"}:</strong> {state.enderecoOuUnidade}</p>
          <p><strong>Data/Horario:</strong> {state.data} · {state.horario}</p>
          {state.observacoes && <p><strong>Obs.:</strong> {state.observacoes}</p>}
          <p className="text-right text-base font-bold">Total: {formatBRL(total)}</p>
        </div>
      )}

      {/* Etapa: Pagamento */}
      {etapa === "pagamento" && (
        <div className="grid gap-3">
          {!pedidoId ? (
            <Button onClick={criar} disabled={criando}>
              {criando ? "Criando pedido..." : "Confirmar e criar pedido"}
            </Button>
          ) : invoiceUrl ? (
            <>
              <LinkPagamentoAcoes
                invoiceUrl={invoiceUrl}
                whatsapp={state.cliente.whatsapp}
                email={state.cliente.email || undefined}
                onGerarNovo={gerar}
                gerando={gerando}
              />
              <Button onClick={() => onFinalizado(pedidoId)}>Concluir</Button>
            </>
          ) : (
            <div className="grid gap-2">
              <p className="text-sm text-muted-foreground">
                Pedido criado. Informe o CPF do cliente e gere o link de pagamento.
              </p>
              <Input placeholder="CPF do cliente" value={cpf} onChange={(e) => setCpf(e.target.value)} />
              <Button onClick={gerar} disabled={gerando}>
                {gerando ? "Gerando link..." : "Gerar link de pagamento"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Erros de validacao da etapa atual */}
      {erros.length > 0 && etapa !== "pagamento" && (
        <ul className="mt-3 text-xs text-terracotta">
          {erros.map((e) => <li key={e}>• {e}</li>)}
        </ul>
      )}

      {/* Navegacao */}
      {etapa !== "pagamento" && (
        <div className="mt-6 flex justify-between">
          <Button variant="outline" onClick={voltar} disabled={etapaIndex === 0}>Voltar</Button>
          <Button onClick={avancar} disabled={erros.length > 0}>Avancar</Button>
        </div>
      )}
      {etapa === "pagamento" && !pedidoId && (
        <div className="mt-6 flex justify-start">
          <Button variant="outline" onClick={voltar}>Voltar</Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros. (Se `useCestasAtivas`/`useSobremesasAtivas` retornarem um tipo cujo `id`/`nome`/`preco` diferem, ajustar o acesso aos campos conforme o type real do store — os itens têm `id`, `nome`, `preco`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/pedidoManual/PedidoManualStepper.tsx
git commit -m "feat(pedido-manual): stepper de criacao manual de pedido

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: Rota `/pedidos/novo`

**Files:**
- Create: `src/routes/pedidos.novo.tsx`

**Interfaces:**
- Consumes: `PedidoManualStepper` (Task 15); `useAuth` de `@/hooks/useAuth`; `AccessDenied` de `@/components/admin/AccessDenied`.

- [ ] **Step 1: Implementar a rota**

Create `src/routes/pedidos.novo.tsx`:

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { AccessDenied } from "@/components/admin/AccessDenied";
import { PedidoManualStepper } from "@/components/pedidoManual/PedidoManualStepper";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/pedidos/novo")({
  component: PedidoNovoPage,
});

function PedidoNovoPage() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linen">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-charcoal border-t-transparent" />
      </div>
    );
  }
  if (!user || !isAdmin) {
    return (
      <>
        <AccessDenied
          title="Acesso restrito"
          description="Somente administradores podem criar pedidos manuais."
          showSignOut
          onSignOut={() => supabase.auth.signOut()}
        />
        <Toaster position="bottom-right" />
      </>
    );
  }
  return (
    <div className="min-h-screen bg-linen">
      <PedidoManualStepper onFinalizado={() => navigate({ to: "/admin" })} />
      <Toaster position="bottom-right" />
    </div>
  );
}
```

- [ ] **Step 2: Regenerar a árvore de rotas + type-check**

Run: `npm run dev` (deixe subir uma vez para o plugin do TanStack Router regenerar `src/routeTree.gen.ts`, depois encerre) — ou `npm run build`.
Em seguida: `npx tsc --noEmit`
Expected: `src/routeTree.gen.ts` passa a incluir a rota `/pedidos/novo`; sem erros de tipo.

Verificar que `/pedidos/novo` (estático) resolve antes de `/pedidos/$token` (dinâmico) — abrir `http://localhost:8080/pedidos/novo` e confirmar que o stepper aparece (não a tela de token).

- [ ] **Step 3: Commit**

```bash
git add src/routes/pedidos.novo.tsx src/routeTree.gen.ts
git commit -m "feat(pedido-manual): rota /pedidos/novo protegida por admin

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: Botão e colunas na aba Pedidos

**Files:**
- Modify: `src/components/admin/AbaPedidos.tsx`

**Interfaces:**
- Consumes: `PedidoRow.origin`, `PedidoRow.operador` (Task 11); rota `/pedidos/novo` (Task 16).

- [ ] **Step 1: Ler o arquivo e localizar os pontos de edição**

Abrir `src/components/admin/AbaPedidos.tsx`. Localizar: (a) a área de cabeçalho/toolbar acima da tabela (onde ficam título/filtros); (b) a linha de cabeçalho da tabela (`<thead>`/`<tr>` com as colunas Data, Pedido, Cliente, Produto, Tipo, Método, Status, Total); (c) o corpo da tabela onde cada `p` (PedidoRow) vira uma `<tr>`.

- [ ] **Step 2: Adicionar o botão "Criar pedido manual"**

Adicionar o import no topo:

```tsx
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
```

No cabeçalho/toolbar (item a), adicionar o botão:

```tsx
<Button asChild className="bg-charcoal text-white hover:bg-charcoal/90">
  <Link to="/pedidos/novo">
    <Plus className="mr-1 h-4 w-4" /> Criar pedido manual
  </Link>
</Button>
```

- [ ] **Step 3: Adicionar as colunas Origem e Operador**

No cabeçalho da tabela (item b), após a coluna "Tipo", adicionar:

```tsx
<th className="px-3 py-2 text-left font-semibold">Origem</th>
<th className="px-3 py-2 text-left font-semibold">Operador</th>
```

Em cada linha da tabela (item c), após a célula de "Tipo", adicionar:

```tsx
<td className="px-3 py-2">
  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
    p.origin === "manual" ? "bg-olive/15 text-olive" : "bg-linen text-muted-foreground"
  }`}>
    {p.origin === "manual" ? "Manual" : "Publico"}
  </span>
</td>
<td className="px-3 py-2 text-xs text-charcoal">
  {p.operador?.short_name ?? p.operador?.name ?? "—"}
</td>
```

(Se a tabela usar uma contagem de colunas em algum `colSpan` para estado vazio, incrementar em 2.)

- [ ] **Step 4: Type-check + verificação manual**

Run: `npx tsc --noEmit`
Expected: sem erros.

Manual: `npm run dev`, em `/admin` → aba Pedidos: o botão "Criar pedido manual" aparece e leva a `/pedidos/novo`; as colunas Origem e Operador aparecem (pedidos antigos = "Publico", operador "—").

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AbaPedidos.tsx
git commit -m "feat(pedido-manual): botao criar e colunas origem/operador na aba Pedidos

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 18: Verificação ponta a ponta (fluxo completo)

**Files:** nenhum (verificação manual)

- [ ] **Step 1: Rodar toda a suíte + type-check**

Run: `npm test && npx tsc --noEmit`
Expected: todos os testes passam; sem erros de tipo.

- [ ] **Step 2: Fluxo manual completo**

Com Asaas configurado em `app_secrets` (ambiente de teste), `npm run dev` e logado como admin:
1. `/admin` → Pedidos → "Criar pedido manual".
2. Percorrer as 6 etapas: operador (auto), cliente (nome/whatsapp/CPF), produto (1 cesta), entrega/retirada (unidade + data + horário válidos), revisão, pagamento.
3. "Confirmar e criar pedido" → toast de sucesso; pedido criado com `origin='manual'` e `operator_id`.
4. Informar CPF → "Gerar link de pagamento" → `invoiceUrl` exibido; testar Copiar/Abrir/WhatsApp/E-mail.
5. Abrir o `invoiceUrl` e pagar no sandbox → confirmar que o webhook atualiza o pagamento (`metodo` preenchido) e o pedido vira `pago` na aba Pedidos.
6. Conferir na aba Operadores que o operador foi auto-provisionado.

- [ ] **Step 3: Confirmar que o fluxo público não regrediu**

Abrir uma campanha pública, montar um pedido pelo Quiz e chegar ao checkout — comportamento inalterado.

---

## Notas de execução

- **`routeTree.gen.ts`** é gerado automaticamente pelo plugin do TanStack Router; não editar à mão — subir `npm run dev`/`npm run build` regenera (Task 16).
- **Sem harness de integração com DB**: as tasks de rota server e UI são verificadas por `npx tsc --noEmit` + teste manual. A lógica pura de maior risco (schema, payload, mapeamento de método, validação por etapa) tem testes Vitest reais.
- **Fora do MVP** (fases futuras): status financeiro×operacional formal, `order_activity_logs` + histórico, métricas/ranking, filtros avançados, página de detalhe dedicada, extras/cupom/taxa por zona, PIN, cancelamento/substituição formal de link.
