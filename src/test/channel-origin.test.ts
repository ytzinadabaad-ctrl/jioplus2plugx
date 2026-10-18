import { expect, it } from "vitest";
import { assertChannelOrigin } from "@/lib/channel-origin";

it("allows the current project preview origin", () => {
  expect(() => assertChannelOrigin(new Request("http://localhost:8080", {
    headers: { referer: "https://e2c2a609-a5e8-45f6-8477-636f05809263.lovableproject.com/" },
  }))).not.toThrow();
});
it("rejects unrelated sites including unrelated Lovable apps", () => {
  expect(() => assertChannelOrigin(new Request("http://localhost:8080", {
    headers: { origin: "https://unrelated.lovable.app" },
  }))).toThrow("Forbidden");
});