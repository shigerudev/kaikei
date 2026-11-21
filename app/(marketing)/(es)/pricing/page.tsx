import { pageMeta } from "@/components/site/page-dict";
import { PricingView } from "@/components/site/views/pricing";

export const metadata = pageMeta("es", "/pricing", "pricing");

export default function Page() {
  return <PricingView lang="es" />;
}
