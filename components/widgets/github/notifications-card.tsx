"use client";

/** the user's unread github notifications, each a link to its pull request, issue or repo */

import type { NotificationsPayload } from "@/server/services/github/widgets";

import { FooterLink } from "../footer-link";
import { useWidgetData } from "../use-widget-data";
import { WidgetCard } from "../widget-card";
import { ago, GitHubLocked } from "./github-locked";
import { GitHubMark } from "./github-mark";

// review_requested -> review requested
const reasonLabel = (r: string) => r.replace(/_/g, " ");
// PullRequest -> PR, the rest as github names it
const typeLabel = (t: string) => (t === "PullRequest" ? "PR" : t);

export function NotificationsCard({
  count = 8,
  onlyParticipating = false,
}: {
  count?: number;
  onlyParticipating?: boolean;
}) {
  const { data, error, locked, loading, refresh } = useWidgetData<NotificationsPayload>(
    "github",
    "notifications",
    { count, only_participating: onlyParticipating },
    "",
  );

  return (
    <WidgetCard
      icon={<GitHubMark className="size-5" />}
      title="Notifications"
      subtitle={data ? `@${data.login} · ${data.items.length} unread` : undefined}
      loading={loading}
      error={locked ? null : error}
      hasData={!!data || locked}
      onRefresh={refresh}
      footer={
        !locked && (
          <FooterLink href="https://github.com/notifications">Open notifications</FooterLink>
        )
      }
    >
      {locked ? (
        <GitHubLocked />
      ) : (
        data &&
        (data.items.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">All caught up.</p>
        ) : (
          <ul className="divide-y" aria-live="polite">
            {data.items.map((n) => (
              <li key={n.id} className="py-2">
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary block text-sm font-medium"
                >
                  {n.title}
                </a>
                <span className="text-muted-foreground block truncate text-xs">
                  {typeLabel(n.type)} · {n.repo} · {reasonLabel(n.reason)} · {ago(n.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        ))
      )}
    </WidgetCard>
  );
}
