## Plano de correções — Editor de Campanha e Quiz

### 1. Slug editável, validado e único (`CampanhaForm.tsx` + `admin.ts`)

O campo de slug já existe em **Informações Gerais**, mas não valida unicidade nem mostra erro. Vamos endurecer:

- Manter normalização ao digitar (lowercase, `[a-z0-9-]`, sem hífens duplos).
- Adicionar **estado local** `slugRascunho` no `InfoGeralTab`: o usuário edita livremente sem propagar a cada tecla. Ao sair do campo (`onBlur`) ou clicar em "Aplicar":
  - Sanitiza, remove hífens nas pontas.
  - Verifica se o resultado colide com:
    - `RESERVED_SLUGS` (admin, pedido, pedidos, api, checkout, q, vazio) — mesmo set usado em `src/routes/$slug.tsx`.
    - Outra campanha (`campanhas.some(c => c.id !== campanha.id && c.slug === novo)`).
  - Se inválido/duplicado: `toast.error("Slug já em uso por outra campanha")` ou "Slug reservado". Não chama `onPatch`. O input mostra borda vermelha + mensagem inline.
  - Se válido: `onPatch({ slug: novo })`. O "Link público gerado" logo abaixo já é derivado de `campanha.slug`, então atualiza em tempo real (já é reativo via store).
- Exportar e reusar `RESERVED_SLUGS` de `$slug.tsx` num módulo compartilhado novo `src/lib/slugs.ts` com `RESERVED_SLUGS` + `normalizarSlug(s: string)`.
- Em `addCampanha` (store) já gera slug único via `Date.now().toString(36)` — manter, mas adicionar guarda extra: se por acaso colidir, sufixa `-2`, `-3` etc.

### 2. Quiz mostra só os produtos da campanha (`Quiz.tsx` + `admin.ts`)

**Bug atual**: o passo 1 do Quiz usa `useCestasAtivas()`, que devolve **todos** os produtos ativos do sistema. Ignora `campanha.produtosPrincipaisIds`.

Correções:

- Criar selector novo `useProdutosDaCampanhaAtiva()` em `src/store/admin.ts`:
  - Lê `campanhaAtiva.produtosPrincipaisIds`.
  - Mapeia para os objetos completos em `s.cestas` (preservando ordem de seleção).
  - Filtra apenas `ativo && !arquivado`.
  - Se a campanha não selecionou nenhum produto: retorna lista vazia (não fazer fallback para todos).
- Em `src/components/Quiz.tsx`, passo 1: trocar `useCestasAtivas()` por `useProdutosDaCampanhaAtiva()`.
- Quando lista vazia, renderizar aviso amigável: "Nenhum produto configurado para esta campanha. Volte ao painel e selecione produtos em Informações Gerais." + botão "Voltar".
- No painel admin (`InfoGeralTab` → bloco "Produtos Principais"): se `produtosPrincipaisIds.length === 0`, mostrar aviso amarelo "⚠️ Sem produtos selecionados o Quiz não terá itens para o cliente escolher".

### 3. Upsell — sobremesas e consistência delivery/retirada

**Estado atual**: existem **dois** lugares editáveis para upsell:
- Em "Informações Gerais": `campanha.upsellAtivo` + `campanha.upsellProdutoIds` (legado).
- Em "Delivery" e "Retirada": `delivery.upsellAtivo/upsellProdutoIds` e `retirada.upsellAtivo/upsellProdutoIds`.

O componente `Upsell.tsx` lê **apenas** os de delivery/retirada conforme o tipo escolhido pelo cliente — então o bloco de Upsell em "Informações Gerais" é confuso e enganoso (parece salvar mas não afeta o Quiz).

Correções:

- **Remover** o bloco "Upsell" de `InfoGeralTab` (campos `campanha.upsellAtivo`/`upsellProdutoIds`). Esses campos legados continuam no tipo só para compat de pedidos antigos.
- O upsell agora é configurado **somente** dentro das abas Delivery e Retirada, que já existem e já são lidos corretamente por `Upsell.tsx`.
- `ProdutosSeletor` filtra `cestas.filter(c => c.ativo && !c.arquivado)` — sobremesas estão em `cestas` sob `categoriaId: "cat-sobremesas"` (graças à migração na store), então **já aparecem** automaticamente. Vou verificar isso visualmente após o ajuste rodando `garantirSobremesas()` no boot, e confirmar que produtos categorizados como Sobremesas aparecem no seletor.
- Adicionar filtro/agrupamento opcional no `ProdutosSeletor`: mostrar produtos agrupados por categoria (Cestas / Sobremesas / outras) para facilitar achar sobremesa entre muitos produtos. Cabeçalho de categoria + lista. Sem filtro de busca por enquanto (lista é curta).
- Em `Upsell.tsx`: se `lista.length === 0`, **não renderizar a seção** (em vez de cair no fallback `sobremesasFallback`). Isso garante que o cliente só vê o que o admin escolheu — nada de "produtos aleatórios". Ajustar Quiz para chamar `onPular()` automaticamente se a etapa de upsell não tiver itens.

