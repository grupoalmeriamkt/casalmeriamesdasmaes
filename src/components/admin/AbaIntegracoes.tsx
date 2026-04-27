import { useAdmin } from "@/store/admin";
import { AdminSection, AdminField, AdminToggle } from "./AdminField";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2, Webhook } from "lucide-react";

export function AbaIntegracoes() {
  const i = useAdmin((s) => s.integracoes);
  const set = useAdmin((s) => s.setIntegracoes);
  const [testando, setTestando] = useState(false);

  const testar = async () => {
    if (!i.webhookUrl) {
      toast.error("Informe a URL do webhook antes de testar.");
      return;
    }
    setTestando(true);
    try {
      await fetch(i.webhookUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento: "teste",
          timestamp: new Date().toISOString(),
          mensagem: "Payload de teste do painel Casa Almeria",
        }),
      });
      toast.success("Webhook disparado!", {
        description:
          "Como usamos modo no-cors, a resposta não pode ser lida — verifique no Make/Zapier/n8n.",
      });
    } catch {
      toast.error("Não foi possível disparar o webhook.");
    } finally {
      setTestando(false);
    }
  };

  return (
    <AdminSection
      title="Integrações"
      icon={<Webhook className="h-5 w-5" />}
      description="Webhook para automações (Make, Zapier, n8n) e links sociais."
    >
      <AdminField
        label="URL do webhook"
        hint="Receberá os eventos de pedido concluído e abandonado."
      >
        <Input
          value={i.webhookUrl}
          onChange={(e) => set({ webhookUrl: e.target.value })}
          placeholder="https://hook.make.com/..."
        />
      </AdminField>

      <div className="grid gap-3 md:grid-cols-2">
        <AdminToggle
          label="Disparar ao concluir pagamento"
          checked={i.dispararPagamento}
          onCheckedChange={(v) => set({ dispararPagamento: v })}
        />
        <AdminToggle
          label="Disparar em abandono de carrinho"
          checked={i.dispararAbandono}
          onCheckedChange={(v) => set({ dispararAbandono: v })}
        />
      </div>

      <AdminField label="Tempo de inatividade para considerar abandono (minutos)">
        <Input
          type="number"
          min={1}
          value={i.minutosAbandono}
          onChange={(e) =>
            set({ minutosAbandono: Math.max(1, parseInt(e.target.value) || 10) })
          }
          className="max-w-[120px]"
        />
      </AdminField>

      <Button
        onClick={testar}
        disabled={testando}
        className="bg-charcoal text-white hover:bg-charcoal/90"
      >
        {testando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Testar webhook
      </Button>

      <AdminField
        label="Google Tag Manager ID"
        hint="Formato GTM-XXXXXX. Quando preenchido, o script do GTM é carregado no site e os eventos do funil (page_view, begin_checkout, generate_lead, sign_up, add_payment_info, purchase) são enviados ao dataLayer."
      >
        <Input
          value={i.gtmId}
          onChange={(e) => set({ gtmId: e.target.value.trim() })}
          placeholder="GTM-XXXXXX"
        />
      </AdminField>

      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Meta Ads (Facebook Pixel + Conversions API)</h3>
          <p className="text-xs text-muted-foreground">
            O Pixel rastreia <strong>PageView</strong> e <strong>Lead</strong> no navegador, e a
            Conversions API envia o mesmo evento pelo servidor (com deduplicação) — mais preciso e
            resistente a bloqueadores.
          </p>
        </div>

        <AdminField
          label="Meta Pixel ID"
          hint="Apenas dígitos. Encontre em Meta Business Suite → Eventos."
        >
          <Input
            value={i.metaPixelId}
            onChange={(e) =>
              set({ metaPixelId: e.target.value.replace(/\D/g, "").slice(0, 20) })
            }
            placeholder="123456789012345"
          />
        </AdminField>

        <AdminField
          label="Conversions API – Access Token"
          hint="Gere em Eventos → Configurações → Conversions API → Gerar token. Necessário para envio server-side."
        >
          <Input
            type="password"
            value={i.metaAccessToken}
            onChange={(e) => set({ metaAccessToken: e.target.value.trim() })}
            placeholder="EAAG..."
          />
        </AdminField>

        <AdminField
          label="Test Event Code (opcional)"
          hint="Use durante testes em Eventos de Teste do Gerenciador de Eventos. Deixe em branco em produção."
        >
          <Input
            value={i.metaTestEventCode}
            onChange={(e) => set({ metaTestEventCode: e.target.value.trim() })}
            placeholder="TEST12345"
          />
        </AdminField>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AdminField label="URL do Instagram">
          <Input
            value={i.instagramUrl}
            onChange={(e) => set({ instagramUrl: e.target.value })}
          />
        </AdminField>
        <AdminField label="URL do WhatsApp (wa.me)">
          <Input
            value={i.whatsappUrl}
            onChange={(e) => set({ whatsappUrl: e.target.value })}
          />
        </AdminField>
      </div>
    </AdminSection>
  );
}
