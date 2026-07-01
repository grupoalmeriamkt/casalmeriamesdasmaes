import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { SignInPage } from "@/components/admin/SignInPage";
import { AccessDenied } from "@/components/admin/AccessDenied";
import { Button } from "@/components/ui/button";
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

type PortalState = "idle" | "resolvendo" | "erro";

function CozinhaPortalPage() {
  const { user, loading, canAccessCozinha } = useAuth();
  const navigate = useNavigate();
  const [loginLoading, setLoginLoading] = useState(false);
  const [portalState, setPortalState] = useState<PortalState>("idle");
  const [portalErro, setPortalErro] = useState<string | null>(null);

  const redirecionarParaCentral = useCallback(async () => {
    setPortalState("resolvendo");
    setPortalErro(null);
    try {
      const token = await obterTokenGeralCozinha();
      if (!token) {
        setPortalState("erro");
        setPortalErro(
          "Não foi possível abrir a central de pedidos. Peça a um administrador para acessar a aba Cozinha no painel admin.",
        );
        return;
      }
      navigate({ to: "/pedidos/$token", params: { token } });
    } catch {
      setPortalState("erro");
      setPortalErro("Erro ao conectar. Verifique sua internet e tente novamente.");
    }
  }, [navigate]);

  useEffect(() => {
    if (loading || !user || !canAccessCozinha) return;
    void redirecionarParaCentral();
  }, [loading, user, canAccessCozinha, redirecionarParaCentral]);

  if (loading || (user && canAccessCozinha && portalState === "resolvendo")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linen">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  if (user && !canAccessCozinha) {
    return (
      <>
        <AccessDenied
          title="Acesso restrito"
          description="Esta área é exclusiva para a equipe da cozinha. Use o painel administrativo se você for gestor."
          showSignOut
          onSignOut={() => supabase.auth.signOut()}
        />
        <Toaster position="bottom-right" />
      </>
    );
  }

  if (user && canAccessCozinha && portalState === "erro") {
    return (
      <>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-linen p-6 text-center">
          <h1 className="text-xl font-bold text-charcoal">Central indisponível</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            {portalErro ?? "Não foi possível abrir a central de pedidos."}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => void redirecionarParaCentral()}>
              Tentar novamente
            </Button>
            <Button variant="outline" onClick={() => supabase.auth.signOut()}>
              Sair e tentar outra conta
            </Button>
          </div>
        </div>
        <Toaster position="bottom-right" />
      </>
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-linen">
      <p className="text-sm text-muted-foreground">Redirecionando…</p>
    </div>
  );
}
