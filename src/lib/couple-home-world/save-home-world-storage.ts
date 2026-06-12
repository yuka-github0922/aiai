import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "couple-home-world";

function parseDataUrl(
  dataUrl: string
): { buffer: Buffer; contentType: string; ext: string } | null {
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return null;

  const [, format, b64] = match;
  const ext = format === "jpeg" ? "jpg" : format;
  return {
    buffer: Buffer.from(b64, "base64"),
    contentType: `image/${format}`,
    ext,
  };
}

export async function saveHomeWorldHeroToStorage(
  supabase: SupabaseClient,
  coupleId: string,
  dataUrl: string,
  version = 1
): Promise<string | null> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    console.error("[saveHomeWorldHeroToStorage] invalid data URL");
    return null;
  }

  const path = `${coupleId}/hero-v${version}.${parsed.ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, parsed.buffer, {
    contentType: parsed.contentType,
    upsert: true,
  });

  if (error) {
    console.error("[saveHomeWorldHeroToStorage] upload failed:", error.message);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
