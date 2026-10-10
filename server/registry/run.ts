/** path every widget fetch goes through: params checked against the widget schema, the answer taken
 * from the cache (server/widget-cache.ts) or fetched w/ a timeout, and checked against the payload
 * schema before it goes out or into the cache */

import { DEFAULT_LOCATION } from "@/server/location";
import { cached, cacheKey } from "@/server/widget-cache";

import { WidgetError, type FetchContext, type WidgetDef } from "./define";

// 1 result per widget, so 1 failing city never fails the whole dashboard. stale = the upstream is
// down and this is the last good answer
export type RunResult =
  | { ok: true; data: unknown; stale: boolean }
  | { ok: false; reason: "invalid_params" | "widget" | "upstream"; message: string };

const TIMEOUT_MS = 8000;

export async function runWidget(
  serviceId: string,
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

  // a widget that didnt declare usesLocation gets the default city, never the user's: the cache key
  // below leaves the location out for it, so the user's city must not change its answer either. a
  // widget that forgot the flag shows madrid everywhere, an obvious bug, instead of serving 1 user's
  // city to the others
  const location = widget.usesLocation ? ctx.location : DEFAULT_LOCATION;

  // everything the answer depends on: the params, the location for the widgets that use it, and the
  // day for the daily games. a user's own key or account (#17, #19) would make it personal, those
  // fetches skip the shared cache
  const key = cacheKey(`${serviceId}/${widget.id}`, {
    params: parsed.data,
    location: widget.usesLocation ? location : null,
    day: new Date().toISOString().slice(0, 10),
  });

  // the timeout only, not the request's signal: an identical request may be sharing this fetch, 1
  // closed tab must not cancel it for the others
  const load = async () => {
    const raw = await widget.fetch({
      ...ctx,
      location,
      params: parsed.data,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const payload = widget.payload.safeParse(raw);
    if (!payload.success) {
      console.error(`widget ${widget.id} returned a bad payload`, payload.error.issues);
      throw new BadPayload();
    }
    return payload.data;
  };

  try {
    if (ctx.credentials) return { ok: true, data: await load(), stale: false };
    const { payload, stale } = await cached(
      key,
      widget.cache.ttl,
      load,
      (err) => !(err instanceof WidgetError),
    );
    return { ok: true, data: payload, stale };
  } catch (err) {
    if (err instanceof WidgetError) return { ok: false, reason: "widget", message: err.message };
    // the page went away mid request, nobody is waiting for an answer and nothing is broken
    if (!ctx.signal.aborted && !(err instanceof BadPayload)) {
      console.error(`widget ${widget.id} failed`, err);
    }
    return upstreamDown();
  }
}

// already logged w/ its zod issues where it happened
class BadPayload extends Error {}

const upstreamDown = (): RunResult => ({
  ok: false,
  reason: "upstream",
  message: "This service is unavailable right now, try again in a moment.",
});
