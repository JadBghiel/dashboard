"use client";

/** the user's public github repositories, w/ their language, stars and last push */

import { Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ReposPayload } from "@/server/services/github/widgets";

import { FooterLink } from "../footer-link";
import { useWidgetData } from "../use-widget-data";
import { WidgetCard } from "../widget-card";
import { ago, GitHubLocked } from "./github-locked";
import { GitHubMark } from "./github-mark";

export function ReposCard({
  count = 5,
  sort = "pushed",
}: {
  count?: number;
  sort?: "pushed" | "created" | "full_name";
}) {
  const { data, error, locked, loading, refresh } = useWidgetData<ReposPayload>(
    "github",
    "repositories",
    { count, sort },
    "",
  );

  return (
    <WidgetCard
      icon={<GitHubMark className="size-5" />}
      title="Repositories"
      subtitle={data ? `@${data.login}` : undefined}
      loading={loading}
      error={locked ? null : error}
      hasData={!!data || locked}
      onRefresh={refresh}
      footer={
        data &&
        !locked && (
          <FooterLink href={`https://github.com/${data.login}?tab=repositories`}>
            All repositories
          </FooterLink>
        )
      }
    >
      {locked ? (
        <GitHubLocked />
      ) : (
        data &&
        (data.items.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">No public repositories.</p>
        ) : (
          <ul className="divide-y" aria-live="polite">
            {data.items.map((r) => (
              <li key={r.id} className="space-y-0.5 py-2">
                <div className="flex items-center gap-2">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary min-w-0 truncate text-sm font-medium"
                  >
                    {r.name}
                  </a>
                  {r.fork && <Badge variant="outline">Fork</Badge>}
                  <span className="text-muted-foreground ml-auto flex shrink-0 items-center gap-1 text-xs">
                    <Star className="size-3" aria-hidden />
                    {r.stars}
                    <span className="sr-only">stars</span>
                  </span>
                </div>
                {r.description && (
                  <p className="text-muted-foreground line-clamp-1 text-xs">{r.description}</p>
                )}
                <p className="text-muted-foreground text-xs">
                  {[r.language, r.pushedAt && `pushed ${ago(r.pushedAt)} ago`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        ))
      )}
    </WidgetCard>
  );
}
