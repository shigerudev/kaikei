"use client";

import { ArrowRightIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SiteLink } from "@/components/site/site-link";
import { cn } from "@/lib/utils";

type RowProps = {
  n: string;
  title: string;
  note: string;
  /** Route that continues this section. */
  more?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
};

export function LedgerRow({ n, title, note, more, children, className }: RowProps) {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), {
      rootMargin: "-50% 0px -50% 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className="grid grid-cols-[minmax(0,1fr)] border-t-[3px] border-ink first:border-t-0 lg:grid-cols-[minmax(0,1fr)_216px]"
    >
      <aside className="flex items-stretch justify-between border-b border-ink lg:order-2 lg:flex-col lg:border-b-0 lg:border-l-[3px]">
        <div className="flex flex-col gap-2 px-5 py-4 lg:sticky lg:top-20 lg:p-6">
          <p className="t-h3 max-lg:text-xl">{title}</p>
          <p className="t-small font-semibold max-lg:hidden">{note}</p>
          {more && (
            <SiteLink href={more.href} className="group mt-4 inline-flex items-center gap-1.5 t-small font-semibold max-lg:hidden">
              {more.label}
              <ArrowRightIcon className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </SiteLink>
          )}
        </div>
        <div
          aria-hidden
          className={cn(
            "flex w-16 shrink-0 items-end justify-end border-l border-ink p-3 transition-colors duration-500 ease-[var(--ease-out)] lg:aspect-square lg:w-auto lg:border-t-[3px] lg:border-l-0 lg:p-6",
            active ? "bg-blue text-beige" : "text-ink",
          )}
        >
          <span className="font-display text-xl font-medium tabular-nums lg:text-2xl">{n}</span>
        </div>
      </aside>
      <div className={cn("min-w-0 px-5 py-12 md:px-8 lg:order-1 lg:px-12 lg:py-16", className)}>
        {children}
        {more && (
          <SiteLink href={more.href} className="btn btn-secondary mt-10 lg:hidden">
            {more.label} <ArrowRightIcon className="size-4" aria-hidden />
          </SiteLink>
        )}
      </div>
    </section>
  );
}

export function LedgerFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("border-[3px] border-ink", className)}>{children}</div>;
}

/** Page opener for inner routes: title on the left, the numbered square on the right. */
export function LedgerHead({ n, title, lead, children }: { n: string; title: string; lead: string; children?: React.ReactNode }) {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)] border-b-[3px] border-ink lg:grid-cols-[minmax(0,1fr)_216px]">
      <div className="reveal min-w-0 px-5 py-12 md:px-8 lg:px-12 lg:py-20">
        <h1 className="t-display max-w-[44rem]">{title}</h1>
        <p className="t-lead mt-6 max-w-[40rem] text-ink/80">{lead}</p>
        {children}
      </div>
      <div aria-hidden className="hidden items-end justify-end border-l-[3px] border-ink bg-blue p-6 text-beige lg:flex">
        <span className="font-display text-2xl font-medium tabular-nums">{n}</span>
      </div>
    </section>
  );
}
