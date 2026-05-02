import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAdmin, type Campanha } from "@/store/admin";
import { ArrowRight } from "lucide-react";

type Tone = "navy" | "gold" | "cream";
const TONE_CYCLE: Tone[] = ["navy", "gold", "cream"];

type ToneStyle = {
  bg: string;
  fg: string;
  fgMuted: string;
  accent: string;
  photoBg: string;
};

const TONES: Record<Tone, ToneStyle> = {
  navy:  { bg: "bg-charcoal",   fg: "text-white",    fgMuted: "text-white/70",    accent: "text-terracotta", photoBg: "bg-charcoal/60" },
  gold:  { bg: "bg-terracotta", fg: "text-charcoal", fgMuted: "text-charcoal/70", accent: "text-charcoal",   photoBg: "bg-terracotta/60" },
  cream: { bg: "bg-parchment",  fg: "text-charcoal", fgMuted: "text-charcoal/60", accent: "text-terracotta", photoBg: "bg-parchment/60" },
};

export function HomeCampanhasDestaque() {
  const campanhas = useAdmin((s) => s.campanhas);
  const destaques = useAdmin((s) => s.home.campanhasDestaque);
  const [activeIdx, setActiveIdx] = useState(0);

  const lista = useMemo((): (Campanha & { ordem: number })[] => {
    return campanhas
      .filter((c) => c.status === "ativa" && destaques[c.id]?.ativo)
      .map((c) => ({ ...c, ordem: destaques[c.id]?.ordem ?? 0 }))
      .sort((a, b) => a.ordem - b.ordem);
  }, [campanhas, destaques]);

  if (lista.length === 0) return null;

  return (
    <section className="pb-2 pt-6 md:pb-12 md:pt-0">
      {/* ── Mobile: horizontal scroll com snap ── */}
      <div className="md:hidden">
        <div
          className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1.5"
          style={{ padding: "0 20px 6px" }}
          onScroll={(e) => {
            const el = e.currentTarget;
            const idx = Math.round(el.scrollLeft / (296 + 12));
            setActiveIdx(Math.min(idx, lista.length - 1));
          }}
        >
          {lista.map((c, i) => {
            const toneKey: Tone = c.tone ?? TONE_CYCLE[i % TONE_CYCLE.length];
            const tone = TONES[toneKey];
            return (
              <Link
                key={c.id}
                to="/$slug"
                params={{ slug: c.slug }}
                className={`relative shrink-0 snap-start overflow-hidden rounded-[22px] ${tone.bg} flex`}
                style={{ width: 296, height: 176 }}
              >
                <div className="relative z-10 flex flex-1 flex-col p-5">
                  <p className={`mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70 ${tone.fg}`}>
                    {c.textos?.eyebrow || "Campanha"}
                  </p>
                  <h3
                    className={`font-serif text-[22px] font-semibold leading-[1.1] ${tone.fg}`}
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {c.textos?.titulo || c.nome}
                  </h3>
                  {c.textos?.subtitulo && (
                    <p className={`mt-1.5 line-clamp-2 text-[12px] leading-[1.4] opacity-[0.78] ${tone.fg}`}>
                      {c.textos.subtitulo}
                    </p>
                  )}
                  <div className="flex-1" />
                  <div className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${tone.accent}`}>
                    {c.textos?.titulo ? "Ver coleção" : "Ver coleção"} <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
                {c.imagemDestaque && (
                  <div className="relative w-[110px] shrink-0">
                    <img
                      src={c.imagemDestaque}
                      alt={c.nome}
                      className="absolute inset-0 h-full w-full object-cover opacity-25"
                    />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
        {lista.length > 1 && (
          <div className="mt-3 flex justify-center gap-1.5">
            {lista.map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full bg-charcoal transition-all duration-200"
                style={{ width: i === activeIdx ? 18 : 6, opacity: i === activeIdx ? 1 : 0.2 }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Desktop: grid 3 colunas, cards com imagem no TOPO ── */}
      <div className="mx-auto hidden max-w-6xl px-6 md:block lg:px-8">
        <div className="mb-[22px] flex items-baseline justify-between">
          <h2
            className="font-serif font-semibold text-charcoal"
            style={{ fontSize: 30, letterSpacing: "-0.01em" }}
          >
            Campanhas
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {lista.map((c, i) => {
            const toneKey: Tone = c.tone ?? TONE_CYCLE[i % TONE_CYCLE.length];
            const tone = TONES[toneKey];
            return (
              <Link
                key={c.id}
                to="/$slug"
                params={{ slug: c.slug }}
                className={`group flex h-[320px] flex-col overflow-hidden rounded-[22px] ${tone.bg} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevated`}
              >
                {/* Imagem no topo */}
                <div className="relative h-[160px] shrink-0 overflow-hidden">
                  {c.imagemDestaque ? (
                    <img
                      src={c.imagemDestaque}
                      alt={c.nome}
                      className="h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className={`h-full w-full ${tone.photoBg}`} />
                  )}
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col p-[22px_22px_20px]" style={{ padding: "20px 22px" }}>
                  <p className={`mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] opacity-70 ${tone.fg}`}>
                    {c.textos?.eyebrow || "Campanha"}
                  </p>
                  <h3
                    className={`font-serif font-semibold leading-[1.1] ${tone.fg}`}
                    style={{ fontSize: 22, letterSpacing: "-0.01em", marginBottom: 6 }}
                  >
                    {c.textos?.titulo || c.nome}
                  </h3>
                  {c.textos?.subtitulo && (
                    <p className={`line-clamp-2 text-[13px] leading-[1.4] opacity-[0.78] ${tone.fg}`}>
                      {c.textos.subtitulo}
                    </p>
                  )}
                  <div className="flex-1" />
                  <div className="mt-3 flex items-center justify-between">
                    <span />
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${tone.accent}`}>
                      Ver coleção <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
