"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/nila";
import { api } from "@/lib/api-client";

export function SyncUsersButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const result = await api.post<{ deleted: number; synced: number }>(
        "/admin/users/sync",
      );
      setMessage({
        type: "success",
        text: `Sync complete. Deleted ${result.deleted} user(s). ${result.synced} users synced with Clerk.`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Sync failed",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={handleSync}
        disabled={loading}
      >
        <RefreshCw className={loading ? "animate-spin" : undefined} />
        {loading ? "Syncing..." : "Sync with Clerk"}
      </Button>
      {message ? (
        <Notice tone={message.type === "success" ? "success" : "error"}>
          {message.text}
        </Notice>
      ) : null}
    </div>
  );
}
