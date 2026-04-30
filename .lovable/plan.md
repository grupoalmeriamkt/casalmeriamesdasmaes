# Reestruturação do Painel Casa Almeria

Mudança grande, com impacto em sidebar, store, várias abas, rota pública e a Home. Abaixo o plano dividido por área, na ordem de execução.

---

## 1. Sidebar (`src/routes/admin.tsx`)

Novo menu principal:

- **Site Principal** (atual aba "Textos" renomeada — controla textos da LP)
- **Produtos** (atual "Cestas")
- **Campanhas** (NOVO)
- **Pedidos**
- **Configurações** (vira hub com sub-abas)

Removidos do nível raiz: Aparência, Pagamento, Integrações, Upsell, Entrega.

A aba "Configurações" passa a renderizar um componente `AbaConfiguracoes` com sub-abas internas (tabs horizontais no topo do conteúdo):

- Geral (atual `AbaGeral`)
- Unidades (NOVO — ver §2)
- Aparência (atual `AbaAparencia`)
- Pagamento (atual `AbaPagamento`)
- Integrações (atual `AbaIntegracoes`)

A aba "Upsell" (`AbaSobremesas`) deixa de existir como item de menu — sobremesas viram opção dentro de Campanhas (§4). Mantemos o store `sobremesas` para reaproveitar como catálogo de produtos-upsell.

---

## 2. Configurações → Unidades

Hoje as unidades vivem em `entrega.unidades` (store `admin.ts`) com campos: id, nome, endereço, lat, lng, ativa.

Vamos **promover Unidades a entidade de primeiro nível** no store: `state.unidades[]`, com o shape ampliado:

- `id`, `nome`, `endereco`, `lat?`, `lng?`
- `horarioFuncionamento`: por dia da semana (seg–dom), cada um com `{ ativo, inicio, fim }`
- `raioEntregaKm: number`
- `status: "ativa" | "inativa"`

Migração: copiar `entrega.unidades` existentes para `state.unidades` preenchendo defaults (horário 09:00–18:00 seg–sáb, raio = `entrega.restricaoRaio.raioKm` ou 10). Remover `entrega.unidades` e `entrega.restricaoRaio` (a restrição passa a ser por unidade).

Componente novo: `src/components/admin/AbaUnidades.tsx` — lista cards editáveis com botão "Adicionar unidade". Geocodificação (lat/lng) reaproveita helper atual `geocodificarEndereco`.

Regra de uso: todo seletor de unidade no sistema (checkout, campanhas, etc.) lê de `useUnidadesAtivas()` que filtra `status === "ativa"`.

---

## 3. Produtos — listagem com ações + Categorias

`AbaCestas` (renomeada visualmente para "Produtos") vira **lista compacta** ao invés de cards expandidos. Cada linha mostra: thumb, nome, badge, preço, status, e um menu de ações (`DropdownMenu`):

- **Abrir** — abre dialog read-only com detalhes
- **Editar** — abre o formulário atual em `Dialog`
- **Excluir** — `AlertDialog` de confirmação ("Tem certeza? Esta ação não pode ser desfeita.")
- **Arquivar** — seta novo campo `arquivado: true` (produto some da Home/Quiz mas continua na lista, marcado como arquivado; ação "Desarquivar" disponível)

Adicionar no store: `arquivado?: boolean` em cestas; selectors `useCestasAtivas` passam a filtrar `!arquivado && ativo`.

**Categorias**: nova entidade `state.categorias: { id, nome }[]` + campo `categoriaId?: string` em cada produto. Botão "Gerenciar categorias" no topo da página abre dialog com CRUD simples (criar / renomear / excluir; ao excluir, produtos ficam com `categoriaId` indefinido = "Sem categoria").

---

## 4. Campanhas (NOVA página)

Novo componente `AbaCampanhas` no admin + nova rota pública `src/routes/q.$slug.tsx` para o link da campanha.

Store novo: `state.campanhas: Campanha[]`

```ts
type Campanha = {
  id: string;
  slug: string;             // gera o link /q/{slug}
  nome: string;
  status: "ativa" | "pausada";
  upsellAtivo: boolean;
  upsellProdutoId?: string; // referencia state.cestas (ou sobremesas)
  quiz: QuizConfig;         // toda config que hoje vive em entrega
};

type QuizConfig = {
  delivery: boolean;
  retirada: boolean;
  unidadeIds: string[];     // referenciam state.unidades
  datas: { id, label, ativa }[];
  horarios: { label, ativo }[];
  restricaoRaio: { ativo, unidadeBaseId, raioKm };
};
```

UI da aba: lista de campanhas com nome, status, link copiável (`https://casa.grupoalmeria.com.br/q/{slug}`), botões editar/duplicar/excluir. Ao editar, abre formulário com:

