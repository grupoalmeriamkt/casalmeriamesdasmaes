import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ImageUpload } from "./ImageUpload";
import { useAdmin, type CestaAdmin } from "@/store/admin";
import type { TamanhoVariante } from "@/lib/types";
import { Plus, Trash2, ImageIcon } from "lucide-react";
import { formatBRL } from "@/store/pedido";

type Props = {
  produto: CestaAdmin | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  readOnly?: boolean;
};

function novoTamanho(): TamanhoVariante {
  return { id: `tam-${Date.now()}`, label: "", preco: 0 };
}

export function ProdutoFormDialog({ produto, open, onOpenChange, readOnly }: Props) {
  const setCesta = useAdmin((s) => s.setCesta);
  const categorias = useAdmin((s) => s.categorias);
  const [draft, setDraft] = useState<CestaAdmin | null>(produto);

  useEffect(() => {
    setDraft(produto);
  }, [produto]);

  if (!draft) return null;

  const upd = (patch: Partial<CestaAdmin>) =>
    setDraft({ ...draft, ...patch } as CestaAdmin);

  const tamanhos: TamanhoVariante[] = draft.tamanhos ?? [];
  const temTamanhos = tamanhos.length > 0;

  const addTamanho = () => upd({ tamanhos: [...tamanhos, novoTamanho()] });

  const updTamanho = (id: string, patch: Partial<TamanhoVariante>) =>
    upd({
      tamanhos: tamanhos.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });

  const removeTamanho = (id: string) =>
    upd({ tamanhos: tamanhos.filter((t) => t.id !== id) });

  const salvar = () => {
    // Limpa linhas vazias dos itens só ao salvar (durante a edição elas são
    // preservadas para permitir quebrar linha / montar a lista normalmente).
    const limpo: CestaAdmin = {
      ...draft,
      itens: draft.itens.filter(Boolean),
      tamanhos: draft.tamanhos?.map((t) => ({
        ...t,
        itens: t.itens?.filter(Boolean),
      })),
    };
    setCesta(limpo.id, limpo);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{readOnly ? draft.nome : "Editar produto"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="geral" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="tamanhos">
              Tamanhos{temTamanhos ? ` (${tamanhos.length})` : ""}
            </TabsTrigger>
          </TabsList>

          {/* ─────────────── ABA GERAL ─────────────── */}
          <TabsContent value="geral">
            <fieldset disabled={readOnly} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={draft.nome} onChange={(e) => upd({ nome: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Badge</Label>
                <Input value={draft.badge} onChange={(e) => upd({ badge: e.target.value })} />
              </div>
              <div className="flex items-center gap-3 md:col-span-2">
                <Switch
                  id="ativo-switch"
                  checked={draft.ativo}
                  onCheckedChange={(v) => upd({ ativo: v })}
                  disabled={readOnly}
                />
                <Label htmlFor="ativo-switch" className="cursor-pointer">
                  {draft.ativo ? "Ativo — visível na loja" : "Inativo — não aparece na loja"}
                </Label>
              </div>
              <div className="space-y-1.5">
                <Label>{temTamanhos ? "Preço base (fallback)" : "Preço (R$)"}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.preco}
                  onChange={(e) => upd({ preco: parseFloat(e.target.value) || 0 })}
                />
                {temTamanhos && (
                  <p className="text-[11px] text-muted-foreground">
                    Usado quando nenhum tamanho é selecionado.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select
                  value={draft.categoriaId ?? "__none"}
                  onValueChange={(v) =>
                    upd({ categoriaId: v === "__none" ? undefined : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sem categoria</SelectItem>
                    {categorias.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <ImageUpload
                  label="Foto principal do produto"
                  value={draft.imagem}
                  onChange={(url) => upd({ imagem: url })}
                  folder="produtos"
                  previewClassName="h-40 w-full"
                  aspect={16 / 10}
                  aspectHint="Proporção 16:10 — recorte ajustável · WebP automático"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Descrição</Label>
                <Textarea
                  rows={2}
                  value={draft.descricao}
                  onChange={(e) => upd({ descricao: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>
                  {temTamanhos ? "Itens gerais (fallback)" : "Itens (um por linha)"}
                </Label>
                <Textarea
                  rows={temTamanhos ? 5 : 8}
                  value={draft.itens.join("\n")}
                  onChange={(e) => upd({ itens: e.target.value.split("\n") })}
                />
                {temTamanhos && (
                  <p className="text-[11px] text-muted-foreground">
                    Usados nos cards da loja e quando um tamanho não tem itens próprios.
                  </p>
                )}
              </div>
            </fieldset>
          </TabsContent>

          {/* ─────────────── ABA TAMANHOS ─────────────── */}
          <TabsContent value="tamanhos">
            <fieldset disabled={readOnly} className="space-y-3">
              {tamanhos.length === 0 && (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[12px] text-muted-foreground">
                  Sem variantes — o produto tem preço único. Adicione tamanhos (P / M / G)
                  para permitir seleção no pedido, com preço, medidas, itens e foto próprios.
                </p>
              )}

              {tamanhos.length > 0 && (
                <Accordion type="multiple" className="rounded-lg border border-border">
                  {tamanhos.map((t) => (
                    <AccordionItem
                      key={t.id}
                      value={t.id}
                      className="relative border-b px-3 last:border-b-0"
                    >
                      <AccordionTrigger className="pr-10 hover:no-underline">
                        <span className="flex items-center gap-2.5 text-left">
                          {t.imagem ? (
                            <img
                              src={t.imagem}
                              alt=""
                              className="h-9 w-9 flex-none rounded object-cover"
                            />
                          ) : (
                            <span className="flex h-9 w-9 flex-none items-center justify-center rounded bg-muted text-muted-foreground">
                              <ImageIcon className="h-4 w-4" />
                            </span>
                          )}
                          <span className="flex flex-col">
                            <span className="font-semibold">
                              {t.label || "Tamanho sem rótulo"}
                            </span>
                            <span className="text-[11px] font-normal text-muted-foreground">
                              {formatBRL(t.preco)} · {(t.itens?.length ?? 0)} itens
                            </span>
                          </span>
                        </span>
                      </AccordionTrigger>

                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => removeTamanho(t.id)}
                          className="absolute right-9 top-4 flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-terracotta"
                          aria-label="Remover tamanho"
                          title="Remover tamanho"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <AccordionContent className="space-y-4">
                        <ImageUpload
                          label="Foto deste tamanho (opcional)"
                          value={t.imagem ?? ""}
                          onChange={(url) => updTamanho(t.id, { imagem: url })}
                          folder="produtos"
                          previewClassName="h-28 w-full"
                          aspect={16 / 10}
                          aspectHint="Deixe vazio para usar a foto principal do produto."
                        />

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label>Rótulo</Label>
                            <Input
                              placeholder="P"
                              value={t.label}
                              onChange={(e) => updTamanho(t.id, { label: e.target.value })}
                              disabled={readOnly}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Preço (R$)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              placeholder="0,00"
                              value={t.preco}
                              onChange={(e) =>
                                updTamanho(t.id, { preco: parseFloat(e.target.value) || 0 })
                              }
                              disabled={readOnly}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label>Diâmetro</Label>
                            <Input
                              placeholder="13 cm"
                              value={t.diametro ?? ""}
                              onChange={(e) => updTamanho(t.id, { diametro: e.target.value })}
                              disabled={readOnly}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Fatias</Label>
                            <Input
                              type="number"
                              min={0}
                              placeholder="10"
                              value={t.fatias ?? ""}
                              onChange={(e) =>
                                updTamanho(t.id, {
                                  fatias: e.target.value ? parseInt(e.target.value) : undefined,
                                })
                              }
                              disabled={readOnly}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Peso</Label>
                            <Input
                              placeholder="1.500 g"
                              value={t.peso ?? ""}
                              onChange={(e) => updTamanho(t.id, { peso: e.target.value })}
                              disabled={readOnly}
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label>Itens do tamanho {t.label || "?"} (um por linha)</Label>
                          <Textarea
                            rows={6}
                            value={(t.itens ?? []).join("\n")}
                            onChange={(e) =>
                              updTamanho(t.id, { itens: e.target.value.split("\n") })
                            }
                            disabled={readOnly}
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Deixe vazio para usar a lista de itens gerais.
                          </p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}

              {!readOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTamanho}
                  className="w-full border-dashed"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar tamanho
                </Button>
              )}
            </fieldset>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {readOnly ? "Fechar" : "Cancelar"}
          </Button>
          {!readOnly && <Button onClick={salvar}>Salvar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
