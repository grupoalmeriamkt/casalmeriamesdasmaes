import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { AccessDenied } from "@/components/admin/AccessDenied";
import { PedidoManualStepper } from "@/components/pedidoManual/PedidoManualStepper";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/pedidos/novo")({
  component: PedidoNovoPage,
});

function PedidoNovoPage() {
  const { user, loading, canAccessCozinha } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linen">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-charcoal border-t-transparent" />
      </div>
    );
  }
  if (!user || !canAccessCozinha) {
    return (
      <>
        <AccessDenied
          title="Acesso restrito"
          description="Somente a equipe interna pode criar pedidos manuais."
          showSignOut
          onSignOut={() => supabase.auth.signOut()}
        />
        <Toaster position="bottom-right" />
      </>
    );
  }
  return (
    <div className="h-screen bg-linen">
      <PedidoManualStepper onFinalizado={() => navigate({ to: "/admin" })} />
      <Toaster position="bottom-right" />
    </div>
  );
}
