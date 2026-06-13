import type { CoupleHomeWorldDisplay } from "@/lib/couple-home-world/types";

type Props = {
  display: CoupleHomeWorldDisplay;
  variant?: "home" | "couple";
};

export default function CoupleHomeScene({ display, variant = "couple" }: Props) {
  const { sceneState, heroImageUrl } = display;

  const homeWindowClass =
    "relative w-full mx-0 mt-4 mb-1 overflow-hidden rounded-t-[50%] rounded-b-xl bg-gradient-to-b from-rose-50/80 to-sky-50/80";

  const homePlaceholderClass = `${homeWindowClass} aiai-home-scene-placeholder min-h-[200px]`;

  const frameClass =
    variant === "home"
      ? homeWindowClass
      : "relative min-h-[200px] mx-0 overflow-hidden rounded-t-[50%] rounded-b-xl aiai-couple-scene-frame";

  if (sceneState === "ready" && heroImageUrl) {
    if (variant === "home") {
      return (
        <div className={homeWindowClass} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImageUrl}
            alt=""
            className="block w-full h-auto"
          />
        </div>
      );
    }

    return (
      <div className={frameClass} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      </div>
    );
  }

  const placeholderClass =
    variant === "home"
      ? homePlaceholderClass
      : `aiai-home-scene-placeholder aiai-couple-scene-placeholder ${frameClass}`;

  return (
    <div className={placeholderClass}>
      <div className="absolute inset-x-[8%] bottom-[34%] h-px bg-white/40 rounded-full" />
      <div className="absolute inset-0 flex items-center justify-center px-6">
        {sceneState === "establishing" ? (
          <p
            className={
              variant === "home"
                ? "text-[10px] text-center leading-relaxed tracking-wide text-rose-400/90 opacity-90"
                : "aiai-couple-scene-caption text-[10px] text-center leading-relaxed tracking-wide opacity-90"
            }
          >
            ふたりの言葉から、
            <br />
            小さな世界を描いています…
          </p>
        ) : (
          <p
            className={
              variant === "home"
                ? "text-[10px] text-center leading-relaxed tracking-wide text-rose-400/80 opacity-80"
                : "aiai-couple-scene-caption text-[10px] text-center leading-relaxed tracking-wide opacity-80"
            }
          >
            ふたり質問を重ねると、
            <br />
            この窓の向こうが育っていきます
          </p>
        )}
      </div>
    </div>
  );
}
