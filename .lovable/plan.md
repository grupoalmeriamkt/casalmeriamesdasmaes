
# Plano — Melhorias no sistema de pedidos

Quatro mudanças independentes no Quiz, no editor de campanha e no painel de pedidos.

---

## 1) Label condicional no Quiz (Retirada vs Delivery)

Arquivo: `src/components/Quiz.tsx` (Step 4, linhas ~679-684).

- Trocar o `<h1>` "Quando deseja receber?" por:
  - `entregaTipo === "retirada"` → "Quando deseja **Retirar?**"
  - caso contrário (delivery) → mantém "Quando deseja **receber?**"
- Ajustar também o subtítulo: "Escolha o melhor dia e horário para retirar / receber".

Mudança trivial, somente texto.

---

## 2) Upsell único em "Informações Gerais"

Hoje o upsell vive em dois lugares (`campanha.delivery.upsell*` e `campanha.retirada.upsell*`). Vamos unificar em um único campo na campanha.

### Modelo de dados (`src/store/admin.ts`)

Adicionar à `Campanha`:

```ts
type UpsellItem =
  | { tipo: "produto"; produtoId: string }                     // cesta/sobremesa do catálogo
  | { tipo: "cartao";  id: string; nome: string; preco: number; maxCaracteres: number }
  | { tipo: "polaroid"; id: string; nome: string; preco: number };

type CampanhaUpsell = {
  ativo: boolean;
  itens: UpsellItem[]; // ordem = ordem de exibição no Quiz
};

type Campanha = {
  // ...existente
  upsell: CampanhaUpsell;
};
```

- Manter `upsellAtivo` / `upsellProdutoIds` legados na tipagem como `@deprecated` por compat, mas **não** mais ler/gravar deles na UI.
- Migration (`migrate` no `persist`, bumpando versão para 10): para cada campanha, montar `upsell.itens` a partir de `delivery.upsellProdutoIds ∪ retirada.upsellProdutoIds` (dedup, mantendo ordem do delivery primeiro). `upsell.ativo = delivery.upsellAtivo || retirada.upsellAtivo`.

Os campos `delivery.upsellAtivo`, `delivery.upsellProdutoIds`, `retirada.upsellAtivo`, `retirada.upsellProdutoIds` deixam de existir no shape novo (removidos do tipo e da migration).

### Editor (`src/components/admin/CampanhaForm.tsx`)

- **Remover** o bloco "Upsell no Delivery" do `DeliveryTab` e "Upsell na Retirada" do `RetiradaTab`.
- **Adicionar** em `InfoGeralTab`, após "Produtos Principais", um novo `Bloco titulo="Upsell (todos os modos)"` contendo:
  - Switch "Habilitar upsell" (`campanha.upsell.ativo`).
  - Componente `UpsellEditor` (novo) que renderiza:
    - Lista de itens já selecionados, com:
      - imagem/ícone, nome, preço, badges (Produto / Cartão / Polaroid),
      - botões ordenar (↑/↓) e remover,
      - se for `cartao`: input para `maxCaracteres` (default 150),
      - se for `cartao`/`polaroid`: inputs para nome e preço.
    - Três botões "Adicionar":
      - "Adicionar produto" → abre seletor (reaproveita `ProdutosSeletor` em modo single, ou cards inline) — adiciona `{ tipo: "produto", produtoId }`.
      - "Adicionar Cartãozinho" → adiciona `{ tipo: "cartao", id: crypto.randomUUID(), nome: "Cartãozinho Especial", preco: 0, maxCaracteres: 150 }`.
      - "Adicionar Foto Polaroid" → adiciona `{ tipo: "polaroid", id: crypto.randomUUID(), nome: "Foto Polaroid", preco: 0 }`.

---

## 3) Substituir sobremesas do Quiz pelo Upsell

### Quiz (`src/components/Quiz.tsx`)

- **Remover** o bloco de sobremesas no Step 4 (linhas ~754-792 — "Quer adicionar uma sobremesa? 🍓").
- **Adicionar** novo Step entre o atual passo 4 (Data/Horário) e o 5 (Resumo): **"Personalize seu pedido"** (Upsell).
  - Passa a haver 6 passos. Atualizar `TITULOS` (adicionar `"PERSONALIZE"` antes de `"REVISÃO E ENVIO"`), `progresso = step/6`, `initialStep` selector preview e validações em `avancar`.
  - Se `campanha.upsell.ativo === false` ou `upsell.itens.length === 0` → pular automaticamente (em runtime; não em modo `isPreview`).
- Conteúdo do passo Upsell:
  - Renderiza cada item de `campanha.upsell.itens`:
    - **Produto** (resolve via `cestas.find(c => c.id === produtoId && ativo && !arquivado)`): card igual ao atual de sobremesas, com toggle (`toggleSobremesa` continua válido — qualquer Cesta vira "extra").
    - **Cartão**: card com checkbox "Adicionar"; quando marcado, mostra `<Textarea>` com contador `{n}/{maxCaracteres}` e `maxLength`. Salva no `usePedido.extras`.
    - **Polaroid**: card com checkbox "Adicionar"; quando marcado, mostra `<input type="file" accept="image/jpeg,image/png">`. Após selecionar, mostra "✓ Foto enviada — pronto para envio" (não exibe preview). Faz upload imediato para Supabase Storage (bucket `polaroids`, path `{pedidoId|tmp-{uuid}}/{filename}`) e salva a URL em `usePedido.extras`.
- O `Resumo` (Step final) lista os extras (cartão + polaroid + sobremesas) somando ao `total`.

### `usePedido` (`src/store/pedido.ts`)

Adicionar slice:

