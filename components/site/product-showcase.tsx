"use client";

import { useEffect, useRef, useState } from "react";
import type { Step } from "@/components/site/dict";
import { cn } from "@/lib/utils";

/** Scroll-driven steps on the left, the matching real screen held sticky on the right. */
export function ProductShowcase({ steps, views }: { steps: Step[]; views: React.ReactNode[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const el of refs.current) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
      <ol className="flex flex-col">
        {steps.map((step, i) => (
          <li
            key={step.title}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-index={i}
            className="flex flex-col justify-center border-t border-ink py-8 lg:min-h-[60vh] lg:py-0"
          >
            <div className={cn("transition-opacity duration-300", active === i ? "lg:opacity-100" : "lg:opacity-40")}>
              <h3 className="t-h3">{step.title}</h3>
              <p className="t-body mt-3 max-w-[30rem] text-ink/80">{step.body}</p>
            </div>
            <div className="mt-6 lg:hidden">{views[i]}</div>
          </li>
        ))}
      </ol>

      <div className="hidden lg:block">
        <div className="sticky top-[max(6rem,calc(50vh-14rem))]">
          <div className="grid">
            {views.map((view, i) => (
              <div
                key={i}
                aria-hidden={active !== i}
                className={cn(
                  "[grid-area:1/1] transition-[opacity,transform] duration-500 ease-[var(--ease-out)]",
                  active === i ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0",
                )}
              >
                {view}
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
            {steps.map((step, i) => (
              <span key={step.title} className={cn("h-[3px] transition-colors duration-300", i <= active ? "bg-ink" : "bg-ink/20")} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
