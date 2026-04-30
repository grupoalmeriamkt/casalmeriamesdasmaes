import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AbaGeral } from "./AbaGeral";
import { AbaUnidades } from "./AbaUnidades";
import { AbaAparencia } from "./AbaAparencia";
import { AbaPagamento } from "./AbaPagamento";
import { AbaIntegracoes } from "./AbaIntegracoes";

const SUBABAS = [
  { id: "geral", label: "Geral", Comp: AbaGeral },
  { id: "unidades", label: "Unidades", Comp: AbaUnidades },
  { id: "aparencia", label: "Aparência", Comp: AbaAparencia },
  { id: "pagamento", label: "Pagamento", Comp: AbaPagamento },
  { id: "integracoes", label: "Integrações", Comp: AbaIntegracoes },
] as const;

export function AbaConfiguracoes() {
  const [aba, setAba] = useState<(typeof SUBABAS)[number]["id"]>("geral");
  return (
    <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
      <TabsList className="mb-6 flex w-full flex-wrap justify-start gap-1 bg-charcoal/5">
        {SUBABAS.map((s) => (
          <TabsTrigger key={s.id} value={s.id} className="px-4">
            {s.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {SUBABAS.map((s) => (
        <TabsContent key={s.id} value={s.id}>
          <s.Comp />
        </TabsContent>
      ))}
    </Tabs>
  );
}
