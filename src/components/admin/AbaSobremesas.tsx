import { useAdmin } from "@/store/admin";
import { AdminSection } from "./AdminField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, PlusCircle } from "lucide-react";
import { ImageUpload } from "./ImageUpload";

export function AbaSobremesas() {
  const sobremesas = useAdmin((s) => s.sobremesas);
  const setSobremesa = useAdmin((s) => s.setSobremesa);
  const add = useAdmin((s) => s.addSobremesa);
  const remove = useAdmin((s) => s.removeSobremesa);

  return (
    <AdminSection
      title="Upsell"
      icon={<PlusCircle className="h-5 w-5" />}
      description="Itens adicionais oferecidos antes do pagamento."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {sobremesas.map((s) => (
          <div
            key={s.id}
            className="rounded-2xl border border-border bg-card p-5 shadow-soft"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={s.ativo}
                  onCheckedChange={(v) => setSobremesa(s.id, { ativo: v })}
                />
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {s.ativo ? "Ativa" : "Inativa"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(s.id)}
                className="text-terracotta hover:bg-terracotta/10 hover:text-terracotta"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  value={s.nome}
                  onChange={(e) => setSobremesa(s.id, { nome: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Preço (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={s.preco}
                  onChange={(e) =>
                    setSobremesa(s.id, {
                      preco: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea
                  rows={2}
                  value={s.descricao}
                  onChange={(e) =>
                    setSobremesa(s.id, { descricao: e.target.value })
                  }
                />
              </div>
              <ImageUpload
                label="Foto do item"
                value={s.imagem}
                onChange={(url) => setSobremesa(s.id, { imagem: url })}
                folder="upsell"
                previewClassName="h-32 w-full"
                aspect={1}
                aspectHint="Proporção 1:1 (quadrada) — recorte ajustável · WebP automático"
              />
            </div>
          </div>
        ))}
      </div>
      <Button
        onClick={add}
        variant="outline"
        className="mt-5 w-full border-dashed border-charcoal/40 text-charcoal hover:bg-charcoal/5"
      >
        <Plus className="mr-2 h-4 w-4" /> Adicionar novo item
      </Button>
    </AdminSection>
  );
}
