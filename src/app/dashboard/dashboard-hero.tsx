import type { CoupleStats } from "@/lib/couple-stats";
import type { CoupleHomeWorldDisplay } from "@/lib/couple-home-world/types";
import CoupleHomeScene from "@/app/dashboard/couple-home-scene";
import HomeWorldGenerationTrigger from "@/app/dashboard/home-world-generation-trigger";
import InviteCodeCopy from "./invite-code-copy";

type Props = {
  selfName: string;
  partnerName: string;
  hasPartner: boolean;
  stats: CoupleStats;
  inviteCode: string | null;
  homeWorld: CoupleHomeWorldDisplay | null;
};

export default function DashboardHero({
  selfName,
  partnerName,
  hasPartner,
  stats,
  inviteCode,
  homeWorld,
}: Props) {
  const heartColor = homeWorld?.uiTokens?.heart_color;
  const subtitleColor = homeWorld?.uiTokens?.subtitle_color;

  return (
    <section className="aiai-sticker-card overflow-hidden">
      {hasPartner ? (
        <>
          <HomeWorldGenerationTrigger
            active={
              homeWorld?.sceneState === "establishing" ||
              homeWorld?.shouldRegrow === true
            }
          />
          <div className="aiai-arch-window bg-white px-5 pt-7 pb-5 relative">
            <span className="aiai-sticker-label absolute top-3 left-4 !bg-rose-200 !text-rose-800">
              ふたりの世界
            </span>
            <span className="absolute top-3 right-4 text-[10px] font-bold text-rose-300/90 tracking-widest">
              01
            </span>

            {homeWorld ? (
              <CoupleHomeScene display={homeWorld} />
            ) : null}

            <div className="relative z-10 pt-3">
              <p
                className="text-center text-[10px] tracking-wide text-rose-400/90"
                style={subtitleColor ? { color: subtitleColor } : undefined}
              >
                今日も、ふたりのことを大切に
              </p>

              <h1 className="text-center text-base font-bold text-gray-800 mt-2 leading-snug">
                <span className="aiai-marker-highlight">{selfName}</span>
                <span
                  className="mx-2 text-sm text-rose-400"
                  style={heartColor ? { color: heartColor } : undefined}
                >
                  ♥
                </span>
                <span className="aiai-marker-highlight">{partnerName}</span>
              </h1>

              {stats.daysTogether !== null && (
                <p className="text-center mt-4 leading-none">
                  <span className="block text-[11px] font-semibold text-rose-400/90 tracking-wide mb-1">
                    付き合って
                  </span>
                  <span className="aiai-outline-num text-5xl font-black tabular-nums">
                    {stats.daysTogether}
                  </span>
                  <span className="text-sm font-bold text-rose-400/80 ml-1">
                    日目
                  </span>
                </p>
              )}
            </div>
          </div>

          {stats.daysUntilAnniversary !== null && (
            <div className="px-5 py-3.5 flex items-center justify-center gap-2 bg-gradient-to-r from-white via-rose-50/40 to-white">
              <span
                className="text-rose-300 text-xs"
                style={heartColor ? { color: heartColor } : undefined}
                aria-hidden="true"
              >
                ♥
              </span>
              <p className="text-xs text-gray-600">
                {stats.upcomingAnniversaryTitle
                  ? `${stats.upcomingAnniversaryTitle}まで `
                  : "次の記念日まで "}
                <span className="font-bold text-rose-500 tabular-nums">
                  {stats.daysUntilAnniversary}
                </span>
                日
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="aiai-arch-window bg-gradient-to-br from-rose-100/80 via-violet-50/80 to-sky-100/80 px-5 py-8 text-center">
          <span className="aiai-sticker-label !bg-rose-200 !text-rose-800">
            ふたりの部屋
          </span>
          <p className="text-rose-300 text-xl mt-4" aria-hidden="true">
            ♥
          </p>
          <h1 className="text-base font-bold text-gray-800 mt-2">
            {selfName} を待っている
          </h1>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            大切な人を招待して、ふたりだけの空間をはじめよう
          </p>
          {inviteCode && (
            <div className="mt-5 bg-white/90 rounded-xl p-3 border-2 border-white shadow-[2px_2px_0_rgba(244,114,182,0.15)] text-left">
              <p className="text-[11px] text-rose-500 mb-2 text-center font-bold">
                恋の招待コード
              </p>
              <InviteCodeCopy code={inviteCode} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
