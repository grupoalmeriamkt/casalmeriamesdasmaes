import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAdmin } from "@/store/admin";
import { useCarrinho } from "@/store/carrinho";
import { formatBRL } from "@/store/pedido";
import { Plus, Star, ArrowRight, X } from "lucide-react";
import { toast } from "sonner";
import { completarTamanhoBolo, resumoTamanho, type TamanhoComResumo } from "@/lib/tamanhoBolo";
import { aplicarCestasCafePorTamanho, ehCestaCafeAgrupada } from "@/lib/cestasCafe";
import { aplicarNomeCategoriaBolos } from "@/lib/tamanhoBolo";

type TamanhoOpcao = TamanhoComResumo;

type ProdutoItem = {
  id: string;
  nome: string;
  badge: string;
  preco: number;
  descricao: string;
  itens: string[];
  imagem: string;
  tamanhos?: TamanhoOpcao[];
};

type Props = { search?: string };

function precoLabel(p: ProdutoItem) {
  if (p.tamanhos && p.tamanhos.length > 0) {
    const min = Math.min(...p.tamanhos.map((t) => t.preco));
    return `A partir de ${formatBRL(min)}`;
  }
  return formatBRL(p.preco);
}

export function HomeProdutosPorCategoria({ search = "" }: Props) {
  const categorias = useAdmin((s) => s.categorias);
  const cestas = useAdmin((s) => s.cestas);
  const add = useCarrinho((s) => s.add);
  const [picker, setPicker] = useState<ProdutoItem | null>(null);
  const [tamanhoId, setTamanhoId] = useState<string | undefined>();

  const { ativos, grupos, preferidos } = useMemo(() => {
    const { cestas: expandida, categorias: catsCafe } = aplicarCestasCafePorTamanho(
      cestas,
      [],
      categorias,
    );
    const { categorias: catsOut } = aplicarNomeCategoriaBolos(catsCafe);
    const ativos = expandida.filter(
      (c) => c.ativo !== false && c.arquivado !== true && !ehCestaCafeAgrupada(c),
    );
    const cats = [...catsOut].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    const out: { id: string; nome: string; produtos: typeof ativos }[] = [];
    for (const cat of cats) {
      const lista = ativos.filter((p) => p.categoriaId === cat.id);
      if (lista.length) out.push({ id: cat.id, nome: cat.nome, produtos: lista });
    }
    const semCat = ativos.filter(
      (p) => !p.categoriaId || !cats.find((c) => c.id === p.categoriaId),
    );
    if (semCat.length) out.push({ id: "outros", nome: "Outros", produtos: semCat });

    const preferidos = ativos.slice(0, 8);

    return { ativos, grupos: out, preferidos };
  }, [categorias, cestas]);

  const confirmarAdd = (p: ProdutoItem, tam?: { id: string; label: string; preco: number; imagem?: string }) => {
    const nome = tam ? `${p.nome} · Tam. ${tam.label}` : p.nome;
    add({
      produtoId: p.id,
      nome,
      preco: tam?.preco ?? p.preco,
      imagem: tam?.imagem || p.imagem,
      ...(tam ? { tamanho: tam.label } : {}),
    });
    toast.success(`${nome} adicionado`);
  };

  const doAdd = (p: ProdutoItem) => {
    if (p.tamanhos && p.tamanhos.length > 0) {
      setTamanhoId(undefined);
      setPicker(p);
      return;
    }
    confirmarAdd(p);
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
        <SizePicker
          produto={picker}
          tamanhoId={tamanhoId}
          onTamanho={setTamanhoId}
          onClose={() => setPicker(null)}
          onConfirm={(tam) => {
            if (picker) confirmarAdd(picker, tam);
            setPicker(null);
          }}
        />
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
                  <CompactCard
                    key={p.id}
                    produto={p}
                    onAdd={() => doAdd(p)}
                    onAddSize={(tam) => {
                      setTamanhoId(tam.id);
                      setPicker(p);
                    }}
                  />
                ))}
              </div>
              {/* Desktop */}
              <div className="hidden md:block">
                <ProductGrid
                  products={results}
                  onAdd={doAdd}
                  onAddSize={(p, tam) => {
                    setTamanhoId(tam.id);
                    setPicker(p);
                  }}
                />
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
      <SizePicker
        produto={picker}
        tamanhoId={tamanhoId}
        onTamanho={setTamanhoId}
        onClose={() => setPicker(null)}
        onConfirm={(tam) => {
          if (picker) confirmarAdd(picker, tam);
          setPicker(null);
        }}
      />
      <div className="mx-auto max-w-6xl">

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
                <CompactCard
                  key={p.id}
                  produto={p}
                  onAdd={() => doAdd(p)}
                  onAddSize={(tam) => {
                    setTamanhoId(tam.id);
                    setPicker(p);
                  }}
                />
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden px-6 md:block lg:px-8">
              <SectionTitleDesktop>Os preferidos da casa</SectionTitleDesktop>
              <ProductGrid
                products={preferidos}
                onAdd={doAdd}
                onAddSize={(p, tam) => {
                  setTamanhoId(tam.id);
                  setPicker(p);
                }}
              />
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
                  <CompactCard
                    key={p.id}
                    produto={p}
                    onAdd={() => doAdd(p)}
                    onAddSize={(tam) => {
                      setTamanhoId(tam.id);
                      setPicker(p);
                    }}
                  />
                ))}
              </div>

              {/* Desktop */}
              <div className="hidden px-6 md:block lg:px-8">
                <SectionTitleDesktop>{g.nome}</SectionTitleDesktop>
                <div className="grid grid-cols-2 gap-[18px] lg:grid-cols-3">
                  {g.produtos.map((p) => (
                    <CompactCardDesktop
                      key={p.id}
                      produto={p}
                      onAdd={() => doAdd(p)}
                      onAddSize={(tam) => {
                        setTamanhoId(tam.id);
                        setPicker(p);
                      }}
                    />
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

function SizePicker({
  produto,
  tamanhoId,
  onTamanho,
  onClose,
  onConfirm,
}: {
  produto: ProdutoItem | null;
  tamanhoId?: string;
  onTamanho: (id: string) => void;
  onClose: () => void;
  onConfirm: (tam: TamanhoOpcao) => void;
}) {
  if (!produto?.tamanhos?.length || typeof document === "undefined") return null;
  const tamanhos = produto.tamanhos.map(completarTamanhoBolo);
  const tam = tamanhos.find((t) => t.id === tamanhoId);
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-charcoal/50 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="Fechar" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-elevated sm:rounded-3xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-charcoal/45">
              Escolha o tamanho
            </p>
            <h3 className="mt-1 font-serif text-xl font-bold text-charcoal">{produto.nome}</h3>
            {produto.descricao ? (
              <p className="mt-1 text-sm leading-relaxed text-charcoal/60">{produto.descricao}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-charcoal/6 text-charcoal"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {tamanhos.map((t) => {
            const sel = tamanhoId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTamanho(t.id)}
                className={`flex min-h-[132px] flex-col items-center gap-1 rounded-2xl border-2 px-2 py-3 text-center ${
                  sel ? "border-terracotta bg-terracotta/5" : "border-charcoal/12 bg-white"
                }`}
              >
                <span className={`font-serif text-2xl font-bold ${sel ? "text-terracotta" : "text-charcoal"}`}>
                  {t.label}
                </span>
                {t.peso ? (
                  <span className="text-[12px] font-semibold text-charcoal">{t.peso}</span>
                ) : null}
                {t.serve ? (
                  <span className="text-[11px] leading-snug text-charcoal/60">Serve {t.serve.replace(/^serve\s+/i, "")}</span>
                ) : null}
                {t.diametro ? (
                  <span className="text-[10px] text-charcoal/45">{t.diametro}</span>
                ) : null}
                <span className={`mt-auto font-serif text-sm font-bold ${sel ? "text-terracotta" : "text-charcoal/80"}`}>
                  {formatBRL(t.preco)}
                </span>
              </button>
            );
          })}
        </div>
        {tam ? (
          <p className="mt-3 rounded-xl bg-linen px-3 py-2 text-center text-sm text-charcoal/70">
            Tamanho {tam.label}: {resumoTamanho(tam)}
            {tam.diametro ? ` · ${tam.diametro}` : ""}
          </p>
        ) : (
          <p className="mt-3 text-center text-sm text-charcoal/50">
            Toque em P, M ou G para ver peso e quantas pessoas serve.
          </p>
        )}
        <button
          type="button"
          disabled={!tam}
          onClick={() => tam && onConfirm(tam)}
          className="mt-4 w-full rounded-xl bg-charcoal py-3.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {tam ? `Adicionar ${formatBRL(tam.preco)}` : "Selecione P, M ou G"}
        </button>
      </div>
    </div>,
    document.body,
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
  onAddSize,
}: {
  products: ProdutoItem[];
  onAdd: (p: ProdutoItem) => void;
  onAddSize?: (p: ProdutoItem, tam: TamanhoOpcao) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-[18px] md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCardDesktop
          key={p.id}
          produto={p}
          onAdd={() => onAdd(p)}
          onAddSize={onAddSize ? (tam) => onAddSize(p, tam) : undefined}
        />
      ))}
    </div>
  );
}

