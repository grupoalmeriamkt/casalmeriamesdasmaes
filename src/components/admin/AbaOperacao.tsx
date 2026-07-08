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
import { ClipboardList, Copy, ExternalLink, KeyRound, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  alterarSenhaUsuarioOperacao,
  atualizarPortalOperacaoToken,
  listarUsuariosOperacao,
  obterPortalOperacaoConfig,
  urlModuloOperacao,
  urlPedidosOperacao,
  type UsuarioOperacao,
} from "@/lib/operacao";

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export function AbaOperacao() {
  const [usuarios, setUsuarios] = useState<UsuarioOperacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [criando, setCriando] = useState(false);
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const [senhaDialog, setSenhaDialog] = useState<UsuarioOperacao | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [shareToken, setShareToken] = useState("");
  const [salvandoToken, setSalvandoToken] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [lista, config] = await Promise.all([
      listarUsuariosOperacao(),
      obterPortalOperacaoConfig(),
    ]);
    setUsuarios(lista);
    if (config?.share_token) setShareToken(config.share_token);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const copiar = (texto: string) => {
    navigator.clipboard.writeText(texto);
    toast.success("Copiado!");
  };

  const salvarToken = async () => {
    if (shareToken.trim().length < 16) {
      toast.error("Informe um token de pedidos válido.");
      return;
    }
    setSalvandoToken(true);
    const res = await atualizarPortalOperacaoToken(shareToken.trim());
    setSalvandoToken(false);
    if (!res.ok) {
      toast.error("Não foi possível salvar o token", { description: res.error });
      return;
    }
    toast.success("Token da operação atualizado.");
  };

  const criarUsuario = async () => {
    if (!email.trim() || senha.length < 8) {
      toast.error("Informe e-mail válido e senha com pelo menos 8 caracteres.");
      return;
    }
    setCriando(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/admin/operacao-users", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "criar", email: email.trim(), password: senha }),
      });
      const json = await res.json();
      if (!res.ok) {
        const desc =
          json.error === "forbidden"
            ? "Sua sessão não tem permissão de administrador no servidor."
            : typeof json.error === "string" && json.error.includes("already been registered")
              ? "Este e-mail já existe. Tente novamente — o sistema deve vincular o acesso automaticamente."
              : json.error;
        toast.error("Não foi possível criar o usuário", { description: desc });
        return;
      }
      if (json.alreadyHadAccess) {
        toast.success("Usuário já tinha acesso à operação.", {
          description: json.linkedExistingUser
            ? "A senha foi atualizada com a informada."
            : undefined,
        });
      } else {
        toast.success(
          json.linkedExistingUser ? "Acesso de operação vinculado!" : "Usuário de operação criado!",
          {
            description: json.emailSent
              ? "E-mail de acesso enviado."
              : json.linkedExistingUser
                ? "Conta existente vinculada — compartilhe o link /operacao e a nova senha."
                : "Compartilhe o link e a senha manualmente.",
          },
        );
      }
      setEmail("");
      setSenha("");
      if (json.user) {
        setUsuarios((prev) => {
          const exists = prev.some((u) => u.user_id === json.user.user_id);
          if (exists) return prev;
          return [json.user as UsuarioOperacao, ...prev];
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
      const res = await fetch("/api/admin/operacao-users", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "remover", userId }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Não foi possível remover", { description: json.error });
        return;
      }
      toast.success("Acesso de operação removido.");
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

  const abrirTrocaSenha = (usuario: UsuarioOperacao) => {
    setSenhaDialog(usuario);
    setNovaSenha("");
  };

  const salvarNovaSenha = async () => {
    if (!senhaDialog || novaSenha.length < 8) {
      toast.error("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    setSalvandoSenha(true);
    const res = await alterarSenhaUsuarioOperacao(senhaDialog.user_id, novaSenha);
    setSalvandoSenha(false);
    if (!res.ok) {
      toast.error("Não foi possível alterar a senha", { description: res.error });
      return;
    }
    toast.success(`Senha de ${senhaDialog.email} atualizada.`);
    setSenhaDialog(null);
    setNovaSenha("");
  };

  const portalUrl = urlModuloOperacao();
  const pedidosUrl = shareToken ? urlPedidosOperacao(shareToken) : "";

  return (
    <AdminSection
      title="Módulo Operação Restrita"
      icon={<ClipboardList className="h-5 w-5" />}
      description="Acesso limitado: somente pedidos aprovados de um link específico, com permissão para concluir (arquivar) e criar novos pedidos."
    >
      <div className="rounded-2xl border border-border bg-linen/50 p-4">
        <p className="mb-2 text-sm font-bold text-charcoal">Link da central</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Usuários deste módulo só acessam este endereço. Veem apenas pedidos aprovados e podem arquivá-los ou criar novos.
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 ring-1 ring-border">
          <code className="min-w-0 flex-1 truncate text-xs text-charcoal">{pedidosUrl || "—"}</code>
          {pedidosUrl && (
            <>
              <Button size="sm" variant="outline" asChild>
                <a href={pedidosUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1 h-3 w-3" /> Abrir
                </a>
              </Button>
              <Button size="sm" variant="outline" onClick={() => copiar(pedidosUrl)}>
                <Copy className="mr-1 h-3 w-3" /> Copiar
              </Button>
            </>
          )}
        </div>
        <p className="mb-2 text-xs font-semibold text-charcoal">Portal de login</p>
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
        <p className="mb-3 text-sm font-bold text-charcoal">Token de pedidos vinculado</p>
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-xl flex-1 font-mono text-xs"
            value={shareToken}
            onChange={(e) => setShareToken(e.target.value)}
            placeholder="Token do link /pedidos/…"
          />
          <Button onClick={salvarToken} disabled={salvandoToken}>
            {salvandoToken ? "Salvando…" : "Salvar token"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 flex items-center gap-2 text-sm font-bold text-charcoal">
          <UserPlus className="h-4 w-4" /> Novo usuário de operação
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
          <p className="text-sm text-muted-foreground">Nenhum usuário de operação cadastrado.</p>
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
