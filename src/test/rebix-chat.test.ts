import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRebixUrl, requestRebixReply } from "@/lib/rebix-chat";

afterEach(() => vi.unstubAllGlobals());

describe("Rebix chat integration", () => {
  it("uses the requested Cohere endpoint with encoded chat, language and guide context", () => {
    const url = buildRebixUrl("Reply in Hindi. Zee TV NOW: Lakshmi Nivas", [
      { role: "assistant", content: "I'm Plugo" },
      { role: "user", content: "hii & अभी क्या चल रहा है?" },
    ]);
    expect(url.origin + url.pathname).toBe("https://api-rebix.vercel.app/api/cohere");
    expect([...url.searchParams.keys()]).toEqual(["q"]);
    expect(url.searchParams.get("q")).toContain("hii & अभी क्या चल रहा है?");
    expect(url.searchParams.get("q")).toContain("Reply in Hindi");
    expect(url.searchParams.get("q")).toContain("Zee TV NOW: Lakshmi Nivas");
    expect(url.searchParams.get("q")).toContain("I'm Plugo");
  });

  it("reads the API's status and message response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: true, message: "Hi there!" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestRebixReply("Plugo", [{ role: "user", content: "hii" }])).resolves.toBe("Hi there!");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([402, 403, 429])("preserves upstream %s failures without a paid fallback", async (status) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("unavailable", { status }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestRebixReply("Plugo", [{ role: "user", content: "hii" }])).rejects.toMatchObject({ status });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([{ status: false, message: "error" }, { status: true, message: "" }, null])("rejects invalid responses", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));
    await expect(requestRebixReply("Plugo", [{ role: "user", content: "hii" }])).rejects.toMatchObject({ status: 502 });
  });
});