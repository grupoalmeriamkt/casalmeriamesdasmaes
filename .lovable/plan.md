# Pré-visualização mobile do Quiz no editor de campanha

Adicionar, ao lado do `CampanhaForm`, um painel fixo no estilo "mockup de celular" que renderiza o Quiz da campanha em edição, atualizando ao vivo a cada alteração feita no formulário (slug, textos, produtos, datas, status, upsell, etc.).

## Como vai funcionar

- O store `useAdmin` (Zustand) já é a fonte de verdade do Quiz. Como o formulário grava direto no store, basta renderizar `<Quiz />` apontando para a campanha em edição — qualquer mudança no input reflete instantaneamente na prévia, sem código de sincronização extra.
- A prévia é **somente visual**: nenhuma ação real (gravar rascunho no Supabase, abrir WhatsApp, enviar Pixel/CAPI/GTM, validar CEP via API) é executada.
- Layout no `AbaCampanhas` (modo editar):
  - Desktop (≥ lg): grid de 2 colunas — formulário à esquerda, prévia sticky à direita (largura ~380px, altura ~780px, moldura de celular).
  - Mobile/tablet: prévia escondida + botão "Ver prévia" que abre um `Sheet` lateral.

## Arquivos novos

**`src/components/admin/QuizPreviewMobile.tsx`**
- Moldura de celular (bordas arredondadas, notch, sombra) com `width: 375px`, `height: 760px`, `overflow: hidden`.
- Dentro: `<div className="scale-[0.85] origin-top">` envolvendo um wrapper que isola estilos e força viewport mobile.
- Renderiza `<Quiz initialStep={previewStep} onConcluir={noop} onVoltar={noop} />` em modo "preview".
- Header da prévia: select para escolher o passo (1 a 5) e botão "Recarregar" que reseta o `usePedido` local.
- Aviso "Pré-visualização — interações desabilitadas".

**`src/components/admin/PreviewContext.tsx`** (pequeno context)
- Expõe `isPreview: boolean` para o Quiz e dependências (Upsell etc.) detectarem modo prévia e:
  - pular efeitos colaterais (tracking, salvar rascunho, finalizar pedido);
  - usar dados mockados em vez de chamadas de rede (CEP, geocoding).

## Arquivos editados

**`src/components/Quiz.tsx`**
- Consumir `useIsPreview()`. Quando `true`:
  - `salvarRascunho` vira no-op;
  - `buscarCep` preenche endereço fake sem fetch;
  - bloqueia `fbqTrack`, `sendCapiEvent`, `trackBeginCheckout`, `trackLeadStart/Complete`, `trackPurchase`;
  - `onConcluir` apenas avança visual sem `finalizarPedido`.
- Nenhuma mudança visual quando fora do preview.

**`src/components/Upsell.tsx`**
- Mesma checagem `useIsPreview()` para evitar `onPular()` automático no efeito de montagem (na prévia, deixar o passo visível mesmo sem itens, ou exibir placeholder).

**`src/components/admin/AbaCampanhas.tsx`**
- Quando `editando` estiver ativo, trocar o layout para:
  ```
  <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
    <div><CampanhaForm ... /></div>
    <aside className="hidden lg:block sticky top-6 self-start">
      <QuizPreviewMobile campanhaId={editando.id} />
    </aside>
  </div>
  ```
- Botão "Ver prévia do Quiz" no header (mobile) abre `Sheet` da direita com o mesmo componente.

**`src/components/admin/CampanhaForm.tsx`**
- Sem mudanças funcionais; apenas garantir que continua patchando o store imediatamente (já é o caso).

## Diagrama de layout (desktop)

```text
┌──────────────────────────── Editar — Campanha X ─────────────────────────────┐
│  ◀ Voltar                                                                     │
│                                                                               │
│  ┌─────────────────────── Form ───────────────────────┐  ┌── Prévia ──┐      │
│  │  [Tabs: Info | Delivery | Retirada]                 │  │  ╭──────╮  │      │
│  │  Nome / Slug / Status / Unidade …                   │  │  │ Quiz │  │      │
│  │  Produtos principais                                │  │  │ step │  │      │
│  │  Datas, Textos                                      │  │  │  1-5 │  │      │
│  │                                                     │  │  ╰──────╯  │      │
│  └─────────────────────────────────────────────────────┘  └────────────┘      │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Notas técnicas

- O Quiz usa `usePedido` (store global). Para a prévia não interferir no pedido real do usuário no admin, criar uma instância isolada via `createStore` ou simplesmente resetar `usePedido` ao montar a prévia + impedir `salvarRascunho`. A opção mais simples e segura é a segunda (já coberta pela flag `isPreview`).
- A campanha exibida na prévia é a que está sendo editada — vou setar `campanhaAtivaId = editando.id` ao montar (o `AbaCampanhas` já faz algo similar) e restaurar ao desmontar.
- A prévia respeita data/status: se a campanha estiver "pausada" ou fora da janela, mostra a `MensagemBloqueio` correspondente (igual ao público). Isso é desejado — ajuda o admin a perceber.

## Critérios de aceite

1. Ao editar uma campanha em desktop, a prévia mobile aparece à direita.
2. Editar título, slug, textos, produtos selecionados, datas ou status atualiza a prévia em < 200ms.
3. Selecionar produto na prévia não dispara WhatsApp, não grava pedido e não envia eventos de tracking.
4. Em mobile/tablet, há um botão "Ver prévia" que abre o mockup em um Sheet.
5. Botões "Próximo passo / passo anterior" da prévia permitem navegar pelos 5 passos do Quiz sem validação obrigatória.
