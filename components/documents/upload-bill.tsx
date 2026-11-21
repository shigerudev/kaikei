"use client";

import { FileUpIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { uploadDocumentAction } from "@/app/w/[ws]/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { wsPath } from "@/lib/nav";

/** Bill upload dialog. On success goes straight to the review screen for that document. */
export function UploadBill({ ws, defaultOpen = false }: { ws: string; defaultOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [dragging, setDragging] = useState(false);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const send = (file: File | undefined) => {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    start(async () => {
      const res = await uploadDocumentAction(ws, form);
      if (!res.ok) {
        toast.error("Upload failed", { description: res.error });
        return;
      }
      if (res.data.alreadyImported) toast("This bill was already uploaded", { description: "Opening the existing document." });
      setOpen(false);
      router.push(wsPath(ws, `/documents/${res.data.documentId}`));
    });
  };

  const sample = () =>
    start(async () => {
      const blob = await (await fetch("/samples/bill_transportes_rapidos.pdf")).blob();
      send(new File([blob], "bill_transportes_rapidos.pdf", { type: "application/pdf" }));
    });

  return (
    <>
      <Button variant="brand" size="sm" onClick={() => setOpen(true)}>
        <FileUpIcon /> Upload bill
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o && defaultOpen) router.replace(wsPath(ws, "/documents"), { scroll: false });
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload a bill or receipt</DialogTitle>
            <DialogDescription>We read the supplier, date and total, then suggest the transaction it belongs to. You confirm.</DialogDescription>
          </DialogHeader>
          <button
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              send(e.dataTransfer.files[0]);
            }}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-[border-color,background-color] duration-150 ${
              dragging ? "border-brand bg-brand-subtle/50" : "hover:border-foreground/25 hover:bg-muted/30"
            }`}
          >
            {pending ? <Loader2Icon className="size-5 animate-spin text-muted-foreground" /> : <FileUpIcon className="size-5 text-muted-foreground" />}
            <span className="text-sm font-medium">{pending ? "Reading the bill…" : "Drop a PDF or click to choose"}</span>
            <span className="text-xs text-muted-foreground">PDF · up to 10 MB</span>
          </button>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => send(e.target.files?.[0])} />
          <Button variant="ghost" size="sm" className="self-start text-muted-foreground" disabled={pending} onClick={sample}>
            Try the sample bill (Transportes Rápidos, Q600)
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
