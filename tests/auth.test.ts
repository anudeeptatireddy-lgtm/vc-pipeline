import { afterEach, describe, expect, it } from "vitest";
import { isCronAuthorized } from "@/lib/auth";

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("cron auth", () => {
  const req = (h?: string) => new Request("http://x/api/run-pipeline", { headers: h ? { authorization: h } : {} });
  it("rejects when no secret is configured", () => {
    expect(isCronAuthorized(req("Bearer "))).toBe(false);
  });
  it("accepts only the exact bearer token", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(isCronAuthorized(req("Bearer s3cret"))).toBe(true);
    expect(isCronAuthorized(req("Bearer wrong"))).toBe(false);
    expect(isCronAuthorized(req())).toBe(false);
  });
});
