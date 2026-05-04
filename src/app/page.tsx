import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FloatingHearts from "./floating-hearts";

export default async function TopPage() {
  // ログイン済みならダッシュボードへ
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ナビゲーション */}
      <header className="px-6 py-4 flex items-center justify-between max-w-5xl mx-auto w-full">
        <span className="text-xl font-bold text-rose-500 tracking-tight">AiAi</span>
        <Link
          href="/login"
          className="text-sm font-medium text-gray-600 hover:text-rose-500 transition-colors"
        >
          ログイン
        </Link>
      </header>

      {/* ヒーロー */}
      <section className="relative flex-1 flex flex-col items-center justify-center text-center px-6 py-20 overflow-hidden">
        {/* 浮かぶハート（スクロール後に表示） */}
        <FloatingHearts />
        <div className="inline-flex items-center gap-2 bg-rose-50 text-rose-500 text-xs font-semibold px-3 py-1 rounded-full mb-6 tracking-wide">
          ✦ AI × カップル
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-5 max-w-xl">
          ふたりのすれ違いを、<br />
          <span className="text-rose-500">AIがやさしくほどく。</span>
        </h1>

        <p className="text-gray-500 text-base sm:text-lg max-w-md leading-relaxed mb-10">
          AiAiは、パートナーへの相談をAIがサポートするプライベートなアドバイザーです。
          あなたの相談内容はパートナーには見えません。
          AIがふたりのことを少しずつ学んで、より的確な助言をお届けします。
        </p>

        <Link
          href="/login"
          className="relative bg-rose-500 hover:bg-rose-600 text-white font-semibold px-8 py-3 rounded-full text-sm transition-colors shadow-sm"
        >
          はじめる（無料）
        </Link>
      </section>

      {/* 特徴 */}
      <section className="bg-gray-50 py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-2xl font-bold text-gray-800 mb-10">
            AiAi でできること
          </h2>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: "💬",
                title: "ひとりで相談できる",
                body: "パートナーには見せない、自分だけのチャット空間。AIに本音を話しながら、気持ちを整理できます。",
              },
              {
                icon: "🧠",
                title: "AIがパートナーを学ぶ",
                body: "AIはあなたの相談から、パートナーの傾向や好みを少しずつ学習。アドバイスがふたりに合わせてカスタマイズされます。",
              },
              {
                icon: "🔒",
                title: "プライバシーを守る",
                body: "相談内容はすべて暗号化して保存。パートナーの生のメッセージはお互いに見えない設計です。",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-gray-800 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 使い方 */}
      <section className="py-16 px-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-center text-2xl font-bold text-gray-800 mb-10">
            3ステップではじめる
          </h2>

          <ol className="space-y-6">
            {[
              {
                step: "01",
                title: "アカウントを作成",
                body: "メールアドレスとパスワードで登録。30秒で完了します。",
              },
              {
                step: "02",
                title: "カップルをつなぐ",
                body: "招待コードをパートナーに共有して、ふたりのスペースを作ります。",
              },
              {
                step: "03",
                title: "相談をスタート",
                body: "AIに気軽に話しかけてみてください。聞いて、整理して、アドバイスします。",
              },
            ].map((s) => (
              <li key={s.step} className="flex gap-5 items-start">
                <span className="text-rose-400 font-bold text-lg tabular-nums w-8 shrink-0 pt-0.5">
                  {s.step}
                </span>
                <div>
                  <p className="font-semibold text-gray-800 mb-1">{s.title}</p>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-rose-50 py-16 px-6 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-3">
          ふたりの関係を、もっとやさしく。
        </h2>
        <p className="text-gray-500 text-sm mb-8">
          まずは自分のアカウントを作るところから。
        </p>
        <Link
          href="/login"
          className="bg-rose-500 hover:bg-rose-600 text-white font-semibold px-8 py-3 rounded-full text-sm transition-colors shadow-sm"
        >
          AiAi をはじめる
        </Link>
      </section>

      {/* フッター */}
      <footer className="py-6 text-center text-xs text-gray-400">
        © 2026 AiAi
      </footer>
    </div>
  );
}
