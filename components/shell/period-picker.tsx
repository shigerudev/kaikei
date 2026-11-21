"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatPeriod } from "@/lib/ui/format";

/** Global period scope, stored in the URL (?period=YYYY-MM or YYYY for the full year). */
export function PeriodPicker({ value, options }: { value: string; options: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const idx = options.indexOf(value);
  // Options are in display order (Jan … Dec, then the full year).
  const older = idx > 0 ? options[idx - 1] : undefined;
  const newer = idx >= 0 ? options[idx + 1] : undefined;

  const set = (period: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("period", period);
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  return (
    <div className="flex items-center" data-pending={pending || undefined}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="max-sm:hidden" disabled={!older} onClick={() => older && set(older)} aria-label="Previous period">
            <ChevronLeftIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Previous period <Kbd>[</Kbd></TooltipContent>
      </Tooltip>
      <Select value={value} onValueChange={set}>
        <SelectTrigger size="sm" className="h-7 min-w-24 border-none sm:min-w-28 bg-transparent px-2 text-sm font-medium shadow-none hover:bg-muted data-[pending]:opacity-60 dark:bg-transparent" aria-label="Period">
          <SelectValue>{formatPeriod(value)}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          {options.map((p) => (
            <SelectItem key={p} value={p}>
              {formatPeriod(p, true)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="max-sm:hidden" disabled={!newer} onClick={() => newer && set(newer)} aria-label="Next period">
            <ChevronRightIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Next period <Kbd>]</Kbd></TooltipContent>
      </Tooltip>
    </div>
  );
}
