import { ViewTransition } from "react";

const types = { "nav-forward": "nav-forward", "nav-back": "nav-back", "lang-fade": "lang-fade", default: "none" };

/** Page content slides by navigation direction and crossfades on a language switch; the header stays put. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={types} exit={types} default="none">
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </ViewTransition>
  );
}
