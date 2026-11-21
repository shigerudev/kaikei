"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { formatAmount } from "@/lib/ui/format";

/**
 * Counts a figure up to its exact value once per run (`version` = run id), to draw the eye to a fresh
 * result. Intermediate frames are display-only; the settled text is always the exact formatted value.
 * Skipped under reduced motion and on repeat views.
 */
export function CountUp({ value, version, dp = 0, className = "" }: { value: string; version: string | null; dp?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const exact = formatAmount(value, { dp });

  useEffect(() => {
    const el = ref.current;
    if (!el || reduce || !version) return;
    const key = `kaikei:counted:${version}:${value}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    const target = Number(value);
    const controls = animate(target * 0.86, target, {
      duration: 0.55,
      ease: [0.23, 1, 0.32, 1],
      onUpdate: (v) => {
        el.textContent = formatAmount(v.toFixed(dp), { dp });
      },
      onComplete: () => {
        el.textContent = exact;
      },
    });
    return () => controls.stop();
  }, [value, version, reduce, exact, dp]);

  return (
    <span ref={ref} className={`num ${className}`}>
      {exact}
    </span>
  );
}
