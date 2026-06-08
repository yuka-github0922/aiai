import type { CoupleStats } from "@/lib/couple-stats";

type Props = {
  /** 自分の相談から抽出されたメモ件数 */
  memoCount: number;
  consultationCount: number;
  anniversaryCount: number;
  stats: CoupleStats;
};

type StatItem = {
  label: string;
  value: string;
  unit: string;
};

export default function RecordsStatsSection({
  memoCount,
  consultationCount,
  anniversaryCount,
  stats,
}: Props) {
  const items: StatItem[] = [
    { label: "覚えていること", value: String(memoCount), unit: "件" },
    { label: "相談した回数", value: String(consultationCount), unit: "回" },
    { label: "記念日", value: String(anniversaryCount), unit: "件" },
  ];

  if (stats.daysTogether !== null) {
    items.push({
      label: "付き合って",
      value: String(stats.daysTogether),
      unit: "日",
    });
  }

  return (
    <section className="aiai-sticker-card px-4 py-5">
      <div className="mb-4">
        <p className="text-sm font-black text-gray-800 tracking-tight">
          <span className="text-sky-400">📊</span> ふたりのデータ
        </p>
        <p className="text-[10px] text-sky-400/60 mt-1 tracking-wide">
          相談を重ねるほど、数字が育っていくよ
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {items.map((item) => (
          <div
            key={item.label}
            className="bg-gradient-to-br from-white to-sky-50/40 rounded-xl px-3.5 py-3 border-2 border-sky-100/60"
          >
            <p className="text-[10px] font-bold text-gray-400 tracking-wide">
              {item.label}
            </p>
            <p className="mt-1 leading-none">
              <span className="text-2xl font-black text-gray-800 tabular-nums">
                {item.value}
              </span>
              <span className="text-xs font-bold text-sky-500/80 ml-0.5">
                {item.unit}
              </span>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
