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
import { ImageUpload } from "./ImageUpload";
import { useAdmin, type CestaAdmin } from "@/store/admin";

type Props = {
  produto: CestaAdmin | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  readOnly?: boolean;
};

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
          <div className="space-y-1.5">
            <Label>Preço (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={draft.preco}
              onChange={(e) => upd({ preco: parseFloat(e.target.value) || 0 })}
            />
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
