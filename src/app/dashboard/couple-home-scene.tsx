import type { CoupleHomeWorldDisplay } from "@/lib/couple-home-world/types";

type Props = {
  display: CoupleHomeWorldDisplay;
};

const PLACEHOLDER_GRADIENT =
  "bg-gradient-to-b from-rose-100/95 via-orange-50/90 to-sky-100/85";

export default function CoupleHomeScene({ display }: Props) {
  const { sceneState, heroImageUrl } = display;

  if (sceneState === "ready" && heroImageUrl) {
    return (
      <div
        className="relative min-h-[148px] mx-1 mt-5 mb-1 overflow-hidden rounded-t-[50%] rounded-b-xl"
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative min-h-[148px] mx-1 mt-5 mb-1 overflow-hidden rounded-t-[50%] rounded-b-xl ${PLACEHOLDER_GRADIENT}`}
    >
      <div className="absolute inset-x-[8%] bottom-[34%] h-px bg-white/40 rounded-full" />
      <div className="absolute inset-0 flex items-center justify-center px-6">
        {sceneState === "establishing" ? (
          <p className="text-[10px] text-rose-400/80 text-center leading-relaxed tracking-wide">
            ふたりの言葉から、
            <br />
            小さな世界を描いています…
          </p>
        ) : (
          <p className="text-[10px] text-rose-400/75 text-center leading-relaxed tracking-wide">
            ふたり質問を重ねると、
            <br />
            この窓の向こうが育っていきます
          </p>
        )}
      </div>
    </div>
  );
}
