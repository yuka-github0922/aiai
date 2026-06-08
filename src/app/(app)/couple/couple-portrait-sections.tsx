import Link from "next/link";
import type { CouplePortrait } from "@/lib/couple-portrait";
import InviteCodeCopy from "@/app/dashboard/invite-code-copy";

const TRAIT_STYLES = [
  "from-rose-50 to-white border-rose-100/80",
  "from-violet-50 to-white border-violet-100/80",
] as const;

const OBSERVATION_STYLES = [
  "from-rose-50 to-white border-rose-100/80 shadow-[2px_2px_0_rgba(251,207,232,0.3)]",
  "from-sky-50 to-white border-sky-100/80 shadow-[2px_2px_0_rgba(125,211,252,0.25)]",
  "from-amber-50 to-white border-amber-100/80 shadow-[2px_2px_0_rgba(252,211,77,0.2)]",
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
        <p className="text-[10px] text-rose-400/60 mt-1 tracking-wide">
          AiAiが会話から感じ取った、ふたりらしさ
        </p>
      </div>

      <ul className="space-y-2.5">
        {portrait.traits.map((trait, index) => {
          const style = TRAIT_STYLES[index % TRAIT_STYLES.length];

          return (
            <li
              key={trait.name}
              className={`bg-gradient-to-r ${style} rounded-xl px-4 py-3.5 border-2`}
            >
              <p className="text-[15px] font-black text-gray-800">{trait.name}</p>
              <p className="text-xs font-bold text-rose-500/90 mt-1 tracking-wide">
                {trait.typeLabel}
              </p>
              <p className="text-[13px] text-gray-600 mt-1 leading-snug">
                {trait.description}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function AiRecentNoticesSection({ portrait }: Pick<Props, "portrait">) {
  return (
    <section className="aiai-sticker-card px-4 py-5">
      <div className="mb-4">
        <p className="text-sm font-black text-gray-800 tracking-tight">
          <span className="text-violet-400">✦</span> AiAiが最近気づいたこと
        </p>
        <p className="text-[10px] text-violet-400/60 mt-1 tracking-wide">
          相談の積み重ねから、ふたりの変化をそっと観察しています
        </p>
      </div>

      <ul className="space-y-2.5">
        {portrait.recentNotices.map((notice, index) => {
          const style = OBSERVATION_STYLES[index % OBSERVATION_STYLES.length];

          return (
            <li
              key={notice.label}
              className={`flex items-center gap-3 bg-gradient-to-r ${style} rounded-xl px-4 py-3.5 border-2`}
            >
              <span
                className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/90 text-lg shrink-0 border border-white shadow-sm"
                aria-hidden="true"
              >
                {notice.emoji}
              </span>
              <span className="text-[13px] text-gray-700 leading-snug flex-1 font-medium">
                {notice.label}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function CoupleSettingsSection({
  inviteCode,
  hasPartner,
}: Pick<Props, "inviteCode" | "hasPartner">) {
  return (
    <section className="aiai-sticker-card px-4 py-5">
      <p className="text-sm font-black text-gray-800 mb-4">設定</p>

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
