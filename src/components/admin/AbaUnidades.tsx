import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, MapPin, Loader2, Store, ChevronDown, Copy } from "lucide-react";
import { useAdmin, type DiaSemana, type UnidadeCadastrada } from "@/store/admin";
import { AdminSection } from "./AdminField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { geocodificarEndereco } from "@/lib/geo";
import { cn } from "@/lib/utils";

const DIAS: { id: DiaSemana; label: string }[] = [
  { id: "seg", label: "Seg" },
  { id: "ter", label: "Ter" },
  { id: "qua", label: "Qua" },
  { id: "qui", label: "Qui" },
  { id: "sex", label: "Sex" },
  { id: "sab", label: "Sáb" },
  { id: "dom", label: "Dom" },
];

export function AbaUnidades() {
  const unidades = useAdmin((s) => s.unidades);
  const setUnidade = useAdmin((s) => s.setUnidadeCadastrada);
  const addUnidade = useAdmin((s) => s.addUnidadeCadastrada);
  const duplicateUnidade = useAdmin((s) => s.duplicateUnidadeCadastrada);
  const removeUnidade = useAdmin((s) => s.removeUnidadeCadastrada);

  // IDs no set = colapsados; ausentes = expandidos (novo item entra expandido automaticamente)
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());
  const [geo, setGeo] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<UnidadeCadastrada | null>(null);

  const toggleColapso = (id: string) =>
    setColapsados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const localizar = async (id: string) => {
    const u = unidades.find((x) => x.id === id);
    if (!u || !u.endereco.trim()) {
      toast.error("Preencha o endereço da unidade primeiro.");
      return;
    }
    setGeo(id);
    const coords = await geocodificarEndereco(u.endereco);
    setGeo(null);
    if (!coords) {
      toast.error("Não foi possível localizar este endereço.");
      return;
    }
    setUnidade(id, { lat: coords.lat, lng: coords.lng });
    toast.success("Coordenadas atualizadas.");
  };

  return (
    <AdminSection
      title="Unidades"
      icon={<Store className="h-5 w-5" />}
      description="Cadastre as lojas físicas. Elas ficam disponíveis para seleção em todo o sistema."
    >
      <div className="space-y-3">
        {unidades.map((u) => {
          const aberto = !colapsados.has(u.id);
          return (
            <div
              key={u.id}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
            >
              {/* ── Cabeçalho ── */}
              <div className="flex items-center gap-2 px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleColapso(u.id)}
                  className="flex flex-1 items-center gap-2.5 text-left min-w-0"
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-charcoal/50 transition-transform duration-200",
                      !aberto && "-rotate-90",
                    )}
                  />
                  <span className="truncate font-medium text-charcoal">{u.nome || "Nova unidade"}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      u.status === "ativa"
                        ? "bg-olive/10 text-olive"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {u.status === "ativa" ? "Ativa" : "Inativa"}
                  </span>
                </button>

                <Switch
                  checked={u.status === "ativa"}
                  onCheckedChange={(v) =>
                    setUnidade(u.id, { status: v ? "ativa" : "inativa" })
                  }
                />

                <Button
                  variant="ghost"
                  size="icon"
                  title="Duplicar unidade"
                  onClick={() => duplicateUnidade(u.id)}
                  className="text-charcoal/60 hover:text-charcoal"
                >
                  <Copy className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  title="Excluir unidade"
                  onClick={() => setExcluindo(u)}
                  className="text-terracotta hover:bg-terracotta/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* ── Corpo colapsável ── */}
              {aberto && (
                <div className="space-y-4 border-t border-border px-5 pb-5 pt-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Nome</Label>
                      <Input
                        value={u.nome}
                        onChange={(e) => setUnidade(u.id, { nome: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Raio de entrega (km)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={200}
                        value={u.raioEntregaKm}
                        onChange={(e) =>
                          setUnidade(u.id, {
                            raioEntregaKm: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label>Endereço completo</Label>
                      <Input
                        value={u.endereco}
                        onChange={(e) => setUnidade(u.id, { endereco: e.target.value })}
                        placeholder="Rua, número, bairro, cidade-UF"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Latitude</Label>
                      <Input
                        type="number"
                        step="any"
                        value={u.lat ?? ""}
                        onChange={(e) =>
                          setUnidade(u.id, {
                            lat: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Longitude</Label>
                      <Input
                        type="number"
                        step="any"
                        value={u.lng ?? ""}
                        onChange={(e) =>
                          setUnidade(u.id, {
                            lng: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Button
                        variant="outline"
                        onClick={() => localizar(u.id)}
                        disabled={geo === u.id}
                      >
                        {geo === u.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <MapPin className="mr-2 h-4 w-4" />
                        )}
                        Localizar pelo endereço
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Horário de funcionamento</Label>
                    <div className="space-y-2">
                      {DIAS.map((d) => {
                        const h = u.horarioFuncionamento[d.id];
                        return (
                          <div
                            key={d.id}
                            className="admin-card grid grid-cols-1 gap-3 p-3 sm:grid-cols-[60px_auto_1fr_1fr] sm:items-center sm:gap-3"
                          >
                            <span className="text-sm font-medium text-charcoal">
                              {d.label}
                            </span>
                            <Switch
                              checked={h.ativo}
                              onCheckedChange={(v) =>
                                setUnidade(u.id, {
                                  horarioFuncionamento: {
                                    ...u.horarioFuncionamento,
                                    [d.id]: { ...h, ativo: v },
                                  },
                                })
                              }
                            />
                            <Input
                              type="time"
                              value={h.inicio}
                              disabled={!h.ativo}
                              onChange={(e) =>
                                setUnidade(u.id, {
                                  horarioFuncionamento: {
                                    ...u.horarioFuncionamento,
                                    [d.id]: { ...h, inicio: e.target.value },
                                  },
                                })
                              }
                            />
                            <Input
                              type="time"
                              value={h.fim}
                              disabled={!h.ativo}
                              onChange={(e) =>
                                setUnidade(u.id, {
                                  horarioFuncionamento: {
                                    ...u.horarioFuncionamento,
                                    [d.id]: { ...h, fim: e.target.value },
                                  },
                                })
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <Button
          onClick={addUnidade}
          variant="outline"
          className="w-full border-dashed border-charcoal/40 text-charcoal hover:bg-charcoal/5"
        >
          <Plus className="mr-2 h-4 w-4" /> Adicionar unidade
        </Button>
      </div>

      {/* ── Confirmação de exclusão ── */}
      <AlertDialog open={!!excluindo} onOpenChange={(v) => !v && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir unidade?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  A unidade <strong className="text-charcoal">{excluindo?.nome}</strong> será
                  removida permanentemente e desvinculada de todas as campanhas.
                </p>
                <p className="rounded-md bg-terracotta/8 px-3 py-2 text-terracotta">
                  ⚠️ Esta ação não pode ser desfeita. Considere desativar a unidade em vez de excluir.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (excluindo) removeUnidade(excluindo.id);
                setExcluindo(null);
              }}
              className="bg-terracotta hover:bg-terracotta/90"
            >
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminSection>
  );
}
