import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Save, Check } from "lucide-react";
import { toast } from "sonner";
import { saveCloudConfig, loadCloudConfig } from "@/lib/cloudConfig";
import { useAdmin } from "@/store/admin";
import { cn } from "@/lib/utils";

const KEYS_OBSERVADAS = [
  "tema",
  "textos",
  "cestas",
  "sobremesas",
  "categorias",
  "unidades",
  "campanhas",
  "campanhaAtivaId",
  "entrega",
  "pagamento",
  "integracoes",
  "geral",
  "home",
] as const;

function snapshot(state: Record<string, unknown>): string {
  const out: Record<string, unknown> = {};
  for (const k of KEYS_OBSERVADAS) out[k] = state[k];
  return JSON.stringify(out);
}

/**
 * Barra fixa no topo do Admin. Indica "alterações não publicadas" e oferece
 * o botão "Publicar alterações" para enviar o estado ao Supabase.
 */
export function SaveConfigBar() {
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [pendentes, setPendentes] = useState(false);
  const ultimoPublicado = useRef<string>("");

  useEffect(() => {
    ultimoPublicado.current = snapshot(useAdmin.getState() as Record<string, unknown>);
    setPendentes(false);

    const unsub = useAdmin.subscribe((s) => {
      const atual = snapshot(s as Record<string, unknown>);
      setPendentes(atual !== ultimoPublicado.current);
    });
    return unsub;
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const res = await saveCloudConfig();
    setSaving(false);
    if (res.ok) {
      ultimoPublicado.current = snapshot(useAdmin.getState() as Record<string, unknown>);
      setPendentes(false);
      setJustSaved(true);
      toast.success("Alterações publicadas! Já estão visíveis no link compartilhado.");
      setTimeout(() => setJustSaved(false), 2500);
    } else {
      toast.error(`Falha ao publicar: ${res.error ?? "erro desconhecido"}`);
    }
  };

  const handleReload = async () => {
    const res = await loadCloudConfig();
    if (res.ok) {
      ultimoPublicado.current = snapshot(useAdmin.getState() as Record<string, unknown>);
      setPendentes(false);
      toast.success(res.found ? "Configurações recarregadas do servidor." : "Nenhuma configuração salva ainda.");
    } else {
      toast.error(`Falha ao carregar: ${res.error ?? "erro"}`);
    }
  };

  return (
    <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-black/6 bg-white/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2 text-xs sm:items-center">
          {pendentes ? (
            <>
              <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-terracotta animate-pulse sm:mt-0" />
              <div className="min-w-0">
                <span className="font-semibold text-terracotta">Alterações não publicadas</span>
                <span className="mt-0.5 block text-muted-foreground sm:mt-0 sm:ml-1 sm:inline">
                  Publique para enviar ao servidor.
                </span>
              </div>
            </>
          ) : (
            <>
              <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-olive sm:mt-0" />
              <span className="text-muted-foreground">
                Tudo publicado. Alterações ficam locais até você publicá-las.
              </span>
            </>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReload}
            disabled={saving}
            className="h-10 justify-center rounded-xl sm:h-9"
          >
            Recarregar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || (!pendentes && !justSaved)}
            className={cn(
              "h-10 rounded-xl bg-charcoal text-white hover:bg-charcoal/90 sm:h-9",
            )}
          >
            {justSaved ? (
              <>
                <Check className="mr-2 h-4 w-4" /> Publicado
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> {saving ? "Publicando…" : "Publicar alterações"}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
