import { pageMeta } from "@/components/site/page-dict";
import { SignupPlanView } from "@/components/site/views/signup";
import { PLAN_IDS } from "@/lib/ui/site";

export const metadata = pageMeta("es", "/signup", "signup");

export function generateStaticParams() {
  return PLAN_IDS.map((plan) => ({ plan }));
}

export default function Page({ params }: PageProps<"/signup/[plan]">) {
  return <SignupPlanView lang="es" params={params} />;
}
