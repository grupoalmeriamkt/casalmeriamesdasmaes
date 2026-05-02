import { useMemo } from "react";
import { useAdmin } from "@/store/admin";
import { useCarrinho } from "@/store/carrinho";
import { formatBRL } from "@/store/pedido";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export function HomeProdutosPorCategoria() {
  const categorias = useAdmin((s) => s.categorias);
  const cestas = useAdmin((s) => s.cestas);
  const add = useCarrinho((s) => s.add);

  const grupos = useMemo(() => {
    const ativos = cestas.filter((c) => c.ativo && !c.arquivado);
    const cats = [...categorias].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    const out: { id: string; nome: string; produtos: typeof ativos }[] = [];
    for (const cat of cats) {
      const lista = ativos.filter((p) => p.categoriaId === cat.id);
      if (lista.length) out.push({ id: cat.id, nome: cat.nome, produtos: lista });
    }
    const semCat = ativos.filter(
      (p) => !p.categoriaId || !cats.find((c) => c.id === p.categoriaId),
    );
    if (semCat.length) out.push({ id: "outros", nome: "Outros", produtos: semCat });
    return out;
  }, [categorias, cestas]);

  if (grupos.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Nenhum produto disponível no momento.
      </p>
    );
  }

  // Todos os produtos em destaque (primeiros de cada grupo, até 8)
  const emDestaque = grupos.flatMap((g) => g.produtos).slice(0, 8);

  return (
    <div id="cardapio" className="py-10 md:py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">

        {/* ── Em destaque: horizontal scroll (mobile) / grid 4 col (desktop) ── */}
        <div className="mb-10 md:mb-14">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="font-serif text-2xl font-semibold text-charcoal md:text-3xl">
              Em destaque
            </h2>
          </div>

          {/* Mobile: horizontal scroll de feature cards */}
          <div className="scrollbar-hide -mx-4 overflow-x-auto px-4 pb-2 md:hidden">
            <ul className="flex gap-3">
              {emDestaque.map((p) => (
                <li key={p.id} className="w-[200px] shrink-0">
                  <FeatureCard
                    produto={p}
                    onAdd={() => {
                      add({ produtoId: p.id, nome: p.nome, preco: p.preco, imagem: p.imagem });
                      toast.success(`${p.nome} adicionado`);
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>

          {/* Desktop: grid 4 colunas */}
          <div className="hidden gap-4 md:grid md:grid-cols-3 lg:grid-cols-4">
            {emDestaque.map((p) => (
              <FeatureCard
                key={p.id}
                produto={p}
                onAdd={() => {
                  add({ produtoId: p.id, nome: p.nome, preco: p.preco, imagem: p.imagem });
                  toast.success(`${p.nome} adicionado`);
                }}
              />
            ))}
          </div>
        </div>

        {/* ── Cardápio por categoria ── */}
        <div className="space-y-12">
          {grupos.map((g) => (
            <section key={g.id} id={`cat-${g.id}`} className="scroll-mt-20">
              <h2 className="mb-5 font-serif text-2xl font-semibold text-charcoal md:text-3xl">
                {g.nome}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.produtos.map((p) => (
                  <CompactCard
                    key={p.id}
                    produto={p}
                    onAdd={() => {
                      add({ produtoId: p.id, nome: p.nome, preco: p.preco, imagem: p.imagem });
                      toast.success(`${p.nome} adicionado`);
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Feature Card (vertical, foto 1:1 no topo) ─────────────────────────────
type ProdutoItem = {
  id: string;
  nome: string;
  badge: string;
  preco: number;
  descricao: string;
  itens: string[];
  imagem: string;
};

function FeatureCard({ produto: p, onAdd }: { produto: ProdutoItem; onAdd: () => void }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-[18px] bg-white ring-1 ring-charcoal/8 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft">
      {/* Foto */}
      <div className="relative aspect-square w-full overflow-hidden bg-[#f3ecdf]">
        {p.imagem ? (
          <img
            src={p.imagem}
            alt={p.nome}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-serif text-3xl text-charcoal/20">
            {p.nome.charAt(0)}
          </div>
        )}
        {/* Badge no canto */}
        {p.badge && (
          <span className="absolute left-3 top-3 rounded-full bg-charcoal/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
            {p.badge}
          </span>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-serif text-base font-semibold leading-snug text-charcoal">
          {p.nome}
        </h3>
        {(p.descricao || p.itens?.[0]) && (
          <p className="mt-1 line-clamp-1 text-xs text-charcoal/55">
            {p.descricao || p.itens.slice(0, 2).join(" · ")}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span className="font-serif text-lg font-bold tabular-nums text-charcoal">
            {formatBRL(p.preco)}
          </span>
          <button
            onClick={(e) => { e.preventDefault(); onAdd(); }}
            aria-label={`Adicionar ${p.nome}`}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-charcoal text-white transition-all hover:bg-charcoal/85 active:scale-90"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

// ── Compact Card (horizontal, foto à esquerda) ────────────────────────────
function CompactCard({ produto: p, onAdd }: { produto: ProdutoItem; onAdd: () => void }) {
  return (
    <article className="group flex gap-3 overflow-hidden rounded-[16px] bg-white p-3 ring-1 ring-charcoal/8 transition-all duration-200 hover:shadow-soft">
      {/* Foto quadrada */}
      <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[12px] bg-[#f3ecdf]">
        {p.imagem ? (
          <img
            src={p.imagem}
            alt={p.nome}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-serif text-2xl text-charcoal/20">
            {p.nome.charAt(0)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          {p.badge && (
            <span className="mb-1 inline-block rounded-full bg-olive/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-olive">
              {p.badge}
            </span>
          )}
          <h3 className="font-serif text-[15px] font-semibold leading-snug text-charcoal">
            {p.nome}
          </h3>
          {(p.descricao || p.itens?.[0]) && (
            <p className="mt-0.5 line-clamp-1 text-xs text-charcoal/50">
              {p.descricao || p.itens.slice(0, 2).join(" · ")}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between pt-1.5">
          <span className="font-serif text-[15px] font-bold tabular-nums text-charcoal">
            {formatBRL(p.preco)}
          </span>
          <button
            onClick={(e) => { e.preventDefault(); onAdd(); }}
            aria-label={`Adicionar ${p.nome}`}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-charcoal text-white transition-all hover:bg-charcoal/85 active:scale-90"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}
