import { createFileRoute } from "@tanstack/react-router";
import { AccessDenied } from "@/components/admin/AccessDenied";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { DashboardPedidos } from "@/components/admin/DashboardPedidos";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboardExpandedPage,
});

function AdminDashboardExpandedPage() {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="admin-shell flex min-h-[100dvh] items-center justify-center bg-[#0A0C10]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#58A6FF] border-t-transparent" />
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
          title="Dashboard operacional restrito"
          description="Sua conta não tem permissão de administrador para visualizar a central de operação."
          showSignOut
          onSignOut={() => supabase.auth.signOut()}
        />
        <Toaster position="bottom-right" />
      </>
    );
  }

  return (
    <>
      <DashboardPedidos fullscreen />
      <Toaster position="bottom-right" />
    </>
  );
}
