import {
  ArrowLeftRightIcon,
  FileTextIcon,
  FlagIcon,
  LayoutGridIcon,
  type LucideProps,
  PlugZapIcon,
  SettingsIcon,
  UploadIcon,
} from "lucide-react";
import type { NavKey } from "@/lib/nav";

const ICONS = {
  overview: LayoutGridIcon,
  import: UploadIcon,
  transactions: ArrowLeftRightIcon,
  documents: FileTextIcon,
  review: FlagIcon,
  connect: PlugZapIcon,
  settings: SettingsIcon,
} satisfies Record<NavKey, React.ComponentType<LucideProps>>;

export function NavIcon({ nav, ...props }: { nav: NavKey } & LucideProps) {
  const Icon = ICONS[nav];
  return <Icon {...props} />;
}
