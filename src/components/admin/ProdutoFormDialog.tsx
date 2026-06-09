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
import { ImageUpload } from "./ImageUpload";
import { useAdmin, type CestaAdmin } from "@/store/admin";
import type { TamanhoVariante } from "@/lib/types";
import { Plus, Trash2 } from "lucide-react";
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
    setCesta(draft.id, draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {readOnly ? draft.nome : "Editar produto"}
          </DialogTitle>
        </DialogHeader>

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
              label="Foto do produto"
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
            <Label>Itens (um por linha)</Label>
            <Textarea
              rows={8}
              value={draft.itens.join("\n")}
              onChange={(e) =>
                upd({ itens: e.target.value.split("\n").filter(Boolean) })
              }
            />
          </div>

          {/* ── Tamanhos / Variantes ── */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center justify-between">
              <Label>Tamanhos / Variantes</Label>
              {!readOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTamanho}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar tamanho
                </Button>
              )}
            </div>

            {tamanhos.length === 0 && (
              <p className="text-[12px] text-muted-foreground">
                Sem variantes — o produto tem preço único. Adicione tamanhos (P / M / G) para permitir seleção no pedido.
              </p>
            )}

            {tamanhos.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-border">
                {/* cabeçalho */}
                <div className="grid grid-cols-[60px_1fr_80px_80px_90px_36px] gap-1.5 bg-muted/50 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <span>Rótulo</span>
                  <span>Diâmetro</span>
                  <span>Fatias</span>
                  <span>Peso</span>
                  <span>Preço</span>
                  <span />
                </div>
                {tamanhos.map((t) => (
                  <div
                    key={t.id}
                    className="grid grid-cols-[60px_1fr_80px_80px_90px_36px] gap-1.5 border-t border-border px-3 py-2"
                  >
                    <Input
                      className="h-8 px-2 text-sm"
                      placeholder="P"
                      value={t.label}
                      onChange={(e) => updTamanho(t.id, { label: e.target.value })}
                      disabled={readOnly}
                    />
                    <Input
                      className="h-8 px-2 text-sm"
                      placeholder="13 cm"
                      value={t.diametro ?? ""}
                      onChange={(e) => updTamanho(t.id, { diametro: e.target.value })}
                      disabled={readOnly}
                    />
                    <Input
                      className="h-8 px-2 text-sm"
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
                    <Input
                      className="h-8 px-2 text-sm"
                      placeholder="1.500 g"
                      value={t.peso ?? ""}
                      onChange={(e) => updTamanho(t.id, { peso: e.target.value })}
                      disabled={readOnly}
                    />
                    <Input
                      className="h-8 px-2 text-sm"
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
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeTamanho(t.id)}
                        className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:text-terracotta"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {readOnly && <span />}
                  </div>
                ))}

                {/* linha de resumo preços */}
                {!readOnly && tamanhos.length > 0 && (
                  <div className="border-t border-border bg-muted/30 px-3 py-2 text-right text-[11px] text-muted-foreground">
                    Preços: {tamanhos.map((t) => `${t.label || "?"} ${formatBRL(t.preco)}`).join(" · ")}
                  </div>
                )}
              </div>
            )}
          </div>
        </fieldset>

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
