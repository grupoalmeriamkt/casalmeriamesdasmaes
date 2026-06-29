import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SignInPage } from "./SignInPage";

export function AdminLogin() {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      toast.error("Falha no login", {
        description:
          error.message === "Invalid login credentials"
            ? "Email ou senha incorretos."
            : error.message,
      });
      return;
    }
    toast.success("Bem-vindo!");
  };

  return (
    <SignInPage
      heroImageSrc="/img_casa_fachada.jpeg"
      loading={loading}
      onSignIn={handleSignIn}
    />
  );
}
