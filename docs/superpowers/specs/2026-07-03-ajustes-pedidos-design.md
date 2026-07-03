# Ajustes no módulo de Pedidos — Design

Data: 2026-07-03
Branch de trabalho: `feat/pedido-manual-integrado`

Seis ajustes no fluxo de pedidos do Casa Almeria (operação + novo pedido manual +
checkout). Cada um é independente; a ordem de implementação vai do menor risco ao maior.

## Contexto do código (verificado)

- **Novo pedido (stepper)**: `src/components/pedidoManual/PedidoManualStepper.tsx` — etapas
  Operador → Cliente → Produto ("Monte o pedido") → Entrega/Retirada → Pagamento → Revisão.
  Produtos vêm de `useCestasAtivas`/`useSobremesasAtivas` (catálogo plano, filtrado só por
  `ativo`/`arquivado`; sem vínculo estrutural com campanha).
- **Painel de operação**: `src/routes/pedidos.$token.tsx` + `src/components/operacao/*`.
- **Exclusão hoje**: `excluirPedido(id)` em `src/lib/pedidos.ts`; a UI exige digitar `"EXCLUIR"`
  (`confirmaTextoExcluir === "EXCLUIR"`, `pedidos.$token.tsx:671`).
- **Pagamentos → "pago"**: `src/routes/api/admin/pedidos.ts` (`marcar_pago`, `pagar_dinheiro`),
  `src/routes/api/public/asaas/charge.ts`, `src/routes/api/public/asaas/webhook.ts`.
- **E-mail**: infra Resend pronta — `src/lib/emailDispatch.server.ts` (`sendEmail`),
  `src/lib/emailTemplates/*` (layout + pedidoConfirmacao), `src/integrations/resend/client.server.ts`.
- **Calendário**: `src/components/ui/calendar.tsx` (shadcn/react-day-picker v9) e `popover.tsx`
  já instalados.
- **Sort atual**: pedidos carregam ordenados por criação desc (migration `20260630_pedidos_ordem_criado_desc`).

---

## 1. Blocos visuais na etapa "Monte o pedido"

**Objetivo:** organizar os produtos em blocos com título, em vez de uma lista única de cestas.

**Escopo (decisão do usuário):** apenas separação **visual** — sem vincular produto a campanha
no modelo de dados nem tela de admin.

**Design:**
- Em `PedidoManualStepper.tsx`, na etapa Produto, dividir as cestas em dois grupos além das
  sobremesas:
  - **Cestas** (padrão)
  - **Cestas Especiais / Campanha** — cestas identificadas por heurística de nome
    (`/especial|campanha|namorados|natal|p[áa]scoa|dia d/i`) ou, se existir, por um campo de
    categoria/tag já presente no produto.
  - **Sobremesas** (como hoje)
- Reusar o componente `ProdutoGrupo` (`titulo` + `itens`). Blocos vazios não renderizam.
- Nenhuma mudança de dados/API. Se a heurística não achar nenhuma "especial", cai no
  comportamento atual (um bloco "Cestas").

**Verificação:** abrir o stepper, etapa Produto → cestas especiais aparecem em bloco próprio;
somar itens de blocos diferentes funciona; total correto.

---

## 2. CEP → Casa ou Apartamento + número

**Objetivo:** capturar se a entrega é casa ou apartamento e o número da unidade.

**Design:**
- Na etapa Entrega do `PedidoManualStepper.tsx`, após o autocomplete de CEP, adicionar:
  - Toggle **Casa / Apartamento** (default Casa).
  - Campo **"Número (do ap ou da casa)"** (texto curto).
  - Se Apartamento: opcional campo **Bloco/Torre** (curto) — YAGNI: incluir só se trivial;
    caso contrário fica em Observações.
- Compor no endereço final (`enderecoOuUnidade`): `"{endereço}, {Casa|Ap} {número}"`.
  Não muda schema do pedido — continua string única.

