import { useMemo } from "react";
import { useAdmin } from "@/store/admin";
import { useCarrinho } from "@/store/carrinho";
import { formatBRL } from "@/store/pedido";
import { Plus } from "lucide-react";
import { toast } from "sonner";

type ProdutoItem = {
  id: string;
  nome: string;
  badge: string;
  preco: number;
  descricao: string;
  itens: string[];
  imagem: string;
};

type Props = { search?: string };

export function HomeProdutosPorCategoria({ search = "" }: Props) {
  const categorias = useAdmin((s) => s.categorias);
  const cestas = useAdmin((s) => s.cestas);
  const add = useCarrinho((s) => s.add);

  const { ativos, grupos, emDestaque, preferidos } = useMemo(() => {
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

    const emDestaque = ativos.slice(0, 8);
    const preferidos = ativos.slice(-3).reverse();

    return { ativos, grupos: out, emDestaque, preferidos };
  }, [categorias, cestas]);

  const doAdd = (p: ProdutoItem) => {
    add({ produtoId: p.id, nome: p.nome, preco: p.preco, imagem: p.imagem });
    toast.success(`${p.nome} adicionado`);
  };

  // Search results mode
  if (search.trim()) {
    const q = search.toLowerCase();
    const results = ativos.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        p.descricao?.toLowerCase().includes(q),
    );
    return (
      <div id="cardapio" className="py-6">
        <div className="mx-auto max-w-6xl px-5 md:px-6 lg:px-8">
          <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-charcoal/50">
            {results.length} resultado{results.length !== 1 ? "s" : ""}
          </p>
          {results.length === 0 ? (
            <p className="py-16 text-center text-sm text-charcoal/40">
              Nada encontrado para "{search}"
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {results.map((p) => (
                <CompactCard key={p.id} produto={p} onAdd={() => doAdd(p)} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (grupos.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-charcoal/50">
        Nenhum produto disponível no momento.
      </p>
    );
  }

  return (
    <div id="cardapio" className="pb-10 pt-8 md:pb-14 md:pt-10">
      <div className="mx-auto max-w-6xl">

        {/* ── Em destaque ── */}
        <div className="mb-10 md:mb-14">
          <SectionTitle className="px-5 md:px-6 lg:px-8">Em destaque</SectionTitle>

          {/* Mobile: horizontal scroll feature cards */}
          <div
            className="scrollbar-hide overflow-x-auto pb-1.5 md:hidden"
            style={{ padding: "0 20px 6px" }}
          >
            <div className="flex gap-3.5">
              {emDestaque.map((p) => (
                <FeatureCard key={p.id} produto={p} onAdd={() => doAdd(p)} />
              ))}
            </div>
          </div>

          {/* Desktop: grid 4 col */}
          <div className="hidden gap-4 px-6 md:grid md:grid-cols-3 lg:grid-cols-4 lg:px-8">
            {emDestaque.map((p) => (
              <FeatureCardDesktop key={p.id} produto={p} onAdd={() => doAdd(p)} />
            ))}
          </div>
        </div>

        {/* ── Cardápio por categoria ── */}
        <div className="space-y-10">
          {grupos.map((g) => (
            <section key={g.id} id={`cat-${g.id}`} className="scroll-mt-20">
              <SectionTitle className="mb-4 px-5 md:px-6 lg:px-8">{g.nome}</SectionTitle>
              <div className="flex flex-col gap-3 px-5 md:grid md:grid-cols-2 md:px-6 lg:grid-cols-3 lg:px-8">
                {g.produtos.map((p) => (
                  <CompactCard key={p.id} produto={p} onAdd={() => doAdd(p)} />
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* ── Os preferidos da casa ── */}
        {preferidos.length > 0 && (
          <div className="mt-12">
            <SectionTitle className="mb-4 px-5 md:px-6 lg:px-8">
              Os preferidos da casa
            </SectionTitle>
            <div className="flex flex-col gap-3 px-5 md:px-6 lg:px-8">
              {preferidos.map((p) => (
                <CompactCard key={p.id} produto={p} onAdd={() => doAdd(p)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section Title ──────────────────────────────────────────────────────────
function SectionTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={`font-serif text-[22px] font-semibold text-charcoal ${className}`}>
      {children}
    </h2>
  );
}

// ── Feature Card (mobile 220px horizontal scroll) ──────────────────────────
function FeatureCard({ produto: p, onAdd }: { produto: ProdutoItem; onAdd: () => void }) {
  return (
    <article
      className="shrink-0 overflow-hidden rounded-[20px] border border-charcoal/8 bg-white"
      style={{ width: 220 }}
    >
      {/* Foto 1:1 */}
      <div className="relative aspect-square w-full overflow-hidden bg-parchment">
        {p.imagem ? (
          <img src={p.imagem} alt={p.nome} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-serif text-3xl text-charcoal/20">
            {p.nome.charAt(0)}
          </div>
        )}
        {p.badge && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-terracotta px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            {p.badge}
          </span>
        )}
      </div>
      {/* Conteúdo */}
      <div className="p-3.5">
        <h3 className="font-serif text-[17px] font-semibold leading-snug text-charcoal">
          {p.nome}
        </h3>
        {(p.descricao || p.itens?.[0]) && (
          <p className="mt-1 line-clamp-1 text-[12px] text-charcoal/50">
            {p.descricao || p.itens.slice(0, 2).join(" · ")}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span className="font-serif text-[16px] font-bold tabular-nums text-charcoal">
            {formatBRL(p.preco)}
          </span>
          <button
            onClick={(e) => { e.preventDefault(); onAdd(); }}
            aria-label={`Adicionar ${p.nome}`}
            className="flex items-center justify-center rounded-full bg-charcoal text-white transition-all hover:bg-charcoal/85 active:scale-90"
            style={{ width: 32, height: 32 }}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

// ── Feature Card Desktop (grid) ────────────────────────────────────────────
function FeatureCardDesktop({ produto: p, onAdd }: { produto: ProdutoItem; onAdd: () => void }) {
  return (
    <article className="group overflow-hidden rounded-[20px] border border-charcoal/8 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft">
      <div className="relative aspect-square w-full overflow-hidden bg-parchment">
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
        {p.badge && (
          <span className="absolute left-3 top-3 rounded-full bg-terracotta px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            {p.badge}
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-serif text-[17px] font-semibold leading-snug text-charcoal">
          {p.nome}
        </h3>
        {(p.descricao || p.itens?.[0]) && (
          <p className="mt-1 line-clamp-1 text-[12px] text-charcoal/50">
            {p.descricao || p.itens.slice(0, 2).join(" · ")}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span className="font-serif text-[16px] font-bold tabular-nums text-charcoal">
            {formatBRL(p.preco)}
          </span>
          <button
            onClick={(e) => { e.preventDefault(); onAdd(); }}
            aria-label={`Adicionar ${p.nome}`}
            className="flex items-center justify-center rounded-full bg-charcoal text-white transition-all hover:bg-charcoal/85 active:scale-90"
            style={{ width: 32, height: 32 }}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

// ── Compact Card (horizontal, 92×92 foto) ─────────────────────────────────
function CompactCard({ produto: p, onAdd }: { produto: ProdutoItem; onAdd: () => void }) {
  return (
    <article className="flex gap-3.5 rounded-2xl border border-charcoal/8 bg-white p-3 transition-all duration-200 hover:shadow-soft">
      {/* Foto */}
      <div
        className="shrink-0 overflow-hidden rounded-[12px] bg-parchment"
        style={{ width: 92, height: 92 }}
      >
        {p.imagem ? (
          <img src={p.imagem} alt={p.nome} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-serif text-2xl text-charcoal/20">
            {p.nome.charAt(0)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="font-serif text-[16px] font-semibold leading-snug text-charcoal">
          {p.nome}
        </h3>
        {(p.descricao || p.itens?.[0]) && (
          <p className="mt-0.5 line-clamp-1 text-[12px] text-charcoal/50">
            {p.descricao || p.itens.slice(0, 2).join(" · ")}
          </p>
        )}
        {p.badge && (
          <div className="mt-1.5 flex gap-1.5">
            <span className="rounded-full bg-terracotta/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-terracotta">
              {p.badge}
            </span>
          </div>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-serif text-[15px] font-bold tabular-nums text-charcoal">
            {formatBRL(p.preco)}
          </span>
          <button
            onClick={(e) => { e.preventDefault(); onAdd(); }}
            aria-label={`Adicionar ${p.nome}`}
            className="flex items-center justify-center rounded-full bg-charcoal text-white transition-all hover:bg-charcoal/85 active:scale-90"
            style={{ width: 30, height: 30 }}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}
