import { supabase } from "@/integrations/supabase/client";

const BUCKET = "admin-uploads";
const MAX_DIM = 1600;
const QUALITY = 0.82;

/**
 * Converte qualquer imagem em WebP otimizado, redimensionando para no máximo
 * MAX_DIM no maior lado.
 */
export async function convertToWebp(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);

  const useOffscreen = typeof OffscreenCanvas !== "undefined";
  const canvas: OffscreenCanvas | HTMLCanvasElement = useOffscreen
    ? new OffscreenCanvas(w, h)
    : Object.assign(document.createElement("canvas"), { width: w, height: h });

  const ctx = (canvas as HTMLCanvasElement).getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error("Canvas 2D não suportado neste navegador");
  ctx.drawImage(bitmap, 0, 0, w, h);

  if (useOffscreen) {
    return await (canvas as OffscreenCanvas).convertToBlob({
      type: "image/webp",
      quality: QUALITY,
    });
  }

  return await new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar WebP"))),
      "image/webp",
      QUALITY,
    );
  });
}

export async function uploadOptimizedImage(
  file: Blob,
  folder = "geral",
): Promise<string> {
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem.");
  }
  const webp = await convertToWebp(file);
  const path = `${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.webp`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, webp, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
