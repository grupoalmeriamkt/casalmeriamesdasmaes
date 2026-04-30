import { useEffect, useState } from "react";
import { RotateCcw, Smartphone } from "lucide-react";
import { Quiz } from "@/components/Quiz";
import { ThemeApplier } from "@/components/ThemeApplier";
import { PreviewProvider } from "./PreviewContext";
import { useAdmin } from "@/store/admin";
import { usePedido } from "@/store/pedido";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = { campanhaId: string };

const PASSOS = [
  { value: "1", label: "1 — Cesta" },
  { value: "2", label: "2 — Dados" },
  { value: "3", label: "3 — Entrega" },
  { value: "4", label: "4 — Data/Horário" },
  { value: "4.5", label: "4 — Personalização" },
  { value: "5", label: "5 — Resumo" },
] as const;

export function QuizPreviewMobile({ campanhaId }: Props) {
  const setCampanhaAtivaId = useAdmin((s) => s.setCampanhaAtivaId);
  const campanhaAtivaIdAtual = useAdmin((s) => s.campanhaAtivaId);
  const [step, setStep] = useState<number>(1);
  // chave para forçar remount ao trocar passo / recarregar
  const [nonce, setNonce] = useState(0);

  // Aponta a campanha em edição como ativa enquanto a prévia está aberta
  useEffect(() => {
    const anterior = campanhaAtivaIdAtual;
    if (anterior !== campanhaId) setCampanhaAtivaId(campanhaId);
    return () => {
      if (anterior && anterior !== campanhaId) setCampanhaAtivaId(anterior);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campanhaId]);

  const recarregar = () => {
    usePedido.getState().reset();
    setNonce((n) => n + 1);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-charcoal/70">
          <Smartphone className="h-4 w-4" />
          Pré-visualização
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(step)}
            onValueChange={(v) => {
              setStep(Number(v));
              setNonce((n) => n + 1);
            }}
          >
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PASSOS.map((p) => (
                <SelectItem key={p.value} value={p.value} className="text-xs">
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={recarregar}
            title="Recarregar prévia"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Moldura de celular */}
      <div className="mx-auto" style={{ width: 380 }}>
        <div
          className="relative overflow-hidden rounded-[2.2rem] border-[10px] border-charcoal bg-charcoal shadow-elevated"
          style={{ height: 760 }}
        >
          {/* Notch */}
          <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-5 w-28 -translate-x-1/2 rounded-b-2xl bg-charcoal" />

          <div className="h-full w-full overflow-hidden rounded-[1.4rem] bg-background">
            <div
              className="h-full overflow-y-auto"
              style={{
                // Renderiza como se a viewport fosse mobile (~375px)
                width: 375,
              }}
            >
              <PreviewProvider>
                <ThemeApplier />
                <Quiz
                  key={`${campanhaId}-${step}-${nonce}`}
                  initialStep={step}
                  onConcluir={() => {
                    /* prévia: no-op */
                  }}
                  onVoltar={() => {
                    /* prévia: no-op */
                  }}
                />
              </PreviewProvider>
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Interações reais (WhatsApp, pagamento, salvar pedido) ficam desativadas
        nesta prévia.
      </p>
    </div>
  );
}
