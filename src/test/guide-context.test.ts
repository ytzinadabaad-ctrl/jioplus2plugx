import { QueryClient } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { buildGuideContext } from "@/lib/guide-context";
import type { Channel } from "@/lib/channels";

const channels: Channel[] = [
  { id: "143", name: "Zee TV HD", group: "Entertainment", logo: "", type: "dash", mpd_url: "" },
];
const setup = () => {
  const qc = new QueryClient();
  const now = Date.now();
  const fetch = vi
    .spyOn(qc, "fetchQuery")
    .mockResolvedValue([
      { title: "Verified live show", start: now - 60000, end: now + 60000, genre: "Drama" },
    ]);
  return { qc, fetch };
};
it("includes the requested Zee TV schedule", async () => {
  const { qc } = setup();
  expect(await buildGuideContext(qc, channels, "what is currently live on zee tv", null)).toContain(
    "Zee TV HD [Entertainment] | NOW: Verified live show",
  );
});
it("does not inject new schedules into unrelated identity replies", async () => {
  const { qc, fetch } = setup();
  expect(
    await buildGuideContext(qc, channels, "bhai aap kaun ho", "143", [
      "what is currently live on zee tv",
    ]),
  ).toBe("");
  expect(fetch).not.toHaveBeenCalled();
});
it("keeps the named channel for a schedule follow-up", async () => {
  const { qc } = setup();
  expect(
    await buildGuideContext(qc, channels, "what is next?", null, [
      "what is currently live on zee tv",
    ]),
  ).toContain("Zee TV HD");
});
