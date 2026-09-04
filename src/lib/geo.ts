// Utilitários de geolocalização para validar entrega por raio ou polígono.
// CEP: BrasilAPI V2. GPS: navigator.geolocation (Safari iOS / Chrome Android).
// Reverse geocode: Nominatim. Nominatim exige User-Agent e ~1 req/seg.

import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { ZonaEntrega } from "@/store/admin";
import { buscarCep } from "@/lib/cep";

export type LatLng = { lat: number; lng: number };

export type EnderecoReverso = {
  lat: number;
  lng: number;
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  displayName: string;
};

export type ErroLocalizacao =
  | "nao_suportado"
  | "permissao_negada"
  | "indisponivel"
  | "timeout"
  | "desconhecido";

export class LocalizacaoError extends Error {
  code: ErroLocalizacao;
  constructor(code: ErroLocalizacao, message: string) {
    super(message);
    this.name = "LocalizacaoError";
    this.code = code;
  }
}

const NOMINATIM_HEADERS = {
  Accept: "application/json",
  "User-Agent": "CasaAlmeria/1.0 (contato@casaalmeria.com.br)",
};

const MSG_LOCALIZACAO: Record<ErroLocalizacao, string> = {
  nao_suportado: "Este navegador não permite localização. Digite o CEP manualmente.",
  permissao_negada:
    "Permissão de localização negada. No iPhone: Ajustes → Safari → Localização. No Android: ícone do cadeado na barra de endereço → Localização.",
  indisponivel: "Não foi possível obter sua localização. Tente de novo ou digite o CEP.",
  timeout: "A localização demorou demais. Tente de novo ou digite o CEP.",
  desconhecido: "Não foi possível usar a localização. Digite o CEP manualmente.",
};

export function mensagemErroLocalizacao(code: ErroLocalizacao): string {
  return MSG_LOCALIZACAO[code];
}

/**
 * Pede a localização atual (iOS Safari e Android Chrome pedem permissão nativa).
 * Exige HTTPS (produção) ou localhost.
 */
export function obterLocalizacaoAtual(opts?: {
  timeoutMs?: number;
  maximumAgeMs?: number;
  enableHighAccuracy?: boolean;
}): Promise<LatLng> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(
      new LocalizacaoError("nao_suportado", MSG_LOCALIZACAO.nao_suportado),
    );
  }

  const timeoutMs = opts?.timeoutMs ?? 15_000;
  const maximumAgeMs = opts?.maximumAgeMs ?? 60_000;
  const enableHighAccuracy = opts?.enableHighAccuracy ?? true;

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        const code: ErroLocalizacao =
          err.code === 1
            ? "permissao_negada"
            : err.code === 2
              ? "indisponivel"
              : err.code === 3
                ? "timeout"
                : "desconhecido";
        reject(new LocalizacaoError(code, MSG_LOCALIZACAO[code]));
      },
      { enableHighAccuracy, timeout: timeoutMs, maximumAge: maximumAgeMs },
    );
  });
}

/**
 * Converte lat/lng em endereço (CEP, rua, bairro) via Nominatim reverse.
 */
