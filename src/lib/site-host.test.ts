import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  KIMCHI_PRODUCTION_ORIGIN,
  resolveAppUrl,
  resolveRequestOrigin,
} from "@/lib/site-host";

describe("resolveRequestOrigin", () => {
  it("prefers x-forwarded-host over request.url host", () => {
    const origin = resolveRequestOrigin({
      headers: new Headers({
        "x-forwarded-host": "kimchi.so",
        "x-forwarded-proto": "https",
        host: "kimchi-git-dev-second-ladder.vercel.app",
      }),
      url: "https://kimchi-git-dev-second-ladder.vercel.app/auth/callback",
    });
    expect(origin).toBe("https://kimchi.so");
  });
});

describe("resolveAppUrl", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it("uses request origin on kimchi.so when env points at dev staging", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://kimchi-git-dev-second-ladder.vercel.app";
    process.env.VERCEL_ENV = "production";

    const url = resolveAppUrl({
      headers: new Headers({
        "x-forwarded-host": "kimchi.so",
        "x-forwarded-proto": "https",
      }),
    });
    expect(url).toBe("https://kimchi.so");
  });

  it("ignores dev staging env on production deployment without request", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://kimchi-git-dev-second-ladder.vercel.app";
    process.env.VERCEL_ENV = "production";

    expect(resolveAppUrl()).toBe(KIMCHI_PRODUCTION_ORIGIN);
  });
});