### 4. Persistência — auditoria do editor

Os campos do editor já gravam direto no store Zustand via `setCampanha`/`setCampanhaDelivery`/`setCampanhaRetirada`, e o store é reativo — o "Link público" já reflete em tempo real. O que pode confundir o usuário:

- **Mudanças locais ≠ publicadas**: hoje a `SaveConfigBar` exige clicar em "Publicar alterações" para enviar ao Supabase. Visitantes só veem o que está no `app_config`. Vamos:
  - Tornar a barra mais visível quando há alterações pendentes: rastrear um hash do estado relevante (`campanhas`, `cestas`, `home`, etc.) e comparar com o último publicado. Quando diferente, mostrar dot vermelho + texto "Há alterações não publicadas".
  - Após `saveCloudConfig` ok, atualizar o snapshot publicado.
- **Datas (`dataInicio`, `dataFim`, `dataLimitePedidos`)**: já persistem via `onPatch`. Não há leitura no Quiz hoje. Adicionar guarda em `src/routes/$slug.tsx`:
  - Se `dataInicio` no futuro → mostrar "Esta campanha começa em [data]".
  - Se `dataFim` no passado **ou** `dataLimitePedidos` no passado → mostrar "Encerrada — não aceitamos novos pedidos".
- **Horários de funcionamento (`delivery.horario`/`retirada.horario`)**: hoje não são lidos. Não vamos implementar bloqueio por horário agora (escopo grande); deixar nota visível no painel: "Estes horários são informativos hoje — bloqueio automático será implementado em fase futura". Isso evita a impressão de que "não estão sendo respeitados".
- Verificar todos os campos `textos.*` (titulo, subtitulo, boasVindas, confirmacao): atualmente o Quiz lê `useAdmin(s => s.textos)` (textos GLOBAIS), não `campanha.textos`. Bug. Corrigir:
  - `Quiz.tsx`: ler `useCampanhaAtiva()?.textos` e usar `boasVindas` no header do passo 1, `confirmacao` na tela de Sucesso.
  - `Sucesso.tsx`: ler `campanha.textos.confirmacao` quando houver.

### 5. Validação fim-a-fim

Após implementar, abrir `/admin`:
- Editar slug "principal" → "primavera" → publicar → abrir `/primavera` (deve abrir Quiz; `/principal` deve cair na home).
- Tentar slug duplicado → erro inline e toast.
- Selecionar 2 produtos em "Produtos Principais" → publicar → Quiz mostra exatamente esses 2.
- Marcar 1 sobremesa em "Upsell — Delivery" → escolher delivery no Quiz → ver só essa sobremesa no upsell.
- Editar `textos.boasVindas` e `textos.titulo` → publicar → conferir Quiz/Sucesso.

### Arquivos a alterar

- `src/lib/slugs.ts` (novo) — `RESERVED_SLUGS`, `normalizarSlug`.
- `src/routes/$slug.tsx` — usa `RESERVED_SLUGS` do novo módulo; checa janelas de data.
- `src/components/admin/CampanhaForm.tsx` — slug com onBlur+validação+erro inline; remove bloco Upsell de InfoGeralTab; aviso quando sem produtos; agrupamento por categoria no `ProdutosSeletor`.
- `src/store/admin.ts` — `useProdutosDaCampanhaAtiva()`; sufixo único em `addCampanha`.
- `src/components/Quiz.tsx` — usa `useProdutosDaCampanhaAtiva()`; lê `campanha.textos`.
- `src/components/Upsell.tsx` — sem fallback global; oculta seção quando vazia.
- `src/components/Sucesso.tsx` — lê `campanha.textos.confirmacao`.
- `src/components/admin/SaveConfigBar.tsx` — indicador de "alterações não publicadas".
