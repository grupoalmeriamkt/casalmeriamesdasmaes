import { supabase } from "@/integrations/supabase/client";

export const POLAROID_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const POLAROID_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png"];

export type UploadPolaroidResult =
  | { ok: true; url: string; nome: string }
  | { ok: false; erro: string };

export async function uploadPolaroid(
  file: File,
): Promise<UploadPolaroidResult> {
  if (!POLAROID_MIME_TYPES.includes(file.type)) {
    return { ok: false, erro: "Formato inválido. Envie JPG ou PNG." };
  }
  if (file.size > POLAROID_MAX_BYTES) {
    return { ok: false, erro: "Arquivo maior que 10 MB." };
  }

  const ext = (file.name.split(".").pop() ?? "jpg")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 5);
  const path = `${crypto.randomUUID()}.${ext || "jpg"}`;

  const { error } = await supabase.storage
    .from("polaroids")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error("[polaroid] upload error", error);
    return { ok: false, erro: "Falha ao enviar foto. Tente novamente." };
  }

  const { data } = supabase.storage.from("polaroids").getPublicUrl(path);
  return { ok: true, url: data.publicUrl, nome: file.name };
}
