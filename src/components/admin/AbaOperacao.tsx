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
import {
  ClipboardList,
  Copy,
  ExternalLink,
  KeyRound,
  Pencil,
  RefreshCw,
  Shuffle,
  Trash2,
  UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { maskCpf } from "@/lib/checkout/cardCharge";
import {
  alterarSenhaUsuarioOperacao,
  atualizarPortalOperacaoToken,
  criarOperadorCodigo,
  editarOperadorCodigo,
  listarAcessosOperacao,
  mensagemErroOperadorCodigo,
  obterPortalOperacaoConfig,
  removerOperadorCodigo,
  urlModuloOperacao,
  urlPedidosOperacao,
  type UsuarioOperacao,
} from "@/lib/operacao";
import {
  codigoAcessoValido,
  cpfValido,
  formatarCpf,
  gerarCodigoAcesso,
  mensagemAcessoOperador,
  somenteDigitos,
  type DadosOperadorCodigo,
  type OperadorCodigo,
} from "@/lib/operacaoCodigo";

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

type FormOperador = { nome: string; cpf: string; setor: string; codigo: string };

const FORM_VAZIO: FormOperador = { nome: "", cpf: "", setor: "", codigo: "" };

function validarFormOperador(form: FormOperador): DadosOperadorCodigo | string {
  const nome = form.nome.trim();
  const setor = form.setor.trim();
  if (nome.length < 2) return "Informe o nome do usuário.";
  if (!cpfValido(form.cpf)) return "CPF inválido. Confira os números.";
  if (setor.length < 2) return "Informe o setor.";
  if (!codigoAcessoValido(form.codigo)) return "O código deve ter de 6 a 8 números.";
  return { nome, cpf: somenteDigitos(form.cpf), setor, codigo: form.codigo };
}

function CamposOperador({
  form,
  onChange,
}: {
  form: FormOperador;
  onChange: (form: FormOperador) => void;
}) {
  const set = (campo: keyof FormOperador, valor: string) => onChange({ ...form, [campo]: valor });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        Nome do usuário
        <Input
          placeholder="Ex.: Juliana"
          maxLength={80}
          value={form.nome}
          onChange={(e) => set("nome", e.target.value)}
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        CPF
        <Input
          placeholder="000.000.000-00"
          inputMode="numeric"
          value={form.cpf}
          onChange={(e) => set("cpf", maskCpf(e.target.value))}
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        Setor
        <Input
          placeholder="Ex.: Operador Balcão"
          list="setores-operacao"
          maxLength={60}
          value={form.setor}
          onChange={(e) => set("setor", e.target.value)}
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        Código de acesso
        <div className="flex gap-2">
          <Input
            placeholder="6 a 8 números"
            inputMode="numeric"
            className="font-mono tracking-widest"
            value={form.codigo}
            onChange={(e) => set("codigo", somenteDigitos(e.target.value).slice(0, 8))}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => set("codigo", gerarCodigoAcesso())}
          >
            <Shuffle className="mr-1 h-3 w-3" /> Gerar
          </Button>
        </div>
      </label>
    </div>
  );
}

