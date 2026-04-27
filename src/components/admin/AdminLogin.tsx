import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Mail } from "lucide-react";

export function AdminLogin() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
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
    <div className="flex min-h-screen items-center justify-center bg-linen p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-elevated ring-1 ring-border">
        <div className="mb-6 flex flex-col items-center">
          <Logo />
          <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
            Acesso restrito
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                autoComplete="email"
                autoFocus
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="pl-9"
                autoComplete="current-password"
                required
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-charcoal text-white hover:bg-charcoal/90"
          >
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
