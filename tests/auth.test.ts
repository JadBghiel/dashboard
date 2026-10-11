/** #10: sign up, log in, verification and their edge cases, against the real test db and the real
 * lib/auth.ts. each case here guards a rule from #9, relaxing 1 of them must turn this file red.
 * every request goes through auth.handler like a browser's would, only the mail is caught instead
 * of sent. each test uses its own users and its own ip, so the rate limits never leak between them */

import { signJWT } from "better-auth/crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendMail: vi.fn(async () => {}) }));

import { auth } from "@/lib/auth";
import { sendMail } from "@/lib/email";
import { api } from "@/server/api/app";
import { db } from "@/server/db";

import { resetDb } from "./db";

const ORIGIN = "http://localhost:3000";
const PASSWORD = "Quartz-Lantern-Velvet-93";
const SESSION_COOKIE = "better-auth.session_token";

let ipCount = 0;
/** a new client ip, so 1 test's attempts never count against another's */
const freshIp = () => `10.20.${Math.floor(ipCount / 250)}.${(ipCount++ % 250) + 1}`;

type Call = { body?: object; cookie?: string; ip?: string };

function call(path: string, { body, cookie, ip }: Call = {}) {
  const headers = new Headers({ origin: ORIGIN, "x-forwarded-for": ip ?? freshIp() });
  if (cookie) headers.set("cookie", cookie);
  if (body) headers.set("content-type", "application/json");
  return auth.handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: body ? "POST" : "GET",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}

/** the full Set-Cookie line of the session cookie, null when the answer signs nobody in */
function sessionSetCookie(res: Response) {
  return (
    res.headers
      .getSetCookie()
      .find((c) => c.startsWith(`${SESSION_COOKIE}=`) && !/Max-Age=0/i.test(c)) ?? null
  );
}

/** what a browser sends back */
function sessionCookie(res: Response) {
  const line = sessionSetCookie(res);
  if (!line) throw new Error(`no session cookie, status ${res.status}`);
  return line.split(";")[0];
}

async function sessionOf(cookie: string) {
  const res = await call("/get-session", { cookie });
  return (await res.json()) as { user: { id: string } } | null;
}

function signUp(name: string, overrides: Record<string, string> = {}) {
  return call("/sign-up/email", {
    body: { name, email: `${name}@example.com`, username: name, password: PASSWORD, ...overrides },
  });
}

function signIn(name: string, password = PASSWORD, ip?: string) {
  return call("/sign-in/email", { body: { email: `${name}@example.com`, password }, ip });
}

/** the token of the last verification link mailed to that address */
async function mailedToken(email: string) {
  const sent = () => vi.mocked(sendMail).mock.calls.filter(([m]) => m.to === email);
  await vi.waitFor(() => expect(sent().length).toBeGreaterThan(0));
  const href = /href="([^"]+)"/.exec(sent().at(-1)![0].html)![1];
  return new URL(href.replaceAll("&amp;", "&")).searchParams.get("token")!;
}

/** a confirmed account, signed in */
async function verifiedUser(name: string) {
  await signUp(name);
  const res = await call(`/verify-email?token=${await mailedToken(`${name}@example.com`)}`);
  expect(res.status).toBe(200);
  const user = await db.user.findUniqueOrThrow({ where: { email: `${name}@example.com` } });
  return { user, cookie: sessionCookie(res) };
}

beforeAll(resetDb);
afterAll(() => db.$disconnect());

