import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { SignInPage } from "@/components/admin/SignInPage";
import { AccessDenied } from "@/components/admin/AccessDenied";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { obterTokenGeralCozinha } from "@/lib/cozinha";

export const Route = createFileRoute("/cozinha")({
  head: () => ({
    meta: [
      { title: "Cozinha — Casa Almeria" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CozinhaPortalPage,
});

function CozinhaPortalPage() {
  const { user, loading, canAccessCozinha } = useAuth();
  const navigate = useNavigate();
  const [loginLoading, setLoginLoading] = useState(false);
  const [resolvendoToken, setResolvendoToken] = useState(false);

  useEffect(() => {
    if (loading || !user || !canAccessCozinha) return;

    let cancelled = false;
    setResolvendoToken(true);
    obterTokenGeralCozinha()
      .then((token) => {
        if (cancelled) return;
        if (!token) {
          toast.error("Painel da cozinha indisponível", {
            description: "Peça a um administrador para configurar o acesso.",
          });
          return;
        }
        navigate({ to: "/pedidos/$token", params: { token } });
      })
      .finally(() => {
        if (!cancelled) setResolvendoToken(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loading, user, canAccessCozinha, navigate]);

  if (loading || (user && canAccessCozinha && resolvendoToken)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linen">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  if (user && !canAccessCozinha) {
    return (
      <AccessDenied
        title="Acesso restrito"
        description="Esta área é exclusiva para a equipe da cozinha. Use o painel administrativo se você for gestor."
        showSignOut
        onSignOut={() => supabase.auth.signOut()}
      />
    );
  }

  if (!user) {
    const handleSignIn = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = new FormData(e.currentTarget);
      const email = String(form.get("email") ?? "").trim();
      const password = String(form.get("password") ?? "");
      if (!email || !password) {
        toast.error("Preencha e-mail e senha.");
        return;
      }
      setLoginLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoginLoading(false);
      if (error) {
        toast.error("Falha no login", {
          description:
            error.message === "Invalid login credentials"
              ? "E-mail ou senha incorretos."
              : error.message,
        });
      }
    };

    return (
      <>
        <SignInPage
          heroImageSrc="/img_casa_fachada.jpeg"
          description="Módulo Cozinha — Central de Pedidos"
          loading={loginLoading}
          onSignIn={handleSignIn}
        />
        <Toaster position="bottom-right" />
      </>
    );
  }

  return null;
}
