import Image from "next/image";
import { cn } from "@/lib/utils";

export type ScreenName = "dashboard" | "uploads" | "findings" | "intercompany" | "inspector";

/**
 * A real platform screen (captured from /g/grupo-ag with preview data) in both themes.
 * `crop` drops the sidebar and frames the working area.
 */
export function Screen({ name, alt, crop, priority, className }: { name: ScreenName; alt: string; crop?: boolean; priority?: boolean; className?: string }) {
  const img = cn("max-w-none select-none", crop ? "absolute top-0 left-[-19.5%] h-auto w-[125%]" : "h-auto w-full");
  const sizes = crop ? "(min-width: 1024px) 900px, 125vw" : "(min-width: 1296px) 1200px, 100vw";
  return (
    <figure className={cn("relative overflow-hidden border-[3px] border-ink bg-beige", crop && "aspect-[16/10]", className)}>
      <Image src={`/product/${name}-light.png`} alt={alt} width={3226} height={1814} sizes={sizes} priority={priority} className={cn(img, "dark:hidden")} />
      <Image src={`/product/${name}-dark.png`} alt={alt} width={3226} height={1814} sizes={sizes} priority={priority} className={cn(img, "hidden dark:block")} />
    </figure>
  );
}
