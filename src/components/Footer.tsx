import { Logo } from "./Logo";
import { Instagram } from "lucide-react";
import { useAdmin } from "@/store/admin";

export function Footer() {
  const tagline = useAdmin((s) => s.textos.taglineFooter);
  const insta = useAdmin((s) => s.integracoes.instagramUrl);
  const wa = useAdmin((s) => s.integracoes.whatsappUrl);

  return (
    <footer className="bg-linen text-charcoal">
      <div className="container mx-auto px-6 md:px-10">
        <div className="divider-warm" />

        <div className="grid gap-12 py-20 md:grid-cols-12 md:gap-10">
          <div className="md:col-span-5">
            <Logo />
            <p className="mt-6 max-w-sm font-serif text-lg italic leading-relaxed text-ink">
              {tagline || "Receber como em casa — uma manhã, uma mesa, um afeto."}
            </p>
          </div>

          <div className="md:col-span-3">
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.28em] text-terracotta">
              Visite-nos
            </p>
            <ul className="mt-5 space-y-2 font-serif text-base text-charcoal">
              <li>104 Sul · Brasília</li>
              <li>Noroeste · Brasília</li>
            </ul>
            <p className="mt-4 text-sm italic text-ink/70">Ter — Dom · 07h às 19h</p>
          </div>

          <div className="md:col-span-4">
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.28em] text-terracotta">
              Acompanhe
            </p>
            <div className="mt-5 flex items-center gap-4">
              <a
                href={insta}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram @casa_almeria"
                className="inline-flex items-center gap-3 text-charcoal transition-colors hover:text-terracotta"
              >
                <Instagram className="h-4 w-4" />
                <span className="font-serif italic">@casa_almeria</span>
              </a>
            </div>
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-3 text-sm text-charcoal transition-colors hover:text-terracotta"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.594 5.319l-.999 3.648 3.894-1.020z" />
              </svg>
              <span className="font-serif italic">Fale conosco no WhatsApp</span>
            </a>
          </div>
        </div>

        <div className="divider-warm" />
        <div className="flex flex-col items-center justify-between gap-4 py-8 md:flex-row">
          <p className="text-xs uppercase tracking-[0.22em] text-ink/60">
            © 2025 Casa Almeria · Brasília
          </p>
          <p className="font-serif text-sm italic text-ink/70">
            Feito à mão, com tempo.
          </p>
        </div>
      </div>
    </footer>
  );
}
