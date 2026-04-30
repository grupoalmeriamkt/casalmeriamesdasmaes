import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AbaTextos } from "@/components/admin/AbaTextos";
import { AbaCestas } from "@/components/admin/AbaCestas";
import { AbaCampanhas } from "@/components/admin/AbaCampanhas";
import { AbaPedidos } from "@/components/admin/AbaPedidos";
import { AbaConfiguracoes } from "@/components/admin/AbaConfiguracoes";
import { SaveConfigBar } from "@/components/admin/SaveConfigBar";
import { Logo } from "@/components/Logo";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  ExternalLink,
  Menu,
  Type,
  Package,
  Megaphone,
  ListOrdered,
  Settings,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

const ABAS = [
  { id: "textos", label: "Site Principal", Icon: Type, Comp: AbaTextos },
  { id: "cestas", label: "Produtos", Icon: Package, Comp: AbaCestas },
  { id: "campanhas", label: "Campanhas", Icon: Megaphone, Comp: AbaCampanhas },
  { id: "pedidos", label: "Pedidos", Icon: ListOrdered, Comp: AbaPedidos },
  { id: "configuracoes", label: "Configurações", Icon: Settings, Comp: AbaConfiguracoes },
] as const;

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const [aba, setAba] = useState<(typeof ABAS)[number]["id"]>(() => {
    if (typeof window === "undefined") return "textos";
    const saved = window.localStorage.getItem("admin:aba");
    if (saved && ABAS.some((a) => a.id === saved)) {
      return saved as (typeof ABAS)[number]["id"];
    }
    return "textos";
  });
  const [menuOpen, setMenuOpen] = useState(false);

  const trocarAba = (id: (typeof ABAS)[number]["id"]) => {
    setAba(id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("admin:aba", id);
    }
    setMenuOpen(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linen">
        <p className="text-sm text-muted-foreground">Carregando…</p>
        <Toaster position="bottom-right" />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AdminLogin />
        <Toaster position="bottom-right" />
      </>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-linen p-6 text-center">
        <div className="rounded-2xl bg-card p-8 shadow-elevated ring-1 ring-border">
          <h1 className="text-xl font-bold text-charcoal">Acesso negado</h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Sua conta ({user.email}) não possui permissão de administrador.
            Entre em contato com o responsável pelo sistema.
          </p>
          <Button
            variant="ghost"
            onClick={logout}
            className="mt-4 text-terracotta hover:bg-terracotta/10 hover:text-terracotta"
          >
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
        <Toaster position="bottom-right" />
      </div>
    );
  }

  const Atual = ABAS.find((a) => a.id === aba)!.Comp;

  return (
    <div className="flex min-h-screen flex-col bg-linen md:flex-row">
      {/* Mobile header */}
      <header className="flex items-center justify-between border-b border-border bg-card p-4 md:hidden">
        <Logo />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </header>

      {/* Sidebar */}
      <aside
        className={`${menuOpen ? "block" : "hidden"} md:block w-full shrink-0 border-r border-border bg-card md:w-64`}
      >
        <div className="hidden border-b border-border p-6 md:block">
          <Logo />
          <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
            Administração
          </p>
        </div>
        <nav className="space-y-1 p-3">
          {ABAS.map((a) => {
            const Icon = a.Icon;
            const ativo = aba === a.id;
            return (
              <button
                key={a.id}
                onClick={() => {
                  setAba(a.id);
                  setMenuOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                  ativo
                    ? "bg-charcoal text-white"
                    : "text-charcoal hover:bg-charcoal/5"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{a.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-border p-3">
          <Button
            asChild
            variant="outline"
            className="w-full justify-start text-charcoal"
          >
            <a href="/" target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" /> Ver site
            </a>
          </Button>
          <Button
            variant="ghost"
            onClick={logout}
            className="w-full justify-start text-terracotta hover:bg-terracotta/10 hover:text-terracotta"
          >
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 p-5 md:p-10">
        <div className="mx-auto max-w-4xl">
          <SaveConfigBar />
          <Atual />
        </div>
      </main>

      <Toaster position="bottom-right" />
    </div>
  );
}
