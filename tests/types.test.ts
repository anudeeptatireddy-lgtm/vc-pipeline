import { describe, expect, it } from "vitest";
import { ACTION_BUCKET, RECOMMENDED_ACTIONS } from "@/lib/types";

describe("recommended_action buckets", () => {
  it("maps every action to a bucket", () => {
    for (const action of Object.values(RECOMMENDED_ACTIONS)) {
      expect(ACTION_BUCKET[action]).toBeDefined();
    }
  });
});
