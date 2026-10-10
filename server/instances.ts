/** a user's widgets: which widget, its options, its refresh rate and its place on the dashboard.
 * every query has the userId in its where, so 1 user can never read or touch another one's rows,
 * a row that isnt yours answers exactly like a row that doesnt exist */

import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_COINS } from "@/server/crypto-watchlist";
import { db } from "@/server/db";
import { registry } from "@/server/registry";
import type { WidgetDef } from "@/server/registry/define";
import { NotSubscribedError, requireSubscription } from "@/server/subscriptions";

// what a new user starts with: 1 of each widget, in the order of the dashboard sections
// the optional 3rd item overrides the widget defaults, crypto starts w/ 8 coins instead of none
export const DEFAULT_WIDGETS: [service: string, widget: string, params?: object][] = [
  ["weather", "current_weather"],
  ["market", "stock_watchlist"],
  ["market", "crypto_prices", { coins: DEFAULT_COINS.join(",") }],
  ["market", "currency_converter"],
  ["tools", "public_holidays"],
  ["tools", "translator"],
  ["tools", "on_this_day"],
  ["news", "world_events"],
  ["news", "live_tv"],
  ["news", "headlines"],
  ["games", "wordle"],
  ["games", "flag_guesser"],
  ["games", "spelling_bee"],
  ["games", "game_2048"],
];

// slowest refresh a user can pick, the timer still needs to come back once a day
export const MAX_REFRESH_SEC = 86_400;

export class InstanceError extends Error {
  constructor(
    readonly status: 400 | 403 | 404,
    message: string,
  ) {
    super(message);
  }
}

const SELECT = {
  id: true,
  serviceId: true,
  widgetId: true,
  params: true,
  refreshSec: true,
  position: true,
  hidden: true,
} as const;

function widgetOf(serviceId: string, widgetId: string) {
  const widget = registry.getWidget(serviceId, widgetId);
  if (!widget) throw new InstanceError(404, "That widget doesn't exist.");
  return widget;
}

/** requireSubscription (#18): a widget of a locked service can't be put on the dashboard, neither
 * added nor switched back on. one already there stays, its card says how to unlock it */
async function checkSubscribed(userId: string, serviceId: string) {
  const service = registry.getService(serviceId);
  if (!service) return;
  try {
    await requireSubscription(userId, service);
  } catch (err) {
    if (err instanceof NotSubscribedError) throw new InstanceError(403, err.message);
    throw err;
  }
}

// the same zod schema the data endpoint uses, so a saved config is always 1 the fetcher can read
function parseParams(widget: WidgetDef, params: unknown) {
  const parsed = widget.params.safeParse(params);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new InstanceError(400, `${issue.path.join(".") || "params"}: ${issue.message}`);
  }
  // params are only strings, integers and booleans (describeParams enforces it), valid json
  return parsed.data as Prisma.InputJsonObject;
}

function checkRefresh(widget: WidgetDef, sec: number) {
  if (sec < widget.refresh.min || sec > MAX_REFRESH_SEC) {
    throw new InstanceError(
      400,
      `The refresh rate must be between ${widget.refresh.min}s and ${MAX_REFRESH_SEC}s.`,
    );
  }
  return sec;
}

/** the defaults w/o a db row, for a dashboard w/ nobody signed in: read only, nothing to save to */
export function defaultInstances() {
  return DEFAULT_WIDGETS.map(([serviceId, widgetId, params], position) => {
    const widget = widgetOf(serviceId, widgetId);
    return {
      id: `default-${serviceId}-${widgetId}`,
      serviceId,
      widgetId,
      params: parseParams(widget, params ?? {}) as Record<string, unknown>,
      refreshSec: widget.refresh.default,
      position,
      hidden: false,
    };
  });
}

const byPosition = (userId: string) =>
  db.widgetInstance.findMany({ where: { userId }, orderBy: { position: "asc" }, select: SELECT });

/** the user's dashboard. the 1st time it's empty, so it gets the default widgets */
export async function listInstances(userId: string) {
  const rows = await byPosition(userId);
  if (rows.length > 0) return rows;

  await db.$transaction(async (tx) => {
    // locks the user row, 2 tabs opening a new account at once dont both create the defaults
    await tx.$executeRaw`SELECT 1 FROM "user" WHERE id = ${userId} FOR UPDATE`;
    if ((await tx.widgetInstance.count({ where: { userId } })) > 0) return;
    await tx.widgetInstance.createMany({
      data: DEFAULT_WIDGETS.map(([serviceId, widgetId, params], position) => {
        const widget = widgetOf(serviceId, widgetId);
        return {
          userId,
          serviceId,
          widgetId,
          params: parseParams(widget, params ?? {}),
          refreshSec: widget.refresh.default,
          position,
        };
      }),
    });
  });
  return byPosition(userId);
}

export async function createInstance(
  userId: string,
  input: { serviceId: string; widgetId: string; params?: unknown; refreshSec?: number },
) {
  const widget = widgetOf(input.serviceId, input.widgetId);
  await checkSubscribed(userId, input.serviceId);
  const last = await db.widgetInstance.findFirst({
    where: { userId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return db.widgetInstance.create({
    data: {
      userId,
      serviceId: input.serviceId,
      widgetId: input.widgetId,
      params: parseParams(widget, input.params ?? {}),
      refreshSec: checkRefresh(widget, input.refreshSec ?? widget.refresh.default),
      position: (last?.position ?? -1) + 1,
    },
    select: SELECT,
  });
}

/** params are merged into the saved ones, so a card control can send only what it changed. hidden
 * is the on/off switch of "add widgets" */
export async function updateInstance(
  userId: string,
  id: string,
  patch: { params?: Record<string, unknown>; refreshSec?: number; hidden?: boolean },
) {
  const row = await db.widgetInstance.findFirst({ where: { id, userId }, select: SELECT });
  if (!row) throw new InstanceError(404, "That widget isn't on your dashboard.");
  const widget = widgetOf(row.serviceId, row.widgetId);
  if (patch.hidden === false && row.hidden) await checkSubscribed(userId, row.serviceId);
  // null clears an option, so an optional one (the news language) can go back to automatic
  const merged = patch.params && { ...(row.params as object), ...patch.params };
  if (merged)
    for (const [k, v] of Object.entries(merged)) if (v === null) delete merged[k as never];
  const params = merged ? parseParams(widget, merged) : undefined;
  const refreshSec =
    patch.refreshSec === undefined ? undefined : checkRefresh(widget, patch.refreshSec);
  return db.widgetInstance.update({
    where: { id: row.id },
    data: { params, refreshSec, hidden: patch.hidden },
    select: SELECT,
  });
}

export async function deleteInstance(userId: string, id: string) {
  const { count } = await db.widgetInstance.deleteMany({ where: { id, userId } });
  if (count === 0) throw new InstanceError(404, "That widget isn't on your dashboard.");
}

/** the whole new order at once, after a drag. it has to be exactly the user's widgets, no more,
 * no less, so a reorder cant smuggle in or drop a row */
export async function reorderInstances(userId: string, ids: string[]) {
  const rows = await db.widgetInstance.findMany({ where: { userId }, select: { id: true } });
  const mine = new Set(rows.map((r) => r.id));
  if (
    ids.length !== mine.size ||
    new Set(ids).size !== ids.length ||
    ids.some((i) => !mine.has(i))
  ) {
    throw new InstanceError(400, "The new order must list each of your widgets exactly once.");
  }
  await db.$transaction(
    ids.map((id, position) => db.widgetInstance.update({ where: { id }, data: { position } })),
  );
  return byPosition(userId);
}
