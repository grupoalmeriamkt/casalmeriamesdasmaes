import { useAdmin } from "@/store/admin";
import { AdminSection, AdminField } from "./AdminField";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Type } from "lucide-react";

export function AbaTextos() {
  const t = useAdmin((s) => s.textos);
  const set = useAdmin((s) => s.setTextos);

  return (
    <AdminSection
      title="Textos da página"
      icon={<Type className="h-5 w-5" />}
      description="Edite os textos que aparecem na landing page."
    >
      <div className="grid gap-5">
        <AdminField label="Headline do Hero">
          <Textarea
            value={t.heroTitulo}
            onChange={(e) => set({ heroTitulo: e.target.value })}
            rows={2}
          />
        </AdminField>
        <AdminField label="Subtítulo do Hero">
          <Input
            value={t.heroSubtitulo}
            onChange={(e) => set({ heroSubtitulo: e.target.value })}
          />
        </AdminField>
        <AdminField label="Badge de prazo (urgência)">
          <Input
            value={t.badgePrazo}
            onChange={(e) => set({ badgePrazo: e.target.value })}
          />
        </AdminField>
        <AdminField label="Texto do CTA principal">
          <Input
            value={t.ctaPrincipal}
            onChange={(e) => set({ ctaPrincipal: e.target.value })}
          />
        </AdminField>
        <AdminField label="Tagline do rodapé">
          <Input
            value={t.taglineFooter}
            onChange={(e) => set({ taglineFooter: e.target.value })}
          />
        </AdminField>
        <AdminField label="WhatsApp para contato (apenas dígitos)">
          <Input
            value={t.whatsapp}
            onChange={(e) => set({ whatsapp: e.target.value.replace(/\D/g, "") })}
            placeholder="5561999999999"
          />
        </AdminField>
        <AdminField label="Mensagem de confirmação do pedido">
          <Textarea
            value={t.msgConfirmacao}
            onChange={(e) => set({ msgConfirmacao: e.target.value })}
            rows={3}
          />
        </AdminField>
      </div>
    </AdminSection>
  );
}
