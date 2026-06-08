import "server-only";

type CronAuthResult =
  | { ok: true; method: "vercel-cron" | "bearer" | "dev-open" }
  | { ok: false; status: 401 | 503; error: string };

function hasValidBearerSecret(request: Request, secret: string): boolean {
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** Vercel Cron 実行時にインフラが付与するヘッダー（値は "1"） */
function isVercelCronRequest(request: Request): boolean {
  return request.headers.get("x-vercel-cron") === "1";
}

/**
 * Cron エンドポイントの認証。
 *
 * production:
 * - Vercel Cron … `x-vercel-cron: 1` を許可
 * - 手動 curl / Vercel（CRON_SECRET 設定時）… `Authorization: Bearer <CRON_SECRET>` を許可
 *
 * development:
 * - CRON_SECRET 未設定なら認証スキップ（手動テスト用）
 * - CRON_SECRET 設定時は Bearer 必須
 */
export function verifyCronSecret(request: Request): CronAuthResult {
  const secret = process.env.CRON_SECRET?.trim();

  if (process.env.NODE_ENV === "production") {
    if (isVercelCronRequest(request)) {
      return { ok: true, method: "vercel-cron" };
    }

    if (!secret) {
      return {
        ok: false,
        status: 503,
        error: "CRON_SECRET is not configured",
      };
    }

    if (hasValidBearerSecret(request, secret)) {
      return { ok: true, method: "bearer" };
    }

    return { ok: false, status: 401, error: "Unauthorized" };
  }

  if (!secret) {
    return { ok: true, method: "dev-open" };
  }

  if (hasValidBearerSecret(request, secret)) {
    return { ok: true, method: "bearer" };
  }

  return { ok: false, status: 401, error: "Unauthorized" };
}
