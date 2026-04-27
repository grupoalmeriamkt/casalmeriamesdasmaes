import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, X, Crop } from "lucide-react";
import { uploadOptimizedImage } from "@/lib/imageUpload";
import { toast } from "sonner";
import { ImageCropDialog } from "./ImageCropDialog";

type Props = {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  previewClassName?: string;
  /** Proporção de recorte (largura/altura). Ex: 16/10 produtos, 1 upsell. */
  aspect?: number;
  /** Texto auxiliar opcional descrevendo a proporção esperada. */
  aspectHint?: string;
};

export function ImageUpload({
  label = "Imagem",
  value,
  onChange,
  folder = "geral",
  previewClassName = "h-32 w-full",
  aspect = 16 / 10,
  aspectHint,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<File | null>(null);

  async function handleCroppedBlob(blob: Blob) {
    setLoading(true);
    try {
      const url = await uploadOptimizedImage(blob, folder);
      onChange(url);
      setPending(null);
      toast.success("Imagem recortada e otimizada (WebP) com sucesso");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro no upload";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setPending(f);
          e.target.value = "";
        }}
      />

      {value ? (
        <div className="relative inline-block w-full">
          <img
            src={value}
            alt=""
            className={`${previewClassName} rounded-lg object-cover`}
          />
          <div className="absolute right-2 top-2 flex gap-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
              aria-label="Trocar imagem"
              title="Trocar imagem"
            >
              <Crop className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
              aria-label="Remover imagem"
              title="Remover"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="w-full border-dashed"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          {loading ? "Otimizando…" : "Enviar imagem"}
        </Button>
      )}

      <p className="text-[11px] text-muted-foreground">
        {aspectHint ?? "Recorte ajustável · Conversão automática para WebP · máx. 1600px"}
      </p>

      <ImageCropDialog
        open={!!pending}
        file={pending}
        aspect={aspect}
        onCancel={() => setPending(null)}
        onConfirm={handleCroppedBlob}
      />
    </div>
  );
}
