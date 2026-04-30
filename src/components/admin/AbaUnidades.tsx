import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, MapPin, Loader2, Store } from "lucide-react";
import { useAdmin, type DiaSemana } from "@/store/admin";
import { AdminSection } from "./AdminField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { geocodificarEndereco } from "@/lib/geo";

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
  const removeUnidade = useAdmin((s) => s.removeUnidadeCadastrada);
  const [geo, setGeo] = useState<string | null>(null);

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
      <div className="space-y-5">
        {unidades.map((u) => (
          <div
            key={u.id}
            className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={u.status === "ativa"}
                  onCheckedChange={(v) =>
                    setUnidade(u.id, { status: v ? "ativa" : "inativa" })
                  }
                />
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {u.status === "ativa" ? "Ativa" : "Inativa"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeUnidade(u.id)}
                className="text-terracotta hover:bg-terracotta/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

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
                  onChange={(e) =>
                    setUnidade(u.id, { endereco: e.target.value })
                  }
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
                      lat:
                        e.target.value === "" ? undefined : Number(e.target.value),
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
                      lng:
                        e.target.value === "" ? undefined : Number(e.target.value),
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
                      className="grid grid-cols-[60px_auto_1fr_1fr] items-center gap-3 rounded-md border border-border bg-background/40 px-3 py-2"
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
        ))}

        <Button
          onClick={addUnidade}
          variant="outline"
          className="w-full border-dashed border-charcoal/40 text-charcoal hover:bg-charcoal/5"
        >
          <Plus className="mr-2 h-4 w-4" /> Adicionar unidade
        </Button>
      </div>
    </AdminSection>
  );
}
