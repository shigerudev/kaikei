import { pageMeta } from "@/components/site/page-dict";
import { PrinciplesView } from "@/components/site/views/principles";

export const metadata = pageMeta("es", "/principles", "principles");

export default function Page() {
  return <PrinciplesView lang="es" />;
}
