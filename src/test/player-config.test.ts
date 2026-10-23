import { describe, expect, it } from "vitest";
import { LIVE_EDGE_OFFSET, RESYNC_BEHIND_SECONDS, STARTUP_ABR, STARTUP_STREAMING, STEADY_STREAMING } from "@/lib/player-config";

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

  it("starts close to the live edge and re-syncs only when far behind", () => {
    expect(LIVE_EDGE_OFFSET).toBeGreaterThan(0);
    expect(LIVE_EDGE_OFFSET).toBeLessThanOrEqual(5);
    expect(RESYNC_BEHIND_SECONDS).toBeGreaterThan(LIVE_EDGE_OFFSET);
  });
});