describe("sign up", () => {
  it("leaves the account unverified, signed out, and the api answers 401", async () => {
    const res = await signUp("alice");
    expect(res.status).toBe(200);
    expect(sessionSetCookie(res)).toBeNull();

    const user = await db.user.findUniqueOrThrow({ where: { email: "alice@example.com" } });
    expect(user.emailVerified).toBe(false);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);

    const widgets = await api.request("/api/market/search?q=aapl");
    expect(widgets.status).toBe(401);
  });

  it("refuses the same email or username in another case, 1 user in the db", async () => {
    expect((await signUp("bob")).status).toBe(200);

    // same answer as a new email, so sign up can't tell who has an account, but nothing is created
    const sameEmail = await signUp("bob2", { email: "BOB@Example.COM" });
    expect(sameEmail.status).toBe(200);
    expect(sessionSetCookie(sameEmail)).toBeNull();

    const sameUsername = await signUp("bob3", { username: "BoB" });
    expect(sameUsername.status).toBe(400);
    expect((await sameUsername.json()).code).toBe("USERNAME_IS_ALREADY_TAKEN");

    const users = await db.user.findMany({ where: { email: { startsWith: "bob" } } });
    expect(users.map((u) => [u.email, u.username])).toEqual([["bob@example.com", "bob"]]);
  });

  it("is enforced by the db too, not only by the app", async () => {
    await signUp("carol");
    const row = { name: "x", emailVerified: false, createdAt: new Date(), updatedAt: new Date() };
    await expect(
      db.user.create({ data: { ...row, id: "dup-1", email: "CAROL@example.com" } }),
    ).rejects.toThrow();
    await expect(
      db.user.create({
        data: { ...row, id: "dup-2", email: "carol2@example.com", username: "Carol" },
      }),
    ).rejects.toThrow();
  });

  it("refuses a short, common or personal password w/ the reason", async () => {
    const short = await signUp("dave", { password: "Sh0rt!" });
    expect(short.status).toBe(400);
    expect((await short.json()).code).toBe("PASSWORD_TOO_SHORT");

    // 422: well formed, but the value itself isn't accepted. the message says why
    for (const password of ["password1234", "dave-dave-dave-1"]) {
      const res = await signUp("dave", { password });
      expect(res.status).toBe(422);
      expect((await res.json()).message).toBeTruthy();
    }
    expect(await db.user.count({ where: { email: "dave@example.com" } })).toBe(0);
  });

  it("refuses a username outside 3-30 characters of a-z 0-9 . _", async () => {
    const cases = {
      ab: "USERNAME_TOO_SHORT",
      ["e".repeat(31)]: "USERNAME_TOO_LONG",
      "eve smith!": "INVALID_USERNAME",
    };
    for (const [username, code] of Object.entries(cases)) {
      const res = await signUp("eve", { username });
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe(code);
    }
    expect(await db.user.count({ where: { email: "eve@example.com" } })).toBe(0);
  });
});

describe("verification link", () => {
  it("confirms the email and signs the user in", async () => {
    await signUp("frank");
    const res = await call(`/verify-email?token=${await mailedToken("frank@example.com")}`);
    expect(res.status).toBe(200);

    const user = await db.user.findUniqueOrThrow({ where: { email: "frank@example.com" } });
    expect(user.emailVerified).toBe(true);
    expect((await sessionOf(sessionCookie(res)))?.user.id).toBe(user.id);
  });

  it("signs nobody in a 2nd time", async () => {
    await signUp("grace");
    const token = await mailedToken("grace@example.com");
    await call(`/verify-email?token=${token}`);

    const again = await call(`/verify-email?token=${token}`);
    expect(again.status).toBe(200);
    expect(sessionSetCookie(again)).toBeNull();
    const user = await db.user.findUniqueOrThrow({ where: { email: "grace@example.com" } });
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
  });

  it("refuses an expired link", async () => {
    await signUp("heidi");
    const expired = await signJWT(
      { email: "heidi@example.com" },
      process.env.BETTER_AUTH_SECRET!,
      -60,
    );
    const res = await call(`/verify-email?token=${expired}`);
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("TOKEN_EXPIRED");
    expect(
      (await db.user.findUniqueOrThrow({ where: { email: "heidi@example.com" } })).emailVerified,
    ).toBe(false);
  });

  it("refuses a forged or tampered link", async () => {
    await signUp("ivan");
    const forged = await signJWT({ email: "ivan@example.com" }, "someone-elses-secret", 3600);
    // a real link w/ its email swapped for another account's
    const [head, , sig] = (await mailedToken("ivan@example.com")).split(".");
    const payload = Buffer.from(JSON.stringify({ email: "alice@example.com" })).toString(
      "base64url",
    );

    for (const token of [forged, `${head}.${payload}.${sig}`, "not-a-token"]) {
      const res = await call(`/verify-email?token=${token}`);
      expect(res.status).toBe(401);
      expect((await res.json()).code).toBe("INVALID_TOKEN");
    }
    const users = await db.user.findMany({
      where: { email: { in: ["ivan@example.com", "alice@example.com"] } },
    });
    expect(users.every((u) => !u.emailVerified)).toBe(true);
  });
});

