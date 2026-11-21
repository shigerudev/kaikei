/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

/** Brand art in both themes; the reverse files are drawn for the dark palette. */
export function Brand({ kind, alt = "", width, height, className }: { kind: "wordmark" | "logo"; alt?: string; width: number; height: number; className?: string }) {
  return (
    <>
      <img src={`/brand/kaikei-${kind}-primary.svg`} alt={alt} width={width} height={height} className={cn(className, "dark:hidden")} />
      <img src={`/brand/kaikei-${kind}-reverse-transparent.svg`} alt={alt} width={width} height={height} className={cn(className, "hidden dark:block")} />
    </>
  );
}
