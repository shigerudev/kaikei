"use client";

import { Loader2Icon, MonitorIcon, MoonIcon, PlusIcon, SunIcon, XIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { resetSampleAction, updateAliasesAction, updateWorkspaceAction } from "@/app/w/[ws]/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Category } from "@/lib/data/types";
import { wsPath } from "@/lib/nav";

const noop = () => () => {};

/** A settings row: label + help on the left, control on the right; stacks on mobile. */
export function SettingRow({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b py-5 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-medium">{label}</p>
        {help && <p className="text-sm text-muted-foreground">{help}</p>}
      </div>
      <div className="w-full sm:w-auto sm:min-w-72">{children}</div>
    </div>
  );
}

export function WorkspaceNameForm({ ws, name }: { ws: string; name: string }) {
  const [value, setValue] = useState(name);
  const [pending, start] = useTransition();
  const dirty = value.trim() !== name;
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateWorkspaceAction(ws, { name: value });
          if (res.ok) toast.success("Workspace renamed");
          else toast.error(res.error);
        });
      }}
    >
      <Label htmlFor="ws-name" className="sr-only">Workspace name</Label>
      <Input id="ws-name" value={value} onChange={(e) => setValue(e.target.value)} className="h-8" maxLength={80} />
      <Button size="sm" disabled={!dirty || pending} type="submit">
        {pending && <Loader2Icon className="animate-spin" />} Save
      </Button>
    </form>
  );
}

export function CategoryAliases({ ws, category }: { ws: string; category: Category }) {
  const [aliases, setAliases] = useState(category.aliases);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();

  const commit = (next: string[]) => {
    setAliases(next);
    start(async () => {
      const res = await updateAliasesAction(ws, category.id, next);
      if (!res.ok) {
        toast.error(res.error);
        setAliases(category.aliases);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3 border-b py-4 last:border-b-0 sm:flex-row sm:items-center">
      <div className="w-40 shrink-0">
        <p className="text-sm font-medium">{category.name}</p>
        <p className="text-xs text-muted-foreground capitalize">{category.kind}</p>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5" data-pending={pending || undefined}>
        {aliases.map((a) => (
          <span key={a} className="inline-flex items-center gap-1 rounded-md border bg-muted/40 py-0.5 pr-1 pl-2 text-xs">
            {a}
            <button type="button" aria-label={`Remove alias ${a}`} onClick={() => commit(aliases.filter((x) => x !== a))} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = draft.trim().toLowerCase();
            if (!v || aliases.includes(v)) return setDraft("");
            commit([...aliases, v]);
            setDraft("");
          }}
          className="flex items-center"
        >
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add alias" className="h-7 w-28 text-xs" aria-label={`Add alias to ${category.name}`} />
          <Button type="submit" variant="ghost" size="icon-xs" aria-label="Add" disabled={!draft.trim()}>
            <PlusIcon />
          </Button>
        </form>
      </div>
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

export function ResetSample({ ws }: { ws: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">Reset sample workspace</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset the sample workspace?</DialogTitle>
          <DialogDescription>Every import, bill and decision you made here is removed and the original sample data comes back. This can&apos;t be undone.</DialogDescription>
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
                const res = await resetSampleAction(ws);
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                setOpen(false);
                toast.success("Sample workspace reset");
                router.push(wsPath(ws));
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
