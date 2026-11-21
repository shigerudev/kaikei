"use client";

import { SearchIcon } from "lucide-react";
import { useCommandMenu } from "@/components/command/command-menu";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";

export function HeaderSearch() {
  const { open } = useCommandMenu();
  return (
    <Button variant="outline" size="sm" onClick={open} className="h-7 gap-2 pr-1.5 pl-2 text-muted-foreground" aria-label="Buscar (⌘K)">
      <SearchIcon />
      <span className="hidden md:inline">Buscar</span>
      <Kbd className="hidden md:inline-flex">⌘K</Kbd>
    </Button>
  );
}
