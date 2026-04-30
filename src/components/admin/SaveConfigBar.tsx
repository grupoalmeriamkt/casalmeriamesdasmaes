import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Save, Check } from "lucide-react";
import { toast } from "sonner";
import { saveCloudConfig, loadCloudConfig } from "@/lib/cloudConfig";
import { useAdmin } from "@/store/admin";

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

  // Inicializa snapshot publicado com o estado atual (assume que o que está
  // carregado veio do servidor).
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
    <div className="sticky top-0 z-30 -mx-5 mb-6 flex items-center justify-between gap-3 border-b border-border bg-card/95 px-5 py-3 backdrop-blur md:-mx-10 md:px-10">
      <div className="flex items-center gap-2 text-xs">
        {pendentes ? (
          <>
            <span className="inline-block h-2 w-2 rounded-full bg-terracotta animate-pulse" />
            <span className="font-medium text-terracotta">
              Há alterações não publicadas
            </span>
            <span className="text-muted-foreground hidden sm:inline">
              — clique em "Publicar" para enviar ao servidor.
            </span>
          </>
        ) : (
          <>
            <span className="inline-block h-2 w-2 rounded-full bg-olive" />
            <span className="text-muted-foreground">
              Tudo publicado. Suas alterações ficam locais até você publicá-las.
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={handleReload} disabled={saving}>
          Recarregar do servidor
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || (!pendentes && !justSaved)}
          className="bg-charcoal text-white hover:bg-charcoal/90"
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
  );
}
