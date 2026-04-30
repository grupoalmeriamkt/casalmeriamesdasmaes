# Correções e Melhorias — Casa Almeria

Plano dividido nos 5 itens da solicitação. Sem novos recursos além do pedido.

---

## 1. Rotas — remover `/q/` do link da campanha

**Problema atual:** o link público do Quiz é `/q/{slug}` (arquivo `src/routes/q.$slug.tsx` + texto "Slug do link (/q/...)" no formulário).

**Mudanças:**
- Renomear `src/routes/q.$slug.tsx` → `src/routes/$slug.tsx` (rota dinâmica raiz `/{slug}`).
- No componente da rota, adicionar guarda: se `slug` colidir com qualquer rota fixa existente (`admin`, `pedido`, `pedidos`, `api`), redirecionar para `/`. Isso evita que o catch-all engula rotas já reservadas.
- Em `CampanhaForm.tsx`: trocar o label "Slug do link (/q/...)" por "Slug do link (/...)" e adicionar lista de slugs reservados na sanitização (se o usuário digitar `admin`, devolve para um valor seguro com aviso `toast`).
- Em `AbaCampanhas.tsx`: ajustar `linkDe(slug)` de `${origin}/q/${slug}` para `${origin}/${slug}`.
- Atualizar qualquer referência a `/q/` em comentários/textos (`.lovable/plan.md` é apenas documentação interna; ignorar).

**Risco:** rota dinâmica raiz captura tudo. A guarda por slugs reservados resolve. Como o TanStack Router prioriza rotas estáticas sobre dinâmicas, `/admin` continua resolvendo para `src/routes/admin.tsx` normalmente.

---

## 2. Configurações → Geral — remover campos

Em `src/components/admin/AbaGeral.tsx` remover os blocos:
- Toggle "Mostrar upsell de sobremesas" (`mostrarUpsell`)
- Toggle "Mostrar seção Informações importantes" (`mostrarInformacoes`)
- Campo "Mensagem da página de manutenção" (`msgManutencao`)
- Campo "Data de encerramento de encomendas" (`encerramento`)

Manter o toggle "Site ativo" e a Zona de risco.

**Limpeza no store (`src/store/admin.ts`):**
- Remover esses 4 campos de `ConfigGeral` e do `initial.geral`.
- Remover leitura desses campos em `src/routes/index.tsx` (bloco `isEncerrado` e `Manutencao msg=…` — manter somente `geral.ativa` para manutenção, com texto fixo padrão).
- Atualizar `src/components/Hero.tsx` e `src/components/Header.tsx` para não dependerem de `isEncerrado`/`encerramento`.
- Remover/ignorar `mostrarUpsell` e `mostrarInformacoes` onde forem lidos (a configuração de upsell passa a ser por campanha — item 4).
- Bumpar `version` do persist para `7` e adicionar branch no `migrate` que apaga esses campos do estado salvo.

---

## 3. Produtos — restaurar categoria "Sobremesas"

Em `src/store/admin.ts`:
- Adicionar `{ id: "cat-sobremesas", nome: "Sobremesas" }` ao array `initialCategorias`.
- No `migrate` (v7), garantir que se `categorias` não tiver `cat-sobremesas`, ela seja inserida.
- Vincular automaticamente: produtos cuja origem é `SOBREMESAS` (em `src/lib/data.ts`) — hoje vivem em `state.sobremesas`, separados de `state.cestas`. Como a UI de Produtos lista apenas `state.cestas`, no `migrate` vamos copiar os itens de `state.sobremesas` (que ainda não existirem em `state.cestas`) para `state.cestas` com `categoriaId: "cat-sobremesas"`, mantendo `ativo: true`, `arquivado: false`. Isso "restaura" os produtos na lista de Produtos sob a categoria Sobremesas.
- A categoria fica vazia se não houver itens migráveis — adição manual continua funcionando.

---

## 4. Campanhas — upsell múltiplo

**Store (`Campanha`):** trocar `upsellProdutoId?: string` por `upsellProdutoIds: string[]` (ordem do array = ordem de exibição). Migrar no v7: se existir `upsellProdutoId`, virar `[upsellProdutoId]`.

**`CampanhaForm.tsx`** — bloco Upsell:
- Substituir o `<Select>` único por um seletor múltiplo customizado:
  - Lista os produtos de `state.cestas` com `ativo && !arquivado`.
  - Cada item mostra **thumbnail (imagem), nome e preço**.
  - Checkbox para selecionar/desselecionar.
- Abaixo, lista dos produtos já selecionados em ordem, com:
  - Botão "remover" (X)
  - Botões "↑" / "↓" para reordenar (ou drag-handle simples — ordenação por setas é suficiente e leve).
- O array final é gravado em `campanha.upsellProdutoIds`.

**Consumo no Quiz/Upsell:** `src/components/Upsell.tsx` e `src/components/Quiz.tsx` precisam aceitar a lista (renderizar todos os upsells da campanha ativa, na ordem). Hoje existe um único upsell — vou iterar sobre `campanha.upsellProdutoIds.map(id => cestas.find(...))` e exibir cards na mesma seção.