**Verificação:** preencher CEP → escolher Ap + número → revisar pedido mostra o endereço
com "Ap 302"; folha de impressão idem.

---

## 3. Excluir pedido com motivo + banco de excluídos

**Objetivo:** ao excluir, o operador digita o **motivo** (não a palavra "EXCLUIR"); o pedido vai
para um arquivo de excluídos com o motivo.

**Data model — nova tabela `pedidos_excluidos`:**
```
create table public.pedidos_excluidos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null,
  pedido_snapshot jsonb not null,   -- cópia do pedido no momento da exclusão
  motivo text not null,
  excluido_por text,                -- operador/e-mail (quando disponível)
  excluido_em timestamptz not null default now()
);
```
- RLS: leitura/escrita só via service_role (padrão dos endpoints admin); sem acesso anon.
- Migration nova `supabase/migrations/20260703_pedidos_excluidos.sql`.

**Fluxo:**
- API: novo action `excluir_pedido` (ou estender) em `src/routes/api/admin/pedidos.ts` que
  recebe `{ pedidoId, motivo }`, lê o pedido, insere o snapshot + motivo em `pedidos_excluidos`
  e então remove/oculta da lista ativa (mesma remoção que `excluirPedido` faz hoje).
- `src/lib/pedidos.ts`: `excluirPedido(id, motivo)` passa o motivo ao endpoint.
- UI (`pedidos.$token.tsx`): o modal de confirmação troca o input "digite EXCLUIR" por um
  **campo de motivo** (obrigatório, mínimo ~3 chars). Botão excluir habilita só com motivo.
  Vale para exclusão individual e em lote (motivo aplicado a todos do lote).

**Verificação:** excluir um pedido com motivo → some da lista; linha em `pedidos_excluidos`
com snapshot + motivo + timestamp; excluir sem motivo é bloqueado.

---

## 4. Forma de pagamento "POS" (maquininha Cielo)

**Objetivo:** novo método para quem paga na maquininha Cielo no estabelecimento.

**Comportamento (decisão do usuário):** nasce **pago (offline)**, igual Dinheiro — sem Asaas.

**Design:**
- No stepper (etapa Pagamento), 5º `MetodoCard` **"POS (maquininha)"**.
- Ao escolher, mostrar mini-form:
  - **Bandeira** do cartão (select: Visa, Mastercard, Elo, Amex, Hipercard, Outra).
  - **Crédito ou Débito** (toggle).
  - **Confirmar CPF** (prefill do CPF já coletado na etapa Cliente) + **Nome**.
- API: novo action `pagar_pos` em `api/admin/pedidos.ts`, espelhando `pagar_dinheiro`:
  cria/atualiza o pedido como `status: "pago"`, `payment_status_normalized: "aprovado"`,
  `pagamento: { metodo: "pos", status: "pago", extras: { bandeira, tipo: "credito"|"debito",
  cpf, nome } }`.
- `pagamentoResolvido` inclui o estado POS pago. Método `metodo: ... | "pos"` no state do stepper.

**Verificação:** escolher POS → preencher bandeira/tipo/CPF/nome → concluir → pedido nasce
Pago; detalhe mostra "Forma de pagamento: POS" e os dados; dispara o e-mail (feature 5).

---

## 5. E-mail para o time de operações em todo pedido aprovado+pago

**Objetivo:** notificar operações sempre que um pedido fica **aprovado + pago**.

**Destinatários (fixos):** `juliana.oliveira@grupoalmeria.com.br`,
`chef.casanoro@grupoalmeria.com.br`, `gerente.casanoro@grupoalmeria.com.br`.

**Gatilho:** todos os pontos que marcam pago — Asaas webhook (CONFIRMED/RECEIVED),
`asaas/charge` (cartão-QR), `marcar_pago`, `pagar_dinheiro`, `pagar_pos`, PIX confirmado.

