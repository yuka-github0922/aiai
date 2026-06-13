import type { ReactNode } from "react";
import Link from "next/link";
import type { CouplePortrait } from "@/lib/couple-portrait";
import type { AiRecentNotice } from "@/lib/couple-portrait";
import InviteCodeCopy from "@/app/dashboard/invite-code-copy";

const TRAIT_STYLES = [
  "from-rose-50 to-white border-rose-100/80",
  "from-violet-50 to-white border-violet-100/80",
] as const;

type Props = {
  portrait: CouplePortrait;
  inviteCode: string | null;
  hasPartner: boolean;
};

export function CoupleTraitsSection({ portrait }: Pick<Props, "portrait">) {
  return (
    <section className="aiai-sticker-card px-4 py-5">
      <div className="mb-4">
        <p className="text-sm font-black text-gray-800 tracking-tight">
          <span className="text-rose-400">♡</span> ふたりの特徴
        </p>
        <p className="text-[10px] text-rose-400/60 mt-1 tracking-wide leading-relaxed">
          AiAiが予想した紹介文と似顔絵で、
          <br />
          ふたりで笑い合えるプロフィール
        </p>
      </div>

      <ul className="space-y-3">
        {portrait.traits.map((trait, index) => {
          const style = TRAIT_STYLES[index % TRAIT_STYLES.length];
          const lines =
            trait.traits.length > 0
              ? trait.traits
              : trait.description
                ? [trait.description]
                : [];

          return (
            <li
              key={trait.name}
              className={`bg-gradient-to-r ${style} rounded-xl px-4 py-4 border-2`}
            >
              <div className="flex gap-3.5 items-start">
                {trait.avatarUrl ? (
                  <div className="shrink-0 flex flex-col items-center gap-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={trait.avatarUrl}
                      alt={`${trait.name}のAiAi予想似顔絵`}
                      width={72}
                      height={72}
                      className="w-[72px] h-[72px] rounded-2xl border-2 border-white shadow-sm object-cover bg-white"
                    />
                    <span className="text-[9px] text-rose-400/70 font-bold tracking-wide">
                      AiAiの予想
                    </span>
                  </div>
                ) : null}

                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-black text-gray-800">
                    {trait.name}
                  </p>
                  <div className="mt-2.5 space-y-0.5">
                    {lines.map((line, lineIndex) => (
                      <p
                        key={`${trait.name}-${lineIndex}`}
                        className="text-[13px] text-gray-600 leading-relaxed"
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function AiRecentNoticesSection({
  notices,
  hasPartner,
}: {
  notices: AiRecentNotice[];
  hasPartner: boolean;
}) {
  return (
    <section className="aiai-sticker-card overflow-hidden p-0">
      <header className="border-b border-slate-200/80 bg-gradient-to-r from-slate-50 to-violet-50/40 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[9px] font-bold tracking-[0.28em] text-violet-500">
            AI REPORT
          </p>
          <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-mono text-slate-400">
            v1.0
          </span>
        </div>
        <p className="mt-2 text-sm font-black text-gray-800 tracking-tight">
          AiAiが最近気づいたこと
        </p>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
          最近の変化・話題の変化を、AIがやさしく観察しています
        </p>
      </header>

      {notices.length > 0 ? (
        <div className="space-y-3 px-4 py-4">
          {notices.map((notice, index) => (
            <article
              key={`${notice.label}-${index}`}
              className="rounded-r-lg border border-slate-100 border-l-[3px] border-l-violet-400 bg-white px-3.5 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-[9px] font-mono font-bold tracking-wide text-violet-400/90">
                  FINDING · {String(index + 1).padStart(2, "0")}
                </p>
                <span
                  className="text-sm leading-none opacity-70"
                  aria-hidden="true"
                >
                  {notice.emoji}
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-slate-700">
                {notice.label}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="px-4 py-6 text-center">
          <p className="text-[10px] font-mono text-violet-300/80 tracking-widest">
            NO FINDINGS YET
          </p>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            {hasPartner
              ? "相談やデイリー質問を重ねると、関係の変化がここに現れます"
              : "パートナーを招待して、ふたりの観察レポートを始めましょう"}
          </p>
          <p className="mt-2 text-[10px] text-slate-400 leading-relaxed">
            相談の内容そのものではなく、変化として言語化しています
          </p>
        </div>
      )}

      <footer className="border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
        <p className="text-[9px] font-mono text-slate-400">
          — end of report · AiAi observation engine
        </p>
      </footer>
    </section>
  );
}

export function CoupleSettingsSection({
  inviteCode,
  hasPartner,
  onboardingSlot,
}: Pick<Props, "inviteCode" | "hasPartner"> & {
  onboardingSlot?: ReactNode;
}) {
  return (
    <section className="aiai-sticker-card px-4 py-5">
      <p className="text-sm font-black text-gray-800 mb-4">設定</p>

      {onboardingSlot}

      <ul className="space-y-2">
        <li>
          <Link
            href="/settings"
            className="flex items-center justify-between w-full text-left px-4 py-3.5 rounded-xl border-2 border-gray-100 bg-white hover:border-rose-100 transition-colors"
          >
            <span className="text-[13px] font-bold text-gray-700">
              プロフィール編集
            </span>
            <span className="text-gray-300 text-sm" aria-hidden="true">
              ›
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/settings#anniversaries"
            className="flex items-center justify-between w-full text-left px-4 py-3.5 rounded-xl border-2 border-gray-100 bg-white hover:border-rose-100 transition-colors"
          >
            <span className="text-[13px] font-bold text-gray-700">
              記念日編集
            </span>
            <span className="text-gray-300 text-sm" aria-hidden="true">
              ›
            </span>
          </Link>
        </li>
      </ul>

      {inviteCode && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-[11px] text-gray-400 mb-2 font-semibold">
            招待コード
          </p>
          {!hasPartner && (
            <p className="text-[10px] text-rose-400/70 mb-2">
              パートナーを招待して、ふたりの部屋を完成させよう
            </p>
          )}
          <InviteCodeCopy code={inviteCode} />
        </div>
      )}
    </section>
  );
}
