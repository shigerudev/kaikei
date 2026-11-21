import { ArrowRightIcon } from "lucide-react";
import type { Dict } from "@/components/site/dict";
import { SiteLink } from "@/components/site/site-link";

export function CtaButtons({ t, primary = "ink" }: { t: Dict["cta"]; primary?: "ink" | "blue" }) {
  return (
    <div className="flex flex-wrap gap-3">
      <SiteLink href="/signup" className={primary === "blue" ? "btn btn-primary" : "btn btn-ink"}>
        {t.primary} <ArrowRightIcon className="size-4" aria-hidden />
      </SiteLink>
      <SiteLink href="/pricing" className="btn btn-secondary">
        {t.secondary}
      </SiteLink>
    </div>
  );
}
