import Link from "next/link";
import { Fragment } from "react";
import { RunStatusBadge } from "@/components/badges";
import { HeaderSearch } from "@/components/shell/header-search";
import { PeriodPicker } from "@/components/shell/period-picker";
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
import type { Run } from "@/lib/api/types";
import { formatStamp, shortHash } from "@/lib/ui/format";
import { gPath } from "@/lib/ui/nav";

export type Crumb = { label: string; href?: string };

/**
 * Sticky top bar for every group screen: breadcrumb (location only) on the left; the run being viewed,
 * period scope and search on the right. Server-rendered so labels come from data.
 */
export function PageHeader({
  group,
  crumbs,
  period,
  run,
  preview,
}: {
  group: string;
  crumbs: Crumb[];
  period?: { value: string; options: string[] };
  run?: Run | null;
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
            const hideOnMobile = crumbs.length > 2 && i < last - 1;
            return (
              <Fragment key={`${c.label}-${i}`}>
                {i === 1 && crumbs.length > 2 && (
                  <>
                    <BreadcrumbItem className="md:hidden">
                      <BreadcrumbEllipsis className="size-4" />
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="md:hidden" />
                  </>
                )}
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
              <span className="hidden items-center gap-1.5 rounded-full border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground xl:inline-flex">
                <span className="size-1.5 rounded-full bg-warning" />
                Datos de ejemplo
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              Espacio de ejemplo generado con paquetes de muestra hasta conectar el motor. Los hallazgos y ubicaciones son reales; las cifras no son de referencia.
            </TooltipContent>
          </Tooltip>
        )}
        {run && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href={gPath(group, `/runs/${run.id}`)} className="hidden items-center gap-2 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted sm:inline-flex">
                <span className="num">Ejecución #{run.number}</span>
                <RunStatusBadge status={run.status} />
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              Huella <span className="font-mono">{shortHash(run.fingerprint)}</span> · {formatStamp(run.created_at)}
            </TooltipContent>
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
        {description && <div className="text-sm text-pretty text-muted-foreground">{description}</div>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function PageBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 md:px-6 md:py-8 ${className}`}>{children}</div>;
}