// ── Desktop Product Card (4:3 image) ──────────────────────────────────────
function ProductCardDesktop({
  produto: p,
  onAdd,
  onAddSize,
}: {
  produto: ProdutoItem;
  onAdd: () => void;
  onAddSize?: (tam: TamanhoOpcao) => void;
}) {
  const tamanhos = p.tamanhos ?? [];
  const comTamanhos = tamanhos.length > 0 && !!onAddSize;
  return (
    <article
      className="group flex flex-col overflow-hidden rounded-[18px] border border-charcoal/8 bg-white transition-all duration-200 hover:-translate-y-[3px] hover:border-charcoal/16"
      style={{ padding: 0 }}
    >
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

      <div className="flex flex-1 flex-col" style={{ padding: "16px 18px 18px" }}>
        <h3 className="font-serif font-bold leading-snug text-charcoal" style={{ fontSize: 17, marginBottom: 3 }}>
          {p.nome}
        </h3>
        {(p.descricao || p.itens?.[0]) && (
          <p className="line-clamp-1 text-charcoal/50" style={{ fontSize: 12.5, marginBottom: 10, minHeight: 18 }}>
            {p.descricao || p.itens.slice(0, 2).join(" · ")}
          </p>
        )}
        <div className="flex-1" />
        {comTamanhos && onAddSize ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-serif font-bold tabular-nums text-charcoal" style={{ fontSize: 15 }}>
                {precoLabel(p)}
              </p>
              <p className="mt-0.5 text-[11px] text-charcoal/50">P, M e G · peso e porções</p>
            </div>
            <button
              onClick={(e) => { e.preventDefault(); onAdd(); }}
              aria-label={`Escolher tamanho de ${p.nome}`}
              className="flex items-center justify-center rounded-full bg-charcoal text-white transition-all hover:bg-charcoal/85 active:scale-90"
              style={{ width: 36, height: 36 }}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <div className="font-serif font-bold tabular-nums text-charcoal" style={{ fontSize: 17 }}>
                {precoLabel(p)}
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
        )}
      </div>
    </article>
  );
}

