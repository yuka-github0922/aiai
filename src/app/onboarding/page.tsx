"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 8 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

export default function OnboardingPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"create" | "join">("create");

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);

    const supabase = createClient();
    const inviteCode = generateInviteCode();

    const { error } = await supabase.rpc("create_couple_for_user", {
      invite_code_param: inviteCode,
    });

    if (error) {
      console.error("[onboarding] create_couple_for_user error:", error);
      if (error.message?.includes("authentication required")) {
        setCreateError("ログインが必要です。ページを再読み込みしてください");
      } else {
        setCreateError(
          `カップルの作成に失敗しました: ${error.message ?? "不明なエラー"}`
        );
      }
      setCreating(false);
      return;
    }

    setCreatedCode(inviteCode);
    setCreating(false);
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoining(true);
    setJoinError(null);

    const supabase = createClient();
    const code = joinCode.trim().toUpperCase();

    const { error } = await supabase.rpc("join_couple_by_code", {
      invite_code_param: code,
    });

    if (error) {
      console.error("[onboarding] join_couple_by_code error:", error);
      if (error.message?.includes("invite code not found")) {
        setJoinError("招待コードが正しくありません");
      } else if (error.message?.includes("2人")) {
        setJoinError("このカップルは満員です");
      } else if (error.message?.includes("authentication required")) {
        setJoinError("ログインが必要です。ページを再読み込みしてください");
      } else {
        setJoinError(
          `参加に失敗しました: ${error.message ?? "不明なエラー"}`
        );
      }
      setJoining(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleCopyCode() {
    if (!createdCode) return;
    await navigator.clipboard.writeText(createdCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          カップルを始めよう
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          新しいカップルを作るか、招待コードで参加してください
        </p>

        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => {
              setTab("create");
              setCreateError(null);
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "create"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            作成する
          </button>
          <button
            onClick={() => {
              setTab("join");
              setJoinError(null);
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "join"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            招待コードで参加
          </button>
        </div>

        {tab === "create" && (
          <div>
            {createdCode ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-gray-700">
                  カップルを作成しました！パートナーに下の招待コードを共有してください。
                </p>
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                  <code className="flex-1 text-xl font-mono font-bold tracking-widest text-gray-900">
                    {createdCode}
                  </code>
                  <button
                    onClick={handleCopyCode}
                    className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    {codeCopied ? "コピー済み ✓" : "コピー"}
                  </button>
                </div>
                <button
                  onClick={() => {
                    router.push("/dashboard");
                    router.refresh();
                  }}
                  className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
                >
                  ダッシュボードへ
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-gray-600">
                  ボタンを押すと招待コードが発行されます。パートナーにコードを共有して参加してもらいましょう。
                </p>
                {createError && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    {createError}
                  </p>
                )}
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
                >
                  {creating ? "作成中..." : "カップルを作る"}
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "join" && (
          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <p className="text-sm text-gray-600">
              パートナーから受け取った招待コードを入力してください。
            </p>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="join-code"
                className="text-sm font-medium text-gray-700"
              >
                招待コード
              </label>
              <input
                id="join-code"
                type="text"
                required
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="例: ABCD1234"
                maxLength={8}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {joinError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {joinError}
              </p>
            )}
            <button
              type="submit"
              disabled={joining}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
            >
              {joining ? "参加中..." : "参加する"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
