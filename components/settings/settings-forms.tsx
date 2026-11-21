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
    <ToggleGroup type="single" variant="outline" value={mounted ? theme : undefined} onValueChange={(v) => v && setTheme(v)} aria-label="Tema">
      <ToggleGroupItem value="light" className="gap-1.5 px-3"><SunIcon /> Claro</ToggleGroupItem>
      <ToggleGroupItem value="dark" className="gap-1.5 px-3"><MoonIcon /> Oscuro</ToggleGroupItem>
      <ToggleGroupItem value="system" className="gap-1.5 px-3"><MonitorIcon /> Sistema</ToggleGroupItem>
    </ToggleGroup>
  );
}

/** Preview only: restore the snapshot ("full") or start from empty uploads ("empty") for the demo. */
export function ResetPreview({ group, mode }: { group: string; mode: "full" | "empty" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const label = mode === "full" ? "Restaurar ejemplo" : "Empezar sin cargas";
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
              ? "Quita tus cargas, decisiones y ejecuciones extra, y restaura los seis paquetes aprobados con la ejecución #1."
              : "Borra cargas, decisiones y ejecuciones para recorrer el flujo desde el primer archivo."}{" "}
            Solo afecta al espacio de ejemplo.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">Cancelar</Button>
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
                toast.success(mode === "full" ? "Ejemplo restaurado" : "Espacio vaciado");
                router.push(gPath(group, mode === "full" ? "" : "/uploads"));
              })
            }
          >
            {pending && <Loader2Icon className="animate-spin" />} Restablecer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
