import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { decryptMessageBody } from "@/lib/encryption";
import ChatPanel from "./chat-panel";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ConsultationPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: consultation, error: consultationError } = await supabase
    .from("consultations")
    .select("id, title, user_id, created_at")
    .eq("id", id)
    .maybeSingle();

  if (consultationError) {
    console.error("consultation fetch error:", consultationError);
  }

  if (!consultation) notFound();

  if (consultation.user_id !== user.id) redirect("/consultations");

  const { data: rawMessages, error: messagesError } = await supabase
    .from("messages")
    .select("id, user_id, role, body_encrypted, body_iv, body_auth_tag, created_at")
    .eq("consultation_id", id)
    .order("created_at", { ascending: true });

  if (messagesError) {
    console.error("messages fetch error:", messagesError);
  }

  const messages = (rawMessages ?? []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    role: row.role,
    body: decryptMessageBody(row),
    created_at: row.created_at,
  }));

  return (
    <main className="min-h-screen aiai-dashboard-bg flex flex-col">
      <header className="bg-white/90 backdrop-blur-md border-b-2 border-white px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <Link
          href="/consultations"
          className="text-gray-400 hover:text-rose-500 text-lg font-bold w-8"
          aria-label="相談一覧に戻る"
        >
          ←
        </Link>
        <h1 className="font-bold text-gray-800 truncate flex-1 text-[15px]">
          {consultation.title}
        </h1>
      </header>

      <div className="flex-1 flex flex-col max-w-lg w-full mx-auto overflow-hidden">
        <ChatPanel
          consultationId={id}
          initialMessages={messages}
          userId={user.id}
        />
      </div>
    </main>
  );
}
