import { useState } from "react";
import { AbaGeral } from "./AbaGeral";
import { AbaUnidades } from "./AbaUnidades";
import { AbaAparencia } from "./AbaAparencia";
import { AbaPagamento } from "./AbaPagamento";
import { AbaIntegracoes } from "./AbaIntegracoes";
import { AdminSegmentedTabs } from "./AdminShell";

const SUBABAS = [
  { id: "geral", label: "Geral", Comp: AbaGeral },
  { id: "unidades", label: "Unidades", Comp: AbaUnidades },
  { id: "aparencia", label: "Aparência", Comp: AbaAparencia },
  { id: "pagamento", label: "Pagamento", Comp: AbaPagamento },
  { id: "integracoes", label: "Integrações", Comp: AbaIntegracoes },
] as const;

export function AbaConfiguracoes() {
  const [aba, setAba] = useState<(typeof SUBABAS)[number]["id"]>("geral");
  const Atual = SUBABAS.find((s) => s.id === aba)!.Comp;

  return (
    <div>
      <AdminSegmentedTabs
        value={aba}
        onValueChange={(v) => setAba(v as typeof aba)}
        items={SUBABAS.map((s) => ({ id: s.id, label: s.label }))}
      />
      <Atual />
    </div>
  );
}
