import { useEffect, useRef, useState } from "react";
import type { ZonaEntrega, TaxaEntrega } from "@/store/admin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";

const CORES = ["#4ade80", "#60a5fa", "#f97316", "#a78bfa", "#f43f5e", "#facc15"];

type Props = {
  centroLat: number;
  centroLng: number;
  zonas: ZonaEntrega[];
  onChange: (zonas: ZonaEntrega[]) => void;
};

function extrairPoligono(layer: any): ZonaEntrega["poligono"] | null {
  try {
    const geo = layer.toGeoJSON();
    if (geo.geometry?.type !== "Polygon") return null;
    return geo.geometry as ZonaEntrega["poligono"];
  } catch {
    return null;
  }
}

function TaxaEditor({
  taxa,
  onChange,
}: {
  taxa: TaxaEntrega;
  onChange: (t: TaxaEntrega) => void;
}) {
  return (
    <div className="space-y-2">
      <Select
        value={taxa.tipo}
        onValueChange={(v) => {
          if (v === "fixa") onChange({ tipo: "fixa", valor: 0 });
          else onChange({ tipo: "faixa", faixas: [{ ateKm: 5, valor: 0 }] });
        }}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="fixa">Taxa fixa</SelectItem>
          <SelectItem value="faixa">Por faixa de km</SelectItem>
        </SelectContent>
      </Select>

      {taxa.tipo === "fixa" ? (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">R$</span>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={taxa.valor}
            onChange={(e) => onChange({ tipo: "fixa", valor: Number(e.target.value) || 0 })}
            className="h-8 max-w-[100px] text-xs"
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          {taxa.faixas.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground w-12">Até km</span>
              <Input
                type="number"
                min={0}
                value={f.ateKm}
                onChange={(e) => {
                  const next = [...taxa.faixas];
                  next[i] = { ...f, ateKm: Number(e.target.value) || 0 };
                  onChange({ tipo: "faixa", faixas: next });
                }}
                className="h-8 w-16 text-xs"
              />
              <span className="text-xs text-muted-foreground">R$</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={f.valor}
                onChange={(e) => {
                  const next = [...taxa.faixas];
                  next[i] = { ...f, valor: Number(e.target.value) || 0 };
                  onChange({ tipo: "faixa", faixas: next });
                }}
                className="h-8 w-20 text-xs"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={() =>
                  onChange({ tipo: "faixa", faixas: taxa.faixas.filter((_, idx) => idx !== i) })
                }
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="h-7 border-dashed text-xs"
            onClick={() =>
              onChange({ tipo: "faixa", faixas: [...taxa.faixas, { ateKm: 5, valor: 0 }] })
            }
          >
            <Plus className="mr-1 h-3 w-3" /> Faixa
          </Button>
        </div>
      )}
    </div>
  );
}

export function MapaZonas({ centroLat, centroLng, zonas, onChange }: Props) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerMapRef = useRef<Map<string, any>>(new Map());
  const zonasRef = useRef(zonas);
  const onChangeRef = useRef(onChange);
  zonasRef.current = zonas;
  onChangeRef.current = onChange;

  const [mapReady, setMapReady] = useState(false);

  // Inicializa o mapa Leaflet + Geoman diretamente (sem react-leaflet)
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;

    let cancelled = false;

    (async () => {
      try {
        // Importações dinâmicas — garantem execução apenas no cliente
        const [{ default: L }, , ] = await Promise.all([
          import("leaflet"),
          import("leaflet/dist/leaflet.css"),
          import("@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css"),
        ]);
        await import("@geoman-io/leaflet-geoman-free");

        if (cancelled || !mapDivRef.current) return;

        // Corrige ícone padrão do Leaflet no Vite
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });

        const map = L.map(mapDivRef.current, {
          center: [centroLat, centroLng],
          zoom: 13,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
        }).addTo(map);

        mapRef.current = map;

        // Inicializa controles do Geoman
        (map as any).pm.addControls({
          position: "topleft",
          drawCircle: false,
          drawCircleMarker: false,
          drawPolyline: false,
          drawMarker: false,
          drawText: false,
          cutPolygon: false,
        });

        // Renderiza zonas existentes
        for (const zona of zonasRef.current) {
          const zonaId = zona.id;
          const coords = zona.poligono.coordinates[0].map(
            (p) => [p[1], p[0]] as [number, number],
          );
          const layer = L.polygon(coords, {
            color: zona.cor,
            fillColor: zona.cor,
            fillOpacity: 0.2,
            weight: 2,
          } as any).addTo(map);
          layerMapRef.current.set(zonaId, layer);
          layer.on("pm:edit", () => {
            const updated = extrairPoligono(layer);
            if (!updated) return;
            onChangeRef.current(
              zonasRef.current.map((z) => (z.id === zonaId ? { ...z, poligono: updated } : z)),
            );
          });
        }

        // Novo polígono criado
        map.on("pm:create", (e: any) => {
          const layer = e.layer;
          const poligono = extrairPoligono(layer);
          if (!poligono) return;
          const id = `zona-${Date.now()}`;
          const cor = CORES[zonasRef.current.length % CORES.length];
          layer.setStyle({ color: cor, fillColor: cor, fillOpacity: 0.2 });
          layerMapRef.current.set(id, layer);
          layer.on("pm:edit", () => {
            const updated = extrairPoligono(layer);
            if (!updated) return;
            onChangeRef.current(
              zonasRef.current.map((z) => (z.id === id ? { ...z, poligono: updated } : z)),
            );
          });
          const novaZona: ZonaEntrega = {
            id,
            nome: `Zona ${zonasRef.current.length + 1}`,
            cor,
            taxa: { tipo: "fixa", valor: 0 },
            poligono,
          };
          onChangeRef.current([...zonasRef.current, novaZona]);
        });

        // Polígono removido pelo mapa
        map.on("pm:remove", (e: any) => {
          const layer = e.layer;
          let removedId: string | null = null;
          for (const [id, l] of layerMapRef.current.entries()) {
            if (l === layer) { removedId = id; break; }
          }
          if (!removedId) return;
          layerMapRef.current.delete(removedId);
          onChangeRef.current(zonasRef.current.filter((z) => z.id !== removedId));
        });

        if (!cancelled) setMapReady(true);
      } catch (err) {
        console.error("[MapaZonas] Erro ao inicializar mapa:", err);
      }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerMapRef.current.clear();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteZona = (zonaId: string) => {
    const layer = layerMapRef.current.get(zonaId);
    if (layer) layer.remove();
    layerMapRef.current.delete(zonaId);
    onChange(zonas.filter((z) => z.id !== zonaId));
  };

  const handleUpdateZona = (zonaId: string, patch: Partial<ZonaEntrega>) => {
    onChange(zonas.map((z) => (z.id === zonaId ? { ...z, ...patch } : z)));
  };

  return (
    <div className="space-y-4">
      <div
        className="overflow-hidden rounded-xl border border-border"
        style={{ height: 360 }}
      >
        <div ref={mapDivRef} style={{ height: "100%", width: "100%" }} />
        {!mapReady && (
          <div className="flex h-full items-center justify-center bg-muted/30">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-charcoal border-t-transparent" />
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Use a barra lateral do mapa para desenhar polígonos (▱) ou retângulos (□) delimitando cada área de entrega. Para editar, ative o modo de edição (✎). Para excluir pelo mapa, use o modo de remoção (🗑).
      </p>

      {zonas.length > 0 && (
        <div className="space-y-3">
          {zonas.map((zona) => (
            <div
              key={zona.id}
              className="rounded-lg border border-border bg-card p-4 space-y-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-3 w-3 flex-none rounded-full border border-border/50"
                  style={{ background: zona.cor }}
                />
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Nome da zona</Label>
                  <Input
                    value={zona.nome}
                    onChange={(e) => handleUpdateZona(zona.id, { nome: e.target.value })}
                    className="mt-1 h-8 text-sm"
                    placeholder="Ex: Zona Centro"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeleteZona(zona.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Taxa de entrega</Label>
                <div className="mt-1.5">
                  <TaxaEditor
                    taxa={zona.taxa}
                    onChange={(taxa) => handleUpdateZona(zona.id, { taxa })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {zonas.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          Nenhuma zona desenhada ainda. Use as ferramentas do mapa para criar áreas de entrega.
        </p>
      )}
    </div>
  );
}
