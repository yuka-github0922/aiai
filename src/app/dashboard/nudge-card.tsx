type Props = {
  message: string;
};

function AiAiAvatar() {
  return (
    <div className="shrink-0 relative" aria-hidden="true">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-rose-200 to-rose-100 flex items-center justify-center shadow-[2px_2px_0_rgba(244,114,182,0.2)] border-2 border-white">
        <span className="text-2xl text-rose-400 leading-none">♥</span>
      </div>
    </div>
  );
}

export default function NudgeCard({ message }: Props) {
  return (
    <section className="aiai-sticker-card px-4 py-5 relative">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-black text-gray-800 tracking-tight">
          <span className="text-rose-400">♥</span> AiAiからのひとこと
        </p>
        <span className="text-[10px] font-bold text-rose-300/80 tracking-widest">02</span>
      </div>

      <div className="flex gap-3 items-start">
        <div className="flex-1 min-w-0 relative">
          <div className="bg-gradient-to-br from-rose-50/95 via-orange-50/80 to-white rounded-2xl rounded-bl-sm px-4 py-4 border-2 border-white shadow-[3px_3px_0_rgba(251,207,232,0.35)]">
            <p className="text-[14px] text-gray-700 leading-[1.85] whitespace-pre-line">
              {message}
            </p>
          </div>
          <div
            className="absolute -bottom-1 left-6 w-3 h-3 bg-rose-50 border-l-2 border-b-2 border-white rotate-45"
            aria-hidden="true"
          />
        </div>
        <div className="pt-2">
          <AiAiAvatar />
        </div>
      </div>

      <p className="text-[10px] text-rose-400/70 mt-4 text-center tracking-wide">
        ♡ ふたりの関係を見守り、今日のひとことを届けています
      </p>
    </section>
  );
}
