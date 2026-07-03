# Ajustes no módulo de Pedidos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar 6 ajustes no fluxo de pedidos (blocos visuais, CEP casa/ap, excluídos com motivo, POS, e-mail pro time, ordenação por entrega, calendário desktop).

**Architecture:** Mudanças incrementais no stepper de novo pedido (`PedidoManualStepper.tsx`), no painel de operação (`pedidos.$token.tsx`), nos endpoints admin (`api/admin/pedidos.ts`) e nos pontos de pagamento; duas migrations Supabase (`pedidos_excluidos`, `ops_notificado_em`); um helper server de notificação por e-mail (Resend) e um template.

**Tech Stack:** TanStack Start/Router (React 19, Vite), Supabase (Postgres + service_role), Resend, shadcn/ui (Calendar/react-day-picker v9, Popover), Zod, Tailwind v4, Vitest.

## Global Constraints

- `npx tsc --noEmit` DEVE estar limpo antes de qualquer deploy (esbuild não acusa identificador indefinido).
- Push via conta `alexicm` ou `grupoalmeriamkt` (`git -c credential.helper='!gh auth git-credential' push`); a conta `sommarunningclub` não tem escrita.
- Deploy manual: `vercel --prod --yes` em loop de retry (checar `"readyState": "READY"`; rede intermitente).
- Migrations aplicadas no Supabase de produção (ref `opbepcajjktehaezmqzf`) ANTES do deploy do código que as usa.
- "Quem pagou" e dados de pagamento NUNCA vão para a folha de impressão (`FolhaImpressao`).
- Endpoints públicos nunca retornam CPF completo.
- Mensagens de commit terminam com `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

- `src/lib/pedidosSort.ts` — **criar**: comparador de ordenação por data de entrega (puro, testável).
- `src/lib/produtoGrupos.ts` — **criar**: classificação visual de cesta em grupo (puro, testável).
- `src/lib/enderecoEntrega.ts` — **criar**: composição do endereço final (casa/ap + número) (puro, testável).
- `src/lib/opsNotify.server.ts` — **criar**: helper `notificarOpsPedidoPago` (Resend + dedupe).
- `src/lib/emailTemplates/pedidoOperacao.ts` — **criar**: template do e-mail didático.
- `supabase/migrations/20260703_pedidos_excluidos.sql` — **criar**.
- `supabase/migrations/20260703_ops_notificado_em.sql` — **criar**.
- `src/components/pedidoManual/PedidoManualStepper.tsx` — **modificar**: blocos, CEP casa/ap, calendário desktop, método POS.
- `src/routes/api/admin/pedidos.ts` — **modificar**: actions `pagar_pos` e `excluir_pedido`; chamar opsNotify nos pontos de pago.
- `src/routes/api/public/asaas/webhook.ts` e `charge.ts` — **modificar**: chamar opsNotify ao confirmar pago.
- `src/lib/pedidos.ts` — **modificar**: `excluirPedido(id, motivo)`.
- `src/routes/pedidos.$token.tsx` — **modificar**: sort na exibição; modal de exclusão com motivo.

---

## Task 1: Ordenação por data de entrega (feature 6)

**Files:**
- Create: `src/lib/pedidosSort.ts`
- Test: `src/lib/pedidosSort.test.ts`
- Modify: `src/routes/pedidos.$token.tsx` (onde as listas lineares são renderizadas)

**Interfaces:**
- Produces: `ordenarPorEntrega<T extends { data?: string | null; horario?: string | null; criadoEm?: string }>(lista: T[]): T[]` — retorna nova lista, entrega mais próxima primeiro; itens sem `data` no fim.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/pedidosSort.test.ts
import { describe, it, expect } from "vitest";
import { ordenarPorEntrega } from "./pedidosSort";

describe("ordenarPorEntrega", () => {
  it("ordena por data de entrega crescente (mais próxima primeiro)", () => {
    const r = ordenarPorEntrega([
      { data: "2026-07-10", horario: "08h" },
      { data: "2026-07-03", horario: "15h" },
      { data: "2026-07-03", horario: "08h" },
    ]);
    expect(r.map((x) => `${x.data} ${x.horario}`)).toEqual([
      "2026-07-03 08h", "2026-07-03 15h", "2026-07-10 08h",
    ]);
  });
  it("joga itens sem data para o fim", () => {
    const r = ordenarPorEntrega([{ data: null }, { data: "2026-07-03" }]);
    expect(r[0].data).toBe("2026-07-03");
    expect(r[1].data).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/pedidosSort.test.ts`
