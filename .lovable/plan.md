# Plano — Melhorias no Editor de Campanha + correções

## 1. Editor de Campanha: nova aba "Informações Gerais"

**Reorganizar `src/components/admin/CampanhaForm.tsx`** transformando o cabeçalho atual em uma aba e adicionando duas novas abas no `Tabs`:

```text
[Informações Gerais]  [Delivery]  [Retirada]
```

A aba **Informações Gerais** conterá:

- **Bloco "Identificação"** (campos atuais já existentes): Nome, Slug, Link público (read-only + copiar), Status (ativa/pausada), Unidade vinculada.
- **Bloco "Produtos Principais"** (novo): seletor múltiplo de produtos, lista produtos de `s.cestas` filtrados por `ativo && !arquivado`. Cada item exibe foto, nome e preço com checkbox. Salva em novo campo `campanha.produtosPrincipaisIds: string[]` com reordenação por ↑/↓ (reaproveitar o componente `UpsellSeletor` extraindo-o como `ProdutosSeletor` genérico).
- **Bloco "Upsell"** (novo nesta aba — em adição aos upsells por canal): toggle `campanha.upsellAtivo` + `ProdutosSeletor` populando `campanha.upsellProdutoIds` (campos legados que já existem no store). Os upsells específicos por canal (Delivery/Retirada) continuam separados nas suas abas.
- **Bloco "Datas"** (novo): três date pickers (shadcn Calendar dentro de Popover, com `pointer-events-auto`):
  - Data de início — `campanha.dataInicio?: string` (ISO)
  - Data de encerramento — `campanha.dataFim?: string`
  - Data limite para encomendas — `campanha.dataLimitePedidos?: string`
- **Bloco "Textos"** (novo): 4 inputs/textareas simples:
  - Título da campanha — `campanha.textos.titulo`
  - Descrição/subtítulo — `campanha.textos.subtitulo`
  - Mensagem de boas-vindas (Quiz) — `campanha.textos.boasVindas`
  - Texto de confirmação — `campanha.textos.confirmacao`

### Mudanças no store (`src/store/admin.ts`)

Estender o tipo `Campanha`:

```ts
type CampanhaTextos = {
  titulo: string;
  subtitulo: string;
  boasVindas: string;
  confirmacao: string;
};

type Campanha = {
  // ...campos atuais
  produtosPrincipaisIds: string[];
  dataInicio?: string;
  dataFim?: string;
  dataLimitePedidos?: string;
  textos: CampanhaTextos;
};
```

Defaults preenchidos em `initialCampanha`, `addCampanha` e no `migrate` (versão **8**), com fallback `produtosPrincipaisIds: []`, `textos: { titulo: nome, subtitulo: "", boasVindas: "", confirmacao: "" }`.

---

## 2. Delivery — restaurar horário antigo

O campo "Horário de funcionamento (Delivery)" hoje usa um `HorarioSemana` (grade Seg–Dom com Switch + `time` início/fim) que é o componente atual. O usuário pediu para reutilizar o **mesmo formato do Quiz anterior**, que é o componente `DatasHorarios` (lista de Datas + Janelas de horário com label livre).

**Ação**: na aba **Delivery** do `CampanhaForm.tsx`, substituir o bloco "Horário de funcionamento (Delivery)" pelo mesmo editor `DatasHorarios` que aparece em "Configuração do Quiz de Delivery", lendo/gravando em `delivery.datas` e `delivery.horarios`. Remover o bloco `HorarioSemana` redundante (e o campo `delivery.horario` deixa de ser exibido — mantemos no tipo por compatibilidade até a próxima limpeza). Mesmo tratamento na aba **Retirada** se necessário (consistência) — mas o pedido foi específico para Delivery; mantemos Retirada como está, exceto deixar apenas o `DatasHorarios`.

---

## 3. Produtos — restaurar Sobremesas

O `migrate` v7 já copia `state.sobremesas` para `state.cestas` quando faltam — porém, se o usuário **excluiu manualmente** itens de sobremesa de `state.cestas`, o migrate não roda novamente (versão já é 7). O campo `arquivado` ou exclusão real explica por que sumiram.

**Ação no `migrate` (bumpar para v8)**:
- Garantir que **todos** os IDs de `SOBREMESAS` (de `src/lib/data.ts`) existam em `state.cestas`. Se faltarem, reinserir com `categoriaId: "cat-sobremesas"`, `ativo: true`, `arquivado: false`.
- Garantir que produtos com `categoriaId: "cat-sobremesas"` que existem em `state.cestas` mas estão `arquivado: true` sejam desarquivados **apenas se** o ID original veio da seed `SOBREMESAS` (não tocar em produtos criados pelo usuário).
- Não duplicar (checar por `id` antes de inserir).

