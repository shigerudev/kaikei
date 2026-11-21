import { ConstructionIcon, type LucideIcon } from "lucide-react";
import { NotImplementedError } from "@/lib/not-implemented";

/** Designed empty state: icon, one-line title, one helpful sentence, optional primary action. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className = "",
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center ${className}`}>
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <div className="max-w-sm space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="text-sm text-pretty text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="mt-1 flex gap-2">{children}</div>}
    </div>
  );
}

/** Shown when the db path for a read isn't implemented yet (DATA_SOURCE=db before the owner lands it). */
export function NotBuiltState({ error }: { error: NotImplementedError }) {
  return (
    <EmptyState
      icon={ConstructionIcon}
      title="This view isn't connected yet"
      description={
        <>
          <span className="font-mono text-xs">{error.what}</span> is still being built by {error.owner}. Switch to preview data
          (<span className="font-mono text-xs">DATA_SOURCE=preview</span>) to explore it now.
        </>
      }
    />
  );
}

/** Run a data read; turn a NotImplementedError into a renderable state instead of a crash. */
export async function load<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; node: React.ReactNode }> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof NotImplementedError) return { ok: false, node: <NotBuiltState error={err} /> };
    throw err;
  }
}
