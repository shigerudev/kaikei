import { pageMeta } from "@/components/site/page-dict";
import { ProductView } from "@/components/site/views/product";

export const metadata = pageMeta("es", "/product", "product");

export default function Page() {
  return <ProductView lang="es" />;
}
