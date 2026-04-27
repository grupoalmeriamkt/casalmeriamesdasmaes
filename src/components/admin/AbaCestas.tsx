import { useAdmin } from "@/store/admin";
import { AdminSection } from "./AdminField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Package } from "lucide-react";
import { ImageUpload } from "./ImageUpload";

export function AbaCestas() {
  const cestas = useAdmin((s) => s.cestas);
  const setCesta = useAdmin((s) => s.setCesta);
  const addCesta = useAdmin((s) => s.addCesta);
  const removeCesta = useAdmin((s) => s.removeCesta);

  return (
    <AdminSection
      title="Produtos"
      icon={<Package className="h-5 w-5" />}
      description="Gerencie os produtos e ofertas que aparecem na loja."
    >
      <div className="space-y-5">
        {cestas.map((c) => (
          <div
            key={c.id}
            className="rounded-2xl border border-border bg-card p-5 shadow-soft"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={c.ativo}
                  onCheckedChange={(v) => setCesta(c.id, { ativo: v })}
                />
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {c.ativo ? "Ativa na LP" : "Inativa"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeCesta(c.id)}
                className="text-terracotta hover:bg-terracotta/10 hover:text-terracotta"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  value={c.nome}
                  onChange={(e) => setCesta(c.id, { nome: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Badge (ex: Para 2 pessoas)</Label>
                <Input
                  value={c.badge}
                  onChange={(e) => setCesta(c.id, { badge: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Preço (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={c.preco}
                  onChange={(e) =>
                    setCesta(c.id, { preco: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <ImageUpload
                  label="Foto do produto"
                  value={c.imagem}
                  onChange={(url) => setCesta(c.id, { imagem: url })}
                  folder="produtos"
                  previewClassName="h-40 w-full"
                  aspect={16 / 10}
                  aspectHint="Proporção 16:10 — recorte ajustável · WebP automático"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Descrição curta</Label>
                <Textarea
                  rows={2}
                  value={c.descricao}
                  onChange={(e) => setCesta(c.id, { descricao: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Itens (um por linha)</Label>
                <Textarea
                  rows={8}
                  value={c.itens.join("\n")}
                  onChange={(e) =>
                    setCesta(c.id, {
                      itens: e.target.value.split("\n").filter(Boolean),
                    })
                  }
                />
              </div>
            </div>

          </div>
        ))}

        <Button
          onClick={addCesta}
          variant="outline"
          className="w-full border-dashed border-charcoal/40 text-charcoal hover:bg-charcoal/5"
        >
          <Plus className="mr-2 h-4 w-4" /> Adicionar novo produto
        </Button>
      </div>
    </AdminSection>
  );
}
