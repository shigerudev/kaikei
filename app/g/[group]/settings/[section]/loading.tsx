import { Skeleton } from "@/components/ui/skeleton";

/** Content-only placeholder: the settings header and nav stay put. */
export default function Loading() {
  return (
    <div className="min-w-0 space-y-4">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}
