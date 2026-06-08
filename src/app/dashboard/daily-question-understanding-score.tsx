import {
  computeUnderstandingScore,
  type UnderstandingScoreInput,
} from "@/lib/daily-question-score";

type Props = UnderstandingScoreInput;

export default function DailyQuestionUnderstandingScore({
  myGuess,
  myAnswer,
  partnerGuess,
  partnerAnswer,
}: Props) {
  const score = computeUnderstandingScore({
    myGuess,
    myAnswer,
    partnerGuess,
    partnerAnswer,
  });

  return (
    <div className="rounded-xl border-2 border-violet-100/80 bg-gradient-to-r from-violet-50/50 via-white to-rose-50/40 px-4 py-3.5 space-y-2.5">
      <p className="text-sm font-black text-violet-600/90">
        🎯 ふたりの理解度{" "}
        <span className="tabular-nums">{score.coupleScore}%</span>
      </p>

      <p className="text-[12px] text-gray-600 leading-snug font-medium">
        {score.message}
      </p>

      <div className="pt-2 border-t border-violet-100/60 space-y-1">
        <p className="text-[11px] text-gray-500">
          あなた → 相手の予想：
          <span className="font-bold tabular-nums text-gray-700">
            {score.myScore}%
          </span>
        </p>
        <p className="text-[11px] text-gray-500">
          相手 → あなたの予想：
          <span className="font-bold tabular-nums text-gray-700">
            {score.partnerScore}%
          </span>
        </p>
      </div>
    </div>
  );
}
