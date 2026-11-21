import Link from "next/link";
import { SETTINGS_SECTIONS, wsPath } from "@/lib/nav";

export function SettingsNav({ ws, active }: { ws: string; active: string }) {
  return (
    <nav aria-label="Settings sections" className="-mx-1 flex gap-1 overflow-x-auto md:mx-0 md:flex-col">
      {SETTINGS_SECTIONS.map((s) => {
        const on = s.key === active;
        return (
          <Link
            key={s.key}
            href={wsPath(ws, `/settings/${s.key}`)}
            aria-current={on ? "page" : undefined}
            className={`relative shrink-0 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
              on ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            } ${s.key === "danger" ? "md:mt-4" : ""}`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
