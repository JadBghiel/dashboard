/** github's rest api, always w/ the user's own token from the linked account (#19). public data only:
 * the scopes are read:user and notifications, private repos never show */

import { WidgetError } from "@/server/registry/define";

import { fetchOnceMore, UpstreamError } from "../http";

const API = "https://api.github.com";

/** GET on the api as the user. a 401 means the token was revoked on github's side, the user can fix
 * it by linking again, so it says so instead of "unavailable" */
export async function githubGet(path: string, token: string, signal: AbortSignal) {
  const res = await fetchOnceMore(new URL(path, API), {
    signal,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    },
  });
  if (res.status === 401) {
    throw new WidgetError(
      "GitHub no longer accepts the link, connect it again on the Services page.",
    );
  }
  if (!res.ok) throw new UpstreamError("github", res.status);
  return res.json() as Promise<unknown>;
}

/** a notification's subject comes as an api url, the browser needs the page:
 * api.github.com/repos/o/r/pulls/12 -> github.com/o/r/pull/12, issues the same, the rest -> the repo */
export function subjectPage(apiUrl: string | null, repoPage: string) {
  const m = apiUrl?.match(
    /^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)\/(pulls|issues)\/(\d+)$/,
  );
  if (!m) return repoPage;
  return `https://github.com/${m[1]}/${m[2] === "pulls" ? "pull" : "issues"}/${m[3]}`;
}
