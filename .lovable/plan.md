## Objetivo

Criar uma página pública somente-leitura de pedidos para a equipe de produção acompanhar e imprimir, sem precisar de login no admin.

## Nova rota: `/pedidos/$token`

Página pública (fora do `/admin`) acessada por link com token secreto. Mostra apenas pedidos — nada de configurações.

Layout:

- Cabeçalho simples: "Pedidos — Casa Almeria" + botão Atualizar (auto-refresh a cada 30s).
- **Duas colunas/abas**:
  - **Aguardando pagamento** (status `pendente` + `abandonado` com nome/telefone preenchidos)
  - **Aprovados** (status `aprovado`)
- Cada pedido em card com: nº, data/hora, **nome**, **telefone (clicável wa.me)**, cesta, sobremesas, tipo (delivery/retirada), endereço/unidade, data+horário entrega, total, status.
- Botões por pedido: **Ver detalhes** (modal) e **Imprimir** (gera folha A5 só desse pedido, `window.print()` com CSS `@media print`).
- Botão "Imprimir todos aprovados do dia" no topo.

## Mostrar pedidos incompletos

Hoje só inserimos no banco quando o pedido é finalizado. Para mostrar nome/telefone "mesmo sem concluir", precisamos gravar mais cedo:

- No `Quiz`/fluxo, assim que o cliente preenche **nome + whatsapp** e avança, fazer um `upsert` em `pedidos` com `status = 'rascunho'` e `pedido_id` salvo no `usePedido` store.
- Conforme o cliente avança (escolhe cesta, endereço, etc.), atualizar o mesmo registro.
- Quando finaliza pagamento → status muda para `pendente`/`aprovado`.
- Adicionar status `rascunho` na lista visível em "Aguardando pagamento" da tela da cozinha (com tag visual "Em preenchimento").

## Backend (SQL — migration)

1. Adicionar coluna `share_token` na tabela `pedidos`? **Não** — melhor uma tabela única de tokens:
  ```sql
   create table public.share_tokens (
     token text primary key,
     scope text not null check (scope in ('pedidos')),
     criado_em timestamptz default now(),
     criado_por uuid references auth.users(id)
   );
   alter table public.share_tokens enable row level security;
   create policy "Admins manage tokens" on public.share_tokens
     for all to authenticated
     using (public.has_role(auth.uid(),'admin'))
     with check (public.has_role(auth.uid(),'admin'));
  ```
2. Função RPC pública para listar pedidos via token (security definer):
  ```sql
   create or replace function public.pedidos_por_token(_token text)
   returns setof public.pedidos
   language sql stable security definer set search_path=public as $$
     select p.* from public.pedidos p
     where exists (select 1 from public.share_tokens t
                   where t.token = _token and t.scope = 'pedidos')
     order by p.criado_em desc
     limit 500;
   $$;
   grant execute on function public.pedidos_por_token(text) to anon, authenticated;
  ```
3. Permitir `update` público em `pedidos` para o próprio rascunho? Mais seguro: criar RPC `upsert_pedido_rascunho(payload jsonb, pedido_id uuid)` que retorna o id, com RLS atual mantendo `select` admin-only. O cliente público nunca lê a tabela direto.
4. Adicionar valor `'rascunho'` ao check de status (se houver) ou só usar texto livre.

## Frontend

**Arquivos novos**:

- `src/routes/cozinha.$token.tsx` — página pública, busca via `supabase.rpc('pedidos_por_token', { _token })`, polling 30s, abas Aguardando/Aprovados, modal de detalhes, impressão.
- `src/components/cozinha/PedidoCard.tsx`, `PedidoDetalhes.tsx`, `FolhaImpressao.tsx`.
- `src/lib/shareToken.ts` — helpers (gerar/listar/revogar).

**Arquivos editados**:

- `src/components/admin/AbaPedidos.tsx` — adicionar bloco "Link público para a cozinha" no topo: botão "Gerar link", exibe URL com copiar, botão "Revogar".
- `src/lib/pedidos.ts` — nova função `upsertRascunho(pedidoParcial)` chamando RPC.
- `src/store/pedido.ts` — guardar `pedidoId` retornado e disparar `upsertRascunho` em pontos-chave (após nome+whatsapp, após escolher cesta, após endereço, etc.).
- `src/lib/pedidos.ts` `inserirPedido` → vira "finalizar" (atualiza rascunho existente em vez de criar novo).

## Estilo de impressão

CSS global `@media print` escondendo header/menus, mostrando só `.folha-impressao` com: logo, nº pedido, cliente, contato, itens, entrega, total. Tamanho A5 retrato.

## Resumo das mudanças

- Migration SQL: tabela `share_tokens` + RPCs `pedidos_por_token` e `upsert_pedido_rascunho`.
- Aba Pedidos: gerenciar link público.
- Nova rota pública `/cozinha/$token` com filtro por status, detalhes, impressão individual e em lote, auto-refresh.
- Fluxo de checkout grava rascunho cedo para capturar nome/telefone de pedidos não concluídos.