Expected: FAIL ("ordenarPorEntrega is not a function" / módulo inexistente).

- [ ] **Step 3: Implementar**

```ts
// src/lib/pedidosSort.ts
export function ordenarPorEntrega<
  T extends { data?: string | null; horario?: string | null; criadoEm?: string },
>(lista: T[]): T[] {
  const chave = (x: T) => x.data ?? "9999-12-31";
  return [...lista].sort((a, b) => {
    const d = chave(a).localeCompare(chave(b));
    if (d !== 0) return d;
    const h = (a.horario ?? "").localeCompare(b.horario ?? "");
    if (h !== 0) return h;
    return (a.criadoEm ?? "").localeCompare(b.criadoEm ?? "");
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/pedidosSort.test.ts`
Expected: PASS.

- [ ] **Step 5: Aplicar na exibição do painel**

Em `src/routes/pedidos.$token.tsx`, importar `ordenarPorEntrega` e envolver as listas lineares
(tabela/planilha) na renderização — ex.: onde hoje se mapeia `pedidosOpsFiltrados`/`pedidosFiltrados`
para a tabela, usar `ordenarPorEntrega(lista)`. Localizar com:
`grep -nE "pedidosOpsFiltrados|pedidosFiltrados" src/routes/pedidos.$token.tsx` e aplicar nas views
lineares (não alterar kanban/calendário). NÃO alterar a query de carregamento.

- [ ] **Step 6: Verificar tsc + build**

Run: `npx tsc --noEmit 2>&1 | grep -E 'pedidosSort|pedidos\.\$token' || echo OK` → OK
Run: `npm run build` → exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/pedidosSort.ts src/lib/pedidosSort.test.ts src/routes/pedidos.\$token.tsx
git commit -m "feat(operacao): ordena painel por data de entrega (mais próxima primeiro)"
```

---

## Task 2: Blocos visuais na etapa Produto (feature 1)

**Files:**
- Create: `src/lib/produtoGrupos.ts`
- Test: `src/lib/produtoGrupos.test.ts`
- Modify: `src/components/pedidoManual/PedidoManualStepper.tsx` (~linha 317, onde `<ProdutoGrupo titulo="Cestas" .../>`)

**Interfaces:**
- Produces: `grupoDaCesta(nome: string): "especial" | "padrao"` e
  `particionarCestas<T extends { nome: string }>(cestas: T[]): { padrao: T[]; especiais: T[] }`.

- [ ] **Step 1: Teste que falha**

```ts
// src/lib/produtoGrupos.test.ts
import { describe, it, expect } from "vitest";
import { grupoDaCesta, particionarCestas } from "./produtoGrupos";

