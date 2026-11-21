import { SiteShell, siteMetadata, siteViewport } from "@/components/site/views/shell";

export const metadata = siteMetadata("en");
export const viewport = siteViewport;

export default function Layout({ children }: LayoutProps<"/en">) {
  return <SiteShell lang="en">{children}</SiteShell>;
}
