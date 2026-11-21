"use client";

import { FileStackIcon, Loader2Icon, UploadCloudIcon } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { loadSamplePacksAction, uploadAction } from "@/app/g/[group]/actions";
import { Button } from "@/components/ui/button";

/** Multi-file drop zone. Files are identified by company and repeats are recognised by SHA-256. */
export function UploadDropzone({ group, preview }: { group: string; preview: boolean }) {
  const [dragging, setDragging] = useState(false);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const send = (list: FileList | File[] | null) => {
    const files = list ? [...list] : [];
    if (!files.length) return;
    const form = new FormData();
    for (const f of files) form.append("file", f);
    start(async () => {
      const res = await uploadAction(group, form);
      if (!res.ok) {
        toast.error("Upload failed", { description: res.error });
        return;
      }
      const repeats = res.data.filter((r) => r.alreadyImported);
      const fresh = res.data.filter((r) => !r.alreadyImported);
      if (fresh.length) toast.success(`${fresh.length} pack${fresh.length === 1 ? "" : "s"} uploaded`, { description: fresh.map((r) => r.company_id).join(", ") + " · review and approve each mapping" });
      if (repeats.length) toast(`${repeats.length} already imported`, { description: "Same SHA-256 as the stored original. Nothing changed." });
    });
  };

  return (
    <div className="space-y-3">
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
          send(e.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-[border-color,background-color] duration-150 ${
          dragging ? "border-brand bg-brand-subtle/50" : "hover:border-foreground/25 hover:bg-muted/30"
        }`}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-muted">
          {pending ? <Loader2Icon className="size-5 animate-spin text-muted-foreground" /> : <UploadCloudIcon className="size-5 text-muted-foreground" />}
        </span>
        <span className="space-y-1">
          <span className="block font-medium">{pending ? "Storing originals and parsing…" : "Drop company packs here, or click to choose"}</span>
          <span className="block text-sm text-muted-foreground">CSV or XLSX · several at once · originals are kept byte for byte</span>
        </span>
      </button>
      <input ref={inputRef} type="file" multiple accept=".csv,.xlsx,text/csv" className="sr-only" onChange={(e) => send(e.target.files)} />
      {preview && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Preview mode:</span>
          <Button
            variant="outline"
            size="xs"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await loadSamplePacksAction(group);
                if (!res.ok) toast.error(res.error);
                else toast.success("Six Grupo AG packs loaded", { description: "Review and approve each mapping." });
              })
            }
          >
            <FileStackIcon /> Load the six fixture packs
          </Button>
        </div>
      )}
    </div>
  );
}
