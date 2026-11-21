"use client";

import { ArrowLeftRightIcon, FlagIcon, LayoutGridIcon, PlayIcon, ScanSearchIcon, SearchIcon, UploadIcon, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { KaikeiSymbol } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { gPath } from "@/lib/ui/nav";

const KEY = "kaikei:onboarded:v1";
const OPEN_EVENT = "kaikei:open-tour";

/** Reopen the tour from anywhere (sidebar, ⌘K). */
export const openTour = () => window.dispatchEvent(new Event(OPEN_EVENT));

type Step = { icon: LucideIcon | "brand"; title: string; body: string; path?: string; cta?: string };

const STEPS: Step[] = [
  {
    icon: "brand",
    title: "Bienvenido a kaikei",
    body: "Consolida los presupuestos de todas tus empresas en una sola moneda, sin doble conteo, y abre cualquier cifra hasta la celda de donde salió. Te mostramos el recorrido en un minuto.",
  },
  {
    icon: UploadIcon,
    title: "1. Sube el paquete de cada empresa",
    body: "Llega en el formato que sea: largo, ancho, Debe/Haber o coma decimal. Guardamos el original sin cambios y te mostramos cómo se leyó para que apruebes el mapeo de cuentas.",
    path: "/uploads",
    cta: "Ir a Cargas",
  },
  {
    icon: PlayIcon,
    title: "2. Lanza una ejecución",
    body: "Cada ejecución valida, convierte a la moneda del grupo, concilia las operaciones entre empresas y elimina lo que no es del grupo. Es inmutable: mismas entradas, misma huella y mismos totales.",
    path: "/runs",
    cta: "Ver ejecuciones",
  },
  {
    icon: FlagIcon,
    title: "3. Revisa los hallazgos",
    body: "Los errores aparecen antes de llegar a un total, con archivo, línea y columna. Resuelve o acepta cada uno con un motivo; los bloqueantes impiden publicar hasta que tengan decisión.",
    path: "/findings",
    cta: "Abrir hallazgos",
  },
  {
    icon: ArrowLeftRightIcon,
    title: "4. Intercompañía sin doble conteo",
    body: "Las ventas, cargos y préstamos entre empresas se concilian por periodo y se eliminan con asientos balanceados. Las diferencias quedan señaladas, nunca se compensan en silencio.",
    path: "/intercompany",
    cta: "Ver intercompañía",
  },
  {
    icon: LayoutGridIcon,
    title: "5. El panel consolidado",
    body: "Estado de resultados y balance, antes y después de eliminaciones, por empresa si lo necesitas. Cuando no quedan bloqueantes, publica y la versión queda congelada.",
    path: "",
    cta: "Ir al panel",
  },
  {
    icon: ScanSearchIcon,
    title: "6. Cada número se explica solo",
    body: "Haz clic en cualquier línea del panel: verás aportes por empresa, la tasa aplicada, las eliminaciones, los hallazgos y la celda de origen con su valor original.",
  },
  {
    icon: SearchIcon,
    title: "Atajos para ir rápido",
    body: "⌘K busca hallazgos, cuentas y empresas. G y una letra salta entre pantallas (G D panel, G F hallazgos). En el panel, [ y ] cambian de periodo. Puedes volver a ver este tutorial desde la barra lateral.",
  },
];

const noop = () => () => {};

function readDone() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}

/** First-run onboarding: opens once per browser, reopenable via openTour(). */
export function OnboardingTour({ group }: { group: string }) {
  const router = useRouter();
  const done = useSyncExternalStore(noop, readDone, () => true);
  const [dismissed, setDismissed] = useState(false);
  const [forced, setForced] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    const onOpen = () => {
      setI(0);
      setForced(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  const open = forced || (!done && !dismissed);
  const close = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* storage unavailable: the tour may show again, harmless */
    }
    setDismissed(true);
    setForced(false);
  };

  const step = STEPS[i]!;
  const last = i === STEPS.length - 1;
  const Icon = step.icon;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md" showCloseButton={false}>
        <div className="flex h-28 items-center justify-center border-b bg-muted/40">
          <span key={`icon-${i}`} className="enter flex size-14 items-center justify-center rounded-2xl border bg-background shadow-xs">
            {Icon === "brand" ? <KaikeiSymbol className="size-7" /> : <Icon className="size-6 text-brand" />}
          </span>
        </div>
        <div key={`body-${i}`} className="enter space-y-2 px-6 pt-5 pb-4">
          <DialogTitle className="text-base">{step.title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">{step.body}</DialogDescription>
          {step.path !== undefined && (
            <button
              type="button"
              onClick={() => {
                close();
                router.push(gPath(group, step.path));
              }}
              className="text-sm font-medium text-brand underline-offset-4 hover:underline"
            >
              {step.cta} →
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 border-t px-6 py-3">
          <div className="flex flex-1 items-center gap-1.5" aria-label={`Paso ${i + 1} de ${STEPS.length}`}>
            {STEPS.map((_, k) => (
              <span
                key={k}
                className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ease-(--ease-out) ${k === i ? "w-5 bg-brand" : "w-1.5 bg-border"}`}
              />
            ))}
          </div>
          {i === 0 ? (
            <Button variant="ghost" size="sm" onClick={close}>
              Omitir
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setI((n) => n - 1)}>
              Atrás
            </Button>
          )}
          <Button size="sm" variant="brand" onClick={() => (last ? close() : setI((n) => n + 1))}>
            {last ? "Empezar" : i === 0 ? "Ver recorrido" : "Siguiente"}
          </Button>
        </div>
        <p className="sr-only">
          Usa <Kbd>Esc</Kbd> para cerrar.
        </p>
      </DialogContent>
    </Dialog>
  );
}
