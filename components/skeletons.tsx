import { Skeleton } from "@/components/ui/skeleton";

/** Route-level skeletons that mirror the real layouts (no spinners, no layout jump on swap). */
function HeaderSkeleton() {
  return (
    <div className="flex h-12 items-center gap-3 border-b px-4">
      <Skeleton className="size-6" />
      <Skeleton className="h-4 w-40" />
      <div className="ml-auto flex gap-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-7 w-20" />
      </div>
    </div>
  );
}

function TitleSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-72" />
    </div>
  );
}

function Rows({ n = 6 }: { n?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="h-8 border-b bg-muted/40" />
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border/60 px-4 py-3.5 last:border-b-0">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

const Body = ({ children, wide }: { children: React.ReactNode; wide?: boolean }) => (
  <div className={`mx-auto w-full ${wide ? "max-w-7xl" : "max-w-6xl"} space-y-6 px-4 py-6 md:px-6 md:py-8`}>{children}</div>
);

export function OverviewSkeleton() {
  return (
    <>
      <HeaderSkeleton />
      <Body>
        <TitleSkeleton />
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-2 bg-background p-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <Rows n={5} />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </Body>
    </>
  );
}

export function ListSkeleton() {
  return (
    <>
      <HeaderSkeleton />
      <Body>
        <TitleSkeleton />
        <Skeleton className="h-8 w-full max-w-lg" />
        <Rows n={8} />
      </Body>
    </>
  );
}

export function DetailSkeleton({ wide }: { wide?: boolean }) {
  return (
    <>
      <HeaderSkeleton />
      <Body wide={wide}>
        <TitleSkeleton />
        <div className={wide ? "grid grid-cols-1 gap-6 lg:grid-cols-2" : "space-y-4"}>
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </Body>
    </>
  );
}
