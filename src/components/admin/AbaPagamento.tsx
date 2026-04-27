import { useAdmin } from "@/store/admin";
import { AdminSection, AdminField, AdminToggle } from "./AdminField";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";

export function AbaPagamento() {
  const p = useAdmin((s) => s.pagamento);
  const set = useAdmin((s) => s.setPagamento);

  const testar = () => {
    if (!p.mpPublicKey || !p.mpAccessToken) {
      toast.error("Preencha as credenciais antes de testar.");
      return;
    }
    toast.success("Credenciais salvas localmente", {
      description:
        "Para validar contra o Mercado Pago de verdade, ative o Lovable Cloud em uma fase futura.",
    });
  };

  return (
    <AdminSection
      title="Pagamento — Mercado Pago"
      icon={<CreditCard className="h-5 w-5" />}
      description="Quando o Checkout do Mercado Pago está ativo, o botão de finalizar pelo WhatsApp é substituído pelo redirecionamento ao Checkout Pro."
    >
      <div className="rounded-lg border border-charcoal/15 bg-linen/40 p-4">
        <AdminToggle
          label="Habilitar Checkout do Mercado Pago"
          description="Ao ativar, o botão 'Enviar pedido pelo WhatsApp' some e o cliente é redirecionado ao Checkout Pro no passo final do Quiz."
          checked={p.checkoutAtivo}
          onCheckedChange={(v) => set({ checkoutAtivo: v })}
        />
      </div>

      <div className="grid gap-4">
        <AdminField
          label="Public Key do Mercado Pago"
          hint="Pode ser exposta no frontend (APP_USR-XXXX...)"
        >
          <Input
            value={p.mpPublicKey}
            onChange={(e) => set({ mpPublicKey: e.target.value })}
            placeholder="APP_USR-..."
          />
        </AdminField>
        <AdminField
          label="Access Token"
          hint="Em produção, guarde via Lovable Cloud — não fica seguro só no navegador."
        >
          <Input
            type="password"
            value={p.mpAccessToken}
            onChange={(e) => set({ mpAccessToken: e.target.value })}
            placeholder="APP_USR-..."
          />
        </AdminField>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <AdminToggle
          label="Aceitar PIX"
          checked={p.pix}
          onCheckedChange={(v) => set({ pix: v })}
        />
        <AdminToggle
          label="Aceitar Cartão de Crédito"
          checked={p.cartao}
          onCheckedChange={(v) => set({ cartao: v })}
        />
      </div>

      <AdminField label="Número máximo de parcelas">
        <Input
          type="number"
          min={1}
          max={12}
          value={p.parcelasMax}
          onChange={(e) =>
            set({ parcelasMax: Math.max(1, parseInt(e.target.value) || 1) })
          }
          className="max-w-[120px]"
        />
      </AdminField>

      <Button
        onClick={testar}
        className="bg-charcoal text-white hover:bg-charcoal/90"
      >
        Testar conexão com Mercado Pago
      </Button>
    </AdminSection>
  );
}
