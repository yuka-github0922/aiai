import Link from "next/link";

export default function ConsultCta() {
  return (
    <section className="pt-0.5 pb-1">
      <Link
        href="/consultations"
        className="aiai-cta-seventeen block w-full text-center px-5 py-5 rounded-2xl transition-all active:scale-[0.98]"
      >
        <span className="block text-lg font-black text-white tracking-tight drop-shadow-sm">
          ♥ AiAiに相談する
        </span>
        <span className="block text-[11px] text-white/90 mt-1 font-semibold">
          恋のモヤモヤを、ふたりでやさしくほどく
        </span>
      </Link>
    </section>
  );
}
