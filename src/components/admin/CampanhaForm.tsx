import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  useAdmin,
  useCategorias,
  type Campanha,
  type CampanhaDelivery,
  type CampanhaRetirada,
  type CestaAdmin,
} from "@/store/admin";
import { validarSlug, normalizarSlug } from "@/lib/slugs";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  Truck,
  Store,
  Copy,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  X,
  Settings,
  CalendarIcon,
} from "lucide-react";

type Props = { campanha: Campanha };

export function CampanhaForm({ campanha }: Props) {
  const setCampanha = useAdmin((s) => s.setCampanha);
  const setDelivery = useAdmin((s) => s.setCampanhaDelivery);
  const setRetirada = useAdmin((s) => s.setCampanhaRetirada);
  const cestas = useAdmin((s) => s.cestas);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="info">
        <TabsList className="bg-charcoal/5">
          <TabsTrigger value="info" className="gap-2">
            <Settings className="h-4 w-4" /> Informações Gerais
          </TabsTrigger>
          <TabsTrigger value="delivery" className="gap-2">
            <Truck className="h-4 w-4" /> Delivery
          </TabsTrigger>
          <TabsTrigger value="retirada" className="gap-2">
            <Store className="h-4 w-4" /> Retirada
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <InfoGeralTab
            campanha={campanha}
            cestas={cestas}
            onPatch={(p) => setCampanha(campanha.id, p)}
          />
        </TabsContent>

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
/*                  INFORMAÇÕES GERAIS                          */
/* ============================================================ */

function InfoGeralTab({
  campanha,
  cestas,
  onPatch,
}: {
  campanha: Campanha;
  cestas: CestaAdmin[];
  onPatch: (p: Partial<Campanha>) => void;
}) {
  const unidades = useAdmin((s) => s.unidades);
  const linkPublico = `${typeof window !== "undefined" ? window.location.origin : ""}/${campanha.slug}`;
  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(linkPublico);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const textos = campanha.textos;

  return (
    <div className="space-y-5">
      <Bloco titulo="Identificação">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome da campanha">
            <Input
              value={campanha.nome}
              onChange={(e) => onPatch({ nome: e.target.value })}
            />
          </Field>
          <Field label="Slug do link (/...)">
            <Input
              value={campanha.slug}
              onChange={(e) =>
                onPatch({
                  slug: e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "-")
                    .replace(/-+/g, "-"),
                })
              }
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Link público gerado">
              <div className="flex gap-2">
                <Input
                  value={linkPublico}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button type="button" variant="outline" onClick={copiarLink}>
                  <Copy className="mr-2 h-4 w-4" /> Copiar
                </Button>
              </div>
            </Field>
          </div>
          <Field label="Status">
            <Select
              value={campanha.status}
              onValueChange={(v) =>
                onPatch({ status: v as "ativa" | "pausada" })
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
          </Field>
          <Field label="Unidade vinculada">
            <Select
              value={campanha.unidadeId ?? ""}
              onValueChange={(v) => onPatch({ unidadeId: v })}
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
          </Field>
        </div>
      </Bloco>

      <Bloco titulo="Produtos Principais">
        <p className="text-xs text-muted-foreground">
          Produtos em destaque exibidos na página pública desta campanha.
        </p>
        <ProdutosSeletor
          cestas={cestas}
          selecionadosIds={campanha.produtosPrincipaisIds}
          onChange={(ids) => onPatch({ produtosPrincipaisIds: ids })}
        />
      </Bloco>

      <Bloco titulo="Upsell">
        <ToggleLinha
          label="Habilitar upsell"
          checked={campanha.upsellAtivo}
          onChange={(v) => onPatch({ upsellAtivo: v })}
        />
        {campanha.upsellAtivo && (
          <ProdutosSeletor
            cestas={cestas}
            selecionadosIds={campanha.upsellProdutoIds}
            onChange={(ids) => onPatch({ upsellProdutoIds: ids })}
          />
        )}
      </Bloco>

      <Bloco titulo="Datas">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Data de início">
            <DatePickerCampo
              value={campanha.dataInicio}
              onChange={(v) => onPatch({ dataInicio: v })}
            />
          </Field>
          <Field label="Data de encerramento">
            <DatePickerCampo
              value={campanha.dataFim}
              onChange={(v) => onPatch({ dataFim: v })}
            />
          </Field>
          <Field label="Data limite para encomendas">
            <DatePickerCampo
              value={campanha.dataLimitePedidos}
              onChange={(v) => onPatch({ dataLimitePedidos: v })}
            />
          </Field>
        </div>
      </Bloco>

      <Bloco titulo="Textos">
        <div className="grid gap-4">
          <Field label="Título da campanha (página pública)">
            <Input
              value={textos.titulo}
              onChange={(e) =>
                onPatch({ textos: { ...textos, titulo: e.target.value } })
              }
            />
          </Field>
          <Field label="Descrição ou subtítulo">
            <Input
              value={textos.subtitulo}
              onChange={(e) =>
                onPatch({ textos: { ...textos, subtitulo: e.target.value } })
              }
            />
          </Field>
          <Field label="Mensagem de boas-vindas (início do Quiz)">
            <Textarea
              rows={2}
              value={textos.boasVindas}
              onChange={(e) =>
                onPatch({ textos: { ...textos, boasVindas: e.target.value } })
              }
            />
          </Field>
          <Field label="Texto de confirmação (após finalizar)">
            <Textarea
              rows={2}
              value={textos.confirmacao}
              onChange={(e) =>
                onPatch({ textos: { ...textos, confirmacao: e.target.value } })
              }
            />
          </Field>
        </div>
      </Bloco>
    </div>
  );
}

function DatePickerCampo({
  value,
  onChange,
}: {
  value?: string;
  onChange: (v: string | undefined) => void;
}) {
  const date = value ? new Date(value) : undefined;
  return (
    <div className="flex gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "dd/MM/yyyy") : "Selecione…"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => onChange(d ? d.toISOString() : undefined)}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      {date && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onChange(undefined)}
          title="Limpar"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
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
            (() => {
              const faixas = d.taxa.faixas;
              return (
                <div className="space-y-2">
                  {faixas.map((f, i) => (
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
                            const next = [...faixas];
                            next[i] = { ...f, ateKm: Number(e.target.value) || 0 };
                            onPatch({ taxa: { tipo: "faixa", faixas: next } });
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
                            const next = [...faixas];
                            next[i] = { ...f, valor: Number(e.target.value) || 0 };
                            onPatch({ taxa: { tipo: "faixa", faixas: next } });
                          }}
                        />
                      </Field>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="self-end text-terracotta hover:bg-terracotta/10"
                        onClick={() => {
                          const next = faixas.filter((_, idx) => idx !== i);
                          onPatch({ taxa: { tipo: "faixa", faixas: next } });
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
                          faixas: [...faixas, { ateKm: 5, valor: 0 }],
                        },
                      })
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" /> Adicionar faixa
                  </Button>
                </div>
              );
            })()
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
        <p className="text-xs text-muted-foreground">
          Datas e janelas de horário oferecidas no Quiz desta forma de entrega.
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
          <ProdutosSeletor
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
          <ProdutosSeletor
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

function ProdutosSeletor({
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
          Selecione os produtos
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
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {fmt(p.preco)}
                  </span>
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