**Design:**
- Helper server `notificarOpsPedidoPago(pedidoId)` em `src/lib/opsNotify.server.ts`:
  1. Lê o pedido.
  2. **Dedupe**: se `ops_notificado_em` já setado, retorna sem enviar.
  3. Monta o e-mail didático e envia via `sendEmail` (Resend) para os 3 destinatários.
  4. Seta `ops_notificado_em = now()` no pedido.
- Novo template `src/lib/emailTemplates/pedidoOperacao.ts` (reusa `layout.ts`). Conteúdo:
  - Nº do pedido, **data e hora da compra**, status.
  - Cliente (nome, whatsapp, CPF), quem pagou.
  - **Para quando é o pedido** (data + horário de entrega/retirada, em destaque), tipo
    (entrega/retirada), endereço/unidade.
  - Itens (cesta + sobremesas + personalizações), valor total, forma de pagamento.
- Data model: coluna `ops_notificado_em timestamptz null` em `pedidos`
  (migration `supabase/migrations/20260703_ops_notificado_em.sql`).
- Chamada disparada de forma resiliente (try/catch; falha de e-mail **não** quebra o pagamento;
  loga o erro). Idealmente após o commit do status pago.

**Verificação:** pagar um pedido (dinheiro/POS/cartão) → os 3 e-mails chegam uma vez;
repetir o gatilho não reenvia; e-mail contém data da compra + data de entrega + itens + valor.

---

## 6. Ordenação por data de entrega (mais próxima primeiro)

**Objetivo:** no painel de pedidos, ordenar por **data de entrega crescente** (hoje/amanhã no topo).

**Design:**
- Ordenar a lista exibida por `data_entrega` ascendente; empate resolve por horário e depois
  por criação. Pedidos sem data de entrega vão para o fim.
- Aplicar na camada de exibição do painel (`pedidos.$token.tsx` / componentes de tabela e
  planilha em `src/components/operacao/*`), sem alterar a query de carregamento (que segue por
  criação). Se houver múltiplas views (tabela, planilha, kanban, calendário), a ordenação
  cronológica por entrega vale para as listas lineares (tabela/planilha).

**Verificação:** painel lista entregas da data mais próxima no topo; nulos no fim.

---

## 7. Calendário no desktop (etapa 4)

**Objetivo:** na escolha de data (Entrega ou Retirada), mostrar um **calendário** no desktop.

**Design:**
- No `PedidoManualStepper.tsx`, etapa Entrega/Retirada:
  - **Desktop** (≥ md): `Popover` + `Calendar` (shadcn) no lugar do `<select>` de data.
    Datas **não permitidas desabilitadas** (`disabled` do react-day-picker) com base nas datas
    disponíveis já calculadas (engine de availability / datas ativas).
  - **Mobile**: mantém o `<select>` atual (ou input date nativo).
- Horário continua `<select>` (dependente da data escolhida, como hoje).
- Detecção desktop/mobile: reusar `useIsMobile` (já usado no projeto).

**Verificação:** desktop mostra calendário; dias fora da disponibilidade não clicáveis;
escolher dia preenche a data e habilita os horários; mobile inalterado.

---

## Fora de escopo (YAGNI)

- Vincular produto↔campanha no modelo de dados / tela de admin (feature 1 é só visual).
- Restaurar pedidos excluídos (só arquivar por enquanto; consulta futura).
- Configurar destinatários do e-mail via admin (lista fixa por ora).

## Sequência de implementação

6 (sort) → 1 (blocos) → 2 (CEP) → 7 (calendário) → 4 (POS) → 3 (excluídos + migration) →
5 (e-mail + migration). Cada item verificado (tsc limpo + build) antes do próximo; deploy ao final.

## Notas de deploy

- `npx tsc --noEmit` **limpo** é obrigatório antes de produção (esbuild não acusa identificador
  indefinido — já causou o crash de impressão).
- Push via conta `alexicm`/`grupoalmeriamkt`; deploy manual `vercel --prod` com retry (rede
  intermitente com a Vercel). Migrations aplicadas no Supabase de produção antes do deploy do código.
