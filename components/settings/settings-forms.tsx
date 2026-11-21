"use client";

import { Loader2Icon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { resetPreviewAction } from "@/app/g/[group]/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { gPath } from "@/lib/ui/nav";

const noop = () => () => {};

/** A settings row: label + help on the left, control on the right; stacks on mobile. */
export function SettingRow({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b py-5 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-medium">{label}</p>
        {help && <p className="text-sm text-muted-foreground">{help}</p>}
      </div>
      <div className="w-full sm:w-auto sm:min-w-64">{children}</div>
    </div>
  );
}

export function ThemeSetting() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return (
    <ToggleGroup type="single" variant="outline" value={mounted ? theme : undefined} onValueChange={(v) => v && setTheme(v)} aria-label="Theme">
      <ToggleGroupItem value="light" className="gap-1.5 px-3"><SunIcon /> Light</ToggleGroupItem>
      <ToggleGroupItem value="dark" className="gap-1.5 px-3"><MoonIcon /> Dark</ToggleGroupItem>
      <ToggleGroupItem value="system" className="gap-1.5 px-3"><MonitorIcon /> System</ToggleGroupItem>
    </ToggleGroup>
  );
}

/** Preview only: restore the snapshot ("full") or start from empty uploads ("empty") for the demo. */
export function ResetPreview({ group, mode }: { group: string; mode: "full" | "empty" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const label = mode === "full" ? "Restore sample run" : "Start from empty uploads";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={mode === "full" ? "outline" : "destructive"} size="sm">{label}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}?</DialogTitle>
          <DialogDescription>
            {mode === "full"
              ? "Removes your uploads, decisions and extra runs, and restores the six approved packs with run #1."
              : "Clears every upload, decision and run so you can demo the flow from the first file."}{" "}
            Only the in-memory preview is affected.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await resetPreviewAction(mode);
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                setOpen(false);
                toast.success(mode === "full" ? "Sample run restored" : "Preview cleared");
                router.push(gPath(group, mode === "full" ? "" : "/uploads"));
              })
            }
          >
            {pending && <Loader2Icon className="animate-spin" />} Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
