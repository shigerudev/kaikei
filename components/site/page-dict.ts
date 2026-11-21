import type { Metadata } from "next";
import { type Dict, getDict } from "@/components/site/dict";
import { type Lang, LOCALES, localize, SITE } from "@/lib/ui/site";

/** Static metadata for one public path: localized title plus hreflang alternates. */
export function pageMeta(lang: Lang, path: string, page?: keyof Dict["meta"]["pages"]): Metadata {
  return {
    ...(page ? { title: getDict(lang).meta.pages[page] } : {}),
    alternates: {
      canonical: localize(lang, path),
      languages: Object.fromEntries(LOCALES.map((l) => [l, `${SITE.url}${localize(l, path)}`])),
    },
  };
}
