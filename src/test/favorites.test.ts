import { describe, expect, it } from "vitest";
import { pushRecent, toggleId } from "@/lib/favorites";

describe("favorites", () => {
  it("toggles a channel on and off", () => {
    expect(toggleId([], "1")).toEqual(["1"]);
    expect(toggleId(["1", "2"], "1")).toEqual(["2"]);
  });
  it("keeps recently watched unique, newest first, max 12", () => {
    expect(pushRecent(["a", "b"], "b")).toEqual(["b", "a"]);
    const many = Array.from({ length: 12 }, (_, i) => String(i));
    expect(pushRecent(many, "x")).toHaveLength(12);
    expect(pushRecent(many, "x")[0]).toBe("x");
  });
});