---

## 5. Editar Campanha — abas Delivery / Retirada

Reescrita do `CampanhaForm.tsx` para a estrutura abaixo. Os novos campos exigem ampliar `Campanha` no store.

### Cabeçalho fixo (fora das abas)
- Nome da campanha
- Link público gerado (read-only, copiável) — agora `/{slug}`
- Status (ativa / pausada)
- **Unidade vinculada** — `Select` único populado com `state.unidades` ativas. Substitui o atual seletor múltiplo de unidades por um único vínculo (campo novo `campanha.unidadeId`). O quiz herda raio, horário e endereço dessa unidade.

### Aba "Delivery"
Bloco controlado por `campanha.delivery: { ativo, valorMinimo, taxa: { tipo: "fixa"|"faixa", valor, faixas: [{ ateKm, valor }] }, tempoEstimado: { min, max }, raioKm, bairros: string[], horario: HorarioFuncionamento, quiz: QuizFlow, upsell: { ativo, produtoIds: string[] } }`.

Campos visíveis:
- Toggle "Delivery ativo"
- Valor mínimo de pedido (input numérico)
- Taxa de entrega: radio (Fixa / Por faixa de km) + inputs correspondentes
- Tempo estimado (min – max em minutos)
- Raio (km) **ou** lista de bairros atendidos (campo de tags)
- Horário de funcionamento por dia da semana (componente reutilizando `HorarioFuncionamento` — 7 linhas com toggle + início/fim)
- Configuração do Quiz de Delivery: editor de perguntas (lista de perguntas, cada uma com `texto`, `tipo` (única/múltipla), opções `[{ label, proxima? }]` para lógica de fluxo)
- Upsell no Delivery: toggle + seletor múltiplo (item 4)

### Aba "Retirada"
Bloco controlado por `campanha.retirada: { ativo, valorMinimo, tempoPreparoMin, tempoPreparoMax, horario: HorarioFuncionamento, enderecoRetirada, quiz: QuizFlow, upsell: { ativo, produtoIds: string[] } }`.

Campos visíveis:
- Toggle "Retirada ativa"
- Valor mínimo de pedido
- Tempo estimado de preparo (min – max)
- Horário de funcionamento por dia da semana
- Local/endereço de retirada (texto livre, sugestão automática = endereço da unidade vinculada)
- Configuração do Quiz de Retirada (mesmo editor da aba Delivery, dados independentes)
- Upsell na Retirada: toggle + seletor múltiplo

### Tipo `QuizFlow`
```ts
type QuizFlow = {
  perguntas: Array<{
    id: string;
    texto: string;
    tipo: "unica" | "multipla";
    opcoes: Array<{ id: string; label: string; proximaPerguntaId?: string }>;
  }>;
};
```
Editor: lista de perguntas com botões "Adicionar pergunta" / "Remover"; dentro de cada, lista de opções editáveis com `Select` opcional para "ir para pergunta…" (lógica de fluxo). Implementação simples, sem drag-and-drop (botões ↑ ↓).

### Migração v7
O `quiz` antigo (`QuizConfig` com `delivery/retirada/datas/horarios/restricaoRaio`) é convertido:
- `campanha.delivery.ativo = quiz.delivery`
- `campanha.retirada.ativo = quiz.retirada`
- `campanha.delivery.raioKm = quiz.restricaoRaio.raioKm`
- `unidadeId = quiz.unidadeIds[0]`
- horários/datas antigos viram `QuizFlow` vazio (usuário recadastra) — defaults sensatos preenchidos.
- Selectors `useDatasAtivas`, `useHorariosAtivos`, `useUnidadesAtivas` continuam funcionando lendo do novo shape (compatibilidade legada do Quiz consumidor).

---

## Resumo dos arquivos

**Editados:**
- `src/store/admin.ts` — novo shape `Campanha`, remoções em `ConfigGeral`, novas categorias, migrate v7, selectors atualizados.
- `src/components/admin/CampanhaForm.tsx` — reescrita com `Tabs` Delivery/Retirada, cabeçalho fixo, seletor múltiplo de upsell, editor de QuizFlow.
- `src/components/admin/AbaCampanhas.tsx` — link `/{slug}` (sem `/q/`).
- `src/components/admin/AbaGeral.tsx` — remover 4 campos.
- `src/routes/index.tsx` — remover `isEncerrado` e leitura de `msgManutencao`.
- `src/components/Hero.tsx`, `src/components/Header.tsx` — remover `isEncerrado`.
- `src/components/Upsell.tsx`, `src/components/Quiz.tsx` — iterar sobre lista de upsells.

**Renomeado:** `src/routes/q.$slug.tsx` → `src/routes/$slug.tsx` (com guarda de slugs reservados).

**Sem novos arquivos.**

Após aprovação, executo na ordem: store/migrate → renomear rota → AbaGeral → CampanhaForm reescrito → ajustes em Quiz/Upsell.