export async function reversoGeocodificar(ponto: LatLng): Promise<EnderecoReverso | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${ponto.lat}` +
      `&lon=${ponto.lng}&addressdetails=1&accept-language=pt-BR`;
    const r = await fetch(url, { headers: NOMINATIM_HEADERS });
    if (!r.ok) return null;
    const d = (await r.json()) as {
      display_name?: string;
      address?: {
        postcode?: string;
        road?: string;
        pedestrian?: string;
        neighbourhood?: string;
        suburb?: string;
        city_district?: string;
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        state?: string;
        "ISO3166-2-lvl4"?: string;
      };
    };
    const a = d.address ?? {};
    const cep = (a.postcode ?? "").replace(/\D/g, "").slice(0, 8);
    const stateRaw = a.state ?? "";
    const state =
      /distrito\s*federal/i.test(stateRaw) || stateRaw === "DF"
        ? "DF"
        : (a["ISO3166-2-lvl4"]?.split("-")[1] ?? stateRaw).slice(0, 2).toUpperCase();
    return {
      lat: ponto.lat,
      lng: ponto.lng,
      cep,
      street: a.road || a.pedestrian || "",
      neighborhood: a.suburb || a.neighbourhood || a.city_district || "",
      city: a.city || a.town || a.village || a.municipality || "",
      state,
      displayName: d.display_name ?? "",
    };
  } catch {
    return null;
  }
}

/**
 * GPS → endereço. Se o reverse trouxer CEP, enriquece com BrasilAPI V2.
 */
export async function enderecoDaLocalizacaoAtual(): Promise<EnderecoReverso> {
  const ponto = await obterLocalizacaoAtual();
  const reverso = await reversoGeocodificar(ponto);
  if (!reverso) {
    throw new LocalizacaoError(
      "indisponivel",
      "Localização obtida, mas não encontramos o endereço. Digite o CEP.",
    );
  }

  if (reverso.cep.length === 8) {
    try {
      const brasil = await buscarCep(reverso.cep);
      if (brasil) {
        return {
          ...reverso,
          street: brasil.street || reverso.street,
          neighborhood: brasil.neighborhood || reverso.neighborhood,
          city: brasil.city || reverso.city,
          state: brasil.state || reverso.state,
          lat: brasil.lat ?? reverso.lat,
          lng: brasil.lng ?? reverso.lng,
        };
      }
    } catch {
      /* mantém reverse */
    }
  }

  return reverso;
}

/**
 * Distância em km entre dois pontos (fórmula de Haversine).
 */
export function distanciaKm(a: LatLng, b: LatLng): number {
  const R = 6371; // raio da Terra em km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Geocodifica um CEP via BrasilAPI v2 (lat/lng direto da base de dados brasileira).
 * Mais confiável que Nominatim para CEPs do DF e condomínios específicos.
 */
export async function geocodificarViaBrasilAPI(cep: string): Promise<LatLng | null> {
  try {
    const limpo = cep.replace(/\D/g, "");
    if (limpo.length !== 8) return null;
    const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${limpo}`);
    if (!r.ok) return null;
    const d = (await r.json()) as {
      location?: {
        coordinates?: { latitude?: string | number; longitude?: string | number };
      };
    };
    const lat = parseFloat(String(d?.location?.coordinates?.latitude ?? ""));
    const lng = parseFloat(String(d?.location?.coordinates?.longitude ?? ""));
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/**
 * Geocodifica um CEP via Nominatim usando busca por postalcode.
 * Mais confiável que busca livre para CEPs brasileiros (inclui Brasília-DF).
 */
export async function geocodificarCep(cep: string): Promise<LatLng | null> {
  try {
    const limpo = cep.replace(/\D/g, "");
    if (limpo.length !== 8) return null;
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&postalcode=${limpo}&countrycodes=br`;
    const r = await fetch(url, { headers: NOMINATIM_HEADERS });
    if (!r.ok) return null;
    const data = (await r.json()) as Array<{ lat: string; lon: string }>;
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/**
 * Geocodifica um endereço (string livre) via Nominatim/OpenStreetMap.
 * Retorna null se não encontrar.
 */
export async function geocodificarEndereco(
  enderecoLivre: string,
): Promise<LatLng | null> {
  try {
    const q = encodeURIComponent(enderecoLivre);
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${q}`;
    const r = await fetch(url, { headers: NOMINATIM_HEADERS });
    if (!r.ok) return null;
    const data = (await r.json()) as Array<{ lat: string; lon: string }>;
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/**
 * Retorna a primeira ZonaEntrega cujo polígono contém o ponto dado,
 * ou null se o ponto estiver fora de todas as zonas.
 * GeoJSON usa [lng, lat] — o swap é feito aqui.
 */
export function encontrarZona(ponto: LatLng, zonas: ZonaEntrega[]): ZonaEntrega | null {
  const turfPoint = {
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [ponto.lng, ponto.lat] },
    properties: {},
  };
  for (const zona of zonas) {
    const turfPoly = {
      type: "Feature" as const,
      geometry: zona.poligono,
      properties: {},
    };
    if (booleanPointInPolygon(turfPoint, turfPoly)) return zona;
  }
  return null;
}

/**
 * Como encontrarZona, mas com tolerância geográfica de ±toleranciaGraus.
 * Evita rejeições causadas por imprecisão do geocodificador (centróide Nominatim).
 * 0.004° ≈ 440 m em Brasília-DF.
 */
export function encontrarZonaComTolerancia(
  ponto: LatLng,
  zonas: ZonaEntrega[],
  toleranciaGraus = 0.004,
): ZonaEntrega | null {
  const exata = encontrarZona(ponto, zonas);
  if (exata) return exata;

  const offsets = [-toleranciaGraus, 0, toleranciaGraus];
  for (const dLat of offsets) {
    for (const dLng of offsets) {
      if (dLat === 0 && dLng === 0) continue;
      const z = encontrarZona({ lat: ponto.lat + dLat, lng: ponto.lng + dLng }, zonas);
      if (z) return z;
    }
  }
  return null;
}