Como a persistência é local (Zustand persist) e `app_config` no Supabase também guarda `cestas` (via `cloudConfig`), incluir uma normalização similar no boot do `CloudConfigLoader` ou logo após `loadCloudConfig` injetar o estado: rodar uma função `garantirSobremesas()` que aplica a mesma lógica em runtime, para corrigir bases já publicadas no Supabase sem exigir nova publicação manual.

---

## 4. Painel — corrigir atualização automática indevida

Causa identificada em `src/hooks/useAuth.ts`: o listener `supabase.auth.onAuthStateChange` dispara em eventos de `TOKEN_REFRESHED` e `INITIAL_SESSION` periódicos. Cada disparo chama `setSession`/`setUser`/`setIsAdmin` mesmo quando os valores são equivalentes, e re-roda `checkAdmin` (RPC), o que re-renderiza todo o `admin.tsx` e descarta o `useState` local da aba selecionada / formulários abertos.

**Ações:**

1. **Em `useAuth`**, ignorar eventos que não mudam estado:
   - Filtrar por `event`: tratar somente `SIGNED_IN`, `SIGNED_OUT`, `USER_UPDATED`. Ignorar `TOKEN_REFRESHED` e `INITIAL_SESSION` (já temos `getSession()` no boot).
   - Comparar `sess?.user?.id` com o atual antes de atualizar: se igual, não chamar setters.
   - Não re-executar `checkAdmin` se o `userId` não mudou.

2. **Em `src/routes/admin.tsx`**, mover o `useState` de `aba` e `menuOpen` para `localStorage` (ou `sessionStorage`) com hidratação no mount, para que mesmo se houver remontagem (HMR, recarregamento manual, troca de sessão), o usuário não perca a aba ativa.

3. **Verificação adicional** — confirmar (via leitura) que não há `setInterval` de polling no admin. Os únicos `setInterval` do projeto estão em `src/routes/pedidos.$token.tsx` (página pública de acompanhamento, fora do painel) — não tocar.

4. **`CloudConfigLoader`** já roda só uma vez no mount (`useEffect` com deps `[]`); não causa refresh.

---

## 5. Banco de dados — verificação

As mudanças deste prompt são **somente client-side**. Os novos campos da campanha (`produtosPrincipaisIds`, datas, textos) são serializados dentro do JSON `payload` da tabela existente `app_config` (coluna `jsonb`) — **nenhuma alteração de schema é necessária**.

Sobre restaurar produtos perdidos no banco: `app_config.payload.cestas` é um JSON; a "restauração" acontece no migrate client-side e no patch após `loadCloudConfig`. Quando o admin clicar em **Publicar alterações**, o `cestas` corrigido será regravado em `app_config`. **Nenhum SQL é necessário** — o sistema se autocorrige no próximo publish.

(Se houver desejo explícito de fazer um upsert manual via SQL no Supabase para "carimbar" o payload corrigido sem esperar o admin publicar, podemos rodar isso depois — mas exige acesso `psql` que não está habilitado nesta sessão. Ficou fora do escopo padrão.)

---

## 6. Quiz — sem alterações estruturais

Confirmado: a estrutura do Quiz (`src/components/Quiz.tsx`) e seus selectors (`useDatasAtivas`, `useHorariosAtivos`, `useUnidadesAtivas`) já leem da campanha ativa via `s.campanhas[].quiz`. Mantemos o fluxo, perguntas e layout inalterados. Novas campanhas continuam herdando o shape via `addCampanha`/migrate.

---

## Arquivos afetados

**Editados:**
- `src/store/admin.ts` — novos campos em `Campanha`, defaults, migrate v8, função `garantirSobremesas`.
- `src/components/admin/CampanhaForm.tsx` — `Tabs` com 3 abas; nova aba "Informações Gerais"; substituir `HorarioSemana` do Delivery por `DatasHorarios`; extrair `UpsellSeletor` para reutilização (renomeado `ProdutosSeletor` ou mantido com prop `titulo`).
- `src/hooks/useAuth.ts` — filtro de eventos + comparação de userId.
- `src/routes/admin.tsx` — persistir aba ativa em `localStorage`.
- `src/lib/cloudConfig.ts` (ou `CloudConfigLoader.tsx`) — chamar `garantirSobremesas` após o `loadCloudConfig`.

**Sem novos arquivos. Sem migrações SQL.**

Após aprovação executo nesta ordem: store/migrate → CampanhaForm com 3 abas → useAuth filter → admin.tsx persist aba → cloudConfig sobremesas.
