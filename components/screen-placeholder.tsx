import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Temporary stand-in for a screen until its owner builds it. Delete per screen as they land. */
export function ScreenPlaceholder({
  title,
  owner,
  purpose,
  todo,
}: {
  title: string;
  owner: string;
  purpose: string;
  todo: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{title}</CardTitle>
          <Badge variant="secondary">owner: {owner}</Badge>
        </div>
        <CardDescription>{purpose}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {todo.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
