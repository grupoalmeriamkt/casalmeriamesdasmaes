import { useAdmin } from "@/store/admin";
import { AdminSection, AdminToggle } from "./AdminField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Truck, MapPin, Loader2, Store, Clock, Calendar } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { geocodificarEndereco } from "@/lib/geo";

export function AbaEntrega() {
  const entrega = useAdmin((s) => s.entrega);
  const setEntrega = useAdmin((s) => s.setEntrega);
  const [geocodificando, setGeocodificando] = useState<string | null>(null);

  const updUnidade = (id: string, patch: Partial<(typeof entrega.unidades)[number]>) =>
    setEntrega({
      unidades: entrega.unidades.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    });
  const addUnidade = () =>
    setEntrega({
      unidades: [
        ...entrega.unidades,
        { id: `u-${Date.now()}`, nome: "Nova unidade", endereco: "", ativa: true },
      ],
    });
  const rmUnidade = (id: string) =>
    setEntrega({ unidades: entrega.unidades.filter((u) => u.id !== id) });

  const geocodificar = async (id: string) => {
    const u = entrega.unidades.find((x) => x.id === id);
    if (!u || !u.endereco.trim()) {
      toast.error("Preencha o endereço da unidade primeiro.");
      return;
    }
    setGeocodificando(id);
    const coords = await geocodificarEndereco(u.endereco);
    setGeocodificando(null);
    if (!coords) {
      toast.error("Não foi possível localizar este endereço.");
      return;
    }
    updUnidade(id, { lat: coords.lat, lng: coords.lng });
    toast.success("Coordenadas atualizadas.");
  };

  const updData = (id: string, patch: Partial<(typeof entrega.datas)[number]>) =>
    setEntrega({
      datas: entrega.datas.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    });
  const addData = () =>
    setEntrega({
      datas: [
        ...entrega.datas,
        { id: `d-${Date.now()}`, label: "Nova data", ativa: true },
      ],
    });
  const rmData = (id: string) =>
    setEntrega({ datas: entrega.datas.filter((d) => d.id !== id) });

  const updHorario = (i: number, patch: Partial<(typeof entrega.horarios)[number]>) =>
    setEntrega({
      horarios: entrega.horarios.map((h, idx) => (idx === i ? { ...h, ...patch } : h)),
    });
  const addHorario = () =>
    setEntrega({
      horarios: [...entrega.horarios, { label: "Nova janela", ativo: true }],
    });
  const rmHorario = (i: number) =>
    setEntrega({ horarios: entrega.horarios.filter((_, idx) => idx !== i) });

  const restricao = entrega.restricaoRaio;
  const setRestricao = (patch: Partial<typeof restricao>) =>
    setEntrega({ restricaoRaio: { ...restricao, ...patch } });

  return (
    <AdminSection
      title="Entrega e retirada"
      icon={<Truck className="h-5 w-5" />}
      description="Configure as opções de recebimento, unidades, datas e horários."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <AdminToggle
          label="Habilitar entrega (delivery)"
          checked={entrega.delivery}
          onCheckedChange={(v) => setEntrega({ delivery: v })}
        />
        <AdminToggle
          label="Habilitar retirada na loja"
          checked={entrega.retirada}
          onCheckedChange={(v) => setEntrega({ retirada: v })}
        />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-charcoal">
          Unidades de retirada
        </h3>
        <div className="space-y-3">
          {entrega.unidades.map((u) => (
            <div
              key={u.id}
              className="space-y-3 rounded-lg border border-border bg-card p-3"
            >
              <div className="grid gap-3 md:grid-cols-[auto_1fr_2fr_auto]">
                <Switch
                  checked={u.ativa}
                  onCheckedChange={(v) => updUnidade(u.id, { ativa: v })}
                />
                <Input
                  value={u.nome}
                  onChange={(e) => updUnidade(u.id, { nome: e.target.value })}
                  placeholder="Nome da unidade"
                />
                <Input
                  value={u.endereco}
                  onChange={(e) => updUnidade(u.id, { endereco: e.target.value })}
                  placeholder="Endereço completo"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => rmUnidade(u.id)}
                  className="text-terracotta hover:bg-terracotta/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Latitude</Label>
                  <Input
                    type="number"
                    step="any"
                    value={u.lat ?? ""}
                    onChange={(e) =>
                      updUnidade(u.id, {
                        lat: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                    placeholder="-15.7942"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Longitude</Label>
                  <Input
                    type="number"
                    step="any"
                    value={u.lng ?? ""}
                    onChange={(e) =>
                      updUnidade(u.id, {
                        lng: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                    placeholder="-47.8822"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => geocodificar(u.id)}
                    disabled={geocodificando === u.id}
                    className="w-full md:w-auto"
                  >
                    {geocodificando === u.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <MapPin className="mr-2 h-4 w-4" />
                    )}
                    Localizar pelo endereço
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          onClick={addUnidade}
          className="mt-3 border-dashed border-charcoal/40 text-charcoal"
        >
          <Plus className="mr-2 h-4 w-4" /> Adicionar unidade
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-charcoal">
              Restrição por raio (delivery)
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Quando ativo, o checkout valida o CEP do cliente e bloqueia pedidos
              fora do raio configurado a partir da unidade base.
            </p>
          </div>
          <Switch
            checked={restricao.ativo}
            onCheckedChange={(v) => setRestricao({ ativo: v })}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Unidade base</Label>
            <Select
              value={restricao.unidadeBaseId}
              onValueChange={(v) => setRestricao({ unidadeBaseId: v })}
              disabled={!restricao.ativo}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a unidade central" />
              </SelectTrigger>
              <SelectContent>
                {entrega.unidades.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}
                    {u.lat == null || u.lng == null ? " — sem coordenadas" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Raio (km)</Label>
            <Input
              type="number"
              min={1}
              max={200}
              value={restricao.raioKm}
              onChange={(e) =>
                setRestricao({ raioKm: Math.max(1, Number(e.target.value) || 1) })
              }
              disabled={!restricao.ativo}
            />
          </div>
        </div>
        {restricao.ativo &&
          (() => {
            const base = entrega.unidades.find(
              (u) => u.id === restricao.unidadeBaseId,
            );
            if (!base || base.lat == null || base.lng == null) {
              return (
                <p className="mt-3 text-xs text-terracotta">
                  Atenção: a unidade base não tem coordenadas. Use “Localizar pelo
                  endereço” acima para configurá-las antes de ativar a restrição.
                </p>
              );
            }
            return null;
          })()}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-charcoal">
          Dias disponíveis
        </h3>
        <div className="space-y-3">
          {entrega.datas.map((d) => (
            <div
              key={d.id}
              className="grid gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-[auto_1fr_auto]"
            >
              <Switch
                checked={d.ativa}
                onCheckedChange={(v) => updData(d.id, { ativa: v })}
              />
              <Input
                value={d.label}
                onChange={(e) => updData(d.id, { label: e.target.value })}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => rmData(d.id)}
                className="text-terracotta hover:bg-terracotta/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          onClick={addData}
          className="mt-3 border-dashed border-charcoal/40 text-charcoal"
        >
          <Plus className="mr-2 h-4 w-4" /> Adicionar data
        </Button>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-charcoal">
          Horários (janelas)
        </h3>
        <div className="space-y-3">
          {entrega.horarios.map((h, i) => (
            <div
              key={i}
              className="grid gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-[auto_1fr_auto]"
            >
              <Switch
                checked={h.ativo}
                onCheckedChange={(v) => updHorario(i, { ativo: v })}
              />
              <Input
                value={h.label}
                onChange={(e) => updHorario(i, { label: e.target.value })}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => rmHorario(i)}
                className="text-terracotta hover:bg-terracotta/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          onClick={addHorario}
          className="mt-3 border-dashed border-charcoal/40 text-charcoal"
        >
          <Plus className="mr-2 h-4 w-4" /> Adicionar horário
        </Button>
      </div>
    </AdminSection>
  );
}

// helper que será reusado em config geral
export function _toLabel(v: string) {
  return v;
}
// re-export label
export { Label };
