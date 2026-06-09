import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useAdmin,
  useCategorias,
  type Campanha,
  type CampanhaDelivery,
  type CampanhaRetirada,
  type CampanhaUpsell,
  type CestaAdmin,
  type UpsellItem,
} from "@/store/admin";
import { validarSlug, normalizarSlug } from "@/lib/slugs";
import { formatDatePtBR, dateRange, toISODateString } from "@/lib/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import { ImageUpload } from "./ImageUpload";
import { ImageCropDialog } from "./ImageCropDialog";
import { uploadOptimizedImage } from "@/lib/imageUpload";
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
const MapaZonasLazy = lazy(() =>
  import("./MapaZonas").then((m) => ({ default: m.MapaZonas })),
);

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
  Library,
  Upload,
  Loader2,
  Check,
  Link2,
} from "lucide-react";
import {
  listarTokensDaCampanha,
  criarTokenPedidos,
  revogarToken,
  urlPublicaPedidos,
  type ShareToken,
} from "@/lib/shareToken";

type Props = { campanha: Campanha };

export function CampanhaForm({ campanha }: Props) {
  const setCampanha = useAdmin((s) => s.setCampanha);
  const setDelivery = useAdmin((s) => s.setCampanhaDelivery);
  const setRetirada = useAdmin((s) => s.setCampanhaRetirada);
  const cestas = useAdmin((s) => s.cestas);
  const unidades = useAdmin((s) => s.unidades);

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
          <TabsTrigger value="links" className="gap-2">
            <Link2 className="h-4 w-4" /> Links
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
            unidades={unidades}
          />
        </TabsContent>
        <TabsContent value="retirada" className="mt-4">
          <RetiradaTab
            campanha={campanha}
            cestas={cestas}
            onPatch={(p) => setRetirada(campanha.id, p)}
          />
        </TabsContent>
        <TabsContent value="links" className="mt-4">
          <LinksTab campanhaId={campanha.id} campanhaNome={campanha.nome} />
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
  const todasCampanhas = useAdmin((s) => s.campanhas);
  const linkPublico = `${typeof window !== "undefined" ? window.location.origin : ""}/${campanha.slug}`;
  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(linkPublico);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  // Slug: edição local com validação no blur
  const [slugInput, setSlugInput] = useState(campanha.slug);
  const [slugErro, setSlugErro] = useState<string | null>(null);
  useEffect(() => {
    setSlugInput(campanha.slug);
    setSlugErro(null);
  }, [campanha.id, campanha.slug]);

  const aplicarSlug = () => {
    const usadosPorOutras = todasCampanhas
      .filter((c) => c.id !== campanha.id)
      .map((c) => c.slug);
    const res = validarSlug(slugInput, usadosPorOutras);
    if (!res.ok) {
      setSlugErro(res.mensagem);
      toast.error(res.mensagem);
      return;
    }
    setSlugErro(null);
    if (res.slug !== campanha.slug) {
      onPatch({ slug: res.slug });
      setSlugInput(res.slug);
      toast.success("Slug atualizado.");
    } else {
      // normalizou para o mesmo valor — só atualiza input
      setSlugInput(res.slug);
    }
  };

  const textos = campanha.textos;
  const semProdutos = (campanha.produtosPrincipaisIds ?? []).length === 0;

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
              value={slugInput}
              onChange={(e) => {
                setSlugInput(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "-")
                    .replace(/-+/g, "-"),
                );
                if (slugErro) setSlugErro(null);
              }}
              onBlur={aplicarSlug}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className={slugErro ? "border-terracotta focus-visible:ring-terracotta" : ""}
            />
            {slugErro && (
              <p className="mt-1 text-xs text-terracotta">{slugErro}</p>
            )}
            {!slugErro && normalizarSlug(slugInput) !== campanha.slug && (
              <p className="mt-1 text-xs text-muted-foreground">
                Pressione Enter ou clique fora para aplicar.
              </p>
            )}
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

      <Bloco titulo="Social Image">
        <p className="text-xs text-muted-foreground">
          Imagem exibida ao compartilhar o link da campanha (WhatsApp, redes sociais). Proporção recomendada 1200 × 630 px.
        </p>
        <SocialImagePicker
          value={campanha.socialImageUrl ?? ""}
          onChange={(url) => onPatch({ socialImageUrl: url })}
        />
      </Bloco>

      <Bloco titulo="Produtos Principais">
        <p className="text-xs text-muted-foreground">
          Selecione os produtos que serão exibidos no Quiz desta campanha. Apenas
          os produtos marcados aqui aparecerão para o cliente.
        </p>
        {semProdutos && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            ⚠️ Nenhum produto selecionado — o Quiz desta campanha ficará sem
            opções para o cliente. Selecione ao menos um produto abaixo.
          </div>
        )}
        <ProdutosSeletor
          cestas={cestas}
          selecionadosIds={campanha.produtosPrincipaisIds}
          onChange={(ids) => onPatch({ produtosPrincipaisIds: ids })}
        />
      </Bloco>

      {(() => {
        const upsell: CampanhaUpsell = campanha.upsell ?? { ativo: false, itens: [] };
        return (
          <Bloco titulo="Upsell (todos os modos)">
            <p className="text-xs text-muted-foreground">
              Itens oferecidos como adicional no Quiz, independente de delivery ou
              retirada. Inclua produtos do catálogo (ex: sobremesas), Cartãozinho
              com mensagem personalizada e Foto Polaroid.
            </p>
            <ToggleLinha
              label="Habilitar upsell"
              checked={upsell.ativo}
              onChange={(v) => onPatch({ upsell: { ...upsell, ativo: v } })}
            />
            {upsell.ativo && (
              <UpsellEditor
                cestas={cestas}
                upsell={upsell}
                onChange={(up: CampanhaUpsell) => onPatch({ upsell: up })}
              />
            )}
          </Bloco>
        );
      })()}

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
          <Field label="Tag/Badge (exibida no cabeçalho do quiz e site — deixe vazio para ocultar)">
            <Input
              value={textos.eyebrow ?? ""}
              placeholder="Ex: 🌸 Dia das Mães"
              onChange={(e) =>
                onPatch({ textos: { ...textos, eyebrow: e.target.value || undefined } })
              }
            />
          </Field>
          <Field label="Eyebrow do Passo 1 (deixe vazio para usar padrão)">
            <Input
              value={textos.passo1Eyebrow ?? ""}
              placeholder="Presenteie com carinho"
              onChange={(e) =>
                onPatch({ textos: { ...textos, passo1Eyebrow: e.target.value || undefined } })
              }
            />
          </Field>
          <Field label="Título do Passo 1 (deixe vazio para usar padrão)">
            <Input
              value={textos.passo1Titulo ?? ""}
              placeholder="Qual cesta você escolhe?"
              onChange={(e) =>
                onPatch({ textos: { ...textos, passo1Titulo: e.target.value || undefined } })
              }
            />
          </Field>
          <Field label="Badge de prazo do Passo 1 (substitui a data automática — deixe vazio para usar a data)">
            <Input
              value={textos.passo1Badge ?? ""}
              placeholder="📦 Encomendas abertas!"
              onChange={(e) =>
                onPatch({ textos: { ...textos, passo1Badge: e.target.value || undefined } })
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
  cestas: _cestas,
  unidades,
  onPatch,
}: {
  campanha: Campanha;
  cestas: CestaAdmin[];
  unidades: import("@/store/admin").UnidadeCadastrada[];
  onPatch: (p: Partial<CampanhaDelivery>) => void;
}) {
  // Defesa contra campanha.delivery ausente em dados legados
  const d = (campanha.delivery ?? {}) as CampanhaDelivery;

  const taxa = d?.taxa ?? { tipo: "fixa" as const, valor: 0 };
  const datas = d?.datas ?? [];
  const horarios = d?.horarios ?? [];

  const unidade = unidades.find((u) => u.id === campanha.unidadeId);
  const centroLat = d?.centroLat ?? unidade?.lat ?? -23.5505;
  const centroLng = d?.centroLng ?? unidade?.lng ?? -46.6333;

  return (
    <div className="space-y-5">
      <Bloco>
        <ToggleLinha
          label="Delivery ativo"
          checked={d.ativo ?? false}
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
              value={d.valorMinimo ?? 0}
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
                value={d.tempoEstimadoMin ?? 40}
                onChange={(e) =>
                  onPatch({ tempoEstimadoMin: Number(e.target.value) || 0 })
                }
              />
              <span className="text-muted-foreground">até</span>
              <Input
                type="number"
                min={0}
                value={d.tempoEstimadoMax ?? 60}
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
            value={taxa.tipo}
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

          {taxa.tipo === "fixa" ? (
            <Field label="Valor da taxa (R$)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={taxa.tipo === "fixa" ? taxa.valor : 0}
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
              const faixas = taxa.tipo === "faixa" ? taxa.faixas : [];
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

      <Bloco titulo="Área de atendimento (Zonas)">
        <ToggleLinha
          label="Usar zonas de entrega"
          checked={d.zonas?.ativo ?? false}
          onChange={(v) =>
            onPatch({ zonas: { ...(d.zonas ?? { zonas: [] }), ativo: v } })
          }
        />
        {d.zonas?.ativo && (
          <Suspense
            fallback={
              <div className="h-80 animate-pulse rounded-xl bg-muted" />
            }
          >
            <MapaZonasLazy
              centroLat={centroLat}
              centroLng={centroLng}
              zonas={d.zonas.zonas}
              onChange={(zonas) => onPatch({ zonas: { ativo: true, zonas } })}
            />
          </Suspense>
        )}
        {!d.zonas?.ativo && (
          <p className="text-xs text-muted-foreground">
            Zonas desativadas — todos os endereços são aceitos no checkout. Ative para delimitar áreas específicas com frete por zona.
          </p>
        )}
      </Bloco>

      <Bloco titulo="Horário de funcionamento (Delivery)">
        <p className="text-xs text-muted-foreground">
          Datas e janelas de horário oferecidas no Quiz desta forma de entrega.
        </p>
        <DatasHorarios
          datas={datas}
          horarios={horarios}
          onDatas={(datas) => onPatch({ datas })}
          onHorarios={(horarios) => onPatch({ horarios })}
        />
      </Bloco>

      {/* Upsell agora vive em "Informações Gerais" — único e aplicado a delivery + retirada. */}
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

      {/* Upsell agora vive em "Informações Gerais" — único e aplicado a delivery + retirada. */}
    </div>
  );
}

/* ============================================================ */
/*                        LINKS TAB                             */
/* ============================================================ */

function LinksTab({ campanhaId, campanhaNome }: { campanhaId: string; campanhaNome: string }) {
  const [tokens, setTokens] = useState<ShareToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [iniciado, setIniciado] = useState(false);

  const carregar = async () => {
    const data = await listarTokensDaCampanha(campanhaId);
    setTokens(data);
  };

  useEffect(() => {
    carregar().then(() => setIniciado(true));
  }, [campanhaId]); // eslint-disable-line react-hooks/exhaustive-deps

  const gerarLink = async () => {
    setLoading(true);
    const t = await criarTokenPedidos(undefined, campanhaId);
    setLoading(false);
    if (!t) { toast.error("Não foi possível gerar o link."); return; }
    toast.success("Link criado.");
    await carregar();
  };

  const revogar = async (token: string) => {
    if (!confirm("Revogar este link? Quem tiver a URL perderá acesso.")) return;
    const ok = await revogarToken(token);
    if (!ok) { toast.error("Falha ao revogar."); return; }
    toast.success("Link revogado.");
    await carregar();
  };

  const copiar = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <div className="space-y-4">
      <Bloco titulo="Links de acompanhamento de pedidos">
        <p className="text-xs text-muted-foreground">
          Compartilhe com a equipe de produção para acompanhar os pedidos de <strong>{campanhaNome}</strong> em tempo real, sem precisar de login.
        </p>
        <Button
          size="sm"
          onClick={gerarLink}
          disabled={loading}
          className="bg-charcoal text-white hover:bg-charcoal/90"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Gerar link
        </Button>

        {iniciado && tokens.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">
            Nenhum link gerado ainda.
          </p>
        )}

        {tokens.length > 0 && (
          <ul className="space-y-2">
            {tokens.map((t) => {
              const url = urlPublicaPedidos(t.token);
              const data = new Date(t.criado_em).toLocaleString("pt-BR");
              return (
                <li
                  key={t.token}
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-background p-2.5 ring-1 ring-border"
                >
                  <div className="flex flex-1 flex-col min-w-0">
                    <code className="truncate text-xs text-charcoal">{url}</code>
                    <span className="text-[10px] text-muted-foreground">Criado em {data}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => copiar(url)}>
                    <Copy className="mr-1 h-3 w-3" /> Copiar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => revogar(t.token)}
                    className="text-terracotta hover:text-terracotta"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </li>
              );
            })}
          </ul>
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

function gerarLabelHora(inicio: string, fim: string): string {
  return `Entre ${inicio.padStart(2, "0")}h e ${fim.padStart(2, "0")}h`;
}

const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

const BLOCOS_PADRAO = [
  { inicio: "06", fim: "08" },
  { inicio: "08", fim: "10" },
  { inicio: "10", fim: "12" },
  { inicio: "12", fim: "14" },
  { inicio: "14", fim: "16" },
  { inicio: "16", fim: "18" },
  { inicio: "18", fim: "20" },
  { inicio: "20", fim: "22" },
];

const LABELS_BLOCOS_PADRAO = new Set(
  BLOCOS_PADRAO.map((b) => `Entre ${b.inicio}h e ${b.fim}h`),
);

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
  const [mostrarCustom, setMostrarCustom] = useState(false);
  const [customInicio, setCustomInicio] = useState("06");
  const [customFim, setCustomFim] = useState("08");

  const isIso = (id: string) => /^\d{4}-\d{2}-\d{2}$/.test(id);

  // Calendar selected dates as Date[]
  const datasIso = datas
    .filter((d) => isIso(d.id))
    .map((d) => {
      const [y, m, day] = d.id.split("-").map(Number);
      return new Date(y, m - 1, day, 12);
    });

  const today = new Date();
  const fromMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const toMonth = (() => {
    const isoIds = datas.filter((d) => isIso(d.id)).map((d) => d.id).sort();
    if (isoIds.length > 0) {
      const last = isoIds[isoIds.length - 1];
      const [y, m] = last.split("-").map(Number);
      return new Date(y, m + 1, 1);
    }
    return new Date(today.getFullYear(), today.getMonth() + 6, 1);
  })();

  function handleCalendarSelect(dates?: Date[]) {
    const newDates = dates ?? [];
    const newIsoIds = new Set(newDates.map(toISODateString));
    const kept = datas.filter((d) => !isIso(d.id) || newIsoIds.has(d.id));
    const existingIds = new Set(datas.map((d) => d.id));
    const added: typeof datas = [];
    for (const date of newDates) {
      const iso = toISODateString(date);
      if (!existingIds.has(iso)) {
        added.push({ id: iso, label: formatDatePtBR(date), ativa: true });
      }
    }
    const merged = [...kept, ...added];
    merged.sort((a, b) => a.id.localeCompare(b.id));
    onDatas(merged);
  }

  // Horários helpers
  function labelBloco(b: { inicio: string; fim: string }) {
    return `Entre ${b.inicio}h e ${b.fim}h`;
  }

  function isBlocoAtivo(b: { inicio: string; fim: string }) {
    return horarios.some((h) => h.label === labelBloco(b) && h.ativo);
  }

  function toggleBloco(b: { inicio: string; fim: string }) {
    const lbl = labelBloco(b);
    const exists = horarios.find((h) => h.label === lbl);
    if (exists) {
      onHorarios(horarios.map((h) => (h.label === lbl ? { ...h, ativo: !h.ativo } : h)));
    } else {
      onHorarios([...horarios, { label: lbl, ativo: true }]);
    }
  }

  const horariosCustom = horarios.filter((h) => !LABELS_BLOCOS_PADRAO.has(h.label));

  const selectClass =
    "h-9 flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* ── Datas ── */}
      <div>
        <p className="mb-2 text-xs font-semibold text-charcoal">Datas</p>
        <div className="overflow-hidden rounded-lg border border-border bg-background/40">
          <Calendar
            mode="multiple"
            selected={datasIso}
            onSelect={handleCalendarSelect}
            fromMonth={fromMonth}
            toMonth={toMonth}
            locale={ptBR}
          />
        </div>
        {datas.length === 0 && (
          <p className="mt-2 text-xs text-charcoal/50">
            Clique nos dias do calendário para adicionar datas disponíveis.
          </p>
        )}
        {datas.length > 0 && (
          <div className="mt-2 space-y-1">
            {datas.map((d, i) => (
              <div
                key={d.id}
                className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1.5"
              >
                <Switch
                  checked={d.ativa}
                  onCheckedChange={(v) =>
                    onDatas(datas.map((x, idx) => (idx === i ? { ...x, ativa: v } : x)))
                  }
                />
                <span className={cn("flex-1 truncate text-xs", !d.ativa && "opacity-50")}>
                  {d.label}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-terracotta hover:bg-terracotta/10"
                  onClick={() => onDatas(datas.filter((_, idx) => idx !== i))}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Horários ── */}
      <div>
        <p className="mb-2 text-xs font-semibold text-charcoal">Janelas de horário</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BLOCOS_PADRAO.map((b) => {
            const ativo = isBlocoAtivo(b);
            return (
              <button
                key={`${b.inicio}-${b.fim}`}
                type="button"
                onClick={() => toggleBloco(b)}
                className={cn(
                  "rounded-lg px-2 py-2 text-xs font-medium transition-colors",
                  ativo
                    ? "bg-charcoal text-white"
                    : "border border-sand/70 bg-background text-charcoal hover:border-charcoal/40",
                )}
              >
                {b.inicio}h–{b.fim}h
              </button>
            );
          })}
        </div>

        {horariosCustom.length > 0 && (
          <div className="mt-3 space-y-1">
            <p className="text-[11px] text-charcoal/50">Janelas personalizadas</p>
            {horariosCustom.map((h) => (
              <div
                key={h.label}
                className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1.5"
              >
                <Switch
                  checked={h.ativo}
                  onCheckedChange={(v) =>
                    onHorarios(horarios.map((x) => (x.label === h.label ? { ...x, ativo: v } : x)))
                  }
                />
                <span className="flex-1 text-xs">{h.label}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-terracotta hover:bg-terracotta/10"
                  onClick={() => onHorarios(horarios.filter((x) => x.label !== h.label))}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {mostrarCustom ? (
          <div className="mt-3 space-y-2 rounded-md border border-dashed border-border bg-background/30 p-3">
            <p className="text-xs font-medium text-charcoal">Janela personalizada</p>
            <div className="flex items-center gap-1.5">
              <select
                value={customInicio}
                onChange={(e) => setCustomInicio(e.target.value)}
                className={selectClass}
              >
                {HORAS.map((h) => (
                  <option key={h} value={h}>{h}h</option>
                ))}
              </select>
              <span className="shrink-0 text-xs text-charcoal/50">às</span>
              <select
                value={customFim}
                onChange={(e) => setCustomFim(e.target.value)}
                className={selectClass}
              >
                {HORAS.map((h) => (
                  <option key={h} value={h}>{h}h</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  const lbl = gerarLabelHora(customInicio, customFim);
                  if (!horarios.find((h) => h.label === lbl)) {
                    onHorarios([...horarios, { label: lbl, ativo: true }]);
                  }
                  setMostrarCustom(false);
                }}
              >
                Adicionar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMostrarCustom(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setMostrarCustom(true)}
            className="mt-3 text-[11px] text-charcoal/50 underline-offset-2 hover:text-charcoal hover:underline"
          >
            + janela personalizada
          </button>
        )}
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
  const categorias = useCategorias();
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

  // Agrupa produtos por categoria para facilitar localizar (ex: Sobremesas).
  const grupos = (() => {
    const buckets = new Map<string, { nome: string; itens: CestaAdmin[] }>();
    for (const c of ativos) {
      const cat = categorias.find((k) => k.id === c.categoriaId);
      const id = cat?.id ?? "_outros";
      const nome = cat?.nome ?? "Sem categoria";
      if (!buckets.has(id)) buckets.set(id, { nome, itens: [] });
      buckets.get(id)!.itens.push(c);
    }
    return Array.from(buckets.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR"),
    );
  })();

  const renderCard = (c: CestaAdmin) => {
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
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <p className="text-xs font-semibold text-charcoal">
          Selecione os produtos
        </p>
        {ativos.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Nenhum produto ativo cadastrado.
          </p>
        )}
        {grupos.map((g) => (
          <div key={g.nome} className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {g.nome}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {g.itens.map(renderCard)}
            </div>
          </div>
        ))}
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

/* ============================================================ */
/*                       UPSELL EDITOR                          */
/* ============================================================ */

function UpsellEditor({
  cestas,
  upsell,
  onChange,
}: {
  cestas: CestaAdmin[];
  upsell: CampanhaUpsell;
  onChange: (u: CampanhaUpsell) => void;
}) {
  const ativos = cestas.filter((c) => c.ativo && !c.arquivado);
  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const setItens = (itens: UpsellItem[]) => onChange({ ...upsell, itens });

  const addProduto = (produtoId: string) => {
    if (
      upsell.itens.some(
        (i) => i.tipo === "produto" && i.produtoId === produtoId,
      )
    )
      return;
    setItens([
      ...upsell.itens,
      { tipo: "produto", itemId: `up-${produtoId}`, produtoId },
    ]);
  };

  const addCartao = () =>
    setItens([
      ...upsell.itens,
      {
        tipo: "cartao",
        itemId: `cartao-${Date.now()}`,
        nome: "Cartãozinho Especial",
        preco: 0,
        maxCaracteres: 150,
      },
    ]);

  const addPolaroid = () =>
    setItens([
      ...upsell.itens,
      {
        tipo: "polaroid",
        itemId: `polaroid-${Date.now()}`,
        nome: "Foto Polaroid",
        preco: 0,
      },
    ]);

  const remove = (itemId: string) =>
    setItens(upsell.itens.filter((i) => i.itemId !== itemId));

  const mover = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= upsell.itens.length) return;
    const next = [...upsell.itens];
    [next[idx], next[j]] = [next[j], next[idx]];
    setItens(next);
  };

  const patch = (itemId: string, p: Partial<UpsellItem>) =>
    setItens(
      upsell.itens.map((i) =>
        i.itemId === itemId ? ({ ...i, ...p } as UpsellItem) : i,
      ),
    );

  const temCartao = upsell.itens.some((i) => i.tipo === "cartao");
  const temPolaroid = upsell.itens.some((i) => i.tipo === "polaroid");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCartao}
          disabled={temCartao}
        >
          <Plus className="mr-1 h-3 w-3" /> Cartãozinho Especial
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addPolaroid}
          disabled={temPolaroid}
        >
          <Plus className="mr-1 h-3 w-3" /> Foto Polaroid
        </Button>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-charcoal">
          Produtos do catálogo
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {ativos.map((c) => {
            const sel = upsell.itens.some(
              (i) => i.tipo === "produto" && i.produtoId === c.id,
            );
            return (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  sel ? remove(`up-${c.id}`) : addProduto(c.id)
                }
                className={`flex items-center gap-2 rounded-lg border-2 bg-card p-2 text-left transition-all ${
                  sel ? "border-terracotta" : "border-border hover:border-charcoal/40"
                }`}
              >
                <img
                  src={c.imagem}
                  alt=""
                  className="h-10 w-10 flex-none rounded object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-charcoal">
                    {c.nome}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(c.preco)}
                  </p>
                </div>
                <span
                  className={`flex h-5 w-5 flex-none items-center justify-center rounded border ${
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
        </div>
      </div>

      {upsell.itens.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-charcoal">
            Itens do upsell ({upsell.itens.length})
          </p>
          <div className="space-y-2">
            {upsell.itens.map((it, i) => {
              const produto =
                it.tipo === "produto"
                  ? cestas.find((c) => c.id === it.produtoId)
                  : null;
              return (
                <div
                  key={it.itemId}
                  className="rounded-md border border-border bg-background/40 p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-center text-xs font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="rounded-full bg-charcoal/10 px-2 py-0.5 text-[10px] font-bold uppercase text-charcoal">
                      {it.tipo}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm text-charcoal">
                      {it.tipo === "produto"
                        ? (produto?.nome ?? "(produto removido)")
                        : it.nome}
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
                      disabled={i === upsell.itens.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-terracotta hover:bg-terracotta/10"
                      onClick={() => remove(it.itemId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {it.tipo === "cartao" && (
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Field label="Nome">
                        <Input
                          value={it.nome}
                          onChange={(e) =>
                            patch(it.itemId, { nome: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Preço (R$)">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={it.preco}
                          onChange={(e) =>
                            patch(it.itemId, {
                              preco: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </Field>
                      <Field label="Máx. caracteres">
                        <Input
                          type="number"
                          min={10}
                          max={500}
                          value={it.maxCaracteres}
                          onChange={(e) =>
                            patch(it.itemId, {
                              maxCaracteres: Number(e.target.value) || 150,
                            })
                          }
                        />
                      </Field>
                    </div>
                  )}

                  {it.tipo === "polaroid" && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="Nome">
                        <Input
                          value={it.nome}
                          onChange={(e) =>
                            patch(it.itemId, { nome: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Preço (R$)">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={it.preco}
                          onChange={(e) =>
                            patch(it.itemId, {
                              preco: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </Field>
                    </div>
                  )}

                  {it.tipo === "produto" && produto && (
                    <p className="text-xs text-muted-foreground">
                      {fmt(produto.preco)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================ */
/*                    SOCIAL IMAGE PICKER                       */
/* ============================================================ */

const BUCKET = "admin-uploads";
const LIBRARY_FOLDERS = ["campanhas", "produtos", "aparencia", "geral"];
const OG_ASPECT = 1200 / 630;

function SocialImagePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [aba, setAba] = useState<"upload" | "biblioteca">("upload");
  const [imagens, setImagens] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [pendente, setPendente] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function carregarBiblioteca() {
    setCarregando(true);
    try {
      const urls: string[] = [];
      for (const folder of LIBRARY_FOLDERS) {
        const { data } = await supabase.storage
          .from(BUCKET)
          .list(folder, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
        for (const item of data ?? []) {
          if (item.name.endsWith(".webp") || item.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            const { data: pub } = supabase.storage
              .from(BUCKET)
              .getPublicUrl(`${folder}/${item.name}`);
            urls.push(pub.publicUrl);
          }
        }
      }
      setImagens(urls);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (aba === "biblioteca" && imagens.length === 0) {
      void carregarBiblioteca();
    }
  }, [aba]);

  async function handleCroppedBlob(blob: Blob) {
    setUploading(true);
    try {
      const url = await uploadOptimizedImage(blob, "campanhas");
      onChange(url);
      setPendente(null);
      toast.success("Social image enviada com sucesso");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Preview da imagem atual */}
      {value && (
        <div className="relative">
          <img
            src={value}
            alt="Social image"
            className="h-40 w-full rounded-xl object-cover ring-1 ring-border"
          />
          <div className="absolute right-2 top-2 flex gap-1">
            <button
              type="button"
              onClick={() => { setAba("upload"); inputRef.current?.click(); }}
              className="rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
              title="Trocar imagem"
            >
              <Upload className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
              title="Remover"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">
            1200 × 630
          </span>
        </div>
      )}

      {/* Abas */}
      <div className="flex rounded-lg border border-border bg-muted/40 p-0.5 gap-0.5">
        {(["upload", "biblioteca"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setAba(t)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              aba === t
                ? "bg-white shadow-sm text-charcoal"
                : "text-muted-foreground hover:text-charcoal"
            }`}
          >
            {t === "upload" ? (
              <><Upload className="h-3.5 w-3.5" /> Enviar nova</>
            ) : (
              <><Library className="h-3.5 w-3.5" /> Biblioteca</>
            )}
          </button>
        ))}
      </div>

      {aba === "upload" && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setPendente(f);
              e.target.value = "";
            }}
          />
          {!value && (
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="w-full border-dashed"
            >
              {uploading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…</>
                : <><Upload className="mr-2 h-4 w-4" /> Selecionar imagem</>
              }
            </Button>
          )}
          {value && (
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" /> Trocar imagem
            </Button>
          )}
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Proporção 1200×630 px · recorte ajustável · WebP automático
          </p>
          <ImageCropDialog
            open={!!pendente}
            file={pendente}
            aspect={OG_ASPECT}
            onCancel={() => setPendente(null)}
            onConfirm={handleCroppedBlob}
          />
        </div>
      )}

      {aba === "biblioteca" && (
        <div>
          {carregando ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando biblioteca…
            </div>
          ) : imagens.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma imagem encontrada na biblioteca.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {imagens.map((url) => {
                const selecionada = url === value;
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => onChange(selecionada ? "" : url)}
                    className={`group relative overflow-hidden rounded-lg ring-2 transition-all ${
                      selecionada
                        ? "ring-terracotta"
                        : "ring-transparent hover:ring-charcoal/30"
                    }`}
                  >
                    <img
                      src={url}
                      alt=""
                      className="aspect-video w-full object-cover"
                      loading="lazy"
                    />
                    {selecionada && (
                      <div className="absolute inset-0 flex items-center justify-center bg-terracotta/30">
                        <Check className="h-5 w-5 text-white drop-shadow" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void carregarBiblioteca()}
            disabled={carregando}
            className="mt-2 text-xs text-muted-foreground"
          >
            <Loader2 className={`mr-1.5 h-3 w-3 ${carregando ? "animate-spin" : ""}`} />
            Recarregar
          </Button>
        </div>
      )}
    </div>
  );
}
