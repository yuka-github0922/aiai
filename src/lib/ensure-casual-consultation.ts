import type { SupabaseClient } from "@supabase/supabase-js";

function isMissingRpcError(message: string | undefined): boolean {
  return (
    message?.includes("ensure_casual_consultation") === true ||
    message?.includes("Could not find the function") === true ||
    message?.includes("PGRST202") === true
  );
}

export async function ensureCasualConsultation(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data, error } = await supabase.rpc("ensure_casual_consultation");

  if (error) {
    console.error(
      "[casual-chat] ensure_casual_consultation error:",
      error.message,
      error.code,
      error.details
    );
    if (isMissingRpcError(error.message)) {
      console.warn(
        "[casual-chat] apply scripts/apply-casual-consultation.sql then NOTIFY pgrst, 'reload schema';"
      );
    }
    return null;
  }

  if (data == null) return null;
  return String(data);
}
