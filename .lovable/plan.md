## Visão geral

Reformular a Home pública (`/`) para ser um cardápio digital genérico do Casa Almeria (sem viés "Dia das Mães"), criar um Editor da Home no painel, adicionar carrinho de múltiplos produtos com checkout via Mercado Pago, proteger o link público de pedidos com senha, e varrer bugs.

---

## 1. Rota "/" — Home como cardápio

A rota `/` hoje **não** redireciona para campanha, mas usa textos e badge de "Dia das Mães" vindos de `useAdmin().textos` (defaults em `src/store/admin.ts`). Vamos:

- Remover o `<span className="badge-mae">🌸 Dia das Mães</span>` do `Index`.
- Substituir os defaults de `textos.heroTitulo/heroSubtitulo/badgePrazo` por textos genéricos do Casa Almeria (ex.: "Sabores artesanais com entrega em Brasília").
- Atualizar `<head>` (root e index) tirando "Dia das Mães" do título/OG.
- Garantir que `/` nunca renderize o componente de campanha; campanhas só vivem em `/[slug]` (`src/routes/$slug.tsx` já está correto).

## 2. Nova Home pública

Reescrever `src/routes/index.tsx` para ter, de cima para baixo:

1. **Header** com logo + links (Instagram, WhatsApp).
2. **Banner principal** (imagem única configurável)
   - `home.banner = { imagemUrl, titulo, subtitulo, ctaLabel, ctaHref }`
   - Componente: `src/components/home/HomeBanner.tsx`.
3. **Campanhas em destaque**
   - Lista `campanhas.filter(c => c.status === "ativa" && home.campanhasDestaque[c.id]?.ativo)` ordenado por `ordem`.
   - Card: imagem (vinda de `campanha.imagemDestaque` — campo novo), nome e botão "Acessar" → `Link to="/$slug"`.
   - Componente: `HomeCampanhasDestaque.tsx`.
4. **Categorias (scroll horizontal)**
   - `categorias` ganha campos `imagemCapa?` e `ordem`.
   - Cada card âncora `href="#cat-{id}"` faz scroll suave até a seção.
   - Componente: `HomeCategoriasCarousel.tsx`.
5. **Produtos por categoria**
   - Reaproveita lógica de `VitrineProdutos.tsx`, mas com `id="cat-{categoriaId}"` em cada seção e botão "Adicionar ao carrinho" (não mais "Quero esse").
6. **Rodapé configurável**
   - `home.rodape = { enderecos[], horarios[], redes: { instagram, whatsapp, facebook }, textoLivre }`.
   - Componente: `HomeFooter.tsx`.

### Carrinho + checkout MP

Como o usuário escolheu **carrinho com vários produtos**:

- Novo store: `src/store/carrinho.ts` (zustand + persist) com `itens: { produtoId, quantidade }[]`, ações `add/remove/setQtd/clear`, selector de total.
- Drawer `CartDrawer.tsx` (usando `@/components/ui/sheet`) com botão flutuante e badge de contagem.
- Página de checkout `src/routes/checkout.tsx`: form de cliente (nome, whatsapp, tipo entrega/retirada — reaproveita `Quiz` parcial ou form simples) + botão "Pagar com Mercado Pago".
- Reaproveitar `src/routes/api/public/mp-preference.ts` adaptando o payload para receber lista de itens em vez de uma cesta única.
- Persistência do pedido em `pedidos` via `finalizarPedido` (Supabase) com `cesta = null` e `sobremesas` populado a partir do carrinho. Marcar tipo `"home"`.

## 3. Painel — "Editor da Home"

Nova aba na sidebar do admin (`src/routes/admin.tsx` → array `ABAS`), entre "Site Principal" e "Produtos":

- Id: `home`, label: "Editor da Home", icon: `LayoutTemplate`, componente `AbaHome`.

`src/components/admin/AbaHome.tsx` com sub-abas (Tabs):

