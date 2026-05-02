import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/store/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Tag, RefreshCw } from "lucide-react";
import { formatBRL } from "@/store/pedido";

type Cupom = {
  id: string;
  codigo: string;
  tipo: "percentual" | "fixo";
  valor: number;
  ativo: boolean;
  validade: string | null;
  uso_max: number | null;
  uso_atual: number;
  valor_minimo: number | null;
  campanha_ids: string[] | null;
  produto_ids: string[] | null;
  criado_em: string;
};

type FormData = {
  codigo: string;
  tipo: "percentual" | "fixo";
  valor: string;
  ativo: boolean;
  validade: string;
  uso_max: string;
  valor_minimo: string;
  campanha_ids: string[];
  produto_ids: string[];
};

const emptyForm: FormData = {
  codigo: "",
  tipo: "percentual",
  valor: "",
  ativo: true,
  validade: "",
  uso_max: "",
  valor_minimo: "",
  campanha_ids: [],
  produto_ids: [],
};

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

async function callApi(body: unknown) {
  const token = await getToken();
  if (!token) throw new Error("Sessão expirada");
  const res = await fetch("/api/admin/cupons", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Erro desconhecido");
  return data;
}

function formatValidade(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("pt-BR");
}

function formatUso(atual: number, max: number | null) {
  return max ? `${atual}/${max}` : `${atual}`;
}

export function AbaCupons() {
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const campanhas = useAdmin((s) => s.campanhas);
  const cestas = useAdmin((s) => s.cestas);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callApi({ action: "list" });
      setCupons(data.cupons ?? []);
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? "Erro ao carregar cupons");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function abrirCriar() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function abrirEditar(c: Cupom) {
    setEditingId(c.id);
    setForm({
      codigo: c.codigo,
      tipo: c.tipo,
      valor: String(c.valor),
      ativo: c.ativo,
      validade: c.validade ? c.validade.slice(0, 10) : "",
      uso_max: c.uso_max != null ? String(c.uso_max) : "",
      valor_minimo: c.valor_minimo != null ? String(c.valor_minimo) : "",
      campanha_ids: c.campanha_ids ?? [],
      produto_ids: c.produto_ids ?? [],
    });
    setDialogOpen(true);
  }

  async function salvar() {
    if (!form.codigo.trim()) {
      toast.error("Código obrigatório");
      return;
    }
    const valor = parseFloat(form.valor.replace(",", "."));
    if (isNaN(valor) || valor <= 0) {
      toast.error("Valor inválido");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        codigo: form.codigo.trim().toUpperCase(),
        tipo: form.tipo,
        valor,
        ativo: form.ativo,
        validade: form.validade || null,
        uso_max: form.uso_max ? parseInt(form.uso_max) : null,
        valor_minimo: form.valor_minimo ? parseFloat(form.valor_minimo.replace(",", ".")) : null,
        campanha_ids: form.campanha_ids.length > 0 ? form.campanha_ids : null,
        produto_ids: form.produto_ids.length > 0 ? form.produto_ids : null,
      };
      if (editingId) {
        await callApi({ action: "update", id: editingId, data: payload });
        toast.success("Cupom atualizado");
      } else {
        await callApi({ action: "create", data: payload });
        toast.success("Cupom criado");
      }
      setDialogOpen(false);
      void carregar();
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAtivo(c: Cupom) {
    try {
      await callApi({ action: "update", id: c.id, data: { ativo: !c.ativo } });
      setCupons((prev) => prev.map((x) => (x.id === c.id ? { ...x, ativo: !c.ativo } : x)));
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? "Erro ao atualizar");
    }
  }

  async function confirmarDelete() {
    if (!deletingId) return;
    try {
      await callApi({ action: "delete", id: deletingId });
      toast.success("Cupom excluído");
      setCupons((prev) => prev.filter((c) => c.id !== deletingId));
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? "Erro ao excluir");
    } finally {
      setDeletingId(null);
    }
  }

  function toggleMultiselect(field: "campanha_ids" | "produto_ids", id: string) {
    setForm((f) => {
      const arr = f[field];
      return {
        ...f,
        [field]: arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id],
      };
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-charcoal">Cupons</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie cupons de desconto para suas campanhas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={carregar} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={abrirCriar} className="bg-charcoal text-white hover:bg-charcoal/90">
            <Plus className="mr-2 h-4 w-4" /> Novo cupom
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-charcoal border-t-transparent" />
        </div>
      ) : cupons.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <Tag className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhum cupom cadastrado</p>
          <Button variant="outline" onClick={abrirCriar}>
            <Plus className="mr-2 h-4 w-4" /> Criar primeiro cupom
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-charcoal">Código</th>
                <th className="px-4 py-3 text-left font-medium text-charcoal">Tipo / Valor</th>
                <th className="px-4 py-3 text-left font-medium text-charcoal">Válido até</th>
                <th className="px-4 py-3 text-left font-medium text-charcoal">Usos</th>
                <th className="px-4 py-3 text-left font-medium text-charcoal">Mín. pedido</th>
                <th className="px-4 py-3 text-center font-medium text-charcoal">Ativo</th>
                <th className="px-4 py-3 text-right font-medium text-charcoal">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cupons.map((c) => (
                <tr key={c.id} className="bg-white hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-charcoal">{c.codigo}</td>
                  <td className="px-4 py-3 text-ink">
                    {c.tipo === "percentual" ? `${c.valor}%` : formatBRL(c.valor)}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({c.tipo === "percentual" ? "%" : "fixo"})
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink">{formatValidade(c.validade)}</td>
                  <td className="px-4 py-3 text-ink">{formatUso(c.uso_atual, c.uso_max)}</td>
                  <td className="px-4 py-3 text-ink">
                    {c.valor_minimo != null ? formatBRL(c.valor_minimo) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Switch
                      checked={c.ativo}
                      onCheckedChange={() => toggleAtivo(c)}
                      className="data-[state=checked]:bg-charcoal"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => abrirEditar(c)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeletingId(c.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar cupom" : "Novo cupom"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Código</Label>
                <Input
                  value={form.codigo}
                  onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                  placeholder="EX: ALMERIA10"
                  maxLength={40}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as "percentual" | "fixo" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentual">Percentual (%)</SelectItem>
                    <SelectItem value="fixo">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{form.tipo === "percentual" ? "Desconto (%)" : "Desconto (R$)"}</Label>
                <Input
                  value={form.valor}
                  onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                  placeholder={form.tipo === "percentual" ? "10" : "25,00"}
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Valor mínimo do pedido (opcional)</Label>
                <Input
                  value={form.valor_minimo}
                  onChange={(e) => setForm((f) => ({ ...f, valor_minimo: e.target.value }))}
                  placeholder="50,00"
                  inputMode="decimal"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Válido até (opcional)</Label>
                <Input
                  type="date"
                  value={form.validade}
                  onChange={(e) => setForm((f) => ({ ...f, validade: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Usos máximos (opcional)</Label>
                <Input
                  value={form.uso_max}
                  onChange={(e) => setForm((f) => ({ ...f, uso_max: e.target.value }))}
                  placeholder="100"
                  inputMode="numeric"
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Switch
                id="cp-ativo"
                checked={form.ativo}
                onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
                className="data-[state=checked]:bg-charcoal"
              />
              <Label htmlFor="cp-ativo">Cupom ativo</Label>
            </div>

            {campanhas.length > 0 && (
              <div className="space-y-1.5">
                <Label>Restringir a campanhas (opcional)</Label>
                <div className="flex flex-wrap gap-2 rounded-md border border-input p-2">
                  {campanhas.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleMultiselect("campanha_ids", c.id)}
                      className={`rounded px-2 py-0.5 text-xs transition-colors ${
                        form.campanha_ids.includes(c.id)
                          ? "bg-charcoal text-white"
                          : "bg-muted text-charcoal hover:bg-muted/80"
                      }`}
                    >
                      {c.nome}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Sem seleção = válido para todas as campanhas
                </p>
              </div>
            )}

            {cestas.filter((c) => !c.arquivado).length > 0 && (
              <div className="space-y-1.5">
                <Label>Restringir a produtos (opcional)</Label>
                <div className="flex flex-wrap gap-2 rounded-md border border-input p-2">
                  {cestas
                    .filter((c) => !c.arquivado)
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleMultiselect("produto_ids", c.id)}
                        className={`rounded px-2 py-0.5 text-xs transition-colors ${
                          form.produto_ids.includes(c.id)
                            ? "bg-charcoal text-white"
                            : "bg-muted text-charcoal hover:bg-muted/80"
                        }`}
                      >
                        {c.nome}
                      </button>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Sem seleção = válido para todos os produtos
                </p>
              </div>
            )}

            <Button
              onClick={salvar}
              disabled={saving}
              className="w-full bg-charcoal text-white hover:bg-charcoal/90"
            >
              {saving ? "Salvando…" : editingId ? "Salvar alterações" : "Criar cupom"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cupom?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O cupom será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
