import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Save, Check } from "lucide-react";
import { toast } from "sonner";
import { saveCloudConfig, loadCloudConfig } from "@/lib/cloudConfig";

/**
 * Barra fixa no topo do Admin com botão "Publicar alterações".
 * Persiste o estado atual do store no Supabase para que todos os
 * visitantes (link compartilhado) vejam as mesmas configurações.
 */
export function SaveConfigBar() {
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const res = await saveCloudConfig();
    setSaving(false);
    if (res.ok) {
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
      toast.success(res.found ? "Configurações recarregadas do servidor." : "Nenhuma configuração salva ainda.");
    } else {
      toast.error(`Falha ao carregar: ${res.error ?? "erro"}`);
    }
  };

  return (
    <div className="sticky top-0 z-30 -mx-5 mb-6 flex items-center justify-between gap-3 border-b border-border bg-card/95 px-5 py-3 backdrop-blur md:-mx-10 md:px-10">
      <div className="text-xs text-muted-foreground">
        Suas alterações são <strong>locais</strong> até você publicá-las no servidor.
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={handleReload} disabled={saving}>
          Recarregar do servidor
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
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
