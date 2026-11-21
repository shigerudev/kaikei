import { pageMeta } from "@/components/site/page-dict";
import { SignupFreeView } from "@/components/site/views/signup";

export const metadata = pageMeta("es", "/signup", "signup");

export default function Page() {
  return <SignupFreeView lang="es" />;
}
