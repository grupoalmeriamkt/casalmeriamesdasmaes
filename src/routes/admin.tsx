import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AbaTextos } from "@/components/admin/AbaTextos";
import { AbaCestas } from "@/components/admin/AbaCestas";
import { AbaCampanhas } from "@/components/admin/AbaCampanhas";
import { AbaPedidos } from "@/components/admin/AbaPedidos";
import { CentralPedidos } from "@/components/admin/pedidos/CentralPedidos";
import { AbaCupons } from "@/components/admin/AbaCupons";
import { AbaConfiguracoes } from "@/components/admin/AbaConfiguracoes";
import { AbaCozinha } from "@/components/admin/AbaCozinha";
import { AbaEmails } from "@/components/admin/AbaEmails";
import { SaveConfigBar } from "@/components/admin/SaveConfigBar";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AccessDenied } from "@/components/admin/AccessDenied";
import { Toaster } from "@/components/ui/sonner";
import {
  Type,
  Package,
  Megaphone,
  ListOrdered,
  Settings,
  Tag,
  ChefHat,
  Mail,
  LayoutDashboard,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  AdminLayout,
  type AdminNavGroup,
  type AdminTabId,
} from "@/components/admin/AdminShell";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

const ABAS: Record<
  AdminTabId,
  { label: string; Comp: React.ComponentType }
> = {
  textos: { label: "Site Principal", Comp: AbaTextos },
  cestas: { label: "Produtos", Comp: AbaCestas },
  campanhas: { label: "Campanhas", Comp: AbaCampanhas },
  "pedidos-central": { label: "Central de Pedidos", Comp: CentralPedidos },
  pedidos: { label: "Lista de Pedidos", Comp: AbaPedidos },
  cozinha: { label: "Cozinha", Comp: AbaCozinha },
  emails: { label: "E-mails", Comp: AbaEmails },
  cupons: { label: "Cupons", Comp: AbaCupons },
  configuracoes: { label: "Configurações", Comp: AbaConfiguracoes },
};

const NAV_GROUPS: AdminNavGroup[] = [
  {
    title: "Conteúdo",
    items: [
      { id: "textos", label: "Site Principal", Icon: Type },
      { id: "cestas", label: "Produtos", Icon: Package },
      { id: "campanhas", label: "Campanhas", Icon: Megaphone },
    ],
  },
  {
    title: "Operação",
    items: [
      { id: "pedidos-central", label: "Central de Pedidos", Icon: LayoutDashboard },
      { id: "pedidos", label: "Lista de Pedidos", Icon: ListOrdered },
      { id: "cozinha", label: "Cozinha", Icon: ChefHat },
      { id: "emails", label: "E-mails", Icon: Mail },
    ],
  },
  {
    title: "Sistema",
    items: [
      { id: "cupons", label: "Cupons", Icon: Tag },
      { id: "configuracoes", label: "Configurações", Icon: Settings },
    ],
  },
];

const TAB_IDS = Object.keys(ABAS) as AdminTabId[];

function AdminPage() {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="admin-shell flex min-h-[100dvh] items-center justify-center bg-[#f2f2f7]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-charcoal border-t-transparent" />
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
      <>
        <AccessDenied
          title="Painel administrativo restrito"
          description="Sua conta não tem permissão de administrador. Se você é da equipe da cozinha, acesse o módulo Cozinha."
          showSignOut
          onSignOut={() => supabase.auth.signOut()}
        />
        <Toaster position="bottom-right" />
      </>
    );
  }

  return <AdminPanel />;
}

function AdminPanel() {
  const [aba, setAba] = useState<AdminTabId>(() => {
    if (typeof window === "undefined") return "pedidos-central";
    const saved = window.localStorage.getItem("admin:aba");
    if (saved === "pedidos-central" || (saved && TAB_IDS.includes(saved as AdminTabId))) {
      return saved as AdminTabId;
    }
    return "pedidos-central";
  });
  const [menuOpen, setMenuOpen] = useState(false);

  const trocarAba = (id: AdminTabId) => {
    setAba(id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("admin:aba", id);
    }
    setMenuOpen(false);
  };

  const Atual = ABAS[aba].Comp;

  return (
    <>
      <AdminLayout
        groups={NAV_GROUPS}
        activeId={aba}
        onNavigate={trocarAba}
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
      >
        <SaveConfigBar />
        <Atual />
      </AdminLayout>
      <Toaster position="bottom-right" />
    </>
  );
}