1. **Banner** — `ImageUpload` + inputs (título, subtítulo, CTA label, CTA href).
2. **Campanhas em destaque** — lista de todas campanhas com toggle "Exibir na Home" + input numérico de ordem (drag opcional via lista simples).
3. **Categorias** — para cada categoria: `ImageUpload` (capa) + ordem. Botão "Editar categorias" abre o `CategoriasDialog` existente.
4. **Produtos** — reaproveita `AbaCestas` em modo embed (lista por categoria com toggle ativo + edição via `ProdutoFormDialog` já existente). Para evitar duplicação, fazer `AbaCestas` aceitar prop opcional ou simplesmente linkar para a aba "Produtos".
5. **Rodapé** — textarea endereços, horários por unidade (ler de `unidades`), inputs redes sociais, textarea texto livre.

### Mudanças no store (`src/store/admin.ts`)

Novo slice `home` (versionado, migration v9):

```ts
export type HomeBanner = { imagemUrl: string; titulo: string; subtitulo: string; ctaLabel: string; ctaHref: string };
export type HomeCampanhaDestaque = { ativo: boolean; ordem: number };
export type HomeRodape = { enderecos: string; redes: { instagram: string; whatsapp: string; facebook: string }; textoLivre: string };
export type Home = { banner: HomeBanner; campanhasDestaque: Record<string, HomeCampanhaDestaque>; rodape: HomeRodape };
```

`Categoria` ganha `imagemCapa?: string` e `ordem?: number`.
`Campanha` ganha `imagemDestaque?: string`.

Setters: `setHome`, `setHomeBanner`, `setHomeCampanhaDestaque`, `setHomeRodape`, `setCategoriaImagem`, `setCategoriaOrdem`.

Bumpar `version` do persist e implementar `migrate` que injeta defaults sem perder dados existentes.

## 4. Segurança — Senha no link público de pedidos

### Banco

Nova migração `supabase/migrations/<timestamp>_share_token_password.sql`:

```sql
ALTER TABLE share_tokens ADD COLUMN IF NOT EXISTS senha text;

-- RPC pública: valida token + senha. Retorna boolean.
CREATE OR REPLACE FUNCTION public.validar_token_pedidos(_token text, _senha text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM share_tokens
    WHERE token = _token AND scope = 'pedidos'
      AND (senha IS NULL OR senha = _senha)
  );
$$;

-- Atualizar pedidos_por_token para checar senha
CREATE OR REPLACE FUNCTION public.pedidos_por_token(_token text, _senha text DEFAULT NULL)
RETURNS SETOF pedidos LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.validar_token_pedidos(_token, _senha) THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM pedidos ORDER BY criado_em DESC LIMIT 500;
END;
$$;
```

Senha em **texto puro** conforme escolha do usuário.

### Painel

`AbaPedidos.tsx` — ao "Gerar link", abrir um pequeno dialog:
- Toggle "Proteger com senha"
- Se ativo: input de senha (mín. 4 chars, validado com zod)
- Botão "Criar"

Após criar, mostrar card com:
- URL completa
- Senha (se houver)
- Botão "Copiar mensagem" — copia template:
  ```
  Acesse a lista de pedidos pelo link abaixo:
  🔗 {url}
  🔑 Senha: {senha}
  ```
  (omitir linha da senha se não houver)

`src/lib/shareToken.ts` — `criarTokenPedidos(senha?: string)` insere com `senha`.

### Tela pública `/pedidos/$token`

`src/routes/pedidos.$token.tsx`:
- Estado `senhaConfirmada` em sessionStorage por token.
- Ao montar, tentar `pedidos_por_token(token, senha)` com senha vazia. Se RPC retornar 0 pedidos **e** o token tiver `senha` (não dá pra saber direto — chamar primeiro `validar_token_pedidos(token, '')` ; se falso, exibir tela de senha).
- Tela de senha: input + botão "Entrar". Não revela se token existe ou não — sempre mostra "Senha incorreta" em caso de falha.
- Sanitização: `senha` validada com zod (`z.string().min(1).max(64)`).

