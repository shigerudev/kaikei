import { ServerCrashIcon, type LucideIcon } from "lucide-react";
import { ApiError } from "@/lib/api";

/** Designed empty state: icon, one-line title, one helpful sentence, optional actions. */
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
      {children && <div className="mt-1 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

/** The engine answered with an error or isn't reachable: say so plainly, keep the shell usable. */
export function EngineErrorState({ error }: { error: ApiError }) {
  return (
    <EmptyState
      icon={ServerCrashIcon}
      title={error.status === 404 ? "El motor aún no ofrece esta vista" : "El motor no respondió"}
      description={
        <>
          <span className="font-mono text-xs">{error.path}</span> respondió {error.status || "sin respuesta"}. No se cambió nada. Quita{" "}
          <span className="font-mono text-xs">KAIKEI_API_URL</span> para explorar con datos de ejemplo.
        </>
      }
    />
  );
}

/** Run a read; turn an engine error into a renderable state instead of a crash. */
export async function load<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; node: React.ReactNode }> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, node: <EngineErrorState error={err} /> };
    if (err instanceof TypeError && /fetch/i.test(err.message)) return { ok: false, node: <EngineErrorState error={new ApiError(err.message, 0, "engine")} /> };
    throw err;
  }
}
