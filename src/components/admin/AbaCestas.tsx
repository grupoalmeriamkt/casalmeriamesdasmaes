import { useState } from "react";
import { useAdmin, type CestaAdmin } from "@/store/admin";
import { AdminSection } from "./AdminField";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Package,
  MoreVertical,
  Eye,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
} from "lucide-react";
import { CategoriasDialog } from "./CategoriasDialog";
import { ProdutoFormDialog } from "./ProdutoFormDialog";
import { formatBRL } from "@/store/pedido";

export function AbaCestas() {
  const cestas = useAdmin((s) => s.cestas);
  const categorias = useAdmin((s) => s.categorias);
  const addCesta = useAdmin((s) => s.addCesta);
  const removeCesta = useAdmin((s) => s.removeCesta);
  const arquivarCesta = useAdmin((s) => s.arquivarCesta);

  const [editando, setEditando] = useState<CestaAdmin | null>(null);
  const [visualizando, setVisualizando] = useState<CestaAdmin | null>(null);
  const [excluindo, setExcluindo] = useState<CestaAdmin | null>(null);

  const nomeCategoria = (id?: string) =>
    categorias.find((c) => c.id === id)?.nome ?? "Sem categoria";

  return (
    <AdminSection
      title="Produtos"
      icon={<Package className="h-5 w-5" />}
      description="Gerencie os produtos vendidos. Apenas produtos ativos aparecem na loja."
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <CategoriasDialog />
        <Button onClick={addCesta}>
          <Plus className="mr-2 h-4 w-4" /> Adicionar produto
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {cestas.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhum produto cadastrado.
          </p>
        )}
        <ul className="divide-y divide-border">
          {cestas.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 p-3 hover:bg-charcoal/[0.02]"
            >
              <img
                src={c.imagem}
                alt={c.nome}
                className="h-14 w-20 shrink-0 rounded-md object-cover"
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-charcoal">
                    {c.nome}
                  </h3>
                  {c.arquivado && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Arquivado
                    </span>
                  )}
                  {!c.ativo && !c.arquivado && (
                    <span className="rounded-full bg-terracotta/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-terracotta">
                      Inativo
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {nomeCategoria(c.categoriaId)} · {c.badge}
                </p>
              </div>
              <span className="whitespace-nowrap font-serif text-base font-semibold text-terracotta">
                {formatBRL(c.preco)}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setVisualizando(c)}>
                    <Eye className="mr-2 h-4 w-4" /> Abrir
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEditando(c)}>
                    <Pencil className="mr-2 h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => arquivarCesta(c.id, !c.arquivado)}
                  >
                    {c.arquivado ? (
                      <>
                        <ArchiveRestore className="mr-2 h-4 w-4" /> Desarquivar
                      </>
                    ) : (
                      <>
                        <Archive className="mr-2 h-4 w-4" /> Arquivar
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setExcluindo(c)}
                    className="text-terracotta focus:text-terracotta"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      </div>

      <ProdutoFormDialog
        produto={editando}
        open={!!editando}
        onOpenChange={(v) => !v && setEditando(null)}
      />
      <ProdutoFormDialog
        produto={visualizando}
        open={!!visualizando}
        onOpenChange={(v) => !v && setVisualizando(null)}
        readOnly
      />

      <AlertDialog
        open={!!excluindo}
        onOpenChange={(v) => !v && setExcluindo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O produto{" "}
              <strong>{excluindo?.nome}</strong> será removido permanentemente.
              Considere arquivar em vez de excluir, se quiser apenas escondê-lo
              da loja.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (excluindo) removeCesta(excluindo.id);
                setExcluindo(null);
              }}
              className="bg-terracotta hover:bg-terracotta/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminSection>
  );
}