export function AbaOperacao() {
  const [usuarios, setUsuarios] = useState<UsuarioOperacao[]>([]);
  const [operadores, setOperadores] = useState<OperadorCodigo[]>([]);
  const [operadoresErro, setOperadoresErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [novoOperador, setNovoOperador] = useState<FormOperador>(FORM_VAZIO);
  const [criandoOperador, setCriandoOperador] = useState(false);
  const [acessoCriado, setAcessoCriado] = useState<OperadorCodigo | null>(null);
  const [editando, setEditando] = useState<OperadorCodigo | null>(null);
  const [formEdicao, setFormEdicao] = useState<FormOperador>(FORM_VAZIO);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [removendoOperadorId, setRemovendoOperadorId] = useState<string | null>(null);
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
    const [acessos, config] = await Promise.all([
      listarAcessosOperacao(),
      obterPortalOperacaoConfig(),
    ]);
    setUsuarios(acessos.usuarios);
    setOperadores(acessos.operadores);
    setOperadoresErro(acessos.operadoresErro);
    if (config?.share_token) setShareToken(config.share_token);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
    setNovoOperador((f) => (f.codigo ? f : { ...f, codigo: gerarCodigoAcesso() }));
  }, [carregar]);

  const copiar = (texto: string) => {
    navigator.clipboard.writeText(texto);
    toast.success("Copiado!");
  };

  const portalUrl = urlModuloOperacao();
  const pedidosUrl = shareToken ? urlPedidosOperacao(shareToken) : "";
  const setores = [...new Set(operadores.map((o) => o.setor).filter(Boolean))];

  const copiarAcesso = (op: OperadorCodigo) =>
    copiar(mensagemAcessoOperador({ nome: op.nome, codigo: op.codigo, portalUrl }));

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

  const criarOperador = async () => {
    const dados = validarFormOperador(novoOperador);
    if (typeof dados === "string") {
      toast.error(dados);
      return;
    }
    setCriandoOperador(true);
    const res = await criarOperadorCodigo(dados);
    setCriandoOperador(false);
    if (!res.ok) {
      toast.error("Não foi possível criar o usuário", {
        description: mensagemErroOperadorCodigo(res.error),
      });
      return;
    }
    toast.success(`Acesso de ${res.operador.nome} criado.`);
    setAcessoCriado(res.operador);
    setOperadores((prev) => [res.operador, ...prev]);
    setNovoOperador({ ...FORM_VAZIO, codigo: gerarCodigoAcesso() });
  };

  const abrirEdicao = (op: OperadorCodigo) => {
    setEditando(op);
    setFormEdicao({ nome: op.nome, cpf: formatarCpf(op.cpf), setor: op.setor, codigo: op.codigo });
  };

  const salvarEdicao = async () => {
    if (!editando) return;
    const dados = validarFormOperador(formEdicao);
    if (typeof dados === "string") {
      toast.error(dados);
      return;
    }
    setSalvandoEdicao(true);
    const res = await editarOperadorCodigo(editando.id, dados);
    setSalvandoEdicao(false);
    if (!res.ok) {
      toast.error("Não foi possível salvar", {
        description: mensagemErroOperadorCodigo(res.error),
      });
      return;
    }
    toast.success(
      res.operador.codigo !== editando.codigo
        ? `Código de ${res.operador.nome} trocado. O código antigo parou de funcionar.`
        : `${res.operador.nome} atualizado.`,
    );
    setOperadores((prev) => prev.map((o) => (o.id === res.operador.id ? res.operador : o)));
    if (acessoCriado?.id === res.operador.id) setAcessoCriado(res.operador);
    setEditando(null);
  };

  const removerOperador = async (op: OperadorCodigo) => {
    if (!window.confirm(`Remover o acesso de ${op.nome}? O código para de funcionar na hora.`)) {
      return;
    }
    setRemovendoOperadorId(op.id);
    const res = await removerOperadorCodigo(op.id);
    setRemovendoOperadorId(null);
    if (!res.ok) {
      toast.error("Não foi possível remover", {
        description: mensagemErroOperadorCodigo(res.error),
      });
      return;
    }
    toast.success(`Acesso de ${op.nome} removido.`);
    setOperadores((prev) => prev.filter((o) => o.id !== op.id));
    if (acessoCriado?.id === op.id) setAcessoCriado(null);
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

  return (
    <AdminSection
      title="Módulo Operação Restrita"
      icon={<ClipboardList className="h-5 w-5" />}
      description="Acesso limitado: somente pedidos aprovados de um link específico, com permissão para concluir (arquivar) e criar novos pedidos. Cada pessoa entra no portal com o próprio código."
    >
      <datalist id="setores-operacao">
        {setores.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <div className="rounded-2xl border border-border bg-linen/50 p-4">
        <p className="mb-2 text-sm font-bold text-charcoal">Link da central</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Usuários deste módulo só acessam este endereço. Veem apenas pedidos aprovados e podem
          arquivá-los ou criar novos.
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
        <p className="mb-1 flex items-center gap-2 text-sm font-bold text-charcoal">
          <UserPlus className="h-4 w-4" /> Novo usuário de operação
        </p>
        <p className="mb-3 text-xs text-muted-foreground">
          A pessoa abre o portal de login e digita o código. O código é único e pode ser trocado
          depois.
        </p>
        <CamposOperador form={novoOperador} onChange={setNovoOperador} />
        <Button className="mt-3" onClick={criarOperador} disabled={criandoOperador}>
          {criandoOperador ? "Criando…" : "Criar usuário e gerar acesso"}
        </Button>

        {acessoCriado && (
          <div className="mt-4 rounded-xl bg-linen/60 p-3 ring-1 ring-border">
            <p className="text-sm font-bold text-charcoal">Acesso de {acessoCriado.nome} pronto</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Envie o link e o código para a pessoa.
            </p>
            <dl className="mt-2 grid gap-1 text-sm">
              <div className="flex min-w-0 gap-2">
                <dt className="text-muted-foreground">Link:</dt>
                <dd className="min-w-0 truncate font-mono text-xs leading-5 text-charcoal">
                  {portalUrl}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Código:</dt>
                <dd className="font-mono font-bold tracking-widest text-charcoal">
                  {acessoCriado.codigo}
                </dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => copiarAcesso(acessoCriado)}>
                <Copy className="mr-1 h-3 w-3" /> Copiar link e código
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAcessoCriado(null)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-charcoal">Usuários com código de acesso</p>
          <Button size="sm" variant="outline" onClick={carregar} disabled={carregando}>
            <RefreshCw className={`mr-1 h-3 w-3 ${carregando ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {operadoresErro && (
          <p className="mb-3 rounded-lg bg-terracotta/10 p-2 text-xs text-terracotta">
            {mensagemErroOperadorCodigo(operadoresErro)}
          </p>
        )}

        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : operadores.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum usuário com código cadastrado.</p>
        ) : (
          <ul className="divide-y divide-border">
            {operadores.map((op) => (
              <li
                key={op.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-charcoal">
                    {op.nome}
                    <span className="font-normal text-muted-foreground"> · {op.setor}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    CPF {formatarCpf(op.cpf)} · Código{" "}
                    <code className="font-mono font-semibold tracking-widest text-charcoal">
                      {op.codigo}
                    </code>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {op.ultimo_acesso_em
                      ? `Última atividade ${new Date(op.ultimo_acesso_em).toLocaleString("pt-BR")}`
                      : "Ainda não entrou"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => copiarAcesso(op)}>
                    <Copy className="mr-1 h-3 w-3" />
                    Copiar acesso
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => abrirEdicao(op)}>
                    <Pencil className="mr-1 h-3 w-3" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-terracotta hover:text-terracotta"
                    disabled={removendoOperadorId === op.id}
                    onClick={() => removerOperador(op)}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    {removendoOperadorId === op.id ? "Removendo…" : "Remover"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <details className="rounded-2xl border border-border bg-card p-4">
        <summary className="cursor-pointer text-sm font-bold text-charcoal">
          Acesso por e-mail e senha ({usuarios.length})
        </summary>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
          {criando ? "Criando…" : "Criar usuário com e-mail"}
        </Button>

        {!carregando && usuarios.length > 0 && (
          <ul className="mt-4 divide-y divide-border border-t border-border">
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
      </details>

      <Dialog open={!!editando} onOpenChange={(open) => !open && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário de operação</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Ao trocar o código, o antigo para de funcionar. Quem já está logado continua na sessão.
          </p>
          <CamposOperador form={formEdicao} onChange={setFormEdicao} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarEdicao} disabled={salvandoEdicao}>
              {salvandoEdicao ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
