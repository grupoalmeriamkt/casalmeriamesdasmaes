import { useCallback, useEffect, useState } from "react";
import { AdminSection } from "./AdminField";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Users, RefreshCw, Pencil } from "lucide-react";
import {
  listarOperadores, atualizarOperador, definirOperadorAtivo, type Operator,
} from "@/lib/operators";

export function AbaOperadores() {
  const [operadores, setOperadores] = useState<Operator[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<Operator | null>(null);
  const [form, setForm] = useState({ short_name: "", role_title: "", internal_key: "" });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setOperadores(await listarOperadores());
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirEdicao = (op: Operator) => {
    setEditando(op);
    setForm({
      short_name: op.short_name ?? "",
      role_title: op.role_title ?? "",
      internal_key: op.internal_key ?? "",
    });
  };

  const salvar = async () => {
    if (!editando) return;
    setSalvando(true);
    const res = await atualizarOperador(editando.id, {
      short_name: form.short_name.trim() || null,
      role_title: form.role_title.trim() || null,
      internal_key: form.internal_key.trim() || null,
    });
    setSalvando(false);
    if (!res.ok) { toast.error("Nao foi possivel salvar", { description: res.error }); return; }
    toast.success("Operador atualizado.");
    setEditando(null);
    await carregar();
  };

  const alternarAtivo = async (op: Operator) => {
    const res = await definirOperadorAtivo(op.id, !op.is_active);
    if (!res.ok) { toast.error("Nao foi possivel alterar", { description: res.error }); return; }
    toast.success(op.is_active ? "Operador desativado." : "Operador ativado.");
    await carregar();
  };

  return (
    <AdminSection
      title="Operadores"
      description="Equipe interna responsavel pelas vendas. O operador e identificado pelo login; ajuste apelido, cargo e chave interna aqui."
      icon={<Users className="h-5 w-5" />}
    >
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-charcoal">Operadores cadastrados</p>
          <Button size="sm" variant="outline" onClick={carregar} disabled={carregando}>
            <RefreshCw className={`mr-1 h-3 w-3 ${carregando ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : operadores.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum operador ainda. Eles aparecem aqui automaticamente ao criar o primeiro pedido manual.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {operadores.map((op) => (
              <li key={op.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-charcoal">
                    {op.short_name || op.name}{" "}
                    {!op.is_active && <span className="text-xs text-terracotta">(inativo)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {op.email ?? "-"}{op.role_title ? ` · ${op.role_title}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => abrirEdicao(op)}>
                    <Pencil className="mr-1 h-3 w-3" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => alternarAtivo(op)}>
                    {op.is_active ? "Desativar" : "Ativar"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!editando} onOpenChange={(open) => !open && setEditando(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar operador</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Input placeholder="Apelido / nome curto" value={form.short_name}
              onChange={(e) => setForm((f) => ({ ...f, short_name: e.target.value }))} />
            <Input placeholder="Cargo ou area" value={form.role_title}
              onChange={(e) => setForm((f) => ({ ...f, role_title: e.target.value }))} />
            <Input placeholder="Chave interna" value={form.internal_key}
              onChange={(e) => setForm((f) => ({ ...f, internal_key: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminSection>
  );
}
