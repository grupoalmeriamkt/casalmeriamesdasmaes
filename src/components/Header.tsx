import { useState } from "react";
import { Logo } from "./Logo";
import { useAdmin } from "@/store/admin";
import { Link } from "@tanstack/react-router";
import { Menu, X, Instagram } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

export function Header() {
  const insta = useAdmin((s) => s.integracoes.instagramUrl);
  const wa = useAdmin((s) => s.integracoes.whatsappUrl);
  const encerrado = false;
  const [open, setOpen] = useState(false);

  const navItems = [
    { href: "#experiencia", label: "A experiência" },
    { href: "#produtos", label: "Presentes" },
    { href: "#como-funciona", label: "Como funciona" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-linen/90 backdrop-blur-md">
      <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 md:px-10 md:py-4">
        <Logo />

        {/* Desktop nav */}
        <nav className="hidden items-center gap-10 text-[0.72rem] font-medium uppercase tracking-[0.24em] text-charcoal/70 md:flex">
          {navItems.map((it) => (
            <a key={it.href} href={it.href} className="transition-colors hover:text-terracotta whitespace-nowrap">
              {it.label}
            </a>
          ))}
          {!encerrado && (
            <Link to="/pedido" className="transition-colors hover:text-terracotta whitespace-nowrap">
              Fazer pedido
            </Link>
          )}
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-2">
          {encerrado ? (
            <span className="inline-flex items-center rounded-full border border-terracotta/40 bg-linen px-3 py-1.5 text-[0.6rem] sm:text-[0.65rem] font-medium uppercase tracking-[0.18em] sm:tracking-[0.22em] text-terracotta whitespace-nowrap">
              Encerradas
            </span>
          ) : (
            <span className="badge-mae" aria-label="Dia das Mães">
              <span className="sm:hidden">Dia das Mães</span>
              <span className="hidden sm:inline">Dia das Mães</span>
            </span>
          )}

          {/* Mobile menu trigger */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-charcoal/15 text-charcoal hover:bg-charcoal hover:text-linen transition-colors"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85%] max-w-sm bg-linen border-l border-sand/60 p-0">
              <SheetHeader className="border-b border-sand/50 px-6 py-5">
                <SheetTitle asChild>
                  <Logo />
                </SheetTitle>
              </SheetHeader>

              <nav className="flex flex-col px-6 py-6">
                {navItems.map((it) => (
                  <SheetClose asChild key={it.href}>
                    <a
                      href={it.href}
                      className="border-b border-sand/40 py-4 font-serif text-lg text-charcoal hover:text-terracotta transition-colors"
                    >
                      {it.label}
                    </a>
                  </SheetClose>
                ))}

                {!encerrado && (
                  <SheetClose asChild>
                    <Link
                      to="/pedido"
                      className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-terracotta px-6 py-4 text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-charcoal shadow-warm hover:bg-charcoal hover:text-linen transition-all"
                    >
                      Fazer pedido →
                    </Link>
                  </SheetClose>
                )}
              </nav>

              <div className="border-t border-sand/40 px-6 py-5 mt-auto">
                <p className="text-[0.65rem] font-medium uppercase tracking-[0.22em] text-terracotta mb-3">
                  Acompanhe
                </p>
                <div className="flex flex-col gap-3">
                  <a href={insta} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-charcoal hover:text-terracotta">
                    <Instagram className="h-4 w-4" />
                    <span className="font-serif italic">@casa_almeria</span>
                  </a>
                  <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-charcoal hover:text-terracotta">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.594 5.319l-.999 3.648 3.894-1.020z" />
                    </svg>
                    <span className="font-serif italic">WhatsApp</span>
                  </a>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
