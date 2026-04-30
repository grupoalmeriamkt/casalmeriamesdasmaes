import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAdmin } from "@/store/admin";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CategoriasDialog() {
  const categorias = useAdmin((s) => s.categorias);
  const addCategoria = useAdmin((s) => s.addCategoria);
  const setCategoria = useAdmin((s) => s.setCategoria);
  const removeCategoria = useAdmin((s) => s.removeCategoria);
  const [nova, setNova] = useState("");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Gerenciar categorias</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Categorias de produtos</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              placeholder="Nome da nova categoria"
              onKeyDown={(e) => {
                if (e.key === "Enter" && nova.trim()) {
                  addCategoria(nova.trim());
                  setNova("");
                }
              }}
            />
            <Button
              onClick={() => {
                if (nova.trim()) {
                  addCategoria(nova.trim());
                  setNova("");
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {categorias.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma categoria cadastrada.
              </p>
            )}
            {categorias.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5"
              >
                <Input
                  value={c.nome}
                  onChange={(e) => setCategoria(c.id, { nome: e.target.value })}
                  className="border-0 shadow-none focus-visible:ring-0"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm(`Excluir categoria "${c.nome}"?`)) {
                      removeCategoria(c.id);
                    }
                  }}
                  className="text-terracotta hover:bg-terracotta/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
