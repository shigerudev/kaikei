import { pageMeta } from "@/components/site/page-dict";
import { OnboardingView } from "@/components/site/views/onboarding";

export const metadata = pageMeta("es", "/onboarding", "onboarding");

export default function Page() {
  return <OnboardingView lang="es" />;
}
