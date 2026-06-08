import type { AiMemoryItem } from "@/lib/ai-memories";

type Props = {
  memories: AiMemoryItem[];
};

const PASTEL_STYLES = [
  "from-rose-50 to-white border-rose-100/80 shadow-[2px_2px_0_rgba(251,207,232,0.3)]",
  "from-sky-50 to-white border-sky-100/80 shadow-[2px_2px_0_rgba(125,211,252,0.25)]",
  "from-violet-50 to-white border-violet-100/80 shadow-[2px_2px_0_rgba(196,181,253,0.25)]",
] as const;

export function AiMemoryCard({
  memory,
  index,
}: {
  memory: AiMemoryItem;
  index: number;
}) {
  const style = PASTEL_STYLES[index % PASTEL_STYLES.length];

  return (
    <li>
      <div
        className={`w-full flex items-center gap-3 bg-gradient-to-r ${style} rounded-xl px-4 py-3.5 border-2`}
      >
        <span
          className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/90 text-lg shrink-0 border border-white shadow-sm"
          aria-hidden="true"
        >
          {memory.emoji}
        </span>
        <span className="text-[13px] text-gray-700 leading-snug flex-1 font-medium">
          {memory.label}
        </span>
      </div>
    </li>
  );
}

export default function AiMemoriesSection({ memories }: Props) {
  return (
    <section className="aiai-sticker-card px-4 py-5">
      <div className="mb-4">
        <p className="text-sm font-black text-gray-800 tracking-tight">
          <span className="text-rose-400">♡</span> AiAiが覚えていること
        </p>
        <p className="text-[10px] text-rose-400/60 mt-1 tracking-wide">
          このAI、私たちのこと覚えてる…
        </p>
      </div>

      {memories.length > 0 ? (
        <ul className="space-y-2.5">
          {memories.map((memory, i) => (
            <AiMemoryCard key={memory.id} memory={memory} index={i} />
          ))}
        </ul>
      ) : (
        <div className="text-center py-6 px-3 rounded-xl border-2 border-dashed border-rose-200/50 bg-rose-50/25">
          <p className="text-sm text-gray-500 leading-relaxed">
            相談を重ねるほど、ふたりの思い出がここに増えていくよ
          </p>
        </div>
      )}

      <p className="text-[10px] font-bold text-amber-400/70 text-right mt-3 tracking-widest">
        03
      </p>
    </section>
  );
}
