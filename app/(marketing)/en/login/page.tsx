import { pageMeta } from "@/components/site/page-dict";
import { LoginView } from "@/components/site/views/login";

export const metadata = pageMeta("en", "/login", "login");

export default function Page({ searchParams }: PageProps<"/en/login">) {
  return <LoginView lang="en" searchParams={searchParams} />;
}
