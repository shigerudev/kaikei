import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CommandMenuProvider } from "@/components/command/command-menu";
import { OnboardingTour } from "@/components/onboarding-tour";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { getCompanies, getFiles, getFindings, getGroup, getRun } from "@/lib/api";
import { PERIODS } from "@/lib/ui/periods";

/**
 * Group shell. Data is always live (no "use cache"), so the subtree streams inside this Suspense
 * boundary. `sheet` is the parallel slot for intercepted detail sheets (findings).
 */
export default function GroupLayout({ children, sheet, params }: LayoutProps<"/g/[group]">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <GroupShell params={params} sheet={sheet}>
        {children}
      </GroupShell>
    </Suspense>
  );
}

async function GroupShell({ children, sheet, params }: { children: React.ReactNode; sheet: React.ReactNode; params: LayoutProps<"/g/[group]">["params"] }) {
  const { group } = await params;
  const info = await getGroup(group).catch(() => null);
  if (!info) notFound();

  const [cookieStore, companies, files, latest] = await Promise.all([
    cookies(),
    getCompanies(group).catch(() => []),
    getFiles(group).catch(() => []),
    getRun(group).catch(() => null),
  ]);
  const findings = latest ? await getFindings(latest.id).catch(() => []) : [];
  const open = findings.filter((f) => f.status === "OPEN" || f.status === "UNDER_REVIEW");
  const ready = files.filter((f) => f.status === "MAPPING_APPROVED").length;

  return (
    <SidebarProvider defaultOpen={cookieStore.get("sidebar_state")?.value !== "false"}>
      <CommandMenuProvider group={group} periods={PERIODS}>
        <AppSidebar
          group={group}
          groupName={info.name}
          subtitle={`${companies.length} empresas · ${info.reporting_currency}`}
          companies={companies}
          openFindings={open.length}
          openBlockers={open.filter((f) => f.severity === "BLOCKER").length}
          filesReady={`${ready}/${companies.length}`}
        />
        <SidebarInset className="min-w-0">{children}</SidebarInset>
        {sheet}
        <OnboardingTour group={group} />
      </CommandMenuProvider>
    </SidebarProvider>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-svh w-full">
      <div className="hidden w-64 shrink-0 flex-col gap-2 border-r bg-sidebar p-3 md:flex">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-8 w-full" />
        <div className="mt-2 space-y-1.5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1">
        <div className="h-12 border-b" />
      </div>
    </div>
  );
}
