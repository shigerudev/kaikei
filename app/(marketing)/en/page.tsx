import { pageMeta } from "@/components/site/page-dict";
import { HomeView } from "@/components/site/views/home";

export const metadata = pageMeta("en", "/");

export default function Page() {
  return <HomeView lang="en" />;
}
