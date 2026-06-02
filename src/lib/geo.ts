// Utilitários de geolocalização para validar entrega por raio ou polígono.
// Usa ViaCEP (já no projeto) + Nominatim (OpenStreetMap) para geocoding gratuito.
// Nominatim exige User-Agent identificável e tem limite de ~1 req/seg — uso pontual no checkout.

import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { ZonaEntrega } from "@/store/admin";

export type LatLng = { lat: number; lng: number };

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

const NOMINATIM_HEADERS = {
  Accept: "application/json",
  "User-Agent": "CasaAlmeria/1.0 (contato@casaalmeria.com.br)",
};

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
