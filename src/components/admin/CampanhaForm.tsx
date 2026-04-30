import { useState } from "react";
import { toast } from "sonner";
import {
  useAdmin,
  type Campanha,
  type CampanhaDelivery,
  type CampanhaRetirada,
  type HorarioFuncionamento,
  type DiaSemana,
  type CestaAdmin,
} from "@/store/admin";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Truck,
  Store,
  Copy,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";

const DIAS: { id: DiaSemana; label: string }[] = [
  { id: "seg", label: "Seg" },
  { id: "ter", label: "Ter" },
  { id: "qua", label: "Qua" },
  { id: "qui", label: "Qui" },
  { id: "sex", label: "Sex" },
  { id: "sab", label: "Sáb" },
  { id: "dom", label: "Dom" },
];

type Props = { campanha: Campanha };

export function CampanhaForm({ campanha }: Props) {
  const setCampanha = useAdmin((s) => s.setCampanha);
  const setDelivery = useAdmin((s) => s.setCampanhaDelivery);
  const setRetirada = useAdmin((s) => s.setCampanhaRetirada);
  const unidades = useAdmin((s) => s.unidades);
  const cestas = useAdmin((s) => s.cestas);

  const linkPublico = `${typeof window !== "undefined" ? window.location.origin : ""}/${campanha.slug}`;
  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(linkPublico);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <div className="space-y-6">
      {/* ========= Cabeçalho — informações gerais ========= */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-charcoal">
          Informações gerais
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Nome da campanha</Label>
            <Input
              value={campanha.nome}
              onChange={(e) =>
                setCampanha(campanha.id, { nome: e.target.value })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Slug do link (/...)</Label>
            <Input
              value={campanha.slug}
              onChange={(e) =>
                setCampanha(campanha.id, {
                  slug: e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "-")
                    .replace(/-+/g, "-"),
                })
              }
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Link público gerado</Label>
            <div className="flex gap-2">
              <Input value={linkPublico} readOnly className="font-mono text-xs" />
              <Button type="button" variant="outline" onClick={copiarLink}>
                <Copy className="mr-2 h-4 w-4" /> Copiar
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={campanha.status}
              onValueChange={(v) =>
                setCampanha(campanha.id, { status: v as "ativa" | "pausada" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="pausada">Pausada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Unidade vinculada</Label>
            <Select
              value={campanha.unidadeId ?? ""}
              onValueChange={(v) => setCampanha(campanha.id, { unidadeId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma unidade" />
              </SelectTrigger>
              <SelectContent>
                {unidades
                  .filter((u) => u.status === "ativa")
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ========= Abas Delivery / Retirada ========= */}
      <Tabs defaultValue="delivery">
        <TabsList className="bg-charcoal/5">
          <TabsTrigger value="delivery" className="gap-2">
            <Truck className="h-4 w-4" /> Delivery
          </TabsTrigger>
          <TabsTrigger value="retirada" className="gap-2">
            <Store className="h-4 w-4" /> Retirada
          </TabsTrigger>
        </TabsList>

        <TabsContent value="delivery" className="mt-4">
          <DeliveryTab
            campanha={campanha}
            cestas={cestas}
            onPatch={(p) => setDelivery(campanha.id, p)}
          />
        </TabsContent>
        <TabsContent value="retirada" className="mt-4">
          <RetiradaTab
            campanha={campanha}
            cestas={cestas}
            onPatch={(p) => setRetirada(campanha.id, p)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================================================ */
/*                          DELIVERY                            */
/* ============================================================ */

function DeliveryTab({
  campanha,
  cestas,
  onPatch,
}: {
  campanha: Campanha;
  cestas: CestaAdmin[];
  onPatch: (p: Partial<CampanhaDelivery>) => void;
}) {
  const d = campanha.delivery;
  const [bairroInput, setBairroInput] = useState("");

  return (
    <div className="space-y-5">
      <Bloco>
        <ToggleLinha
          label="Delivery ativo"
          checked={d.ativo}
          onChange={(v) => onPatch({ ativo: v })}
        />
      </Bloco>

      <Bloco titulo="Pedido">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Valor mínimo de pedido (R$)">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={d.valorMinimo}
              onChange={(e) =>
                onPatch({ valorMinimo: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <Field label="Tempo estimado (min)">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={d.tempoEstimadoMin}
                onChange={(e) =>
                  onPatch({ tempoEstimadoMin: Number(e.target.value) || 0 })
                }
              />
              <span className="text-muted-foreground">até</span>
              <Input
                type="number"
                min={0}
                value={d.tempoEstimadoMax}
                onChange={(e) =>
                  onPatch({ tempoEstimadoMax: Number(e.target.value) || 0 })
                }
              />
            </div>
          </Field>
        </div>
      </Bloco>

      <Bloco titulo="Taxa de entrega">
        <div className="space-y-3">
          <Select
            value={d.taxa.tipo}
            onValueChange={(v) => {
              if (v === "fixa") onPatch({ taxa: { tipo: "fixa", valor: 0 } });
              else onPatch({ taxa: { tipo: "faixa", faixas: [] } });
            }}
          >
            <SelectTrigger className="max-w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixa">Taxa fixa</SelectItem>
              <SelectItem value="faixa">Por faixa de km</SelectItem>
            </SelectContent>
          </Select>

          {d.taxa.tipo === "fixa" ? (
            <Field label="Valor da taxa (R$)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={d.taxa.valor}
                onChange={(e) =>
                  onPatch({
                    taxa: { tipo: "fixa", valor: Number(e.target.value) || 0 },
                  })
                }
                className="max-w-[200px]"
              />
            </Field>
          ) : (
            <div className="space-y-2">
              {d.taxa.faixas.map((f, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-md border border-border bg-background/40 p-2"
                >
                  <Field label="Até km">
                    <Input
                      type="number"
                      min={0}
                      value={f.ateKm}
                      onChange={(e) => {
                        const faixas = [...d.taxa.faixas];
                        faixas[i] = { ...f, ateKm: Number(e.target.value) || 0 };
                        onPatch({ taxa: { tipo: "faixa", faixas } });
                      }}
                    />
                  </Field>
                  <Field label="Valor (R$)">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={f.valor}
                      onChange={(e) => {
                        const faixas = [...d.taxa.faixas];
                        faixas[i] = { ...f, valor: Number(e.target.value) || 0 };
                        onPatch({ taxa: { tipo: "faixa", faixas } });
                      }}
                    />
                  </Field>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="self-end text-terracotta hover:bg-terracotta/10"
                    onClick={() => {
                      const faixas = d.taxa.faixas.filter((_, idx) => idx !== i);
                      onPatch({ taxa: { tipo: "faixa", faixas } });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                className="border-dashed"
                onClick={() =>
                  onPatch({
                    taxa: {
                      tipo: "faixa",
                      faixas: [...d.taxa.faixas, { ateKm: 5, valor: 0 }],
                    },
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" /> Adicionar faixa
              </Button>
            </div>
          )}
        </div>
      </Bloco>

      <Bloco titulo="Área de atendimento">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Raio (km)">
            <Input
              type="number"
              min={0}
              value={d.raioKm}
              onChange={(e) => onPatch({ raioKm: Number(e.target.value) || 0 })}
              className="max-w-[160px]"
            />
          </Field>
          <Field label="Bairros atendidos">
            <div className="flex flex-wrap gap-1.5">
              {d.bairros.map((b, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full bg-charcoal/5 px-2.5 py-1 text-xs text-charcoal"
                >
                  {b}
                  <button
                    onClick={() =>
                      onPatch({
                        bairros: d.bairros.filter((_, idx) => idx !== i),
                      })
                    }
                    className="text-terracotta hover:opacity-70"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                value={bairroInput}
                placeholder="Nome do bairro"
                onChange={(e) => setBairroInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && bairroInput.trim()) {
                    e.preventDefault();
                    onPatch({ bairros: [...d.bairros, bairroInput.trim()] });
                    setBairroInput("");
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => {
                  if (bairroInput.trim()) {
                    onPatch({ bairros: [...d.bairros, bairroInput.trim()] });
                    setBairroInput("");
                  }
                }}
              >
                Adicionar
              </Button>
            </div>
          </Field>
        </div>
      </Bloco>

      <Bloco titulo="Horário de funcionamento (Delivery)">
        <HorarioSemana
          horario={d.horario}
          onChange={(h) => onPatch({ horario: h })}
        />
      </Bloco>

      <Bloco titulo="Configuração do Quiz de Delivery">
        <p className="text-xs text-muted-foreground">
          Datas e janelas de horário oferecidas no Quiz desta forma de
          entrega.
        </p>
        <DatasHorarios
          datas={d.datas}
          horarios={d.horarios}
          onDatas={(datas) => onPatch({ datas })}
          onHorarios={(horarios) => onPatch({ horarios })}
        />
      </Bloco>

      <Bloco titulo="Upsell no Delivery">
        <ToggleLinha
          label="Habilitar upsell"
          checked={d.upsellAtivo}
          onChange={(v) => onPatch({ upsellAtivo: v })}
        />
        {d.upsellAtivo && (
          <UpsellSeletor
            cestas={cestas}
            selecionadosIds={d.upsellProdutoIds}
            onChange={(ids) => onPatch({ upsellProdutoIds: ids })}
          />
        )}
      </Bloco>
    </div>
  );
}

/* ============================================================ */
/*                          RETIRADA                            */
/* ============================================================ */

function RetiradaTab({
  campanha,
  cestas,
  onPatch,
}: {
  campanha: Campanha;
  cestas: CestaAdmin[];
  onPatch: (p: Partial<CampanhaRetirada>) => void;
}) {
  const r = campanha.retirada;

  return (
    <div className="space-y-5">
      <Bloco>
        <ToggleLinha
          label="Retirada ativa"
          checked={r.ativo}
          onChange={(v) => onPatch({ ativo: v })}
        />
      </Bloco>

      <Bloco titulo="Pedido">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Valor mínimo de pedido (R$)">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={r.valorMinimo}
              onChange={(e) =>
                onPatch({ valorMinimo: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <Field label="Tempo de preparo (min)">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={r.tempoPreparoMin}
                onChange={(e) =>
                  onPatch({ tempoPreparoMin: Number(e.target.value) || 0 })
                }
              />
              <span className="text-muted-foreground">até</span>
              <Input
                type="number"
                min={0}
                value={r.tempoPreparoMax}
                onChange={(e) =>
                  onPatch({ tempoPreparoMax: Number(e.target.value) || 0 })
                }
              />
            </div>
          </Field>
        </div>
      </Bloco>

      <Bloco titulo="Local de retirada">
        <Field label="Endereço de retirada">
          <Textarea
            rows={2}
            value={r.enderecoRetirada}
            onChange={(e) => onPatch({ enderecoRetirada: e.target.value })}
            placeholder="Endereço completo onde o cliente retira o pedido"
          />
        </Field>
      </Bloco>

      <Bloco titulo="Horário de funcionamento (Retirada)">
        <HorarioSemana
          horario={r.horario}
          onChange={(h) => onPatch({ horario: h })}
        />
      </Bloco>

      <Bloco titulo="Configuração do Quiz de Retirada">
        <p className="text-xs text-muted-foreground">
          Datas e janelas de horário oferecidas no Quiz para retirada.
        </p>
        <DatasHorarios
          datas={r.datas}
          horarios={r.horarios}
          onDatas={(datas) => onPatch({ datas })}
          onHorarios={(horarios) => onPatch({ horarios })}
        />
      </Bloco>

      <Bloco titulo="Upsell na Retirada">
        <ToggleLinha
          label="Habilitar upsell"
          checked={r.upsellAtivo}
          onChange={(v) => onPatch({ upsellAtivo: v })}
        />
        {r.upsellAtivo && (
          <UpsellSeletor
            cestas={cestas}
            selecionadosIds={r.upsellProdutoIds}
            onChange={(ids) => onPatch({ upsellProdutoIds: ids })}
          />
        )}
      </Bloco>
    </div>
  );
}

/* ============================================================ */
/*                       SHARED PIECES                          */
/* ============================================================ */

function Bloco({
  titulo,
  children,
}: {
  titulo?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      {titulo && (
        <h4 className="text-xs font-bold uppercase tracking-widest text-charcoal">
          {titulo}
        </h4>
      )}
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ToggleLinha({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-charcoal">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function HorarioSemana({
  horario,
  onChange,
}: {
  horario: HorarioFuncionamento;
  onChange: (h: HorarioFuncionamento) => void;
}) {
  return (
    <div className="space-y-1.5">
      {DIAS.map(({ id, label }) => {
        const dia = horario[id];
        return (
          <div
            key={id}
            className="grid grid-cols-[60px_auto_1fr_1fr] items-center gap-3 rounded-md border border-border bg-background/40 p-2"
          >
            <span className="text-xs font-medium uppercase text-charcoal">
              {label}
            </span>
            <Switch
              checked={dia.ativo}
              onCheckedChange={(v) =>
                onChange({ ...horario, [id]: { ...dia, ativo: v } })
              }
            />
            <Input
              type="time"
              value={dia.inicio}
              disabled={!dia.ativo}
              onChange={(e) =>
                onChange({
                  ...horario,
                  [id]: { ...dia, inicio: e.target.value },
                })
              }
            />
            <Input
              type="time"
              value={dia.fim}
              disabled={!dia.ativo}
              onChange={(e) =>
                onChange({ ...horario, [id]: { ...dia, fim: e.target.value } })
              }
            />
          </div>
        );
      })}
    </div>
  );
}

function DatasHorarios({
  datas,
  horarios,
  onDatas,
  onHorarios,
}: {
  datas: { id: string; label: string; ativa: boolean }[];
  horarios: { label: string; ativo: boolean }[];
  onDatas: (d: { id: string; label: string; ativa: boolean }[]) => void;
  onHorarios: (h: { label: string; ativo: boolean }[]) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-semibold text-charcoal">Datas</p>
        <div className="space-y-1.5">
          {datas.map((d, i) => (
            <div
              key={d.id}
              className="grid grid-cols-[auto_1fr_auto] gap-2 rounded-md border border-border bg-background/40 p-2"
            >
              <Switch
                checked={d.ativa}
                onCheckedChange={(v) =>
                  onDatas(datas.map((x, idx) => (idx === i ? { ...x, ativa: v } : x)))
                }
              />
              <Input
                value={d.label}
                onChange={(e) =>
                  onDatas(
                    datas.map((x, idx) =>
                      idx === i ? { ...x, label: e.target.value } : x,
                    ),
                  )
                }
              />
              <Button
                variant="ghost"
                size="icon"
                className="text-terracotta hover:bg-terracotta/10"
                onClick={() => onDatas(datas.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          className="mt-2 border-dashed"
          onClick={() =>
            onDatas([
              ...datas,
              { id: `d-${Date.now()}`, label: "Nova data", ativa: true },
            ])
          }
        >
          <Plus className="mr-2 h-4 w-4" /> Adicionar data
        </Button>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-charcoal">Janelas de horário</p>
        <div className="space-y-1.5">
          {horarios.map((h, i) => (
            <div
              key={i}
              className="grid grid-cols-[auto_1fr_auto] gap-2 rounded-md border border-border bg-background/40 p-2"
            >
              <Switch
                checked={h.ativo}
                onCheckedChange={(v) =>
                  onHorarios(
                    horarios.map((x, idx) =>
                      idx === i ? { ...x, ativo: v } : x,
                    ),
                  )
                }
              />
              <Input
                value={h.label}
                onChange={(e) =>
                  onHorarios(
                    horarios.map((x, idx) =>
                      idx === i ? { ...x, label: e.target.value } : x,
                    ),
                  )
                }
              />
              <Button
                variant="ghost"
                size="icon"
                className="text-terracotta hover:bg-terracotta/10"
                onClick={() =>
                  onHorarios(horarios.filter((_, idx) => idx !== i))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          className="mt-2 border-dashed"
          onClick={() =>
            onHorarios([...horarios, { label: "Nova janela", ativo: true }])
          }
        >
          <Plus className="mr-2 h-4 w-4" /> Adicionar janela
        </Button>
      </div>
    </div>
  );
}

function UpsellSeletor({
  cestas,
  selecionadosIds,
  onChange,
}: {
  cestas: CestaAdmin[];
  selecionadosIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const ativos = cestas.filter((c) => c.ativo && !c.arquivado);
  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const toggle = (id: string) => {
    if (selecionadosIds.includes(id)) {
      onChange(selecionadosIds.filter((x) => x !== id));
    } else {
      onChange([...selecionadosIds, id]);
    }
  };

  const mover = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= selecionadosIds.length) return;
    const next = [...selecionadosIds];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold text-charcoal">
          Selecione os produtos do upsell
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {ativos.map((c) => {
            const sel = selecionadosIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className={`flex items-center gap-3 rounded-lg border-2 bg-card p-2 text-left transition-all ${
                  sel ? "border-terracotta" : "border-border hover:border-charcoal/40"
                }`}
              >
                <img
                  src={c.imagem}
                  alt={c.nome}
                  className="h-12 w-12 flex-none rounded-md object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-charcoal">
                    {c.nome}
                  </p>
                  <p className="text-xs text-muted-foreground">{fmt(c.preco)}</p>
                </div>
                <span
                  className={`flex h-5 w-5 flex-none items-center justify-center rounded-md border ${
                    sel
                      ? "border-terracotta bg-terracotta text-white"
                      : "border-border"
                  }`}
                >
                  {sel ? "✓" : ""}
                </span>
              </button>
            );
          })}
          {ativos.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhum produto ativo cadastrado.
            </p>
          )}
        </div>
      </div>

      {selecionadosIds.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-charcoal">
            Ordem de exibição
          </p>
          <div className="space-y-1.5">
            {selecionadosIds.map((id, i) => {
              const p = cestas.find((c) => c.id === id);
              if (!p) return null;
              return (
                <div
                  key={id}
                  className="flex items-center gap-2 rounded-md border border-border bg-background/40 p-2"
                >
                  <span className="w-5 text-center text-xs font-bold text-muted-foreground">
                    {i + 1}
                  </span>
                  <img
                    src={p.imagem}
                    alt={p.nome}
                    className="h-8 w-8 flex-none rounded object-cover"
                  />
                  <p className="min-w-0 flex-1 truncate text-sm text-charcoal">
                    {p.nome}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => mover(i, -1)}
                    disabled={i === 0}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => mover(i, 1)}
                    disabled={i === selecionadosIds.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-terracotta hover:bg-terracotta/10"
                    onClick={() => toggle(id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
