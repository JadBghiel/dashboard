import { createMiddleware } from "hono/factory";
import { auth } from "@/lib/auth";
import type { Context } from "hono";

export type Env = {
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
};

export function getSessionUser(c: Context) {
  return c.get("user" as never) as typeof auth.$Infer.Session.user | null;
}

export const sessionMiddleware = createMiddleware<Env>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  c.set("user", session?.user ?? null);
  c.set("session", session?.session ?? null);
  await next();
});