```ts
extras: {
  cartoes: { itemId: string; nome: string; preco: number; mensagem: string }[];
  polaroids: { itemId: string; nome: string; preco: number; arquivoUrl: string; arquivoNome: string }[];
}
setCartao(itemId, patch)
removeCartao(itemId)
setPolaroid(itemId, patch)
removePolaroid(itemId)
```

`selectTotal` passa a somar também os extras (`cartoes` + `polaroids` + `sobremesas`).

### Persistência no pedido (`src/lib/pedidos.ts`)

- O payload enviado para `upsert_pedido_rascunho` ganha um campo `extras` dentro do JSON (já é JSONB):
  ```
  extras: { cartoes: [...], polaroids: [{ nome, preco, arquivoUrl, arquivoNome }] }
  ```
- `PedidoRow`/`rowToPedidoSalvo` expõem `extras`.
- `WhatsApp message` (`src/lib/whatsappMsg.ts`): adicionar linhas:
  - `*Cartão:* "<mensagem>"`
  - `*Foto Polaroid:* <url assinada>`

---

## 4) Cartãozinho + Foto Polaroid — back-end

### Storage (migration nova)

```sql
-- bucket público (URLs de download para o admin)
insert into storage.buckets (id, name, public)
values ('polaroids', 'polaroids', true)
on conflict (id) do nothing;

-- RLS: permitir INSERT anônimo (cliente sobe foto antes de finalizar)
create policy "polaroids_insert_anon"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'polaroids');

-- leitura pública (já implícita por bucket público) — manter explícita:
create policy "polaroids_read_public"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'polaroids');
```

### Tabela `pedidos`

Sem mudança de schema: o JSONB já existente recebe `extras`. Se o RPC `upsert_pedido_rascunho` espelha colunas tipadas, **adicionar coluna**:

```sql
alter table public.pedidos add column if not exists extras jsonb not null default '{}'::jsonb;
```

E atualizar a função `upsert_pedido_rascunho` para gravar `_payload->'extras'` em `extras`.

### Painel de pedidos (`src/components/admin/AbaPedidos.tsx`)

- Nova coluna "Extras" (ou ícones na linha) com:
  - Se `extras.cartoes?.length`: ícone ✉️ + tooltip/expand mostrando a mensagem.
  - Se `extras.polaroids?.length`: ícone 📷 com link "Baixar foto" apontando para `arquivoUrl` (download attribute).
- CSV exportado ganha colunas "Cartão" e "Polaroid (URL)".

### Upload (cliente)

Helper `src/lib/uploadPolaroid.ts`:

```ts
import { supabase } from "@/integrations/supabase/client";

export async function uploadPolaroid(file: File): Promise<{ url: string; nome: string } | null> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("polaroids").upload(path, file, {
    contentType: file.type, upsert: false,
  });
  if (error) return null;
  const { data } = supabase.storage.from("polaroids").getPublicUrl(path);
  return { url: data.publicUrl, nome: file.name };
}
```

Validações: `accept="image/jpeg,image/png"`, `file.size <= 10 * 1024 * 1024` (10 MB), erro via `toast`.

Em modo `isPreview` (preview do editor): mockar — não sobe arquivo, apenas marca como "✓ Foto (prévia)".

---

## Arquivos tocados

**Edit**:
- `src/components/Quiz.tsx` — label condicional (#1), remover sobremesas (#3), novo step Upsell (#3,#4), TITULOS/progresso.
- `src/components/admin/CampanhaForm.tsx` — remover blocos Upsell de Delivery/Retirada (#2), adicionar bloco em InfoGeral (#2,#4).
- `src/store/admin.ts` — tipo `CampanhaUpsell`/`UpsellItem`, migration v10, defaults, remoção dos campos `upsell*` de delivery/retirada.
- `src/store/pedido.ts` — slice `extras`, `selectTotal` com extras.
- `src/lib/pedidos.ts` — payload com `extras`, `PedidoRow.extras`, `rowToPedidoSalvo`.
- `src/lib/whatsappMsg.ts` — incluir cartão/polaroid na mensagem.
- `src/components/admin/AbaPedidos.tsx` — coluna Extras + CSV.
- `src/components/Resumo.tsx` / `Sucesso.tsx` se aplicável — exibir extras.
- `src/components/Upsell.tsx` — pode ser removido (não usado mais) ou re-aproveitado pelo novo step; vamos remover o uso atual e deletar o arquivo se não houver outros consumidores.

**Create**:
- `src/lib/uploadPolaroid.ts` — helper de upload.
- Migration SQL — bucket `polaroids` + policies + coluna `extras` em `pedidos` + atualização do RPC `upsert_pedido_rascunho`.

---

## Critérios de aceite

1. Quiz step de data/horário mostra "Quando deseja Retirar?" quando entrega = retirada; "Quando deseja receber?" caso contrário.
2. Editor de campanha não tem mais bloco de Upsell em Delivery/Retirada; tem um bloco único em "Informações Gerais".
3. Bloco de upsell aceita produtos do catálogo, "Cartãozinho Especial" (com `maxCaracteres` configurável) e "Foto Polaroid".
4. No Quiz, sobremesas não aparecem mais no passo de data/horário; aparecem como itens de upsell quando o admin as inclui.
5. Cliente que escolhe "Cartãozinho" digita mensagem com contador `n/max`; texto vai junto ao pedido (Supabase + WhatsApp + painel).
6. Cliente que escolhe "Foto Polaroid" envia JPG/PNG (≤10 MB); vê confirmação "✓ enviada"; admin baixa pelo painel de pedidos.
7. Pedidos antigos continuam abrindo (migration preserva dados de upsell legado).