// ── Compact Card (mobile + desktop category list) ─────────────────────────
function CompactCard({
  produto: p,
  onAdd,
}: {
  produto: ProdutoItem;
  onAdd: () => void;
  onAddSize?: (tam: TamanhoOpcao) => void;
}) {
  const comTamanhos = (p.tamanhos?.length ?? 0) > 0;
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
        <h3 className="font-serif text-[16px] font-bold leading-snug text-charcoal">
          {p.nome}
        </h3>
        {(p.descricao || p.itens?.[0]) && (
          <p className="mt-0.5 line-clamp-2 text-[12px] text-charcoal/50">
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
            {precoLabel(p)}
          </span>
          <button
            onClick={(e) => { e.preventDefault(); onAdd(); }}
            aria-label={comTamanhos ? `Escolher tamanho de ${p.nome}` : `Adicionar ${p.nome}`}
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
function CompactCardDesktop({
  produto: p,
  onAdd,
}: {
  produto: ProdutoItem;
  onAdd: () => void;
  onAddSize?: (tam: TamanhoOpcao) => void;
}) {
  const comTamanhos = (p.tamanhos?.length ?? 0) > 0;
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
        <h3 className="font-serif font-bold leading-snug text-charcoal" style={{ fontSize: 16 }}>
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
            {precoLabel(p)}
          </span>
          <button
            onClick={(e) => { e.preventDefault(); onAdd(); }}
            aria-label={comTamanhos ? `Escolher tamanho de ${p.nome}` : `Adicionar ${p.nome}`}
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
