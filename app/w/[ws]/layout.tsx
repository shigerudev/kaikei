import Link from "next/link";
import { Suspense } from "react";

/**
 * Workspace shell. Workspace data is always live (no "use cache"), so the whole subtree streams
 * inside this Suspense boundary — pages below can `await params` and query the DB directly.
 */
export default function WorkspaceLayout({ children, params }: LayoutProps<"/w/[ws]">) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading…</div>}>
      <WorkspaceShell params={params}>{children}</WorkspaceShell>
    </Suspense>
  );
}

async function WorkspaceShell({
  children,
  params,
}: {
  children: React.ReactNode;
  params: LayoutProps<"/w/[ws]">["params"];
}) {
  const { ws } = await params;
  // TODO(Jordi): load the workspace name (getWorkspace) and the open-flag count for the Review badge.
  const nav = [
    { href: `/w/${ws}`, label: "Overview" },
    { href: `/w/${ws}/import`, label: "Upload" },
    { href: `/w/${ws}/review`, label: "Review" },
    { href: `/w/${ws}/connect`, label: "Connect AI" },
  ];
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link href="/" className="font-semibold">
            Kaikei
          </Link>
          <nav className="flex gap-4 text-sm">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="text-muted-foreground hover:text-foreground">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
