"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Props = {
  active: boolean;
};

export default function HomeWorldGenerationTrigger({ active }: Props) {
  const router = useRouter();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!active || startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;

    async function run() {
      try {
        const res = await fetch("/api/couple-home-world/generate", {
          method: "POST",
        });

        if (!res.ok) {
          console.error("[HomeWorldGenerationTrigger] failed", await res.text());
          return;
        }

        const body = (await res.json()) as { completed?: boolean };
        if (!cancelled && body.completed) {
          router.refresh();
        }
      } catch (err) {
        console.error("[HomeWorldGenerationTrigger] error", err);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [active, router]);

  return null;
}
