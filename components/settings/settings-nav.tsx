import Link from "next/link";
import { gPath, SETTINGS_SECTIONS } from "@/lib/ui/nav";

export function SettingsNav({ group, active }: { group: string; active: string }) {
  return (
    <nav aria-label="Settings sections" className="-mx-1 flex gap-1 overflow-x-auto md:mx-0 md:flex-col">
      {SETTINGS_SECTIONS.map((s) => {
        const on = s.key === active;
        return (
          <Link
            key={s.key}
            href={gPath(group, `/settings/${s.key}`)}
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
