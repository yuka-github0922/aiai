import type { AiMemoryItem } from "@/lib/ai-memories";

type Props = {
  memories: AiMemoryItem[];
};

const TAG_STYLES = [
  {
    chip: "bg-amber-50/90 border-amber-200/70 text-amber-950",
    rotate: "-rotate-1",
  },
  {
    chip: "bg-sky-50/90 border-sky-200/70 text-sky-950",
    rotate: "rotate-1",
  },
  {
    chip: "bg-rose-50/90 border-rose-200/70 text-rose-950",
    rotate: "-rotate-[0.5deg]",
  },
  {
    chip: "bg-lime-50/90 border-lime-200/70 text-lime-950",
    rotate: "rotate-[0.5deg]",
  },
] as const;

function formatMemoDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function AiMemoryCard({
  memory,
  index,
}: {
  memory: AiMemoryItem;
  index: number;
}) {
  const style = TAG_STYLES[index % TAG_STYLES.length];

  return (
    <li className={style.rotate}>
      <span
        className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border-2 border-dashed px-3 py-2 shadow-[1px_2px_0_rgba(251,191,36,0.15)] ${style.chip}`}
      >
        <span className="text-base leading-none shrink-0" aria-hidden="true">
          {memory.emoji}
        </span>
        <span className="text-[12px] font-semibold leading-snug text-left">
          {memory.label}
        </span>
      </span>
    </li>
  );
}

export default function AiMemoriesSection({ memories }: Props) {
  const latestDate =
    memories.length > 0
      ? formatMemoDate(
          memories.reduce((latest, memory) =>
            new Date(memory.createdAt).getTime() >
            new Date(latest.createdAt).getTime()
              ? memory
              : latest
          ).createdAt
        )
      : null;

  return (
    <section className="aiai-sticker-card px-4 py-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-gray-800 tracking-tight">
            <span className="aiai-sticker-label mr-1.5">MEMO</span>
            AiAiが覚えていること
          </p>
          <p className="text-[10px] text-rose-400/60 mt-1.5 tracking-wide">
            あなたの相談・雑談から拾ったメモ
          </p>
        </div>
        {latestDate ? (
          <span className="shrink-0 rounded-md border border-dashed border-rose-200/60 bg-rose-50/40 px-2 py-1 text-[9px] font-bold text-rose-400/70">
            {latestDate}
          </span>
        ) : null}
      </div>

      {memories.length > 0 ? (
        <div className="rounded-xl border-2 border-dashed border-rose-200/45 bg-[linear-gradient(135deg,rgba(255,251,235,0.45),rgba(255,241,242,0.35))] p-3">
          <ul className="flex flex-wrap gap-2">
            {memories.map((memory, i) => (
              <AiMemoryCard key={memory.id} memory={memory} index={i} />
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-rose-200/50 bg-rose-50/25 px-3 py-6 text-center">
          <p className="text-[11px] font-bold text-rose-300/80 tracking-widest">
            # empty
          </p>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
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
