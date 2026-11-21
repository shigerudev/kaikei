import { pageMeta } from "@/components/site/page-dict";
import { AssistantsView } from "@/components/site/views/assistants";

export const metadata = pageMeta("es", "/assistants", "assistants");

export default function Page() {
  return <AssistantsView lang="es" />;
}
