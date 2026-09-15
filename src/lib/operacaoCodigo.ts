/** Acesso ao portal /operacao por código numérico, cadastrado no módulo Operação Restrita. */

export const CODIGO_ACESSO_REGEX = /^[0-9]{6,8}$/;

export type DadosOperadorCodigo = {
  nome: string;
  /** Só dígitos. */
  cpf: string;
  setor: string;
  codigo: string;
};

export type OperadorCodigo = DadosOperadorCodigo & {
  id: string;
  user_id: string | null;
  criado_em: string;
  ultimo_acesso_em: string | null;
};

export function somenteDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

export function cpfValido(cpf: string): boolean {
  const d = somenteDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digitoVerificador = (tamanho: number) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digitoVerificador(9) === Number(d[9]) && digitoVerificador(10) === Number(d[10]);
}

export function formatarCpf(cpf: string): string {
  const d = somenteDigitos(cpf);
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function codigoAcessoValido(codigo: string): boolean {
  return CODIGO_ACESSO_REGEX.test(codigo);
}

/** Código aleatório de 6 dígitos. A unicidade é conferida no servidor. */
export function gerarCodigoAcesso(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}

/** Texto pronto para mandar ao operador (WhatsApp etc.). */
export function mensagemAcessoOperador(p: {
  nome: string;
  codigo: string;
  portalUrl: string;
}): string {
  return [
    `Olá, ${p.nome}! Este é o seu acesso à operação da Casa Almeria.`,
    "",
    `Link: ${p.portalUrl}`,
    `Código: ${p.codigo}`,
    "",
    "Abra o link e digite o código. O código é pessoal: não compartilhe.",
  ].join("\n");
}