1. Dados básicos (nome, slug auto, status)
2. Bloco "Configuração do Quiz" — exatamente o conteúdo atual de `AbaEntrega` (delivery/retirada toggles, seleção de unidades dentre as cadastradas em §2, datas, horários, restrição de raio)
3. Bloco "Upsell" — toggle + `Select` populado com `state.cestas` ativas

**Migração**: ao subir a v6 do store, criar uma campanha "default" copiando `state.entrega` atual, com slug `principal`. Depois remover `state.entrega` do tipo.

**Rota pública** `src/routes/q.$slug.tsx`: idêntica a `index.tsx` atual, mas lê a campanha pelo slug e injeta a config no `Quiz` via prop (Quiz hoje lê do store global — vamos passar a aceitar uma `QuizConfig` opcional via prop, com fallback ao store por compatibilidade).

A aba "Entrega" deixa de existir.

---

## 5. Home pública (`src/routes/index.tsx` + Quiz)

Hoje a Home renderiza diretamente o `Quiz`. Novo comportamento:

A Home exibe **vitrine de produtos agrupados por categoria** (apenas `ativo && !arquivado`). Cada produto tem botão "Quero esse" que inicia o Quiz da campanha default. Estrutura:

```
<Hero />
{categorias.map(cat => (
  <section>
    <h2>{cat.nome}</h2>
    <ProdutoGrid produtos={produtosDe(cat)} />
  </section>
))}
{produtosSemCategoria.length > 0 && <section title="Outros">...</section>}
```

Componente novo: `src/components/VitrineProdutos.tsx`. Ao clicar em "Quero esse", seleciona o produto no `usePedido` e avança o Quiz como hoje.

---

## Resumo técnico das mudanças

**Store (`src/store/admin.ts`)** — versão 6 com migrate:
- adiciona `unidades`, `categorias`, `campanhas`
- cestas ganham `categoriaId?`, `arquivado?`
- remove `entrega` (migra para campanha "principal")
- novos selectors: `useUnidadesAtivas`, `useCampanhasAtivas`, `useProdutosAtivos`, `useCategorias`

**Arquivos novos:**
- `src/components/admin/AbaConfiguracoes.tsx` (hub com tabs)
- `src/components/admin/AbaUnidades.tsx`
- `src/components/admin/AbaCampanhas.tsx`
- `src/components/admin/CampanhaForm.tsx`
- `src/components/admin/CategoriasDialog.tsx`
- `src/components/admin/ProdutoFormDialog.tsx` (extrai form atual de AbaCestas)
- `src/components/VitrineProdutos.tsx`
- `src/routes/q.$slug.tsx`

**Arquivos editados:**
- `src/routes/admin.tsx` — novo array de ABAS
- `src/routes/index.tsx` — vitrine + entrada no Quiz
- `src/components/admin/AbaCestas.tsx` — lista + ações
- `src/components/Quiz.tsx` — aceita prop `config?: QuizConfig`
- arquivos que usam `entrega.*` (Quiz, Resumo, etc.) — passam a ler da campanha ativa

**Arquivos removidos do menu (mas mantidos como componentes reutilizados internamente):**
- `AbaAparencia`, `AbaPagamento`, `AbaIntegracoes`, `AbaSobremesas`, `AbaEntrega` — `AbaEntrega` será deletado depois que `AbaCampanhas` estiver completo.

---

## Pontos de atenção / decisões

1. **Sobremesas vs Upsell**: hoje há `state.sobremesas` (catálogo separado) usado como upsell no Quiz. Como o item 4 diz "selecionar um produto cadastrado (puxa da lista de Produtos)", vou fazer o Select de upsell puxar de `state.cestas` (Produtos). A aba `AbaSobremesas` é removida e `state.sobremesas` deixa de ser editável pela UI (mantenho no store por compatibilidade de migração, mas pode ser limpo depois).

2. **Restrição de raio por unidade**: como cada unidade agora tem `raioEntregaKm`, a `restricaoRaio` da campanha pode virar só `{ ativo: boolean }` usando o raio da própria unidade base. Vou nessa direção (mais simples e coerente com §2).

3. **Link público da campanha**: usaremos `/q/{slug}` para ficar curto. A Home (`/`) continua existindo como vitrine institucional.

4. **Backward compat**: o `migrate` do persist garante que clientes com state antigo não percam dados — entrega vira campanha "principal", unidades migram para o novo lugar, cestas ganham defaults de categoria/arquivado.

Posso começar pela ordem: store → Unidades → Campanhas/rota pública → Produtos lista+categorias → Sidebar/Configurações hub → Home vitrine.
