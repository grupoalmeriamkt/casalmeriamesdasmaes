import { useMemo } from "react";
import { useAdmin } from "@/store/admin";
import { useCarrinho } from "@/store/carrinho";
import { formatBRL } from "@/store/pedido";
import { Plus, Star, ArrowRight } from "lucide-react";
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

    const emDestaque = ativos.slice(0, 4);
    const preferidos = ativos.slice(0, 8);

    return { ativos, grupos: out, emDestaque, preferidos };
  }, [categorias, cestas]);

  const doAdd = (p: ProdutoItem) => {
    add({ produtoId: p.id, nome: p.nome, preco: p.preco, imagem: p.imagem });
    toast.success(`${p.nome} adicionado`);
  };

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
          <h2
            className="mb-[22px] font-serif font-semibold text-charcoal"
            style={{ fontSize: 30, letterSpacing: "-0.01em" }}
          >
            {results.length} resultado{results.length !== 1 ? "s" : ""} para &ldquo;{search}&rdquo;
          </h2>
          {results.length === 0 ? (
            <p className="py-16 text-center text-sm text-charcoal/40">
              Nada encontrado para &ldquo;{search}&rdquo;
            </p>
          ) : (
            <>
              {/* Mobile */}
              <div className="flex flex-col gap-3 md:hidden">
                {results.map((p) => (
                  <CompactCard key={p.id} produto={p} onAdd={() => doAdd(p)} />
                ))}
              </div>
              {/* Desktop */}
              <div className="hidden md:block">
                <ProductGrid products={results} onAdd={doAdd} />
              </div>
            </>
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
        <div className="mb-10 md:mb-12">
          {/* Mobile title */}
          <div className="mb-4 flex items-baseline justify-between px-5 md:hidden">
            <h2 className="font-serif text-[22px] font-semibold text-charcoal">Em destaque</h2>
          </div>

          {/* Mobile: horizontal scroll */}
          <div
            className="scrollbar-hide overflow-x-auto pb-1.5 md:hidden"
            style={{ padding: "0 20px 6px" }}
          >
            <div className="flex gap-3.5">
              {emDestaque.map((p) => (
                <FeatureCardMobile key={p.id} produto={p} onAdd={() => doAdd(p)} />
              ))}
            </div>
          </div>

          {/* Desktop */}
          <div className="hidden px-6 md:block lg:px-8">
            <SectionTitleDesktop action="Ver todos" href="#cardapio">Em destaque</SectionTitleDesktop>
            <ProductGrid products={emDestaque} onAdd={doAdd} />
          </div>
        </div>

        {/* ── Os preferidos da casa ── */}
        {preferidos.length > 0 && (
          <div className="mb-10 md:mb-12">
            {/* Mobile title */}
            <div className="mb-4 flex items-baseline px-5 md:hidden">
              <h2 className="font-serif text-[22px] font-semibold text-charcoal">Os preferidos da casa</h2>
            </div>

            {/* Mobile: compact list */}
            <div className="flex flex-col gap-3 px-5 md:hidden">
              {preferidos.slice(0, 3).map((p) => (
                <CompactCard key={p.id} produto={p} onAdd={() => doAdd(p)} />
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden px-6 md:block lg:px-8">
              <SectionTitleDesktop>Os preferidos da casa</SectionTitleDesktop>
              <ProductGrid products={preferidos} onAdd={doAdd} />
            </div>
          </div>
        )}

        {/* ── Cardápio por categoria ── */}
        <div className="space-y-10">
          {grupos.map((g) => (
            <section key={g.id} id={`cat-${g.id}`} className="scroll-mt-20">
              {/* Mobile title */}
              <div className="mb-4 px-5 md:hidden">
                <h2 className="font-serif text-[22px] font-semibold text-charcoal">{g.nome}</h2>
              </div>

              {/* Mobile: compact list */}
              <div className="flex flex-col gap-3 px-5 md:hidden">
                {g.produtos.map((p) => (
                  <CompactCard key={p.id} produto={p} onAdd={() => doAdd(p)} />
                ))}
              </div>

              {/* Desktop */}
              <div className="hidden px-6 md:block lg:px-8">
                <SectionTitleDesktop>{g.nome}</SectionTitleDesktop>
                <div className="grid grid-cols-2 gap-[18px] lg:grid-cols-3">
                  {g.produtos.map((p) => (
                    <CompactCardDesktop key={p.id} produto={p} onAdd={() => doAdd(p)} />
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Desktop Section Title ──────────────────────────────────────────────────
function SectionTitleDesktop({
  children,
  action,
  href,
}: {
  children: React.ReactNode;
  action?: string;
  href?: string;
}) {
  return (
    <div className="mb-[22px] flex items-baseline justify-between">
      <h2
        className="font-serif font-semibold text-charcoal"
        style={{ fontSize: 30, letterSpacing: "-0.01em" }}
      >
        {children}
      </h2>
      {action && href && (
        <a
          href={href}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-terracotta hover:text-terracotta/80"
        >
          {action} <ArrowRight className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

// ── Desktop Product Grid (4-col, aspect 4:3) ──────────────────────────────
function ProductGrid({
  products,
  onAdd,
}: {
  products: ProdutoItem[];
  onAdd: (p: ProdutoItem) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-[18px] md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCardDesktop key={p.id} produto={p} onAdd={() => onAdd(p)} />
      ))}
    </div>
  );
}

// ── Desktop Product Card (4:3 image) ──────────────────────────────────────
function ProductCardDesktop({ produto: p, onAdd }: { produto: ProdutoItem; onAdd: () => void }) {
  return (
    <article
      className="group flex flex-col overflow-hidden rounded-[18px] border border-charcoal/8 bg-white transition-all duration-200 hover:-translate-y-[3px] hover:border-charcoal/16"
      style={{ padding: 0 }}
    >
      {/* 4:3 image */}
      <div className="relative overflow-hidden bg-parchment" style={{ aspectRatio: "4/3" }}>
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
          <span
            className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white"
            style={{ background: "#C9963E" }}
          >
            {p.badge}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col" style={{ padding: "16px 18px 18px" }}>
        <h3 className="font-serif font-semibold leading-snug text-charcoal" style={{ fontSize: 17, marginBottom: 3 }}>
          {p.nome}
        </h3>
        {(p.descricao || p.itens?.[0]) && (
          <p className="line-clamp-1 text-charcoal/50" style={{ fontSize: 12.5, marginBottom: 10, minHeight: 18 }}>
            {p.descricao || p.itens.slice(0, 2).join(" · ")}
          </p>
        )}
        <div className="flex-1" />
        <div className="flex items-center justify-between">
          <div>
            <div className="font-serif font-bold tabular-nums text-charcoal" style={{ fontSize: 17 }}>
              {formatBRL(p.preco)}
            </div>
            <div className="mt-0.5 flex items-center gap-1">
              <Star className="h-[11px] w-[11px] fill-terracotta text-terracotta" />
              <span className="text-charcoal/50" style={{ fontSize: 11 }}>5.0</span>
            </div>
          </div>
          <button
            onClick={(e) => { e.preventDefault(); onAdd(); }}
            aria-label={`Adicionar ${p.nome}`}
            className="flex items-center justify-center rounded-full bg-charcoal text-white transition-all hover:bg-charcoal/85 active:scale-90"
            style={{ width: 36, height: 36 }}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

// ── Mobile Feature Card (220px horizontal scroll) ─────────────────────────
function FeatureCardMobile({ produto: p, onAdd }: { produto: ProdutoItem; onAdd: () => void }) {
  return (
    <article
      className="shrink-0 overflow-hidden rounded-[20px] border border-charcoal/8 bg-white"
      style={{ width: 220 }}
    >
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

// ── Compact Card (mobile + desktop category list) ─────────────────────────
function CompactCard({ produto: p, onAdd }: { produto: ProdutoItem; onAdd: () => void }) {
  return (
    <article className="flex gap-3.5 rounded-2xl border border-charcoal/8 bg-white p-3 transition-all duration-200 hover:shadow-soft">
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

// ── Desktop Compact Card (category sections) ──────────────────────────────
function CompactCardDesktop({ produto: p, onAdd }: { produto: ProdutoItem; onAdd: () => void }) {
  return (
    <article className="flex gap-4 rounded-2xl border border-charcoal/8 bg-white p-3.5 transition-all duration-200 hover:shadow-soft">
      <div
        className="shrink-0 overflow-hidden rounded-[14px] bg-parchment"
        style={{ width: 100, height: 100 }}
      >
        {p.imagem ? (
          <img src={p.imagem} alt={p.nome} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-serif text-2xl text-charcoal/20">
            {p.nome.charAt(0)}
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="font-serif font-semibold leading-snug text-charcoal" style={{ fontSize: 16 }}>
          {p.nome}
        </h3>
        {(p.descricao || p.itens?.[0]) && (
          <p className="mt-0.5 line-clamp-2 text-charcoal/50" style={{ fontSize: 12.5 }}>
            {p.descricao || p.itens.slice(0, 2).join(" · ")}
          </p>
        )}
        {p.badge && (
          <div className="mt-1.5">
            <span className="rounded-full bg-terracotta/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-terracotta">
              {p.badge}
            </span>
          </div>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-serif font-bold tabular-nums text-charcoal" style={{ fontSize: 15 }}>
            {formatBRL(p.preco)}
          </span>
          <button
            onClick={(e) => { e.preventDefault(); onAdd(); }}
            aria-label={`Adicionar ${p.nome}`}
            className="flex items-center justify-center rounded-full bg-charcoal text-white transition-all hover:bg-charcoal/85 active:scale-90"
            style={{ width: 32, height: 32 }}
          >
            <Plus className="h-[15px] w-[15px]" />
          </button>
        </div>
      </div>
    </article>
  );
}
