import { useCallback, useEffect, useState } from "react";
import { AdminSection } from "./AdminField";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ChefHat, Copy, ExternalLink, KeyRound, Mail, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  alterarSenhaUsuarioCozinha,
  listarUsuariosCozinha,
  urlModuloCozinha,
  type UsuarioCozinha,
} from "@/lib/cozinha";
import { criarTokenPedidos, listarTokensPedidos } from "@/lib/shareToken";

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export function AbaCozinha() {
  const [usuarios, setUsuarios] = useState<UsuarioCozinha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [criando, setCriando] = useState(false);
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const [senhaDialog, setSenhaDialog] = useState<UsuarioCozinha | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [testeEmail, setTesteEmail] = useState("grupoalmeria.mkt@gmail.com");
  const [enviandoTeste, setEnviandoTeste] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const lista = await listarUsuariosCozinha();
    setUsuarios(lista);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
    (async () => {
      const lista = await listarTokensPedidos();
      const geral = lista.find((t) => !t.campanha_id);
      if (!geral) await criarTokenPedidos(undefined, undefined);
    })();
  }, [carregar]);

  const copiar = (texto: string) => {
    navigator.clipboard.writeText(texto);
    toast.success("Copiado!");
  };

  const criarUsuario = async () => {
    if (!email.trim() || senha.length < 8) {
      toast.error("Informe e-mail válido e senha com pelo menos 8 caracteres.");
      return;
    }
    setCriando(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/admin/cozinha-users", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "criar", email: email.trim(), password: senha }),
      });
      const json = await res.json();
      if (!res.ok) {
        const desc =
          json.error === "forbidden"
            ? "Sua sessão não tem permissão de administrador no servidor. Saia, entre de novo e tente outra vez."
            : json.error;
        toast.error("Não foi possível criar o usuário", { description: desc });
        return;
      }
      toast.success("Usuário da cozinha criado!", {
        description: json.emailSent
          ? "E-mail de acesso enviado ao funcionário."
          : "Compartilhe o link e a senha manualmente.",
      });
      setEmail("");
      setSenha("");
      if (json.user) {
        setUsuarios((prev) => {
          const exists = prev.some((u) => u.user_id === json.user.user_id);
          if (exists) return prev;
          return [json.user as UsuarioCozinha, ...prev];
        });
      }
      await carregar();
    } catch (e) {
      toast.error("Erro ao criar usuário", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      });
    } finally {
      setCriando(false);
    }
  };

  const removerUsuario = async (userId: string) => {
    setRemovendoId(userId);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/admin/cozinha-users", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "remover", userId }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Não foi possível remover", { description: json.error });
        return;
      }
      toast.success("Acesso da cozinha removido.");
      setUsuarios((prev) => prev.filter((u) => u.user_id !== userId));
      await carregar();
    } catch (e) {
      toast.error("Erro ao remover", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      });
    } finally {
      setRemovendoId(null);
    }
  };

  const abrirTrocaSenha = (usuario: UsuarioCozinha) => {
    setSenhaDialog(usuario);
    setNovaSenha("");
  };

  const salvarNovaSenha = async () => {
    if (!senhaDialog || novaSenha.length < 8) {
      toast.error("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    setSalvandoSenha(true);
    const res = await alterarSenhaUsuarioCozinha(senhaDialog.user_id, novaSenha);
    setSalvandoSenha(false);
    if (!res.ok) {
      toast.error("Não foi possível alterar a senha", { description: res.error });
      return;
    }
    toast.success(`Senha de ${senhaDialog.email} atualizada.`);
    setSenhaDialog(null);
    setNovaSenha("");
  };

  const enviarEmailTeste = async () => {
    if (!testeEmail.trim()) {
      toast.error("Informe um e-mail para o teste.");
      return;
    }
    setEnviandoTeste(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/admin/email", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "test", to: testeEmail.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Falha no envio", {
          description:
            json.error === "resend_not_configured"
              ? "Configure RESEND_API_KEY no .env"
              : json.error,
        });
        return;
      }
      toast.success("E-mail de teste enviado!", { description: testeEmail.trim() });
    } catch (e) {
      toast.error("Erro ao enviar teste", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      });
    } finally {
      setEnviandoTeste(false);
    }
  };

  const portalUrl = urlModuloCozinha();

  return (
    <AdminSection
      title="Módulo Cozinha"
      icon={<ChefHat className="h-5 w-5" />}
      description="Gerencie quem pode acessar a central de pedidos da cozinha, separada do painel administrativo."
    >
      <div className="rounded-2xl border border-border bg-linen/50 p-4">
        <p className="mb-2 text-sm font-bold text-charcoal">Portal da cozinha</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Compartilhe este endereço com a equipe. Eles farão login com o e-mail e senha criados abaixo.
        </p>
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 ring-1 ring-border">
          <code className="min-w-0 flex-1 truncate text-xs text-charcoal">{portalUrl}</code>
          <Button size="sm" variant="outline" asChild>
            <a href={portalUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1 h-3 w-3" /> Abrir
            </a>
          </Button>
          <Button size="sm" variant="outline" onClick={() => copiar(portalUrl)}>
            <Copy className="mr-1 h-3 w-3" /> Copiar
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 flex items-center gap-2 text-sm font-bold text-charcoal">
          <UserPlus className="h-4 w-4" /> Novo usuário da cozinha
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            type="email"
            placeholder="E-mail do funcionário"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Senha (mín. 8 caracteres)"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>
        <Button className="mt-3" onClick={criarUsuario} disabled={criando}>
          {criando ? "Criando…" : "Criar usuário"}
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-charcoal">Usuários com acesso</p>
          <Button size="sm" variant="outline" onClick={carregar} disabled={carregando}>
            <RefreshCw className={`mr-1 h-3 w-3 ${carregando ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : usuarios.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum usuário da cozinha cadastrado.</p>
        ) : (
          <ul className="divide-y divide-border">
            {usuarios.map((u) => (
              <li
                key={u.user_id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-charcoal">{u.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Desde {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => abrirTrocaSenha(u)}>
                    <KeyRound className="mr-1 h-3 w-3" />
                    Trocar senha
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-terracotta hover:text-terracotta"
                    disabled={removendoId === u.user_id}
                    onClick={() => removerUsuario(u.user_id)}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    {removendoId === u.user_id ? "Removendo…" : "Remover"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-linen/50 p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-bold text-charcoal">
          <Mail className="h-4 w-4" /> Testar Resend
        </p>
        <p className="mb-3 text-xs text-muted-foreground">
          Envia o e-mail de teste padrão do Resend para validar a integração.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            type="email"
            className="max-w-sm flex-1"
            value={testeEmail}
            onChange={(e) => setTesteEmail(e.target.value)}
            placeholder="destino@email.com"
          />
          <Button variant="outline" onClick={enviarEmailTeste} disabled={enviandoTeste}>
            {enviandoTeste ? "Enviando…" : "Enviar teste"}
          </Button>
        </div>
      </div>

      <Dialog open={!!senhaDialog} onOpenChange={(open) => !open && setSenhaDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trocar senha</DialogTitle>
          </DialogHeader>
          {senhaDialog && (
            <p className="text-sm text-muted-foreground">
              Nova senha para <strong className="text-charcoal">{senhaDialog.email}</strong>
            </p>
          )}
          <Input
            type="password"
            placeholder="Nova senha (mín. 8 caracteres)"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSenhaDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarNovaSenha} disabled={salvandoSenha}>
              {salvandoSenha ? "Salvando…" : "Salvar senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminSection>
  );
}
