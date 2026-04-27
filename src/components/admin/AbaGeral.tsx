import { useAdmin } from "@/store/admin";
import { AdminSection, AdminField, AdminToggle } from "./AdminField";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Settings } from "lucide-react";

export function AbaGeral() {
  const g = useAdmin((s) => s.geral);
  const set = useAdmin((s) => s.setGeral);
  const limparPedidos = useAdmin((s) => s.limparPedidos);
  const reset = useAdmin((s) => s.resetTudo);

  return (
    <AdminSection
      title="Configurações gerais"
      icon={<Settings className="h-5 w-5" />}
      description="Status do site e dados sensíveis."
    >
      <AdminToggle
        label="Site ativo"
        description="Desative para colocar a LP em modo manutenção."
        checked={g.ativa}
        onCheckedChange={(v) => set({ ativa: v })}
      />

      <AdminField label="Mensagem da página de manutenção">
        <Textarea
          rows={2}
          value={g.msgManutencao}
          onChange={(e) => set({ msgManutencao: e.target.value })}
        />
      </AdminField>

      <AdminField
        label="Data de encerramento de encomendas"
        hint="A partir do dia seguinte, a LP exibirá 'Encomendas encerradas'."
      >
        <Input
          type="date"
          value={g.encerramento}
          onChange={(e) => set({ encerramento: e.target.value })}
          className="max-w-[200px]"
        />
      </AdminField>

      <div className="grid gap-3 md:grid-cols-2">
        <AdminToggle
          label="Mostrar upsell de sobremesas"
          checked={g.mostrarUpsell}
          onCheckedChange={(v) => set({ mostrarUpsell: v })}
        />
        <AdminToggle
          label='Mostrar seção "Informações importantes"'
          checked={g.mostrarInformacoes}
          onCheckedChange={(v) => set({ mostrarInformacoes: v })}
        />
      </div>

      <div className="rounded-xl border border-terracotta/30 bg-terracotta/5 p-5">
        <h3 className="font-bold text-terracotta">Zona de risco</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Estas ações não podem ser desfeitas.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => {
              limparPedidos();
              toast.success("Pedidos limpos.");
            }}
            className="border-terracotta/40 text-terracotta hover:bg-terracotta/10"
          >
            Limpar todos os pedidos
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("Restaurar todas as configurações ao padrão?")) {
                reset();
                toast.success("Configurações restauradas.");
              }
            }}
            className="border-terracotta/40 text-terracotta hover:bg-terracotta/10"
          >
            Restaurar configurações padrão
          </Button>
        </div>
      </div>
    </AdminSection>
  );
}
