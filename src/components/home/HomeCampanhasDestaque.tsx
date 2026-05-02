import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAdmin } from "@/store/admin";
import { ArrowRight } from "lucide-react";

type Tone = "navy" | "gold" | "cream";
const TONE_CYCLE: Tone[] = ["navy", "gold", "cream"];

const TONES: Record<Tone, { bg: string; fg: string; fgMuted: string; accent: string }> = {
  navy:  { bg: "bg-charcoal",   fg: "text-white",    fgMuted: "text-white/70",    accent: "text-terracotta" },
  gold:  { bg: "bg-terracotta", fg: "text-charcoal", fgMuted: "text-charcoal/70", accent: "text-charcoal" },
  cream: { bg: "bg-parchment",  fg: "text-charcoal", fgMuted: "text-charcoal/60", accent: "text-terracotta" },
};

export function HomeCampanhasDestaque() {
  const campanhas = useAdmin((s) => s.campanhas);
  const destaques = useAdmin((s) => s.home.campanhasDestaque);
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const lista = useMemo(() => {
    return campanhas
      .filter((c) => c.status === "ativa" && destaques[c.id]?.ativo)
      .map((c) => ({ ...c, ordem: destaques[c.id]?.ordem ?? 0 }))
      .sort((a, b) => a.ordem - b.ordem);
  }, [campanhas, destaques]);

  if (lista.length === 0) return null;

  return (
    <section className="pb-2 pt-6">
      <div
        ref={scrollRef}
        className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1.5"
        style={{ padding: "0 20px 6px" }}
        onScroll={(e) => {
          const el = e.currentTarget;
          const cardWidth = 296 + 12; // width + gap
          const idx = Math.round(el.scrollLeft / cardWidth);
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
              {/* Text content */}
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
                  Ver coleção <ArrowRight className="h-3 w-3" />
                </div>
              </div>

              {/* Right image */}
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

      {/* Dot indicators */}
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
    </section>
  );
}
