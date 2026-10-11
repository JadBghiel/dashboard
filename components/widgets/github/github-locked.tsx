"use client";

/** what a github card shows until the user links their account, and the relative time both cards
 * print. the card itself fetched, the server answered 403 not_subscribed */

import { ConnectAccount } from "@/components/services/connect-account";

export function GitHubLocked() {
  return (
    <div className="space-y-3 py-2">
      <p className="text-muted-foreground text-sm">
        Connect your GitHub account to see your notifications and repositories here. Read only,
        public data.
      </p>
      <ConnectAccount provider="github" name="GitHub" accountId={null} enabled />
    </div>
  );
}

// 5m, 3h, 2d, an iso date from github
export function ago(iso: string) {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