describe("grupoDaCesta", () => {
  it("classifica cestas de campanha como especial", () => {
    expect(grupoDaCesta("Cesta Especial - Dia dos Namorados")).toBe("especial");
    expect(grupoDaCesta("Cesta de Natal")).toBe("especial");
    expect(grupoDaCesta("Cesta Café da Manhã Tamanho M")).toBe("padrao");
  });
  it("particiona mantendo ordem", () => {
    const r = particionarCestas([
      { nome: "Cesta Café da Manhã Tamanho M" },
      { nome: "Cesta Especial - Dia dos Namorados" },
    ]);
    expect(r.padrao).toHaveLength(1);
    expect(r.especiais).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/produtoGrupos.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/lib/produtoGrupos.ts
const RE_ESPECIAL = /especial|campanha|namorados|natal|p[áa]scoa|dia d|m[ãa]es|pais/i;

export function grupoDaCesta(nome: string): "especial" | "padrao" {
  return RE_ESPECIAL.test(nome) ? "especial" : "padrao";
}

export function particionarCestas<T extends { nome: string }>(cestas: T[]) {
  const padrao: T[] = [];
  const especiais: T[] = [];
  for (const c of cestas) (grupoDaCesta(c.nome) === "especial" ? especiais : padrao).push(c);
  return { padrao, especiais };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/produtoGrupos.test.ts` → PASS.

- [ ] **Step 5: Usar no stepper**

Em `PedidoManualStepper.tsx`, na etapa Produto, substituir o único `<ProdutoGrupo titulo="Cestas" itens={cestas} .../>` por:
```tsx
{(() => {
  const { padrao, especiais } = particionarCestas(cestas);
  return (
    <>
      {padrao.length > 0 && <ProdutoGrupo titulo="Cestas" itens={padrao} getQtd={getQtd} {/* ...mesmas props */} />}
      {especiais.length > 0 && <ProdutoGrupo titulo="Cestas Especiais / Campanha" itens={especiais} getQtd={getQtd} {/* ...mesmas props */} />}
    </>
  );
})()}
```
Manter o bloco de Sobremesas existente. Copiar exatamente as props que o `<ProdutoGrupo>` de cestas já recebia.

- [ ] **Step 6: tsc + build**

Run: `npx tsc --noEmit 2>&1 | grep -E 'produtoGrupos|PedidoManualStepper' || echo OK` → OK
Run: `npm run build` → exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/produtoGrupos.ts src/lib/produtoGrupos.test.ts src/components/pedidoManual/PedidoManualStepper.tsx
git commit -m "feat(novo-pedido): separa cestas especiais/campanha em bloco próprio"
```

---

## Task 3: CEP casa/ap + número (feature 2)

**Files:**
- Create: `src/lib/enderecoEntrega.ts`
- Test: `src/lib/enderecoEntrega.test.ts`
- Modify: `src/components/pedidoManual/PedidoManualStepper.tsx` (etapa Entrega, após o campo CEP/Endereço)

**Interfaces:**
- Produces: `montarEnderecoFinal(input: { endereco: string; tipoLocal: "casa" | "apartamento"; numeroUnidade: string }): string`.

- [ ] **Step 1: Teste que falha**

```ts
// src/lib/enderecoEntrega.test.ts
import { describe, it, expect } from "vitest";
import { montarEnderecoFinal } from "./enderecoEntrega";

describe("montarEnderecoFinal", () => {
  it("acrescenta Ap + número", () => {
    expect(montarEnderecoFinal({ endereco: "Rua X, 100 — Centro", tipoLocal: "apartamento", numeroUnidade: "302" }))
      .toBe("Rua X, 100 — Centro, Ap 302");
  });
  it("acrescenta Casa quando informado", () => {
    expect(montarEnderecoFinal({ endereco: "Rua Y, 5", tipoLocal: "casa", numeroUnidade: "5" }))
      .toBe("Rua Y, 5, Casa 5");
  });
  it("sem número não acrescenta sufixo", () => {
    expect(montarEnderecoFinal({ endereco: "Rua Z", tipoLocal: "casa", numeroUnidade: "" }))
      .toBe("Rua Z");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** → `npx vitest run src/lib/enderecoEntrega.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/lib/enderecoEntrega.ts
export function montarEnderecoFinal(input: {
  endereco: string;
  tipoLocal: "casa" | "apartamento";
  numeroUnidade: string;
}): string {
  const base = input.endereco.trim();
  const num = input.numeroUnidade.trim();
  if (!num) return base;
  const rotulo = input.tipoLocal === "apartamento" ? "Ap" : "Casa";
  return `${base}, ${rotulo} ${num}`;
}
```

- [ ] **Step 4: Rodar e ver passar** → PASS.

- [ ] **Step 5: UI no stepper**

Na etapa Entrega do `PedidoManualStepper.tsx`, após o campo Endereço, adicionar estado
`tipoLocal: "casa"|"apartamento"` (default "casa") e `numeroUnidade: string`, um toggle Casa/Apartamento
(mesmo padrão dos toggles existentes) e um `<Input>` "Número (do ap ou da casa)". Ao avançar/gravar
o endereço no state do pedido, usar `montarEnderecoFinal({ endereco, tipoLocal, numeroUnidade })`.

- [ ] **Step 6: tsc + build** → OK / exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/enderecoEntrega.ts src/lib/enderecoEntrega.test.ts src/components/pedidoManual/PedidoManualStepper.tsx
git commit -m "feat(novo-pedido): casa/apartamento + número da unidade na entrega"
```

---

## Task 4: Calendário no desktop (feature 7)

**Files:**
- Modify: `src/components/pedidoManual/PedidoManualStepper.tsx` (etapa Entrega/Retirada, campo Data)

**Interfaces:**
- Consumes: `Calendar` de `@/components/ui/calendar`, `Popover/PopoverTrigger/PopoverContent` de `@/components/ui/popover`, `useIsMobile` de `@/hooks/use-mobile`.

- [ ] **Step 1: Identificar as datas permitidas**

`grep -nE "datas|Selecione|<select" src/components/pedidoManual/PedidoManualStepper.tsx` — localizar o
`<select>` de data e a lista de datas disponíveis (`datasDisponiveis` / availability) que o popula.

- [ ] **Step 2: Renderizar calendário no desktop**

Envolver o campo Data em `const isMobile = useIsMobile();` e:
```tsx
{isMobile ? (
  /* <select> atual de data, inalterado */
) : (
  <Popover>
    <PopoverTrigger asChild>
      <button className="/* estilo input */">{dataSelecionada ? formatBR(dataSelecionada) : "Selecione"}</button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar
        mode="single"
        selected={dataSelecionada ? new Date(dataSelecionada) : undefined}
        onSelect={(d) => d && setData(toIso(d))}
        disabled={(d) => !datasDisponiveisSet.has(toIso(d))}
      />
    </PopoverContent>
  </Popover>
)}
```
`datasDisponiveisSet` = `new Set(datasDisponiveis.map(toIso))`. `toIso(d)` → `YYYY-MM-DD` local.
Ao selecionar, resetar o horário (como o `<select>` faz hoje).

- [ ] **Step 3: Verificar manualmente (dev)**

Run: `npm run dev` → abrir novo pedido no desktop → etapa Entrega → calendário aparece; dias fora da
disponibilidade desabilitados; escolher dia habilita horários. Mobile (devtools responsive) mantém select.

- [ ] **Step 4: tsc + build** → OK / exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/pedidoManual/PedidoManualStepper.tsx
git commit -m "feat(novo-pedido): calendário de datas no desktop (etapa entrega)"
```

---

## Task 5: Forma de pagamento POS (feature 4)

**Files:**
- Modify: `src/components/pedidoManual/PedidoManualStepper.tsx` (etapa Pagamento)
- Modify: `src/routes/api/admin/pedidos.ts` (novo action `pagar_pos`)
- Modify: `src/lib/pedidos.ts` (função cliente `pagarPos`, espelhando `pagarDinheiro`)

**Interfaces:**
- Produces (API): action `pagar_pos` com body `{ action: "pagar_pos", pedidoId: string, pos: { bandeira: string; tipo: "credito" | "debito"; cpf: string; nome: string } }` → grava `status: "pago"`, `payment_status_normalized: "aprovado"`, `pagamento: { metodo: "pos", status: "pago", extras: { pos } }`.
- Produces (client): `pagarPos(pedidoId, pos): Promise<{ ok: boolean }>`.

- [ ] **Step 1: Action no endpoint (espelhar pagar_dinheiro)**

Em `api/admin/pedidos.ts`, adicionar ao discriminatedUnion:
```ts
z.object({
  action: z.literal("pagar_pos"),
  pedidoId: z.string().uuid(),
  pos: z.object({
    bandeira: z.string().min(1).max(30),
    tipo: z.enum(["credito", "debito"]),
    cpf: z.string().transform((s) => s.replace(/\D/g, "")).pipe(z.string().regex(/^\d{11}$/)),
    nome: z.string().min(2).max(120),
  }),
}),
```
E o handler (copiar a lógica de `pagar_dinheiro`, trocando o `pagamento`):
```ts
if (action === "pagar_pos") {
  // ...ler pagAtual como em pagar_dinheiro...
  const { error } = await admin.from("pedidos").update({
    status: "pago",
    payment_status_normalized: "aprovado",
    pagamento: { ...pagAtual, metodo: "pos", status: "pago", extras: { ...(pagAtual?.extras ?? {}), pos: body.pos } },
  }).eq("id", body.pedidoId);
  if (error) { console.error("[admin/pedidos] pagar_pos", error); return Response.json({ error: "db" }, { status: 500 }); }
  await notificarOpsPedidoPago(body.pedidoId).catch((e) => console.error("[opsNotify] pos", e)); // ligado na Task 7
  return Response.json({ ok: true });
}
```
(A linha do `notificarOpsPedidoPago` só compila após a Task 7; se implementar POS antes, deixar comentada e ligar na Task 7.)

- [ ] **Step 2: Cliente pagarPos**

Em `src/lib/pedidos.ts`, ao lado de `pagarDinheiro`, adicionar `pagarPos(pedidoId, pos)` que faz o POST
com `action: "pagar_pos"`.

- [ ] **Step 3: UI no stepper**

5º `MetodoCard` "POS (maquininha)" (ícone `CreditCard`/`Nfc`). Estado `metodo: ...|"pos"`, `posPago`,
e um mini-form: `<select>` bandeira (Visa/Mastercard/Elo/Amex/Hipercard/Outra), toggle Crédito/Débito,
`<Input>` CPF (prefill `state.cliente.cpf`) e `<Input>` Nome (prefill `state.cliente.nome`).
Botão "Confirmar pagamento na maquininha" → chama `pagarPos(...)` → `posPago = true`.
Incluir `posPago` em `pagamentoResolvido`.

- [ ] **Step 4: tsc + build** → OK / exit 0.

- [ ] **Step 5: Verificar (dev)**

Novo pedido → Pagamento → POS → preencher → concluir → pedido nasce Pago; detalhe mostra método POS
+ bandeira/tipo. `curl`/Supabase: linha com `pagamento.extras.pos`.

- [ ] **Step 6: Commit**

```bash
git add src/components/pedidoManual/PedidoManualStepper.tsx src/routes/api/admin/pedidos.ts src/lib/pedidos.ts
git commit -m "feat(pagamento): método POS (maquininha Cielo) nasce pago offline"
```

---

## Task 6: Excluir com motivo + tabela de excluídos (feature 3)

**Files:**
- Create: `supabase/migrations/20260703_pedidos_excluidos.sql`
- Modify: `src/routes/api/admin/pedidos.ts` (action `excluir_pedido`)
- Modify: `src/lib/pedidos.ts` (`excluirPedido(id, motivo)`)
- Modify: `src/routes/pedidos.$token.tsx` (modal de exclusão)

- [ ] **Step 1: Migration**

```sql
-- supabase/migrations/20260703_pedidos_excluidos.sql
create table if not exists public.pedidos_excluidos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null,
  pedido_snapshot jsonb not null,
  motivo text not null,
  excluido_por text,
  excluido_em timestamptz not null default now()
);
alter table public.pedidos_excluidos enable row level security;
-- sem policies para anon/authenticated: acesso só via service_role (endpoints admin)
```
Aplicar no Supabase de produção antes do deploy.

- [ ] **Step 2: Action excluir_pedido (arquiva + remove)**

Em `api/admin/pedidos.ts`:
```ts
z.object({ action: z.literal("excluir_pedido"), pedidoId: z.string().uuid(), motivo: z.string().trim().min(3).max(500), excluidoPor: z.string().optional() }),
```
Handler: ler o pedido (`select *`), inserir em `pedidos_excluidos` (`pedido_id`, `pedido_snapshot`=linha,
`motivo`, `excluido_por`), e então executar a MESMA remoção que a exclusão atual faz (localizar como
`excluirPedido` remove hoje — delete ou flag). Retornar `{ ok: true }`.

- [ ] **Step 3: Cliente excluirPedido(id, motivo)**

Em `src/lib/pedidos.ts`, alterar assinatura para `excluirPedido(id: string, motivo: string, excluidoPor?: string)`
e postar `action: "excluir_pedido"`.

- [ ] **Step 4: UI — trocar "digite EXCLUIR" por motivo**

Em `pedidos.$token.tsx`: substituir `confirmaTextoExcluir === "EXCLUIR"` por um estado `motivoExclusao`
(texto). O input do modal vira "Motivo da exclusão" (obrigatório). Botão excluir habilita com
`motivoExclusao.trim().length >= 3`. Em `excluirSelecionados`, chamar `excluirPedido(id, motivoExclusao)`
para cada id do lote. Ajustar labels ("Excluir" continua, mas a validação é o motivo).

- [ ] **Step 5: tsc + build** → OK / exit 0.

- [ ] **Step 6: Verificar**

Excluir um pedido com motivo → some da lista; `select * from pedidos_excluidos` mostra snapshot+motivo;
excluir sem motivo é bloqueado.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260703_pedidos_excluidos.sql src/routes/api/admin/pedidos.ts src/lib/pedidos.ts src/routes/pedidos.\$token.tsx
git commit -m "feat(operacao): exclusão de pedido exige motivo e arquiva em pedidos_excluidos"
```

---

## Task 7: E-mail para o time de operações (feature 5)

**Files:**
- Create: `supabase/migrations/20260703_ops_notificado_em.sql`
- Create: `src/lib/emailTemplates/pedidoOperacao.ts`
- Create: `src/lib/opsNotify.server.ts`
- Test: `src/lib/emailTemplates/pedidoOperacao.test.ts`
- Modify: `src/routes/api/admin/pedidos.ts`, `src/routes/api/public/asaas/webhook.ts`, `src/routes/api/public/asaas/charge.ts` (chamar o helper nos pontos de pago)

**Interfaces:**
- Produces: `renderPedidoOperacaoEmail(p): { subject: string; html: string }` (puro) e
  `notificarOpsPedidoPago(pedidoId: string): Promise<void>` (server; lê pedido, dedupe por `ops_notificado_em`, envia, marca).

- [ ] **Step 1: Migration da coluna de dedupe**

```sql
-- supabase/migrations/20260703_ops_notificado_em.sql
alter table public.pedidos add column if not exists ops_notificado_em timestamptz;
```
Aplicar em produção antes do deploy.

- [ ] **Step 2: Teste do template (puro)**

```ts
// src/lib/emailTemplates/pedidoOperacao.test.ts
import { describe, it, expect } from "vitest";
import { renderPedidoOperacaoEmail } from "./pedidoOperacao";

describe("renderPedidoOperacaoEmail", () => {
  it("inclui cliente, data de entrega e valor", () => {
    const { subject, html } = renderPedidoOperacaoEmail({
      id: "abc123", numero: "ABC123", criadoEm: "2026-07-02T19:35:00Z",
      clienteNome: "Marcio Mileski", clienteWhatsapp: "61984695396",
      tipo: "delivery", dataEntrega: "2026-07-07", horario: "Entre 08h e 09h",
      endereco: "Quadra SQN 402", itens: [{ nome: "Cesta Café da Manhã", quantidade: 1, preco: 330 }],
      total: 360, formaPagamento: "Cartão de crédito", quemPagou: "Marcio Mileski",
    });
    expect(subject).toContain("Marcio Mileski");
    expect(html).toContain("2026-07-07");
    expect(html).toContain("360");
    expect(html).toContain("Cesta Café da Manhã");
  });
});
```

- [ ] **Step 3: Rodar e ver falhar** → FAIL.

- [ ] **Step 4: Implementar template**

`renderPedidoOperacaoEmail(p)` usando `layout.ts` (mesmo wrapper do `pedidoConfirmacao.ts`). `subject`:
`"Novo pedido pago — {clienteNome} (entrega {dataEntrega})"`. `html`: blocos didáticos — Nº, data/hora
da compra, cliente+whatsapp, **para quando** (dataEntrega + horario em destaque), tipo, endereço, itens
(lista), total (BRL), forma de pagamento, quem pagou. Tipar o input `PedidoOperacaoEmailData`.

- [ ] **Step 5: Rodar e ver passar** → PASS.

- [ ] **Step 6: Helper opsNotify.server.ts**

```ts
// src/lib/opsNotify.server.ts
import { getAdminClient } from "@/integrations/supabase/client.server";
import { sendEmail } from "@/lib/email";
import { renderPedidoOperacaoEmail } from "@/lib/emailTemplates/pedidoOperacao";

const OPS_EMAILS = [
  "juliana.oliveira@grupoalmeria.com.br",
  "chef.casanoro@grupoalmeria.com.br",
  "gerente.casanoro@grupoalmeria.com.br",
];

export async function notificarOpsPedidoPago(pedidoId: string): Promise<void> {
  const admin = getAdminClient();
  if (!admin) return;
  const { data: p } = await admin.from("pedidos").select("*").eq("id", pedidoId).maybeSingle();
  if (!p || p.ops_notificado_em) return; // dedupe
  const { subject, html } = renderPedidoOperacaoEmail(mapPedidoParaEmail(p));
  await sendEmail({ to: OPS_EMAILS, subject, html }); // confirmar assinatura real de sendEmail
  await admin.from("pedidos").update({ ops_notificado_em: new Date().toISOString() }).eq("id", pedidoId);
}
```
`mapPedidoParaEmail(p)` converte a linha do banco em `PedidoOperacaoEmailData` (nome, whatsapp, itens
achatados de `cesta`+`sobremesas`, total, forma de pagamento, quem pagou = `pagamento` payer / cliente).
Confirmar a assinatura de `sendEmail` (ver `src/lib/email.ts`) — pode exigir `from`/`replyTo`.

- [ ] **Step 7: Ligar nos pontos de pago**

Chamar `await notificarOpsPedidoPago(pedidoId).catch((e) => console.error("[opsNotify]", e));` após o
update de pago em: `api/admin/pedidos.ts` (`marcar_pago`, `pagar_dinheiro`, `pagar_pos`),
`api/public/asaas/charge.ts` (quando status CONFIRMED/RECEIVED) e `api/public/asaas/webhook.ts`
(quando o webhook confirma pago). A falha do e-mail nunca quebra o pagamento (try/catch).

- [ ] **Step 8: tsc + build** → OK / exit 0.

- [ ] **Step 9: Verificar**

Pagar um pedido (dinheiro/POS) → 3 e-mails chegam 1×; repetir gatilho não reenvia (`ops_notificado_em`
setado); e-mail contém data da compra + data de entrega + itens + valor.

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/20260703_ops_notificado_em.sql src/lib/emailTemplates/pedidoOperacao.ts src/lib/emailTemplates/pedidoOperacao.test.ts src/lib/opsNotify.server.ts src/routes/api/admin/pedidos.ts src/routes/api/public/asaas/webhook.ts src/routes/api/public/asaas/charge.ts
git commit -m "feat(operacao): e-mail didático pro time em todo pedido aprovado+pago (dedupe)"
```

---

## Deploy final (após todas as tasks)

- [ ] `npx tsc --noEmit` limpo (zero erros).
- [ ] `npm run build` exit 0.
- [ ] Migrations `20260703_pedidos_excluidos` e `20260703_ops_notificado_em` aplicadas no Supabase de produção.
- [ ] Push `main` via conta com escrita.
- [ ] `vercel --prod --yes` com retry até `READY`.
- [ ] Smoke em produção: novo pedido (POS, calendário, blocos, CEP), exclusão com motivo, e-mail recebido, painel ordenado por entrega.

## Self-Review (feito)

- **Cobertura da spec:** features 1–7 mapeadas a Tasks 2,3,6,5,7,1,4 respectivamente. ✔
- **Placeholders:** código real nos pontos-chave; UI descrita com âncoras exatas (grep). Assinatura de
  `sendEmail` marcada para confirmar em `src/lib/email.ts` durante a Task 7.
- **Consistência de tipos:** `notificarOpsPedidoPago(pedidoId)`, `pagarPos(pedidoId, pos)`,
  `excluirPedido(id, motivo)`, `ordenarPorEntrega`, `particionarCestas`, `montarEnderecoFinal`,
  `renderPedidoOperacaoEmail` usados com os mesmos nomes/assinaturas entre tasks. ✔
