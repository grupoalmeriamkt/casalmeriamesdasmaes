/** Consulta de CEP via BrasilAPI (CEP V2). https://brasilapi.com.br/docs#tag/CEP-V2 */

export type EnderecoCep = {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
};

/** Busca o endereço de um CEP (8 dígitos). Retorna null se inválido/não encontrado. */
export async function buscarCep(cep: string): Promise<EnderecoCep | null> {
  const limpo = cep.replace(/\D/g, "");
  if (limpo.length !== 8) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${limpo}`);
    if (!res.ok) return null;
    const d = (await res.json()) as {
      cep?: string;
      street?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
    };
    return {
      cep: d.cep ?? limpo,
      street: d.street ?? "",
      neighborhood: d.neighborhood ?? "",
      city: d.city ?? "",
      state: d.state ?? "",
    };
  } catch {
    return null;
  }
}

/** Monta uma linha de endereço legível a partir do resultado do CEP. */
export function formatarEndereco(e: EnderecoCep): string {
  const cidadeUf = e.city ? `${e.city}${e.state ? `/${e.state}` : ""}` : "";
  return [e.street, e.neighborhood, cidadeUf].filter(Boolean).join(", ");
}
