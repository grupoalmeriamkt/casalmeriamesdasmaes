# Exibir extras em Resumo, Admin e Link público

Hoje os "extras" (Cartãozinho com mensagem e Foto Polaroid) são coletados no Quiz e gravados no banco em `pagamento.extras`, mas:
- O **Resumo** antes do pagamento não os mostra e **nem os envia** para o `inserirPedido` (são perdidos quando o cliente paga pelo Resumo).
- O **painel admin** (`AbaPedidos`) só lista pedidos em tabela — não tem detalhe.
- O **link público** (`/pedidos/$token`) tem modal de detalhes, mas não mostra extras.

---

## 1. Resumo de Compra (`src/components/Resumo.tsx`)

- Ler `extras` do store: `const extras = usePedido((s) => s.extras)`.
- Na seção "Resumo do pedido", após a lista de sobremesas, renderizar:
  - Cada `extras.cartoes[i]`: linha com nome do item + preço, e logo abaixo a mensagem entre aspas em itálico (`text-charcoal italic`, fundo `bg-linen` ou borda lateral terracotta).
  - Cada `extras.polaroids[i]`: linha com nome + preço e abaixo, em destaque, ícone `<ImageIcon />` (lucide) + texto "1 foto enviada — `arquivoNome`".
- Incluir `extras` no `pedidoPayload.pagamento.extras` ao chamar `inserirPedido`, montando a partir do store (apenas `nome`, `preco`, `mensagem` para cartões; `nome`, `preco`, `arquivoUrl`, `arquivoNome` para polaroids). O `selectTotal` já soma os extras, então o `total` continua correto.

---

## 2. Painel Admin — modal de detalhes (`src/components/admin/AbaPedidos.tsx`)

- Adicionar estado `const [detalhe, setDetalhe] = useState<PedidoSalvo | null>(null)`.
- Tornar cada linha da tabela clicável (`onClick={() => setDetalhe(p)}` + `cursor-pointer hover:bg-muted/50`).
- Renderizar um `<Dialog>` (shadcn) que abre quando `detalhe` está setado, exibindo um componente `DetalhesPedidoAdmin` com:
  - **Cliente**: nome, WhatsApp (link `wa.me`).
  - **Entrega**: tipo, endereço/unidade, data, horário.
  - **Itens**: cesta (nome × qtd × preço unitário) e cada sobremesa.
  - **Upsell — Cartãozinho**: para cada `pagamento.extras.cartoes`, mostrar nome + preço + bloco destacado com a mensagem.
  - **Upsell — Polaroid**: para cada `pagamento.extras.polaroids`, mostrar nome + preço + miniatura `<img src={arquivoUrl} className="h-24 w-24 object-cover rounded">` + botão "Baixar foto" (`<a href={arquivoUrl} download={arquivoNome} target="_blank">` estilizado como Button com ícone `<Download />`).
  - **Status** (badge colorido) + **Total** (destacado em terracotta).
- Acrescentar colunas `Cartões`/`Polaroids` no CSV exportado (contagem) — opcional, manter simples.

---

## 3. Link público (`src/routes/pedidos.$token.tsx`)

Atualizar o componente `DetalhesPedido` (já existente) para:
- Logo após a lista de itens, renderizar bloco "Personalizações":
  - **Cartãozinho Especial**: para cada cartão, item + preço + caixa com a mensagem entre aspas em itálico (mesma estética do Resumo).
  - **Foto Polaroid**: item + preço + linha com ícone `<Image />` + texto "Foto enviada com sucesso" (sem mostrar a imagem nem link de download — o link público é para o cliente).
- Atualizar também o componente `FolhaImpressao` para incluir as mensagens dos cartões e a confirmação de polaroid (útil para a cozinha).

---

## Detalhes técnicos

- **Tipos**: `PedidoSalvo.pagamento.extras` já existe em `src/store/admin.ts` e `PedidoRow.pagamento.extras` já existe em `src/lib/pedidos.ts` — não precisa migração de banco. Os dados gravados pelo Quiz já chegam corretamente; só falta exibir.
- **Bug crítico a corrigir**: `Resumo.tsx` monta `pedidoPayload.pagamento = { metodo: tab, status: "aprovado" }` sem extras. Quando o pedido é finalizado pela tela Resumo (não pelo Quiz), os extras são perdidos. A correção (item 1) garante persistência.
- **Helpers compartilhados**: criar `src/components/PedidoExtrasView.tsx` (opcional) com dois sub-componentes — `<CartoesList>` e `<PolaroidsList variant="admin"|"cliente">` — reutilizáveis pelo Resumo, modal admin, e link público, evitando duplicação de markup.
- **Botão de download (admin)**: como o bucket `polaroids` é público, o `arquivoUrl` do Supabase Storage funciona direto como `href`. Atributo `download` no `<a>` força o download na maioria dos browsers; em caso de CORS, abrir em nova aba também resolve para o admin.
- **Acessibilidade**: Dialog com `DialogTitle` descritivo (`Pedido #ABC123`).

---

## Arquivos afetados

```text
src/components/Resumo.tsx                  (extras na UI + payload)
src/components/admin/AbaPedidos.tsx        (linhas clicáveis + dialog detalhes)
src/routes/pedidos.$token.tsx              (extras em DetalhesPedido + FolhaImpressao)
src/components/PedidoExtrasView.tsx        (novo — opcional)
```

Nenhuma migração de banco necessária.
