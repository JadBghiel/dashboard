/** the github widgets, both on the user's linked account: unread notifications, and their repos */

import { z } from "zod";

import { defineWidget, WidgetError, type WidgetCredentials } from "@/server/registry/define";

import { githubGet, subjectPage } from "./api";

// requireSubscription only lets a linked user through, so this is a safety net
function tokenOf(credentials: WidgetCredentials) {
  if (credentials?.kind !== "oauth") throw new WidgetError("Connect GitHub on the Services page.");
  return credentials.accessToken;
}

const User = z.object({ login: z.string() });

// ---- notifications ----

const Notification = z.object({
  id: z.string(),
  reason: z.string(),
  updated_at: z.string(),
  subject: z.object({ title: z.string(), type: z.string(), url: z.string().nullable() }),
  repository: z.object({ full_name: z.string(), html_url: z.string() }),
});

export const NotificationsPayload = z.object({
  login: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      // PullRequest, Issue, Release, CheckSuite...
      type: z.string(),
      // why you got it: mention, review_requested, assign...
      reason: z.string(),
      repo: z.string(),
      url: z.string(),
      updatedAt: z.string(),
    }),
  ),
});
export type NotificationsPayload = z.infer<typeof NotificationsPayload>;

export const notificationsWidget = defineWidget({
  id: "notifications",
  name: "GitHub notifications",
  description: "Your unread GitHub notifications, each linked to its page",
  params: z.object({
    count: z.number().int().min(1).max(20).default(8),
    // only the threads you take part in (mentioned, assigned, reviewing, author)
    only_participating: z.boolean().default(false),
  }),
  // 5000 calls an hour per user, a minute is far from it
  refresh: { default: 300, min: 60 },
  // the user's own data, runWidget never puts it in the shared cache
  cache: { ttl: 60 },
  payload: NotificationsPayload,
  async fetch({ params, credentials, signal }) {
    const token = tokenOf(credentials);
    const path = `/notifications?per_page=${params.count}&participating=${params.only_participating}`;
    const [user, list] = await Promise.all([
      githubGet("/user", token, signal),
      githubGet(path, token, signal),
    ]);
    return {
      login: User.parse(user).login,
      items: z
        .array(Notification)
        .parse(list)
        .map((n) => ({
          id: n.id,
          title: n.subject.title,
          type: n.subject.type,
          reason: n.reason,
          repo: n.repository.full_name,
          url: subjectPage(n.subject.url, n.repository.html_url),
          updatedAt: n.updated_at,
        })),
    };
  },
});

// ---- repos ----

const Repo = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  html_url: z.string(),
  description: z.string().nullable(),
  stargazers_count: z.number(),
  language: z.string().nullable(),
  pushed_at: z.string().nullable(),
  fork: z.boolean(),
});

export const ReposPayload = z.object({
  login: z.string(),
  items: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      fullName: z.string(),
      url: z.string(),
      description: z.string().nullable(),
      stars: z.number(),
      language: z.string().nullable(),
      pushedAt: z.string().nullable(),
      fork: z.boolean(),
    }),
  ),
});
export type ReposPayload = z.infer<typeof ReposPayload>;

export const reposWidget = defineWidget({
  id: "repositories",
  name: "GitHub repositories",
  description: "Your public repositories, with their stars and last push",
  params: z.object({
    count: z.number().int().min(1).max(10).default(5),
    sort: z.enum(["pushed", "created", "full_name"]).default("pushed"),
  }),
  refresh: { default: 1800, min: 300 },
  cache: { ttl: 300 },
  payload: ReposPayload,
  async fetch({ params, credentials, signal }) {
    const token = tokenOf(credentials);
    const path = `/user/repos?visibility=public&affiliation=owner&sort=${params.sort}&per_page=${params.count}`;
    const [user, list] = await Promise.all([
      githubGet("/user", token, signal),
      githubGet(path, token, signal),
    ]);
    return {
      login: User.parse(user).login,
      items: z
        .array(Repo)
        .parse(list)
        .map((r) => ({
          id: r.id,
          name: r.name,
          fullName: r.full_name,
          url: r.html_url,
          description: r.description,
          stars: r.stargazers_count,
          language: r.language,
          pushedAt: r.pushed_at,
          fork: r.fork,
        })),
    };
  },
});
