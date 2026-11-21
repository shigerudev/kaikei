"use client";

import { CheckIcon, ChevronsUpDownIcon, MonitorIcon, MoonIcon, SearchIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCommandMenu } from "@/components/command/command-menu";
import { NavIcon } from "@/components/shell/nav-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { activeNav, gPath, NAV } from "@/lib/ui/nav";

type Props = {
  group: string;
  groupName: string;
  subtitle: string;
  companies: { id: string; name: string; functional_currency: string }[];
  openBlockers: number;
  openFindings: number;
  filesReady: string;
};

export function AppSidebar({ group, groupName, subtitle, companies, openBlockers, openFindings, filesReady }: Props) {
  const pathname = usePathname();
  const active = activeNav(pathname, group);
  const { open: openCommand } = useCommandMenu();
  const { isMobile, setOpenMobile } = useSidebar();
  const close = () => isMobile && setOpenMobile(false);
  const main = NAV.filter((n) => n.section === "main");
  const settings = NAV.find((n) => n.key === "settings")!;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-foreground text-[12px] font-semibold text-background">AG</span>
                  <span className="grid min-w-0 flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium text-sidebar-accent-foreground">{groupName}</span>
                    <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
                  </span>
                  <ChevronsUpDownIcon className="ml-auto size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side={isMobile ? "bottom" : "right"} sideOffset={6} className="w-64">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Group</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link href={gPath(group)}>
                    <span className="flex size-5 items-center justify-center rounded bg-foreground text-[9px] font-semibold text-background">AG</span>
                    {groupName}
                    <CheckIcon className="ml-auto size-4" />
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuLabel className="mt-1 text-xs text-muted-foreground">Companies</DropdownMenuLabel>
                {companies.map((c) => (
                  <DropdownMenuItem key={c.id} asChild>
                    <Link href={gPath(group, `/uploads/${c.id}`)}>
                      <span className="w-9 font-mono text-[10px] text-muted-foreground">{c.id}</span>
                      <span className="truncate">{c.name}</span>
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground">{c.functional_currency}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Search ⌘K"
              onClick={() => {
                close();
                openCommand();
              }}
              className="text-muted-foreground"
            >
              <SearchIcon />
              <span>Search</span>
              <Kbd className="ml-auto group-data-[collapsible=icon]:hidden">⌘K</Kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Consolidation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {main.map((n) => {
                const isActive = active === n.key;
                return (
                  <SidebarMenuItem key={n.key}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={n.label} className="relative">
                      <Link href={gPath(group, n.path)} onClick={close} aria-current={isActive ? "page" : undefined}>
                        {isActive && <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand group-data-[collapsible=icon]:hidden" />}
                        <NavIcon nav={n.key} className={isActive ? "text-brand" : undefined} />
                        <span>{n.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {n.key === "findings" && openFindings > 0 && (
                      <SidebarMenuBadge className={`num rounded-full px-1.5 ${openBlockers ? "bg-negative/12 text-negative" : "bg-brand-subtle text-brand"}`}>{openFindings}</SidebarMenuBadge>
                    )}
                    {n.key === "uploads" && <SidebarMenuBadge className="num text-[11px] text-muted-foreground">{filesReady}</SidebarMenuBadge>}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={active === "settings"} tooltip={settings.label}>
              <Link href={gPath(group, settings.path)} onClick={close}>
                <NavIcon nav="settings" className={active === "settings" ? "text-brand" : undefined} />
                <span>{settings.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <ThemeMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton tooltip="Theme" className="text-muted-foreground">
          <SunIcon className="dark:hidden" />
          <MoonIcon className="hidden dark:block" />
          <span>Theme</span>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" sideOffset={6} className="w-40">
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light"><SunIcon /> Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark"><MoonIcon /> Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system"><MonitorIcon /> System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
