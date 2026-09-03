import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAdmin } from "@/store/admin";
import { useCarrinho } from "@/store/carrinho";
import { formatBRL } from "@/store/pedido";
import { Plus, Minus, Star, ArrowRight, X, ZoomIn } from "lucide-react";
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

  const confirmarAdd = (
    p: ProdutoItem,
    tam?: { id: string; label: string; preco: number; imagem?: string },
  ) => {
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

  const abrirDetalhe = (p: ProdutoItem) => {
    setTamanhoId(undefined);
    setPicker(p);
  };

  if (search.trim()) {
    const q = search.toLowerCase();
    const results = ativos.filter(
      (p) => p.nome.toLowerCase().includes(q) || p.descricao?.toLowerCase().includes(q),
    );
    return (
      <div id="cardapio" className="py-6">
        <ProductDetail
          produto={picker}
          tamanhoId={tamanhoId}
          onTamanho={setTamanhoId}
          onClose={() => setPicker(null)}
          onAdd={(tam) => {
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
                  <CompactCard key={p.id} produto={p} onOpen={() => abrirDetalhe(p)} />
                ))}
              </div>
              {/* Desktop */}
              <div className="hidden md:block">
                <ProductGrid products={results} onOpen={abrirDetalhe} />
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
      <ProductDetail
        produto={picker}
        tamanhoId={tamanhoId}
        onTamanho={setTamanhoId}
        onClose={() => setPicker(null)}
        onAdd={(tam) => {
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
              <h2 className="font-serif text-[22px] font-semibold text-charcoal">
                Os preferidos da casa
              </h2>
            </div>

            {/* Mobile: compact list */}
            <div className="flex flex-col gap-3 px-5 md:hidden">
              {preferidos.slice(0, 3).map((p) => (
                <CompactCard key={p.id} produto={p} onOpen={() => abrirDetalhe(p)} />
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden px-6 md:block lg:px-8">
              <SectionTitleDesktop>Os preferidos da casa</SectionTitleDesktop>
              <ProductGrid products={preferidos} onOpen={abrirDetalhe} />
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
                  <CompactCard key={p.id} produto={p} onOpen={() => abrirDetalhe(p)} />
                ))}
              </div>

              {/* Desktop */}
              <div className="hidden px-6 md:block lg:px-8">
                <SectionTitleDesktop>{g.nome}</SectionTitleDesktop>
                <div className="grid grid-cols-2 gap-[18px] lg:grid-cols-3">
                  {g.produtos.map((p) => (
                    <CompactCardDesktop key={p.id} produto={p} onOpen={() => abrirDetalhe(p)} />
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

function ProductDetail({
  produto,
  tamanhoId,
  onTamanho,
  onClose,
  onAdd,
}: {
  produto: ProdutoItem | null;
  tamanhoId?: string;
  onTamanho: (id: string) => void;
  onClose: () => void;
  onAdd: (tam?: TamanhoOpcao) => void;
}) {
  const [zoom, setZoom] = useState(false);
  const zoomAberto = useRef(false);
  zoomAberto.current = zoom;

  useEffect(() => {
    setZoom(false);
  }, [produto?.id]);

  useEffect(() => {
    if (!produto) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (zoomAberto.current) return;
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [produto, onClose]);

  if (!produto || typeof document === "undefined") return null;

  const tamanhos = (produto.tamanhos ?? []).map(completarTamanhoBolo);
  const temTamanhos = tamanhos.length > 0;
  const tam = tamanhos.find((t) => t.id === tamanhoId);
  const imagem = tam?.imagem || produto.imagem;
  const itens = tam?.itens && tam.itens.length > 0 ? tam.itens : (produto.itens ?? []);
  const preco =
    tam?.preco ?? (temTamanhos ? Math.min(...tamanhos.map((t) => t.preco)) : produto.preco);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[200] flex items-end justify-center bg-charcoal/70 backdrop-blur-sm sm:items-center sm:p-4">
        <button type="button" className="absolute inset-0" aria-label="Fechar" onClick={onClose} />
        <div
          className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-linen shadow-elevated sm:max-w-3xl sm:flex-row sm:rounded-3xl"
          style={{ maxHeight: "min(92dvh, 760px)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="produto-detalhe-titulo"
        >
          <div className="relative h-52 w-full flex-none overflow-hidden bg-parchment sm:h-auto sm:min-h-[420px] sm:w-[44%]">
            <div className="absolute left-1/2 top-2.5 z-10 h-1.5 w-10 -translate-x-1/2 rounded-full bg-white/80 shadow-sm sm:hidden" />
            {imagem ? (
              <button
                type="button"
                onClick={() => setZoom(true)}
                className="group/img relative h-full w-full"
                aria-label="Ampliar imagem"
              >
                <img src={imagem} alt={produto.nome} className="h-full w-full object-cover" />
                <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-charcoal/70 px-2.5 py-1.5 text-[11px] font-medium text-white backdrop-blur-sm">
                  <ZoomIn className="h-3.5 w-3.5" />
                  Ampliar
                </span>
              </button>
            ) : (
              <div className="flex h-full w-full items-center justify-center font-serif text-6xl text-charcoal/20">
                {produto.nome.charAt(0)}
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-charcoal/60 text-white backdrop-blur-sm"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 sm:pb-5">
            {produto.badge ? (
              <span className="inline-block w-fit rounded-full bg-olive px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-white">
                {produto.badge}
              </span>
            ) : null}
            <h3
              id="produto-detalhe-titulo"
              className="mt-2 font-serif text-xl font-bold text-charcoal sm:text-2xl"
            >
              {produto.nome}
            </h3>
            <p className="mt-1 font-serif text-xl font-semibold text-terracotta sm:text-2xl">
              {temTamanhos && !tam ? `A partir de ${formatBRL(preco)}` : formatBRL(preco)}
            </p>

            {produto.descricao ? (
              <p className="mt-3 text-sm leading-relaxed text-ink/70">{produto.descricao}</p>
            ) : null}

            {temTamanhos ? (
              <div className="mt-4 space-y-2">
                <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-charcoal/60">
                  Escolha o tamanho
                </p>
                <div
                  className={`grid gap-2 ${tamanhos.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}
                >
                  {tamanhos.map((t) => {
                    const sel = tamanhoId === t.id;
                    const serve = t.serve?.replace(/^serve\s+/i, "");
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onTamanho(t.id)}
                        className={`flex min-h-[120px] flex-col items-center gap-1 rounded-2xl border-2 px-1.5 py-2.5 text-center ${
                          sel
                            ? "border-terracotta bg-terracotta/5 shadow-sm"
                            : "border-charcoal/15 bg-white"
                        }`}
                      >
                        <span
                          className={`font-serif text-xl font-bold ${sel ? "text-terracotta" : "text-charcoal"}`}
                        >
                          {t.label}
                        </span>
                        {t.peso ? (
                          <span className="text-[12px] font-semibold text-charcoal">{t.peso}</span>
                        ) : null}
                        {serve ? (
                          <span className="text-[11px] leading-snug text-charcoal/60">
                            Serve {serve}
                          </span>
                        ) : null}
                        {t.diametro ? (
                          <span className="text-[10px] text-charcoal/45">{t.diametro}</span>
                        ) : null}
                        <span
                          className={`mt-auto font-serif text-xs font-bold ${sel ? "text-terracotta" : "text-charcoal/70"}`}
                        >
                          {formatBRL(t.preco)}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {tam ? (
                  <p className="rounded-xl bg-white/70 px-3 py-2 text-center text-sm text-charcoal/70">
                    Tamanho {tam.label}: {resumoTamanho(tam)}
                    {tam.diametro ? ` · ${tam.diametro}` : ""}
                  </p>
                ) : (
                  <p className="text-center text-sm text-charcoal/50">
                    Toque em P, M ou G para ver peso e quantas pessoas serve.
                  </p>
                )}
              </div>
            ) : null}

            {itens.length > 0 ? (
              <ul className="mt-4 grid gap-x-3 gap-y-1.5 sm:grid-cols-2">
                {itens.map((i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 border-b border-charcoal/5 pb-1.5 text-sm text-ink"
                  >
                    <span className="mt-1.5 block h-1.5 w-1.5 flex-none rounded-full bg-terracotta" />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex-1" />

            <button
              type="button"
              disabled={temTamanhos && !tam}
              onClick={() => {
                if (temTamanhos && !tam) {
                  toast.error("Escolha um tamanho para continuar.");
                  return;
                }
                onAdd(tam);
              }}
              className="mt-5 w-full rounded-xl bg-charcoal py-3.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {temTamanhos && !tam
                ? "Selecione P, M ou G"
                : `Adicionar ${formatBRL(tam?.preco ?? produto.preco)}`}
            </button>
          </div>
        </div>
      </div>
      {zoom && imagem ? (
        <ImageLightbox src={imagem} alt={produto.nome} onClose={() => setZoom(false)} />
      ) : null}
    </>,
    document.body,
  );
}

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  const clampScale = (s: number) => Math.min(4, Math.max(1, s));

  const applyScale = (next: number) => {
    const s = clampScale(next);
    setScale(s);
    if (s <= 1) setOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[220] flex flex-col bg-charcoal/95">
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <p className="min-w-0 truncate font-serif text-sm">{alt}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => applyScale(scale - 0.5)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"
            aria-label="Diminuir zoom"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            onClick={() => applyScale(scale + 0.5)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"
            aria-label="Aumentar zoom"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"
            aria-label="Fechar zoom"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        className="relative min-h-0 flex-1 touch-none overflow-hidden"
        onWheel={(e) => {
          e.preventDefault();
          applyScale(scale + (e.deltaY < 0 ? 0.25 : -0.25));
        }}
        onDoubleClick={() => applyScale(scale > 1 ? 1 : 2.5)}
        onPointerDown={(e) => {
          if (e.pointerType === "touch") return;
          drag.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current || scale <= 1) return;
          setOffset({
            x: drag.current.ox + (e.clientX - drag.current.px),
            y: drag.current.oy + (e.clientY - drag.current.py),
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onTouchStart={(e) => {
          if (e.touches.length === 2) {
            pinch.current = {
              dist: Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY,
              ),
              scale,
            };
            drag.current = null;
            return;
          }
          if (e.touches.length === 1) {
            drag.current = {
              px: e.touches[0].clientX,
              py: e.touches[0].clientY,
              ox: offset.x,
              oy: offset.y,
            };
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2 && pinch.current) {
            e.preventDefault();
            const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY,
            );
            applyScale(pinch.current.scale * (dist / pinch.current.dist));
            return;
          }
          if (e.touches.length === 1 && drag.current && scale > 1) {
            e.preventDefault();
            setOffset({
              x: drag.current.ox + (e.touches[0].clientX - drag.current.px),
              y: drag.current.oy + (e.touches[0].clientY - drag.current.py),
            });
          }
        }}
        onTouchEnd={() => {
          pinch.current = null;
          drag.current = null;
        }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="h-full w-full select-none object-contain"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "center center",
            cursor: scale > 1 ? "grab" : "zoom-in",
          }}
        />
      </div>
      <p className="px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-center text-[11px] text-white/55">
        Role o mouse ou use +/− para zoom · arraste para mover · toque duas vezes para ampliar
      </p>
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
  onOpen,
}: {
  products: ProdutoItem[];
  onOpen: (p: ProdutoItem) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-[18px] md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCardDesktop key={p.id} produto={p} onOpen={() => onOpen(p)} />
      ))}
    </div>
  );
}

// ── Desktop Product Card (4:3 image) ──────────────────────────────────────
function ProductCardDesktop({ produto: p, onOpen }: { produto: ProdutoItem; onOpen: () => void }) {
  const comTamanhos = (p.tamanhos?.length ?? 0) > 0;
  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Ver ${p.nome}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-[18px] border border-charcoal/8 bg-white transition-all duration-200 hover:-translate-y-[3px] hover:border-charcoal/16"
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
        <h3
          className="font-serif font-bold leading-snug text-charcoal"
          style={{ fontSize: 17, marginBottom: 3 }}
        >
          {p.nome}
        </h3>
        {(p.descricao || p.itens?.[0]) && (
          <p
            className="line-clamp-1 text-charcoal/50"
            style={{ fontSize: 12.5, marginBottom: 10, minHeight: 18 }}
          >
            {p.descricao || p.itens.slice(0, 2).join(" · ")}
          </p>
        )}
        <div className="flex-1" />
        {comTamanhos ? (
          <div className="flex items-center justify-between">
            <div>
              <p
                className="font-serif font-bold tabular-nums text-charcoal"
                style={{ fontSize: 15 }}
              >
                {precoLabel(p)}
              </p>
              <p className="mt-0.5 text-[11px] text-charcoal/50">P, M e G · peso e porções</p>
            </div>
            <span
              className="flex items-center justify-center rounded-full bg-charcoal text-white transition-all group-hover:bg-charcoal/85"
              style={{ width: 36, height: 36 }}
              aria-hidden
            >
              <Plus className="h-4 w-4" />
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <div
                className="font-serif font-bold tabular-nums text-charcoal"
                style={{ fontSize: 17 }}
              >
                {precoLabel(p)}
              </div>
              <div className="mt-0.5 flex items-center gap-1">
                <Star className="h-[11px] w-[11px] fill-terracotta text-terracotta" />
                <span className="text-charcoal/50" style={{ fontSize: 11 }}>
                  5.0
                </span>
              </div>
            </div>
            <span
              className="flex items-center justify-center rounded-full bg-charcoal text-white transition-all group-hover:bg-charcoal/85"
              style={{ width: 36, height: 36 }}
              aria-hidden
            >
              <Plus className="h-4 w-4" />
            </span>
          </div>
        )}
      </div>
    </article>
  );
}

// ── Compact Card (mobile + desktop category list) ─────────────────────────
function CompactCard({ produto: p, onOpen }: { produto: ProdutoItem; onOpen: () => void }) {
  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Ver ${p.nome}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="flex cursor-pointer gap-3.5 rounded-2xl border border-charcoal/8 bg-white p-3 transition-all duration-200 hover:shadow-soft"
    >
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
        <h3 className="font-serif text-[16px] font-bold leading-snug text-charcoal">{p.nome}</h3>
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
          <span
            className="flex items-center justify-center rounded-full bg-charcoal text-white"
            style={{ width: 30, height: 30 }}
            aria-hidden
          >
            <Plus className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </article>
  );
}

// ── Desktop Compact Card (category sections) ──────────────────────────────
function CompactCardDesktop({ produto: p, onOpen }: { produto: ProdutoItem; onOpen: () => void }) {
  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Ver ${p.nome}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="flex cursor-pointer gap-4 rounded-2xl border border-charcoal/8 bg-white p-3.5 transition-all duration-200 hover:shadow-soft"
    >
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
          <span
            className="font-serif font-bold tabular-nums text-charcoal"
            style={{ fontSize: 15 }}
          >
            {precoLabel(p)}
          </span>
          <span
            className="flex items-center justify-center rounded-full bg-charcoal text-white"
            style={{ width: 32, height: 32 }}
            aria-hidden
          >
            <Plus className="h-[15px] w-[15px]" />
          </span>
        </div>
      </div>
    </article>
  );
}
