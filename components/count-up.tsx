"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { formatMinor } from "@/lib/money";

/**
 * Animates a money figure up to its exact value once per data version (`version` = as_of import id).
 * Purpose: draw the eye to a figure that changed after an upload. The final text is always the exact
 * `formatMinor` output; intermediate frames are display-only. Skipped under reduced motion or repeats.
 */
export function CountUp({ minor, currency, version, className = "" }: { minor: string; currency: string; version: string | null; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const exact = formatMinor(minor, currency);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduce || !version) return;
    const key = `kaikei:counted:${version}:${minor}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    const target = Number(BigInt(minor));
    const controls = animate(target * 0.82, target, {
      duration: 0.5,
      ease: [0.23, 1, 0.32, 1],
      onUpdate: (v) => {
        el.textContent = formatMinor(BigInt(Math.round(v)), currency);
      },
      onComplete: () => {
        el.textContent = exact;
      },
    });
    return () => controls.stop();
  }, [minor, currency, version, reduce, exact]);

  return (
    <span ref={ref} className={`num ${className}`}>
      {exact}
    </span>
  );
}
