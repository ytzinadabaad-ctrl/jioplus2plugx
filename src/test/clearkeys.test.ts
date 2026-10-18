import { describe, it, expect } from "vitest";
import { parseClearKeys } from "@/lib/channels";

describe("parseClearKeys", () => {
  it("parses a single pair", () => {
    expect(parseClearKeys("c6255706bca250079aeaf1fc4474d1b9:eab6217aac6f1feec103120e6218eb43")).toEqual({
      c6255706bca250079aeaf1fc4474d1b9: "eab6217aac6f1feec103120e6218eb43",
    });
  });
  it("parses all 5 pairs of a multi-key channel", () => {
    const s = "ae3d3b12ab0f5dada0f2423d1cc7b403:4577d96a74683b0c261cc5c0e30af011,911d8e8e9c645409b044dca3f5f82b45:c1fc9a8b91e4311d80eb6966ecd8647b,86cc5f899821572d824d4e5ada5ca90a:ef1e6497c816dbc95f7b42d7215707cd,2b0868c6e92b5d3490f688f8e75d9ebc:a1ef94ae152a30669ff77231763fc4f5,1b47214ae74557c1aed1b3678c565f94:f82bfec351105993a52ccb73cad1dd0c";
    const r = parseClearKeys(s);
    expect(Object.keys(r).length).toBe(5);
    expect(r["1b47214ae74557c1aed1b3678c565f94"]).toBe("f82bfec351105993a52ccb73cad1dd0c");
  });
  it("skips the all-zero key id", () => {
    expect(parseClearKeys("00000000000000000000000000000000:eab6217aac6f1feec103120e6218eb43")).toEqual({});
  });
});
