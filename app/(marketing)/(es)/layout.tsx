import { SiteShell, siteMetadata, siteViewport } from "@/components/site/views/shell";

export const metadata = siteMetadata("es");
export const viewport = siteViewport;

export default function Layout({ children }: LayoutProps<"/">) {
  return <SiteShell lang="es">{children}</SiteShell>;
}
