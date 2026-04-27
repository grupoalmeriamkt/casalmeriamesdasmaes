// Utilitários de geolocalização para validar entrega por raio.
// Usa ViaCEP (já no projeto) + Nominatim (OpenStreetMap) para geocoding gratuito.
// Nominatim exige User-Agent identificável e tem limite de ~1 req/seg — uso pontual no checkout.

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
    const r = await fetch(url, {
      headers: { Accept: "application/json" },
    });
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
