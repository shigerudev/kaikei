import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CommandMenuProvider } from "@/components/command/command-menu";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { getDefaultPeriod, getFlags, getPeriods, getWorkspaceInfo, listWorkspaces } from "@/lib/data";

/**
 * Workspace shell. Workspace data is always live (no "use cache"), so the subtree streams inside
 * this Suspense boundary. `sheet` is the parallel slot that renders intercepted detail sheets.
 */
export default function WorkspaceLayout({ children, sheet, params }: LayoutProps<"/w/[ws]">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <WorkspaceShell params={params} sheet={sheet}>
        {children}
      </WorkspaceShell>
    </Suspense>
  );
}

async function WorkspaceShell({
  children,
  sheet,
  params,
}: {
  children: React.ReactNode;
  sheet: React.ReactNode;
  params: LayoutProps<"/w/[ws]">["params"];
}) {
  const { ws } = await params;
  const info = await getWorkspaceInfo(ws);
  if (!info) notFound();

  const [cookieStore, flags, periods, workspaces, defaultPeriod] = await Promise.all([
    cookies(),
    getFlags(ws, "open").catch(() => []),
    getPeriods(ws).catch(() => [] as string[]),
    listWorkspaces().catch(() => [{ id: info.id, name: info.name }]),
    getDefaultPeriod(ws).catch(() => null),
  ]);
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <CommandMenuProvider ws={ws} periods={periods} defaultPeriod={defaultPeriod ?? periods[0] ?? null} mcpUrl={info.mcpUrl}>
        <AppSidebar ws={ws} workspaceName={info.name} isSample={info.isSample} workspaces={workspaces} openFlags={flags.length} />
        <SidebarInset className="min-w-0">{children}</SidebarInset>
        {sheet}
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
          {Array.from({ length: 6 }, (_, i) => (
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
