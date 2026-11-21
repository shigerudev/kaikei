import {
  ArrowLeftRightIcon,
  FlagIcon,
  LayoutGridIcon,
  type LucideProps,
  PlayIcon,
  SettingsIcon,
  UploadIcon,
} from "lucide-react";
import type { NavKey } from "@/lib/ui/nav";

const ICONS = {
  dashboard: LayoutGridIcon,
  uploads: UploadIcon,
  runs: PlayIcon,
  findings: FlagIcon,
  intercompany: ArrowLeftRightIcon,
  settings: SettingsIcon,
} satisfies Record<NavKey, React.ComponentType<LucideProps>>;

export function NavIcon({ nav, ...props }: { nav: NavKey } & LucideProps) {
  const Icon = ICONS[nav];
  return <Icon {...props} />;
}
