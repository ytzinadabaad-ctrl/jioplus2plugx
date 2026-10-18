import { describe, expect, it } from "vitest";
import { STARTUP_ABR, STARTUP_STREAMING, STEADY_STREAMING } from "@/lib/player-config";

describe("quick playback configuration", () => {
  it("starts with a small cushion before switching to a resilient buffer", () => {
    expect(STARTUP_STREAMING.rebufferingGoal).toBe(1);
    expect(STEADY_STREAMING.rebufferingGoal).toBe(4);
    expect(STEADY_STREAMING.bufferingGoal).toBeGreaterThan(STARTUP_STREAMING.bufferingGoal);
  });

  it("starts conservatively while allowing automatic quality upgrades", () => {
    expect(STARTUP_ABR.defaultBandwidthEstimate).toBe(750_000);
    expect(STARTUP_ABR.enabled).toBe(true);
    expect(STARTUP_STREAMING.segmentPrefetchLimit).toBe(1);
  });
});