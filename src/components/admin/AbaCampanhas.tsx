import { useState } from "react";
import { toast } from "sonner";
import { Megaphone, Plus, Copy, Trash2, ArrowLeft, Star } from "lucide-react";
import { useAdmin } from "@/store/admin";
import { AdminSection } from "./AdminField";
import { Button } from "@/components/ui/button";
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
import { CampanhaForm } from "./CampanhaForm";

export function AbaCampanhas() {
  const campanhas = useAdmin((s) => s.campanhas);
  const addCampanha = useAdmin((s) => s.addCampanha);
  const removeCampanha = useAdmin((s) => s.removeCampanha);
  const campanhaAtivaId = useAdmin((s) => s.campanhaAtivaId);
  const setCampanhaAtivaId = useAdmin((s) => s.setCampanhaAtivaId);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const editando = campanhas.find((c) => c.id === editandoId);
  const excluindo = campanhas.find((c) => c.id === excluindoId);

  const linkDe = (slug: string) => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/${slug}`;
  };

  const copiarLink = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(linkDe(slug));
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  if (editando) {
    return (
      <AdminSection
        title={`Editar — ${editando.nome}`}
        icon={<Megaphone className="h-5 w-5" />}
      >
        <Button
          variant="outline"
          onClick={() => setEditandoId(null)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para campanhas
        </Button>
        <CampanhaForm campanha={editando} />
      </AdminSection>
    );
  }

  return (
    <AdminSection
      title="Campanhas"
      icon={<Megaphone className="h-5 w-5" />}
      description="Cada campanha gera um link único com seu próprio Quiz e upsell."
    >
      <div className="mb-4 flex justify-end">
        <Button onClick={addCampanha}>
          <Plus className="mr-2 h-4 w-4" /> Nova campanha
        </Button>
      </div>
      <div className="space-y-3">
        {campanhas.map((c) => {
          const ativa = c.id === campanhaAtivaId;
          return (
            <div
              key={c.id}
              className="rounded-xl border border-border bg-card p-4 shadow-soft"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-base font-semibold text-charcoal">
                      {c.nome}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                        c.status === "ativa"
                          ? "bg-olive/15 text-olive"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {c.status}
                    </span>
                    {ativa && (
                      <span className="flex items-center gap-1 rounded-full bg-terracotta/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-terracotta">
                        <Star className="h-3 w-3" /> Padrão
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => copiarLink(c.slug)}
                    className="mt-1 block max-w-full truncate text-left text-xs text-muted-foreground hover:text-charcoal"
                    title="Copiar link"
                  >
                    {linkDe(c.slug)}
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copiarLink(c.slug)}
                    title="Copiar link"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {!ativa && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCampanhaAtivaId(c.id);
                        toast.success("Campanha definida como padrão da Home.");
                      }}
                    >
                      Tornar padrão
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditandoId(c.id)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setExcluindoId(c.id)}
                    className="text-terracotta hover:bg-terracotta/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog
        open={!!excluindoId}
        onOpenChange={(v) => !v && setExcluindoId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              A campanha <strong>{excluindo?.nome}</strong> e seu link serão
              removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (excluindoId) removeCampanha(excluindoId);
                setExcluindoId(null);
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
