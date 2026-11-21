import { pageMeta } from "@/components/site/page-dict";
import { LoginView } from "@/components/site/views/login";

export const metadata = pageMeta("es", "/login", "login");

export default function Page({ searchParams }: PageProps<"/login">) {
  return <LoginView lang="es" searchParams={searchParams} />;
}
