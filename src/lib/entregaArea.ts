/** Área de entrega: somente Plano Piloto (Brasília central). */

export const MSG_AREA_ENTREGA =
  "Entrega somente no Plano Piloto: Asa Norte, Asa Sul, Noroeste, Vila Planalto, Vila Telebrasília, Granja do Torto, Setor Militar Urbano, Setor de Clubes, Eixo Monumental, Esplanada dos Ministérios e Setor de Embaixadas. Não entregamos em outras regiões do DF nem nas cidades do entorno.";

export const MSG_FORA_AREA =
  "Este endereço está fora da nossa área de entrega. Atendemos somente o Plano Piloto (Asa Norte, Asa Sul, Noroeste e adjacências). Cidades do entorno e outras regiões do DF não são atendidas — você pode retirar na loja.";

const STORAGE_KEY = "casa-almeria-cep-entrega";

function semAcento(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Bairros/localidades do Plano Piloto (e aliases comuns no CEP). */
const BAIRROS_OK = [
  "asa norte",
  "asa sul",
  "noroeste",
  "vila planalto",
  "vila telebrasilia",
  "granja do torto",
  "setor militar urbano",
  "smu",
  "setor de clubes",
  "setor de clubes norte",
  "setor de clubes sul",
  "setor de clubes esportivos norte",
  "setor de clubes esportivos sul",
  "setor de garagens",
  "setor de garagens e oficinas",
  "setor de garagens norte",
  "setor de garagens sul",
  "eixo monumental",
  "esplanada",
  "esplanada dos ministerios",
  "setor de embaixadas",
  "setor de embaixadas norte",
  "setor de embaixadas sul",
  "setor de areas isoladas",
  "setor de areas isoladas norte",
  "setor comercial sul",
  "setor comercial norte",
  "setor hoteleiro sul",
  "setor hoteleiro norte",
  "setor bancario sul",
  "setor bancario norte",
  "setor de diversoes sul",
  "setor de diversoes norte",
  "superquadra sul",
  "superquadra norte",
  "setor de industrias graficas",
].map(semAcento);

const PREFIXOS_LOGRADOURO = [
  "sqs",
  "scls",
  "shs",
  "scs",
  "sbs",
  "sds",
  "sqn",
  "scln",
  "shn",
  "scn",
  "sbn",
  "sdn",
  "sqnw",
  "clnw",
  "shnw",
  "scnw",
  "smu",
  "seps",
  "sepn",
  "sgas",
  "sgan",
  "sgo",
  "scon",
  "scos",
  "sen",
  "ses",
  "sain",
  "sais",
];

const CIDADES_FORA = [
  "taguatinga",
  "aguas claras",
  "ceilandia",
  "guara",
  "lago sul",
  "lago norte",
  "sudoeste",
  "octogonal",
  "cruzeiro",
  "vicente pires",
  "samambaia",
  "gama",
  "santa maria",
  "recanto das emas",
  "riacho fundo",
  "nucleo bandeirante",
  "park way",
  "jardim botanico",
  "sao sebastiao",
  "paranoa",
  "itapoa",
  "sobradinho",
  "planaltina",
  "brazlandia",
  "candangolandia",
  "sia",
  "setor de industria e abastecimento",
  "valparaiso",
  "valparaiso de goias",
  "novo gama",
  "aguas lindas",
  "cidade ocidental",
  "luziania",
  "formosa",
  "planaltina de goias",
  "goiania",
].map(semAcento);

export type EnderecoArea = {
  city?: string;
  neighborhood?: string;
  street?: string;
  state?: string;
};

export function atendeAreaEntrega(end: EnderecoArea): boolean {
  const cidade = semAcento(end.city ?? "");
  const bairro = semAcento(end.neighborhood ?? "");
  const rua = semAcento(end.street ?? "");
  const uf = semAcento(end.state ?? "");
  const blob = `${cidade} ${bairro} ${rua}`;

  if (uf && uf !== "df" && uf !== "distrito federal") return false;

  if (CIDADES_FORA.some((c) => cidade === c || cidade.includes(c) || bairro.includes(c))) {
    return false;
  }

  if (BAIRROS_OK.some((b) => bairro === b || bairro.includes(b) || blob.includes(b))) {
    return true;
  }

  const tokens = `${rua} ${bairro}`.split(" ").filter(Boolean);
  if (PREFIXOS_LOGRADOURO.some((p) => tokens.includes(p))) return true;

  return false;
}

/** Valida texto livre (checkout / pedido gravado). */
export function atendeAreaEntregaFromTexto(texto: string): boolean {
  const t = (texto ?? "").trim();
  if (!t) return false;
  return atendeAreaEntrega({
    city: t,
    neighborhood: t,
    street: t,
  });
}

export type CepEntregaSalvo = {
  cep: string;
  neighborhood: string;
  city: string;
  atende: boolean;
};

export function lerCepEntregaSalvo(): CepEntregaSalvo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as CepEntregaSalvo;
    if (!d?.cep) return null;
    return d;
  } catch {
    return null;
  }
}

export function salvarCepEntrega(d: CepEntregaSalvo) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  } catch {
    /* ignore quota */
  }
}
