import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function WorkspaceNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <p className="num text-sm text-muted-foreground">404</p>
      <h1 className="text-lg font-medium">We couldn&apos;t find that page</h1>
      <p className="text-sm text-muted-foreground">The workspace or record may not exist, or the link is out of date.</p>
      <Button size="sm" variant="outline" asChild>
        <Link href="/w/demo">Open the sample workspace</Link>
      </Button>
    </div>
  );
}