describe("log in", () => {
  it("refuses an account whose email isn't confirmed, even w/ the right password", async () => {
    await signUp("judy");
    const res = await signIn("judy");
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("EMAIL_NOT_VERIFIED");
    expect(sessionSetCookie(res)).toBeNull();

    const byUsername = await call("/sign-in/username", {
      body: { username: "judy", password: PASSWORD },
    });
    expect(byUsername.status).toBe(403);
  });

  it("answers a wrong password and an unknown email the same way", async () => {
    await verifiedUser("ken");
    const wrong = await signIn("ken", "Wrong-Password-But-Long");
    const unknown = await signIn("nobody-here");
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect((await wrong.json()).code).toBe((await unknown.json()).code);
  });

  it("rate limits 1 ip after 5 attempts a minute", async () => {
    await verifiedUser("leo");
    const ip = freshIp();
    for (let i = 0; i < 5; i++)
      expect((await signIn("leo", "Wrong-Password-But-Long", ip)).status).toBe(401);
    // even the right password, the limit is checked before it
    expect((await signIn("leo", PASSWORD, ip)).status).toBe(429);
    expect((await signIn("leo", PASSWORD)).status).toBe(200);
  });

  it("rate limits 1 account after 10 attempts, whatever the ips", async () => {
    await verifiedUser("mallory");
    for (let i = 0; i < 10; i++)
      expect((await signIn("mallory", "Wrong-Password-But-Long")).status).toBe(401);
    expect((await signIn("mallory")).status).toBe(429);
    // the username form shares the account's count
    const byUsername = await call("/sign-in/username", {
      body: { username: "Mallory", password: PASSWORD },
    });
    expect(byUsername.status).toBe(429);
    // other accounts aren't affected
    await verifiedUser("nina");
    expect((await signIn("nina")).status).toBe(200);
  });

  it("rate limits resending the verification mail, per ip and per account", async () => {
    await signUp("oscar");
    const resend = (ip?: string) =>
      call("/send-verification-email", { body: { email: "oscar@example.com" }, ip });

    const ip = freshIp();
    for (let i = 0; i < 3; i++) expect((await resend(ip)).status).toBe(200);
    expect((await resend(ip)).status).toBe(429);

    // 3 above + 2 here from new ips = 5 for the account
    for (let i = 0; i < 2; i++) expect((await resend()).status).toBe(200);
    expect((await resend()).status).toBe(429);
  });

  it("refuses a banned user, and the ban ends their open sessions", async () => {
    const admin = await verifiedUser("peggy");
    await db.user.update({ where: { id: admin.user.id }, data: { role: "admin" } });
    const target = await verifiedUser("quentin");

    const ban = await call("/admin/ban-user", {
      body: { userId: target.user.id },
      cookie: admin.cookie,
    });
    expect(ban.status).toBe(200);
    expect(await sessionOf(target.cookie)).toBeNull();

    const res = await signIn("quentin");
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("BANNED_USER");
  });
});

describe("sessions", () => {
  it("lives in an httpOnly, sameSite=lax cookie", async () => {
    await verifiedUser("rupert");
    const line = sessionSetCookie(await signIn("rupert"))!;
    expect(line).toMatch(/;\s*HttpOnly/i);
    expect(line).toMatch(/;\s*SameSite=Lax/i);
    expect(line).toMatch(/;\s*Path=\//i);
  });

  it("is dead after sign out, server side, not only in the browser", async () => {
    const { user, cookie } = await verifiedUser("sybil");
    const res = await call("/sign-out", { body: {}, cookie });
    expect(res.status).toBe(200);
    expect(await sessionOf(cookie)).toBeNull();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("signs the other devices out on a password change, even when the request asks not to", async () => {
    const { user, cookie: laptop } = await verifiedUser("trent");
    const phone = sessionCookie(await signIn("trent"));

    const res = await call("/change-password", {
      body: {
        currentPassword: PASSWORD,
        newPassword: "Harbor-Meadow-Cobalt-71",
        revokeOtherSessions: false,
      },
      cookie: laptop,
    });
    expect(res.status).toBe(200);

    expect(await sessionOf(phone)).toBeNull();
    // the device that changed it stays signed in, on the fresh session it was given
    const current = sessionCookie(res);
    expect((await sessionOf(current))?.user.id).toBe(user.id);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);

    expect((await signIn("trent")).status).toBe(401);
    expect((await signIn("trent", "Harbor-Meadow-Cobalt-71")).status).toBe(200);
  });
});
