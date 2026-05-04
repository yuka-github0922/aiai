"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("パスワードが一致しません。");
      return;
    }
    if (password.length < 8) {
      setError("パスワードは8文字以上にしてください。");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // メール確認が不要な場合（Supabase設定により即ログイン）
    if (data.session) {
      router.push("/onboarding");
      router.refresh();
      return;
    }

    // メール確認が必要な場合
    setSent(true);
  }

  if (sent) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-rose-50 px-4">
        <Link href="/" className="flex flex-col items-center mb-8">
          <span className="text-4xl mb-1">♥</span>
          <span className="text-xl font-bold text-rose-500 tracking-tight">AiAi</span>
        </Link>

        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-rose-100 p-8 text-center">
          <div className="text-4xl mb-4">📩</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">確認メールを送りました</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            <span className="font-medium text-gray-700">{email}</span> に確認メールを送信しました。
            メール内のリンクをクリックして登録を完了してください。
          </p>
          <Link
            href="/login"
            className="inline-block text-sm text-rose-500 hover:text-rose-600 font-medium"
          >
            ログインページへ →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-rose-50 px-4">
      {/* ロゴ */}
      <Link href="/" className="flex flex-col items-center mb-8 group">
        <span className="text-4xl mb-1">♥</span>
        <span className="text-xl font-bold text-rose-500 tracking-tight group-hover:text-rose-600 transition-colors">
          AiAi
        </span>
      </Link>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-rose-100 p-8">
        <h1 className="text-xl font-bold text-gray-800 mb-1">アカウント作成</h1>
        <p className="text-sm text-gray-400 mb-6">無料ではじめましょう</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium text-gray-700">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium text-gray-700">
              パスワード
              <span className="text-gray-400 font-normal ml-1">（8文字以上）</span>
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="confirm" className="text-sm font-medium text-gray-700">
              パスワード（確認）
            </label>
            <input
              id="confirm"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors"
          >
            {loading ? "登録中..." : "アカウントを作成する"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-6">
          すでにアカウントをお持ちの方は{" "}
          <Link href="/login" className="text-rose-500 hover:text-rose-600 font-medium">
            ログイン
          </Link>
        </p>
      </div>
    </main>
  );
}
