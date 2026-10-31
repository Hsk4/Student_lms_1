"use client";

import * as React from "react";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface NotificationItem {
  id: string;
  title: string;
  body?: string;
  href?: string;
}

/**
 * Reference kit notifications drawer. The kit rendered mock notifications; here
 * the items are passed in by the server layout (e.g. pending requests for an
 * admin), and an empty array renders the honest "nothing new" state instead of
 * inventing events.
 */
export function NotificationsDrawer({
  items = [],
}: {
  items?: NotificationItem[];
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            items.length ? `Notifications (${items.length})` : "Notifications"
          }
        >
          <Bell className="h-5 w-5" />
          {items.length ? (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-status-red" />
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[340px] p-0 sm:max-w-[380px]">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>
            {items.length
              ? `${items.length} item${items.length === 1 ? "" : "s"} need attention`
              : "Nothing needs your attention"}
          </SheetDescription>
        </SheetHeader>
        <ul className="quiet-scroll max-h-[calc(100vh-5rem)] overflow-y-auto p-3">
          {items.length === 0 ? (
            <li className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              You are all caught up.
            </li>
          ) : (
            items.map((item) => (
              <li key={item.id}>
                <a
                  href={item.href ?? "#"}
                  className={cn(
                    "block rounded-lg border border-transparent px-3 py-2.5 transition-colors",
                    "hover:border-border hover:bg-secondary",
                  )}
                >
                  <p className="text-sm font-medium text-foreground">
                    {item.title}
                  </p>
                  {item.body ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.body}
                    </p>
                  ) : null}
                </a>
              </li>
            ))
          )}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
