import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { CachedCoupleTraitsRow } from "@/lib/couple-traits-types";

export function formatSupabaseError(
  error: PostgrestError | null | undefined,
  context: string
): string {
  if (!error) return `${context}: unknown error`;
  const parts = [
    context,
    error.code && `code=${error.code}`,
    error.message && `message=${error.message}`,
    error.details && `details=${error.details}`,
    error.hint && `hint=${error.hint}`,
  ].filter(Boolean);
  return parts.join(" | ");
}

function isMissingRelationError(error: PostgrestError): boolean {
  return (
    error.code === "42P01" ||
    error.message?.includes("cached_couple_traits") ||
    error.message?.includes("does not exist")
  );
}

function parseCachedRow(data: unknown): CachedCoupleTraitsRow | null {
  if (!data || typeof data !== "object") return null;

  const row = data as CachedCoupleTraitsRow;
  if (!row.self_traits?.traits?.length) return null;

  return row;
}

export async function fetchCachedCoupleTraits(
  supabase: SupabaseClient,
  coupleId: string
): Promise<CachedCoupleTraitsRow | null> {
  const { data, error } = await supabase
    .from("cached_couple_traits")
    .select(
      "couple_id, self_traits, partner_traits, generated_at, source_summary, model"
    )
    .eq("couple_id", coupleId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) {
      console.warn(
        "[fetchCachedCoupleTraits] table not found — apply migration 20260523140000_cached_couple_traits.sql"
      );
      return null;
    }

    console.error(formatSupabaseError(error, "[fetchCachedCoupleTraits] select"));
    return null;
  }

  return parseCachedRow(data);
}
