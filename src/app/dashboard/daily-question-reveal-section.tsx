export default function DailyQuestionRevealSection({
  heading,
  answerLabel,
  answer,
  guessLabel,
  guess,
}: {
  heading: string;
  answerLabel: string;
  answer: string;
  guessLabel: string;
  guess: string;
}) {
  return (
    <div className="rounded-xl border-2 border-rose-100/80 bg-gradient-to-r from-rose-50/60 to-white px-4 py-3.5 space-y-3">
      <p className="text-[12px] font-black text-rose-500/90">{heading}</p>
      <div>
        <p className="text-[10px] font-bold text-gray-400 mb-1">{answerLabel}</p>
        <p className="text-[13px] text-gray-700 leading-snug font-medium">
          「{answer}」
        </p>
      </div>
      <div className="pt-1 border-t border-rose-100/60">
        <p className="text-[10px] font-bold text-gray-400 mb-1 mt-2">
          {guessLabel}
        </p>
        <p className="text-[13px] text-gray-700 leading-snug font-medium">
          「{guess}」
        </p>
      </div>
    </div>
  );
}