### Segurança geral (varredura)

- Confirmar `/admin` e sub-abas protegidas: `admin.tsx` já bloqueia via `useAuth()` + `isAdmin`. OK.
- Confirmar RLS de `pedidos`: leitura via service role (admin) ou RPC com token. Adicionar comentário no migration confirmando policies.
- Validação zod em todos forms públicos: checkout, senha do link.
- Sem `dangerouslySetInnerHTML` em conteúdo do usuário.

## 5. Bugs — varredura e correções

Itens já mapeados durante a leitura:

1. **Texto "Dia das Mães" hardcoded** em `__root.tsx` e `index.tsx` — trocar por genérico Casa Almeria.
2. **`useEffect` após early return** em `src/routes/$slug.tsx` (linha 41 vem depois de returns condicionais nas linhas 35 e 45) — viola regras dos hooks. Mover `useEffect` para antes dos returns.
3. **`<Navigate to="/" />` em `$slug.tsx`** quando slug reservado pode causar loop em rotas com nomes semelhantes — trocar por `throw redirect({ to: "/" })` no `beforeLoad`.
4. **Sidebar mobile** em `admin.tsx` — `menuOpen` não fecha ao trocar viewport para desktop; adicionar `useEffect` com matchMedia.
5. **`SaveConfigBar` mobile** — `sticky top-0` colide com header mobile. Ajustar `top-[56px]` em telas md:hidden.
6. **`AbaPedidos`** — `confirm()` nativo não funciona em alguns iOS; trocar por `AlertDialog`.
7. **Loading infinito** em `CloudConfigLoader` se Supabase responder erro silenciosamente — já tem timeout de 3s, manter.
8. **Console**: rodar `code--read_console_logs` durante implementação e corrigir quaisquer warnings restantes (chaves duplicadas, refs faltando).

---

## Detalhes técnicos

### Arquivos novos

```
src/components/home/HomeBanner.tsx
src/components/home/HomeCampanhasDestaque.tsx
src/components/home/HomeCategoriasCarousel.tsx
src/components/home/HomeProdutosPorCategoria.tsx
src/components/home/HomeFooter.tsx
src/components/home/CartDrawer.tsx
src/components/home/CartButton.tsx
src/components/admin/AbaHome.tsx
src/components/admin/SharedLinkDialog.tsx
src/store/carrinho.ts
src/routes/checkout.tsx
supabase/migrations/<ts>_share_token_password.sql
supabase/migrations/<ts>_home_categoria_imagem.sql  (não necessário — campos vivem no client store)
```

### Arquivos editados

```
src/routes/__root.tsx          — meta tags genéricas
src/routes/index.tsx           — nova Home (cardápio)
src/routes/$slug.tsx           — fix hooks + redirect
src/routes/admin.tsx           — nova aba "Editor da Home", fix mobile
src/routes/pedidos.$token.tsx  — gate de senha
src/store/admin.ts             — slice home, migration v9, campos novos
src/lib/shareToken.ts          — senha + helpers de mensagem
src/lib/pedidos.ts             — pedidos_por_token aceita senha
src/components/admin/AbaPedidos.tsx — dialog gerar link com senha + msg copiável
src/components/admin/AbaCestas.tsx — pequenos ajustes para reuso
src/components/CloudConfigLoader.tsx — garantir defaults da nova `home`
```

### Compatibilidade

- Migração de store v8 → v9: `migrate` injeta `home` default, `categorias` ganha `imagemCapa/ordem` opcionais. Nada é removido.
- Migração SQL usa `IF NOT EXISTS` para `senha`. RPC `pedidos_por_token` ganha parâmetro com `DEFAULT NULL` — clientes antigos continuam funcionando para tokens sem senha.
- Quiz das campanhas permanece exatamente igual.

### Fora de escopo

- Drag-and-drop real para reordenação (usar inputs numéricos de ordem).
- Editor visual WYSIWYG do rodapé (apenas textareas).
- Múltiplos banners / carrossel — usuário escolheu imagem única.
