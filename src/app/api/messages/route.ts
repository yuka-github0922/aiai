import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { encrypt } from "@/lib/encryption";

export async function POST(request: NextRequest) {
  // --- 認証 ---
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- リクエスト検証 ---
  let consultationId: string;
  let messageBody: string;
  try {
    const body = await request.json();
    consultationId = body.consultationId;
    messageBody   = body.message;
    if (!consultationId || !messageBody?.trim()) {
      throw new Error("missing fields");
    }
  } catch {
    return NextResponse.json(
      { error: "consultationId and message are required" },
      { status: 400 }
    );
  }

  const plaintext = messageBody.trim();

  // --- サーバーサイドで暗号化 ---
  let payload: ReturnType<typeof encrypt>;
  try {
    payload = encrypt(plaintext);
  } catch (err) {
    console.error("[api/messages] encrypt error:", err);
    return NextResponse.json(
      { error: "Encryption failed. Check MESSAGE_ENCRYPTION_KEY." },
      { status: 500 }
    );
  }

  // --- send_message RPC（暗号列を渡す）---
  const { data: newId, error: rpcError } = await supabase.rpc("send_message", {
    consultation_id_param: consultationId,
    body_encrypted_param:  payload.encrypted,
    body_iv_param:         payload.iv,
    body_auth_tag_param:   payload.authTag,
  });

  if (rpcError) {
    console.error("[api/messages] send_message error:", rpcError);
    return NextResponse.json(
      { error: `Failed to save message: ${rpcError.message}` },
      { status: 500 }
    );
  }

  // ブラウザには平文を返す（HTTPS 上のため安全）
  return NextResponse.json({
    id:         newId as string,
    user_id:    user.id,
    role:       "user",
    body:       plaintext,
    created_at: new Date().toISOString(),
  });
}
