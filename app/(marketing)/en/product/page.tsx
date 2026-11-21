import { pageMeta } from "@/components/site/page-dict";
import { ProductView } from "@/components/site/views/product";

export const metadata = pageMeta("en", "/product", "product");

export default function Page() {
  return <ProductView lang="en" />;
}
