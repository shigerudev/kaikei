"use client";

import { Maximize2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * Intercepted-route sheet: slides over the current list and closes with Esc / click-outside / back.
 * Closing animates out first (≈200ms), then navigates back so the URL returns to the list.
 */
export function DetailSheet({ title, description, fullHref, children }: { title: string; description?: string; fullHref: string; children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (o) return;
        setOpen(false);
        setTimeout(() => router.back(), 190);
      }}
    >
      <SheetContent side="right" className="gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="sticky top-0 z-10 flex-row items-center gap-2 border-b bg-popover/90 px-5 py-3.5 backdrop-blur">
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate">{title}</SheetTitle>
            {description && <SheetDescription className="truncate">{description}</SheetDescription>}
          </div>
          <Button variant="ghost" size="icon-sm" asChild aria-label="Abrir en página completa" className="mr-8">
            {/* Plain anchor on purpose: a soft <Link> would be intercepted back into this sheet. */}
            <a href={fullHref}>
              <Maximize2Icon />
            </a>
          </Button>
        </SheetHeader>
        <div className="px-5 py-5">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
