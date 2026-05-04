import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Tooltip,
  useMapEvents,
} from "react-leaflet";

// Corrige ícone padrão do Leaflet no Vite (asset path quebrado)
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const CORES = ["#4ade80", "#facc15", "#f97316", "#ef4444", "#a855f7", "#3b82f6"];

type Faixa = { ateKm: number; valor: number };

type Props = {
  centroLat: number;
  centroLng: number;
  faixas: Faixa[];
  raioKm: number;
  tipoTaxa: "fixa" | "faixa";
  taxaFixa?: number;
  onCentroChange: (lat: number, lng: number) => void;
};

function PinDraggavel({
  pos,
  onChange,
}: {
  pos: [number, number];
  onChange: (lat: number, lng: number) => void;
}) {
  useMapEvents({});
  return (
    <Marker
      position={pos}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const p = (e.target as L.Marker).getLatLng();
          onChange(p.lat, p.lng);
        },
      }}
    />
  );
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function MapaRaio({
  centroLat,
  centroLng,
  faixas,
  raioKm,
  tipoTaxa,
  taxaFixa,
  onCentroChange,
}: Props) {
  const centro: [number, number] = [centroLat, centroLng];

  const circulos: { raioM: number; cor: string; label: string }[] =
    tipoTaxa === "faixa"
      ? faixas
          .slice()
          .sort((a, b) => a.ateKm - b.ateKm)
          .map((f, i) => ({
            raioM: f.ateKm * 1000,
            cor: CORES[i % CORES.length],
            label: `Até ${f.ateKm} km — ${fmt(f.valor)}`,
          }))
      : raioKm > 0
        ? [
            {
              raioM: raioKm * 1000,
              cor: CORES[0],
              label: `${raioKm} km — ${fmt(taxaFixa ?? 0)}`,
            },
          ]
        : [];

  return (
    <div className="space-y-3">
      <div
        className="overflow-hidden rounded-xl border border-border"
        style={{ height: 320 }}
      >
        <MapContainer
          center={centro}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <PinDraggavel pos={centro} onChange={onCentroChange} />
          {circulos.map((c, i) => (
            <Circle
              key={i}
              center={centro}
              radius={c.raioM}
              pathOptions={{
                color: c.cor,
                fillColor: c.cor,
                fillOpacity: 0.08,
                weight: 2,
              }}
            >
              <Tooltip sticky>{c.label}</Tooltip>
            </Circle>
          ))}
        </MapContainer>
      </div>

      {circulos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {circulos.map((c, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-charcoal"
            >
              <span
                className="h-2.5 w-2.5 flex-none rounded-full"
                style={{ background: c.cor }}
              />
              {c.label}
            </span>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Arraste o pino para ajustar o centro de entrega. Passe o mouse sobre um
        círculo para ver o preço da zona.
      </p>
    </div>
  );
}
