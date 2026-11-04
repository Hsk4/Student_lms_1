"use client";

import * as React from "react";
import { Menu } from "lucide-react";

import {
  SidebarNav,
  type SidebarNavProps,
} from "@/components/shell/sidebar-nav";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/** Hamburger + slide-over sidebar, used by the panels with grouped nav. */
export function MobileNavSheet(props: Omit<SidebarNavProps, "onNavigate">) {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 border-[1.5px] border-on-navy-line text-white hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0 sm:max-w-[300px]">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Panel navigation</SheetDescription>
        </SheetHeader>
        <SidebarNav
          {...props}
          onNavigate={() => setOpen(false)}
          className="border-r-0"
        />
      </SheetContent>
    </Sheet>
  );
}
