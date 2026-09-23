/** path every widget fetch goes through: params checked against the widget schema, the fetcher
 * run w/ a timeout, and its answer checked against the payload schema before it goes out. #22 wraps
 * this w/ the cache and the batching */

import { WidgetError, type FetchContext, type WidgetDef } from "./define";

// result: he batch endpoint in #22 returns 1 result per widget, 1 failing city
// shouldnt fail the whole dashboard
export type RunResult =
  | { ok: true; data: unknown }
  | { ok: false; reason: "invalid_params" | "widget" | "upstream"; message: string };

const TIMEOUT_MS = 8000;

export async function runWidget(
  widget: WidgetDef,
  rawParams: unknown,
  ctx: Omit<FetchContext<unknown>, "params">,
): Promise<RunResult> {
  const parsed = widget.params.safeParse(rawParams ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.join(".");
    return {
      ok: false,
      reason: "invalid_params",
      message: path ? `${path}: ${issue.message}` : issue.message,
    };
  }

  try {
    const raw = await widget.fetch({
      ...ctx,
      params: parsed.data,
      signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(TIMEOUT_MS)]),
    });

    // fetcher: 
    const payload = widget.payload.safeParse(raw);
    if (!payload.success) {
      console.error(`widget ${widget.id} returned a bad payload`, payload.error.issues);
      return upstreamDown();
    }
    return { ok: true, data: payload.data };
  } catch (err) {
    if (err instanceof WidgetError) return { ok: false, reason: "widget", message: err.message };
    console.error(`widget ${widget.id} failed`, err);
    return upstreamDown();
  }
}

const upstreamDown = (): RunResult => ({
  ok: false,
  reason: "upstream",
  message: "This service is unavailable right now, try again in a moment.",
});
