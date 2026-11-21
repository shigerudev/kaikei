import Link from "next/link";
import { Fragment } from "react";
import { PeriodPicker } from "@/components/shell/period-picker";
import { HeaderSearch } from "@/components/shell/header-search";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AsOf } from "@/lib/types";
import { formatStamp } from "@/lib/format";

export type Crumb = { label: string; href?: string };

/**
 * Sticky top bar for every workspace screen: breadcrumb (location only) on the left;
 * data freshness, period scope and search on the right. Server-rendered so labels come from data.
 */
export function PageHeader({
  crumbs,
  period,
  asOf,
  preview,
}: {
  crumbs: Crumb[];
  period?: { value: string; options: string[] };
  asOf?: AsOf;
  preview?: boolean;
}) {
  const last = crumbs.length - 1;
  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur-md supports-backdrop-filter:bg-background/70 md:px-4">
      <SidebarTrigger className="-ml-1 text-muted-foreground" />
      <Separator orientation="vertical" className="mr-1 self-center data-[orientation=vertical]:h-4" />
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="flex-nowrap">
          {crumbs.map((c, i) => {
            // On narrow screens keep only the last two segments; middle ones collapse to an ellipsis.
            const hideOnMobile = crumbs.length > 2 && i < last - 1;
            return (
              <Fragment key={`${c.label}-${i}`}>
                {i === 1 && crumbs.length > 2 && (
                  <BreadcrumbItem className="md:hidden">
                    <BreadcrumbEllipsis className="size-4" />
                  </BreadcrumbItem>
                )}
                {i === 1 && crumbs.length > 2 && <BreadcrumbSeparator className="md:hidden" />}
                <BreadcrumbItem className={hideOnMobile ? "hidden min-w-0 md:inline-flex" : "min-w-0"}>
                  {i === last || !c.href ? (
                    <BreadcrumbPage className="truncate font-medium">{c.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild className="truncate">
                      <Link href={c.href}>{c.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {i < last && <BreadcrumbSeparator className={hideOnMobile ? "hidden md:inline-flex" : undefined} />}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex shrink-0 items-center gap-1.5">
        {preview && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="hidden items-center gap-1.5 rounded-full border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground sm:inline-flex">
                <span className="size-1.5 rounded-full bg-warning" />
                Preview data
              </span>
            </TooltipTrigger>
            <TooltipContent>Sample records held in memory until the database path is live. Figures follow the same rules.</TooltipContent>
          </Tooltip>
        )}
        {asOf?.at && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="hidden text-xs text-muted-foreground lg:inline">Updated {formatStamp(asOf.at)}</span>
            </TooltipTrigger>
            <TooltipContent>As of the latest import. The app and every AI client read this same state.</TooltipContent>
          </Tooltip>
        )}
        {period && period.options.length > 0 && <PeriodPicker value={period.value} options={period.options} />}
        <HeaderSearch />
      </div>
    </header>
  );
}

/** Title block under the header: one H1, optional description and right-aligned actions. */
export function PageTitle({ title, description, children }: { title: string; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-balance">{title}</h1>
        {description && <p className="text-sm text-pretty text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

export function PageBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 md:px-6 md:py-8 ${className}`}>{children}</div>;
}
