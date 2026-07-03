export function montarEnderecoFinal(input: {
  endereco: string;
  tipoLocal: "casa" | "apartamento";
  numeroUnidade: string;
}): string {
  const base = input.endereco.trim();
  const num = input.numeroUnidade.trim();
  if (!num) return base;
  const rotulo = input.tipoLocal === "apartamento" ? "Ap" : "Casa";
  return `${base}, ${rotulo} ${num}`;
}
