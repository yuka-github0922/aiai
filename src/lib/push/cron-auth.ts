import "server-only";

type CronAuthResult =
  | { ok: true; method: "vercel-cron" | "bearer" | "dev-open" }
  | { ok: false; status: 401 | 503; error: string };

function hasValidBearerSecret(request: Request, secret: string): boolean {
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** Vercel Cron 実行時にインフラが付与するヘッダー（値は通常 "1"） */
function hasVercelCronHeader(request: Request): boolean {
  const value = request.headers.get("x-vercel-cron");
  return value != null && value.length > 0;
}

/** ログ識別用: x-vercel-cron または User-Agent が vercel-cron/ なら Cron 実行とみなす */
function isVercelCronInvocation(request: Request): boolean {
  if (hasVercelCronHeader(request)) return true;
  const userAgent = request.headers.get("user-agent") ?? "";
  return userAgent.startsWith("vercel-cron/");
}

function resolveAuthMethod(
  request: Request,
  authVia: "vercel-cron" | "bearer" | "dev-open"
): "vercel-cron" | "bearer" | "dev-open" {
  if (isVercelCronInvocation(request)) return "vercel-cron";
  return authVia;
}

/**
 * Cron エンドポイントの認証。
 *
 * production:
 * - Vercel Cron … `x-vercel-cron` ヘッダーを優先（Bearer より先に判定）
 * - 手動 curl / Vercel（CRON_SECRET 設定時）… `Authorization: Bearer <CRON_SECRET>` を許可
 *
 * development:
 * - CRON_SECRET 未設定なら認証スキップ（手動テスト用）
 * - CRON_SECRET 設定時は Bearer 必須
 */
export function verifyCronSecret(request: Request): CronAuthResult {
  const secret = process.env.CRON_SECRET?.trim();

  if (process.env.NODE_ENV === "production") {
    // 1. x-vercel-cron（Bearer より優先してログ識別）
    if (hasVercelCronHeader(request)) {
      return { ok: true, method: "vercel-cron" };
    }

    if (!secret) {
      return {
        ok: false,
        status: 503,
        error: "CRON_SECRET is not configured",
      };
    }

    // 2. Authorization: Bearer（手動 curl / Vercel の CRON_SECRET 付与）
    if (hasValidBearerSecret(request, secret)) {
      return {
        ok: true,
        method: resolveAuthMethod(request, "bearer"),
      };
    }

    return { ok: false, status: 401, error: "Unauthorized" };
  }

  if (!secret) {
    return { ok: true, method: "dev-open" };
  }

  if (hasValidBearerSecret(request, secret)) {
    return {
      ok: true,
      method: resolveAuthMethod(request, "bearer"),
    };
  }

  return { ok: false, status: 401, error: "Unauthorized" };
}
