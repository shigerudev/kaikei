"use client";

import { CheckIcon, ChevronsUpDownIcon, MonitorIcon, MoonIcon, PlusIcon, SearchIcon, SunIcon } from "lucide-react";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { activeNav, NAV, wsPath } from "@/lib/nav";

type Props = {
  ws: string;
  workspaceName: string;
  isSample: boolean;
  workspaces: { id: string; name: string }[];
  openFlags: number;
};

export function AppSidebar({ ws, workspaceName, isSample, workspaces, openFlags }: Props) {
  const pathname = usePathname();
  const active = activeNav(pathname, ws);
  const { open: openCommand } = useCommandMenu();
  const { isMobile, setOpenMobile } = useSidebar();
  const close = () => isMobile && setOpenMobile(false);
  const main = NAV.filter((n) => n.key !== "settings");
  const settings = NAV.find((n) => n.key === "settings")!;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-foreground text-[13px] font-semibold text-background">
                    {workspaceName.slice(0, 1)}
                  </span>
                  <span className="grid min-w-0 flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium text-sidebar-accent-foreground">{workspaceName}</span>
                    <span className="truncate text-xs text-muted-foreground">{isSample ? "Sample workspace" : "Workspace"}</span>
                  </span>
                  <ChevronsUpDownIcon className="ml-auto size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side={isMobile ? "bottom" : "right"} sideOffset={6} className="w-60">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
                {workspaces.map((w) => (
                  <DropdownMenuItem key={w.id} asChild>
                    <Link href={wsPath(w.id)}>
                      <span className="flex size-5 items-center justify-center rounded bg-foreground text-[10px] font-semibold text-background">{w.name.slice(0, 1)}</span>
                      <span className="truncate">{w.name}</span>
                      {w.id === ws && <CheckIcon className="ml-auto size-4" />}
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/">
                    <PlusIcon />
                    Use your own file
                  </Link>
                </DropdownMenuItem>
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
          <SidebarGroupContent>
            <SidebarMenu>
              {main.map((n) => {
                const isActive = active === n.key;
                return (
                  <SidebarMenuItem key={n.key}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={n.label} className="relative">
                      <Link href={wsPath(ws, n.path)} onClick={close} aria-current={isActive ? "page" : undefined}>
                        {isActive && <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand group-data-[collapsible=icon]:hidden" />}
                        <NavIcon nav={n.key} className={isActive ? "text-brand" : undefined} />
                        <span>{n.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {n.key === "review" && openFlags > 0 && (
                      <SidebarMenuBadge className="num rounded-full bg-brand-subtle px-1.5 text-brand">{openFlags}</SidebarMenuBadge>
                    )}
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
            <SidebarMenuButton asChild isActive={active === "settings"} tooltip="Settings">
              <Link href={wsPath(ws, settings.path)} onClick={close}>
                <NavIcon nav="settings" className={active === "settings" ? "text-brand" : undefined} />
                <span>Settings</span>
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
