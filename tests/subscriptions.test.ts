/** #18: which services a user can use, the status the services page and /api/services show */

import { afterEach, describe, expect, it } from "vitest";

import type { ServiceDef } from "@/server/registry/define";
import { isUnlocked, serviceStatus } from "@/server/subscriptions";

const service = (auth: ServiceDef["auth"]): ServiceDef => ({
  id: "test",
  name: "Test",
  description: "",
  category: "utility",
  auth,
  key: auth === "api_key" ? { label: "Test key", helpUrl: "", env: "TEST_APP_KEY" } : undefined,
  widgets: [],
});

afterEach(() => {
  delete process.env.TEST_APP_KEY;
});

describe("serviceStatus", () => {
  it("opens keyless services to everyone", () => {
    expect(serviceStatus(service("none"), false)).toBe("ready");
  });

  it("runs a key service on the user's key first", () => {
    process.env.TEST_APP_KEY = "app";
    expect(serviceStatus(service("api_key"), true)).toBe("own_key");
  });

  it("falls back to the app key when the user has none", () => {
    process.env.TEST_APP_KEY = "app";
    expect(serviceStatus(service("api_key"), false)).toBe("ready");
  });

  it("locks a key service when neither exists", () => {
    const status = serviceStatus(service("api_key"), false);
    expect(status).toBe("missing_key");
    expect(isUnlocked(status)).toBe(false);
  });

  it("locks an oauth service until the account is linked", () => {
    expect(isUnlocked(serviceStatus(service("oauth"), false))).toBe(false);
    expect(serviceStatus(service("oauth"), true)).toBe("linked");
    expect(isUnlocked(serviceStatus(service("oauth"), true))).toBe(true);
  });
});
